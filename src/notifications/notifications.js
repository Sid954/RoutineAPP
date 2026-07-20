import { Storage } from '../storage/storage.js';
import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { NotificationLog } from './notification-log.js';
import { getOverrideFor } from '../announcements/overrides.js';
import { format12h, formatRoom, toMinutes, getCurrentMinutes } from '../core/utils.js';
import { showToast } from '../toast/toast.js';

// NativePush circular dep fix: NativePush registers itself via setNativePush()
export let _nativePush = null;
export function setNativePush(np) { _nativePush = np; }

export const Notifications = {
  timeouts: [],

  isSupported() {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) return true;
    return 'Notification' in window;
  },

  async getPermission() {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        const status = await LocalNotifications.checkPermissions();
        return status.display;
      } catch (e) {
        return 'denied';
      }
    }
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  },

  async requestPermission() {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        const status = await LocalNotifications.requestPermissions();
        await this.updatePermissionUI();
        return status.display === 'granted';
      } catch (e) {
        return false;
      }
    }
    if (!this.isSupported()) return false;
    const result = await Notification.requestPermission();
    await this.updatePermissionUI();
    return result === 'granted';
  },

  async updatePermissionUI() {
    const perm = await this.getPermission();
    const labels = { granted: 'Granted ✓', denied: 'Blocked by browser', default: 'Not yet requested', prompt: 'Not yet requested', unsupported: 'Not supported' };
    DOM.notifPermStatus.textContent = labels[perm] || perm;
    DOM.notifPermStatus.style.color = perm === 'granted' ? '#10b981' : perm === 'denied' ? '#f43f5e' : '';
  },

  async scheduleForToday() {
    await this.cancelAll();
    const settings = Storage.getNotifSettings();
    if (!settings.enabled) return;

    const hasPerm = (await this.getPermission()) === 'granted';
    if (!hasPerm) return;

    const todayIdx = new Date().getDay();
    const classes = State.schedule[todayIdx] || [];
    const now = getCurrentMinutes();
    const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

    // Check holiday override
    const holidayOverride = getOverrideFor(todayIdx);
    const isHoliday = holidayOverride && holidayOverride.type === 'holiday';

    if (isNative) {
      const { LocalNotifications } = window.Capacitor.Plugins;
      const nativeNotifs = [];
      let notifId = 100;

      // ── Morning Briefing ──
      if (settings.briefingEnabled !== false) {
        const briefingMins = settings.briefingTime || 450;
        if (briefingMins > now) {
          const briefDate = new Date();
          briefDate.setHours(Math.floor(briefingMins / 60), briefingMins % 60, 0, 0);

          let briefBody;
          if (isHoliday) {
            briefBody = `No classes today! ${holidayOverride.announcement.title} 🎉`;
          } else if (!classes.length) {
            briefBody = 'No classes scheduled today. Enjoy your day off! 🎉';
          } else {
            const first = classes[0];
            let cancelCount = 0;
            classes.forEach(c => { if (getOverrideFor(todayIdx, c.title)) cancelCount++; });
            const activeCount = classes.length - cancelCount;
            briefBody = `You have ${activeCount} class${activeCount !== 1 ? 'es' : ''} today.`;
            if (cancelCount > 0) briefBody += ` (${cancelCount} cancelled)`;
            briefBody += ` First up: ${first.title} at ${format12h(first.start)} in Room ${formatRoom(first.room)}`;
          }

          nativeNotifs.push({
            title: '☀️ Good Morning! Today\'s Schedule',
            body: briefBody,
            id: notifId++,
            schedule: { at: briefDate },
            smallIcon: 'ic_stat_icon',
            iconColor: '#fbbf24'
          });
          NotificationLog.add({ type: 'morning_briefing', title: '☀️ Good Morning! Today\'s Schedule', body: briefBody });
        }
      }

      if (!isHoliday) {
        classes.forEach((cls) => {
          const startMins = toMinutes(cls.start);
          const endMins = toMinutes(cls.end);
          const cancelOverride = getOverrideFor(todayIdx, cls.title);
          if (cancelOverride) return; // Skip cancelled classes

          // ── Pre-class Reminder ──
          const alertMins = startMins - settings.leadTime;
          if (alertMins > now) {
            const alertDate = new Date();
            alertDate.setHours(Math.floor(alertMins / 60), alertMins % 60, 0, 0);
            const titleText = `⏰ ${cls.title} in ${settings.leadTime} min`;
            const bodyText = `Room ${formatRoom(cls.room)} · ${cls.instructor || ''} · ${format12h(cls.start)} – ${format12h(cls.end)}`;
            nativeNotifs.push({
              title: titleText,
              body: bodyText,
              id: notifId++,
              schedule: { at: alertDate },
              smallIcon: 'ic_stat_icon',
              iconColor: '#38bdf8'
            });
            NotificationLog.add({ type: 'reminder', title: titleText, body: bodyText });
          }

          // ── Class Starting Now ──
          if (startMins > now) {
            const startDate = new Date();
            startDate.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
            const titleText = `📚 ${cls.title} starting now!`;
            const bodyText = `Head to Room ${formatRoom(cls.room)}${cls.instructor ? ` · Instructor: ${cls.instructor}` : ''}`;
            nativeNotifs.push({
              title: titleText,
              body: bodyText,
              id: notifId++,
              schedule: { at: startDate },
              smallIcon: 'ic_stat_icon',
              iconColor: '#10b981'
            });
            NotificationLog.add({ type: 'class_start', title: titleText, body: bodyText });
          }

          // ── Class Ending Soon (5 min before end) ──
          if (settings.classEndEnabled) {
            const endAlertMins = endMins - 5;
            if (endAlertMins > now) {
              const endAlertDate = new Date();
              endAlertDate.setHours(Math.floor(endAlertMins / 60), endAlertMins % 60, 0, 0);

              let nextClassInfo = 'Free time after this!';
              const remaining = classes.filter(c => toMinutes(c.start) >= endMins && !getOverrideFor(todayIdx, c.title));
              if (remaining.length) {
                nextClassInfo = `Next up: ${remaining[0].title} at ${format12h(remaining[0].start)}`;
              }

              const titleText = `⌛ ${cls.title} ending in 5 min`;
              nativeNotifs.push({
                title: titleText,
                body: nextClassInfo,
                id: notifId++,
                schedule: { at: endAlertDate },
                smallIcon: 'ic_stat_icon',
                iconColor: '#a78bfa'
              });
              NotificationLog.add({ type: 'class_end', title: titleText, body: nextClassInfo });
            }
          }
        });

        // ── Day Complete ──
        if (settings.dayDoneEnabled !== false && classes.length > 0) {
          const activeClasses = classes.filter(c => !getOverrideFor(todayIdx, c.title));
          if (activeClasses.length > 0) {
            const lastClass = activeClasses[activeClasses.length - 1];
            const lastEndMins = toMinutes(lastClass.end);
            if (lastEndMins > now) {
              const doneDate = new Date();
              doneDate.setHours(Math.floor(lastEndMins / 60), lastEndMins % 60, 0, 0);
              const titleText = '🎉 All classes done for today!';
              const bodyText = `Great job! You completed ${activeClasses.length} class${activeClasses.length !== 1 ? 'es' : ''} today.`;
              nativeNotifs.push({
                title: titleText,
                body: bodyText,
                id: notifId++,
                schedule: { at: doneDate },
                smallIcon: 'ic_stat_icon',
                iconColor: '#34d399'
              });
              NotificationLog.add({ type: 'day_done', title: titleText, body: bodyText });
            }
          }
        }
      }

      if (nativeNotifs.length) {
        try {
          await LocalNotifications.schedule({ notifications: nativeNotifs });
        } catch (e) {
          console.error('Failed to schedule native alarms:', e);
        }
      }
    } else {
      // ── Web Browser Notifications ──

      // Morning Briefing
      if (settings.briefingEnabled !== false) {
        const briefingMins = settings.briefingTime || 450;
        if (briefingMins > now) {
          const delay = (briefingMins - now) * 60000;
          this.timeouts.push(setTimeout(() => {
            let briefBody;
            if (isHoliday) {
              briefBody = `No classes today! ${holidayOverride.announcement.title} 🎉`;
            } else if (!classes.length) {
              briefBody = 'No classes scheduled today. Enjoy your day off! 🎉';
            } else {
              const first = classes[0];
              briefBody = `You have ${classes.length} class${classes.length !== 1 ? 'es' : ''} today. First up: ${first.title} at ${format12h(first.start)} in Room ${formatRoom(first.room)}`;
            }
            const title = '☀️ Good Morning! Today\'s Schedule';
            this.show(title, briefBody);
            NotificationLog.add({ type: 'morning_briefing', title, body: briefBody });
          }, delay));
        }
      }

      if (!isHoliday) {
        classes.forEach((cls) => {
          const startMins = toMinutes(cls.start);
          const endMins = toMinutes(cls.end);
          const cancelOverride = getOverrideFor(todayIdx, cls.title);
          if (cancelOverride) return;

          // Pre-class Reminder
          const alertMins = startMins - settings.leadTime;
          if (alertMins > now) {
            const delay = (alertMins - now) * 60000;
            this.timeouts.push(setTimeout(() => {
              const title = `⏰ ${cls.title} in ${settings.leadTime} min`;
              const body = `Room ${formatRoom(cls.room)} · ${cls.instructor || ''} · ${format12h(cls.start)} – ${format12h(cls.end)}`;
              this.show(title, body);
              NotificationLog.add({ type: 'reminder', title, body });
            }, delay));
          }

          // Class Starting Now
          if (startMins > now) {
            const delay = (startMins - now) * 60000;
            this.timeouts.push(setTimeout(() => {
              const title = `📚 ${cls.title} starting now!`;
              const body = `Head to Room ${formatRoom(cls.room)}${cls.instructor ? ` · Instructor: ${cls.instructor}` : ''}`;
              this.show(title, body);
              NotificationLog.add({ type: 'class_start', title, body });
            }, delay));
          }

          // Class Ending Soon
          if (settings.classEndEnabled) {
            const endAlertMins = endMins - 5;
            if (endAlertMins > now) {
              const delay = (endAlertMins - now) * 60000;
              this.timeouts.push(setTimeout(() => {
                let nextInfo = 'Free time after this!';
                const remaining = classes.filter(c => toMinutes(c.start) >= endMins && !getOverrideFor(todayIdx, c.title));
                if (remaining.length) nextInfo = `Next up: ${remaining[0].title} at ${format12h(remaining[0].start)}`;
                const title = `⌛ ${cls.title} ending in 5 min`;
                this.show(title, nextInfo);
                NotificationLog.add({ type: 'class_end', title, body: nextInfo });
              }, delay));
            }
          }
        });

        // Day Complete
        if (settings.dayDoneEnabled !== false && classes.length > 0) {
          const activeClasses = classes.filter(c => !getOverrideFor(todayIdx, c.title));
          if (activeClasses.length > 0) {
            const lastClass = activeClasses[activeClasses.length - 1];
            const lastEndMins = toMinutes(lastClass.end);
            if (lastEndMins > now) {
              const delay = (lastEndMins - now) * 60000;
              this.timeouts.push(setTimeout(() => {
                const title = '🎉 All classes done for today!';
                const body = `Great job! You completed ${activeClasses.length} class${activeClasses.length !== 1 ? 'es' : ''} today.`;
                this.show(title, body);
                NotificationLog.add({ type: 'day_done', title, body });
              }, delay));
            }
          }
        }
      }
    }
  },

  async cancelAll() {
    this.timeouts.forEach(t => clearTimeout(t));
    this.timeouts = [];

    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length) {
          await LocalNotifications.cancel(pending);
        }
      } catch (e) {
        console.error('Failed to cancel native alarms:', e);
      }
    }
  },

  show(title, body) {
    if (!this.isSupported() || Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        tag: `routine-${Date.now()}`,
        requireInteraction: false
      });
    } catch {}
  },

  async showInstant(title, body, type = 'general') {
    const hasPerm = (await this.getPermission()) === 'granted';
    if (!hasPerm) return;

    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        await LocalNotifications.schedule({
          notifications: [{
            title,
            body,
            id: Math.floor(Math.random() * 1000000),
            smallIcon: 'ic_stat_icon',
            iconColor: type === 'class_test' ? '#f97316' : (type === 'online_class' ? '#10b981' : (type === 'cancellation' ? '#f43f5e' : '#38bdf8'))
          }]
        });
      } catch (e) {
        console.error('Failed to trigger native notification:', e);
      }
    } else {
      this.show(title, body);
    }
    NotificationLog.add({ type, title, body });
  },

  async maybeShowBanner() {
    if (!this.isSupported()) return;
    const perm = await this.getPermission();
    if (perm !== 'default' && perm !== 'prompt') return;
    if (Storage.isBannerDismissed(Storage.BANNER_DISMISS_KEY)) return;
    DOM.notifBanner.classList.add('show');
  },

  async init() {
    await this.updatePermissionUI();
    const settings = Storage.getNotifSettings();
    DOM.notifToggle.checked = settings.enabled;
    DOM.notifLeadTime.value = settings.leadTime;
    DOM.notifBriefingToggle.checked = settings.briefingEnabled !== false;
    DOM.notifBriefingTime.value = settings.briefingTime || 450;
    DOM.notifClassEndToggle.checked = !!settings.classEndEnabled;
    DOM.notifDayDoneToggle.checked = settings.dayDoneEnabled !== false;

    if (settings.enabled) {
      await this.scheduleForToday();
      if (_nativePush && _nativePush.isSupported()) {
        _nativePush.init();
      }
    }
    await this.maybeShowBanner();
  },

  initEvents() {
    DOM.notifToggle.addEventListener('change', async () => {
      const settings = Storage.getNotifSettings();
      settings.enabled = DOM.notifToggle.checked;

      if (settings.enabled) {
        const granted = await Notifications.requestPermission();
        if (!granted) {
          DOM.notifToggle.checked = false;
          settings.enabled = false;
          showToast('Notification permission denied by browser.', 'error');
        } else {
          showToast('Notifications enabled!', 'success');
          if (_nativePush && _nativePush.isSupported()) {
            _nativePush.init();
          }
        }
      } else {
        Notifications.cancelAll();
        showToast('Notifications disabled', 'info');
      }

      Storage.saveNotifSettings(settings);
      Notifications.scheduleForToday();
      Notifications.updatePermissionUI();
    });

    DOM.notifLeadTime.addEventListener('change', () => {
      const settings = Storage.getNotifSettings();
      settings.leadTime = parseInt(DOM.notifLeadTime.value);
      Storage.saveNotifSettings(settings);
      Notifications.scheduleForToday();
      showToast(`Alert time: ${settings.leadTime} min before class`, 'info');
    });

    DOM.notifBriefingToggle.addEventListener('change', () => {
      const settings = Storage.getNotifSettings();
      settings.briefingEnabled = DOM.notifBriefingToggle.checked;
      Storage.saveNotifSettings(settings);
      Notifications.scheduleForToday();
      showToast(settings.briefingEnabled ? 'Morning briefing enabled' : 'Morning briefing disabled', 'info');
    });

    DOM.notifBriefingTime.addEventListener('change', () => {
      const settings = Storage.getNotifSettings();
      settings.briefingTime = parseInt(DOM.notifBriefingTime.value);
      Storage.saveNotifSettings(settings);
      Notifications.scheduleForToday();
      const h = Math.floor(settings.briefingTime / 60);
      const m = settings.briefingTime % 60;
      showToast(`Briefing time set to ${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`, 'info');
    });

    DOM.notifClassEndToggle.addEventListener('change', () => {
      const settings = Storage.getNotifSettings();
      settings.classEndEnabled = DOM.notifClassEndToggle.checked;
      Storage.saveNotifSettings(settings);
      Notifications.scheduleForToday();
      showToast(settings.classEndEnabled ? 'Class end alerts enabled' : 'Class end alerts disabled', 'info');
    });

    DOM.notifDayDoneToggle.addEventListener('change', () => {
      const settings = Storage.getNotifSettings();
      settings.dayDoneEnabled = DOM.notifDayDoneToggle.checked;
      Storage.saveNotifSettings(settings);
      Notifications.scheduleForToday();
      showToast(settings.dayDoneEnabled ? 'Day complete alerts enabled' : 'Day complete alerts disabled', 'info');
    });
  }
};
