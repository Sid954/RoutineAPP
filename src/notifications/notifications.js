import { Storage } from '../storage/storage.js';
import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { showToast } from '../toast/toast.js';
import { NotificationLog } from './notification-log.js';
import { getOverrideFor } from '../announcements/overrides.js';
import { format12h, formatRoom, toMinutes } from '../core/utils.js';

export let _nativePush = null;
export function setNativePush(np) { _nativePush = np; }

function isCancelledClass(todayIdx, subjectTitle) {
  const ov = getOverrideFor(todayIdx, subjectTitle);
  return ov && ov.type === 'cancellation';
}

function buildReminderPayload(cls, settings, todayIdx) {
  const cancelOverride = getOverrideFor(todayIdx, cls.title);
  const isOnline = cancelOverride && cancelOverride.type === 'online_class';
  const isExam = cls.isExam || (cancelOverride && cancelOverride.type === 'class_test');

  let titleText = `⏰ CLASS IN ${settings.leadTime} MIN: ${cls.title}`;
  let iconColor = '#38bdf8';

  if (isExam) {
    titleText = `📝 EXAM TODAY IN ${settings.leadTime} MIN: ${cls.title}`;
    iconColor = '#f97316';
  } else if (isOnline) {
    titleText = `📡 ONLINE CLASS IN ${settings.leadTime} MIN: ${cls.title}`;
    iconColor = '#10b981';
  }

  let bodyText = `📍 Location: ${isOnline ? 'Online Class' : `Room ${formatRoom(cls.room)}`}`;
  if (cls.instructor) bodyText += ` · 👤 ${cls.instructor}`;
  bodyText += `\n⏰ Timing: ${format12h(cls.start)} – ${format12h(cls.end)}`;

  if (isExam) {
    let topics = cls.examTopics || '';
    if (!topics && cancelOverride && cancelOverride.announcement && cancelOverride.announcement.announcement) {
      try {
        const parsed = JSON.parse(cancelOverride.announcement.announcement);
        topics = parsed.topics || 'Not Specified';
      } catch (e) {}
    }
    if (topics) bodyText += `\n📚 Syllabus: ${topics}`;
  } else if (isOnline) {
    let link = '';
    if (cancelOverride && cancelOverride.announcement && cancelOverride.announcement.announcement) {
      try {
        const parsed = JSON.parse(cancelOverride.announcement.announcement);
        link = parsed.platform || '';
      } catch (e) {}
    }
    if (link) bodyText += `\n📡 Link: ${link}`;
  }

  return { title: titleText, body: bodyText, iconColor, isExam, isOnline };
}

function buildClassStartPayload(cls, todayIdx) {
  const cancelOverride = getOverrideFor(todayIdx, cls.title);
  const isOnline = cancelOverride && cancelOverride.type === 'online_class';
  const isExam = cls.isExam || (cancelOverride && cancelOverride.type === 'class_test');

  let titleText = `📚 STARTING NOW: ${cls.title}`;
  let iconColor = '#10b981';

  if (isExam) {
    titleText = `📝 EXAM STARTING NOW: ${cls.title}`;
    iconColor = '#f97316';
  } else if (isOnline) {
    titleText = `📡 LIVE ONLINE CLASS: ${cls.title}`;
    iconColor = '#10b981';
  }

  let bodyText = isOnline
    ? `📡 Virtual class is now live!\n⏰ ${format12h(cls.start)} – ${format12h(cls.end)}`
    : `📍 Head to Room ${formatRoom(cls.room)} right now!\n👤 Instructor: ${cls.instructor || 'TBA'} · ⏰ ${format12h(cls.start)} – ${format12h(cls.end)}`;

  return { title: titleText, body: bodyText, iconColor };
}

function buildBriefingPayload(classes, isHoliday, holidayOverride, todayIdx) {
  const sec = Storage.getSection().toUpperCase();
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const titleText = `🌅 Morning Briefing — Section ${sec} (${dateStr})`;
  let iconColor = '#fbbf24';

  if (isHoliday) {
    return {
      title: `🎉 Holiday Today — Section ${sec}`,
      body: `Enjoy your day off! ${holidayOverride.announcement.title}`,
      iconColor: '#fb923c'
    };
  }

  const activeClasses = classes.filter(c => !isCancelledClass(todayIdx, c.title));

  if (!activeClasses.length) {
    return {
      title: titleText,
      body: '🎉 No classes scheduled for today. Enjoy your free day!',
      iconColor
    };
  }

  let bodyText = `📊 ${activeClasses.length} Class${activeClasses.length !== 1 ? 'es' : ''} Scheduled Today:\n`;
  activeClasses.forEach(c => {
    const cancelOverride = getOverrideFor(todayIdx, c.title);
    const isOnline = cancelOverride && cancelOverride.type === 'online_class';
    const isExam = c.isExam || (cancelOverride && cancelOverride.type === 'class_test');

    const typeTag = isExam ? '📝 Exam' : isOnline ? '📡 Online' : `Room ${formatRoom(c.room)}`;
    const instStr = c.instructor ? ` · ${c.instructor}` : '';
    bodyText += `\n• ${format12h(c.start)} – ${format12h(c.end)}: ${c.title} (${typeTag}${instStr})`;
  });

  return { title: titleText, body: bodyText, iconColor };
}

export const Notifications = {
  timeouts: [],

  isSupported() {
    return typeof Notification !== 'undefined';
  },

  async getPermission() {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        const status = await LocalNotifications.checkPermissions();
        return status.display === 'granted' ? 'granted' : (status.display === 'denied' ? 'denied' : 'prompt');
      } catch (e) {
        return 'unsupported';
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
    const badges = {
      granted: { label: '🟢 Granted', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
      denied: { label: '🔴 Blocked', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
      default: { label: '🟡 Not Prompted', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
      prompt: { label: '🟡 Not Prompted', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
      unsupported: { label: '⚠️ Not Supported', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
    };
    const bMeta = badges[perm] || { label: perm, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' };
    if (DOM.notifPermStatus) {
      DOM.notifPermStatus.textContent = bMeta.label;
      DOM.notifPermStatus.style.color = bMeta.color;
      DOM.notifPermStatus.style.background = bMeta.bg;
      DOM.notifPermStatus.style.border = `1px solid ${bMeta.color}40`;
    }
  },

  _lastScheduleTime: 0,

  async scheduleForToday(force = false) {
    try {
      const nowTs = Date.now();
      if (!force && nowTs - this._lastScheduleTime < 5000) {
        return;
      }
      this._lastScheduleTime = nowTs;

      const settings = Storage.getNotifSettings();
      if (!settings.enabled) {
        await this.cancelAll();
        return;
      }

      await this.cancelAll();

      const todayIdx = new Date().getDay();
      const classes = State.schedule[todayIdx] || [];
      const now = new Date().getHours() * 60 + new Date().getMinutes();
      const holidayOverride = getOverrideFor(todayIdx);
      const isHoliday = holidayOverride && holidayOverride.type === 'holiday';

      // ── Capacitor Native Platform Scheduling ──
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        const { LocalNotifications } = window.Capacitor.Plugins;
        if (!LocalNotifications) return;

        const nativeNotifs = [];
        let notifId = 100;

        // Morning Briefing
        if (settings.briefingEnabled !== false) {
          const briefingMins = settings.briefingTime || 450;
          if (briefingMins > now) {
            const briefDate = new Date();
            briefDate.setHours(Math.floor(briefingMins / 60), briefingMins % 60, 0, 0);

            const brief = buildBriefingPayload(classes, isHoliday, holidayOverride, todayIdx);

            nativeNotifs.push({
              title: brief.title,
              body: brief.body,
              largeBody: brief.body,
              summaryText: `Section ${Storage.getSection().toUpperCase()} Timetable`,
              id: notifId++,
              schedule: { at: briefDate, allowWhileIdle: true },
              iconColor: brief.iconColor
            });
          }
        }

        if (!isHoliday) {
          classes.forEach((cls) => {
            const startMins = toMinutes(cls.start);
            const endMins = toMinutes(cls.end);
            if (isCancelledClass(todayIdx, cls.title)) return;

            // Pre-class / Pre-exam Reminder
            const alertMins = startMins - settings.leadTime;
            if (alertMins > now) {
              const alertDate = new Date();
              alertDate.setHours(Math.floor(alertMins / 60), alertMins % 60, 0, 0);
              const payload = buildReminderPayload(cls, settings, todayIdx);

              nativeNotifs.push({
                title: payload.title,
                body: payload.body,
                largeBody: payload.body,
                id: notifId++,
                schedule: { at: alertDate, allowWhileIdle: true },
                iconColor: payload.iconColor
              });
            }

            // Class Starting Now
            if (startMins > now) {
              const startDate = new Date();
              startDate.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
              const payload = buildClassStartPayload(cls, todayIdx);

              nativeNotifs.push({
                title: payload.title,
                body: payload.body,
                largeBody: payload.body,
                id: notifId++,
                schedule: { at: startDate, allowWhileIdle: true },
                iconColor: payload.iconColor
              });
            }

            // Class Ending Soon
            if (settings.classEndEnabled) {
              const endAlertMins = endMins - 5;
              if (endAlertMins > now) {
                const endAlertDate = new Date();
                endAlertDate.setHours(Math.floor(endAlertMins / 60), endAlertMins % 60, 0, 0);

                let nextClassInfo = 'Free time after this!';
                const remaining = classes.filter(c => toMinutes(c.start) >= endMins && !isCancelledClass(todayIdx, c.title));
                if (remaining.length) {
                  nextClassInfo = `Next up: ${remaining[0].title} at ${format12h(remaining[0].start)} in Room ${formatRoom(remaining[0].room)}`;
                }

                const titleText = `⌛ 5 MIN REMAINING: ${cls.title}`;
                nativeNotifs.push({
                  title: titleText,
                  body: nextClassInfo,
                  largeBody: nextClassInfo,
                  id: notifId++,
                  schedule: { at: endAlertDate, allowWhileIdle: true },
                  iconColor: '#a78bfa'
                });
              }
            }
          });

          // Day Complete
          if (settings.dayDoneEnabled !== false && classes.length > 0) {
            const activeClasses = classes.filter(c => !isCancelledClass(todayIdx, c.title));
            if (activeClasses.length > 0) {
              const lastClass = activeClasses[activeClasses.length - 1];
              const lastEndMins = toMinutes(lastClass.end);
              if (lastEndMins > now) {
                const doneDate = new Date();
                doneDate.setHours(Math.floor(lastEndMins / 60), lastEndMins % 60, 0, 0);
                const titleText = '🎉 ALL CLASSES COMPLETED FOR TODAY!';
                const bodyText = `Great job! You finished all ${activeClasses.length} class${activeClasses.length !== 1 ? 'es' : ''} today. Time to relax! ☕`;
                nativeNotifs.push({
                  title: titleText,
                  body: bodyText,
                  largeBody: bodyText,
                  id: notifId++,
                  schedule: { at: doneDate, allowWhileIdle: true },
                  iconColor: '#34d399'
                });
              }
            }
          }
        }

        if (nativeNotifs.length) {
          try {
            await LocalNotifications.schedule({ notifications: nativeNotifs });
          } catch (e) {
            const safeNotifs = nativeNotifs.map(n => ({
              title: n.title,
              body: n.body,
              largeBody: n.largeBody,
              id: n.id,
              schedule: { at: n.schedule.at },
              iconColor: n.iconColor
            }));
            try {
              await LocalNotifications.schedule({ notifications: safeNotifs });
            } catch (e2) {}
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
              const brief = buildBriefingPayload(classes, isHoliday, holidayOverride, todayIdx);
              this.show(brief.title, brief.body);
              NotificationLog.add({ type: 'morning_briefing', title: brief.title, body: brief.body });
            }, delay));
          }
        }

        if (!isHoliday) {
          classes.forEach((cls) => {
            const startMins = toMinutes(cls.start);
            const endMins = toMinutes(cls.end);
            if (isCancelledClass(todayIdx, cls.title)) return;

            // Pre-class / Pre-exam Reminder
            const alertMins = startMins - settings.leadTime;
            if (alertMins > now) {
              const delay = (alertMins - now) * 60000;
              this.timeouts.push(setTimeout(() => {
                const payload = buildReminderPayload(cls, settings, todayIdx);
                this.show(payload.title, payload.body);
                NotificationLog.add({ type: payload.isExam ? 'class_test' : (payload.isOnline ? 'online_class' : 'reminder'), title: payload.title, body: payload.body });
              }, delay));
            }

            // Class / Exam Starting Now
            if (startMins > now) {
              const delay = (startMins - now) * 60000;
              this.timeouts.push(setTimeout(() => {
                const payload = buildClassStartPayload(cls, todayIdx);
                this.show(payload.title, payload.body);
                NotificationLog.add({ type: 'class_start', title: payload.title, body: payload.body });
              }, delay));
            }

            // Class Ending Soon
            if (settings.classEndEnabled) {
              const endAlertMins = endMins - 5;
              if (endAlertMins > now) {
                const delay = (endAlertMins - now) * 60000;
                this.timeouts.push(setTimeout(() => {
                  let nextInfo = 'Free time after this!';
                  const remaining = classes.filter(c => toMinutes(c.start) >= endMins && !isCancelledClass(todayIdx, c.title));
                  if (remaining.length) nextInfo = `Next up: ${remaining[0].title} at ${format12h(remaining[0].start)} in Room ${formatRoom(remaining[0].room)}`;
                  const title = `⌛ 5 MIN REMAINING: ${cls.title}`;
                  this.show(title, nextInfo);
                  NotificationLog.add({ type: 'class_end', title, body: nextInfo });
                }, delay));
              }
            }
          });

          // Day Complete
          if (settings.dayDoneEnabled !== false && classes.length > 0) {
            const activeClasses = classes.filter(c => !isCancelledClass(todayIdx, c.title));
            if (activeClasses.length > 0) {
              const lastClass = activeClasses[activeClasses.length - 1];
              const lastEndMins = toMinutes(lastClass.end);
              if (lastEndMins > now) {
                const delay = (lastEndMins - now) * 60000;
                this.timeouts.push(setTimeout(() => {
                  const title = '🎉 ALL CLASSES COMPLETED FOR TODAY!';
                  const body = `Great job! You finished all ${activeClasses.length} class${activeClasses.length !== 1 ? 'es' : ''} today. Time to relax! ☕`;
                  this.show(title, body);
                  NotificationLog.add({ type: 'day_done', title, body });
                }, delay));
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('scheduleForToday failed:', e);
    }
  },

  async cancelAll() {
    this.timeouts.forEach(t => clearTimeout(t));
    this.timeouts = [];

    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        if (LocalNotifications) {
          const pending = await LocalNotifications.getPending();
          if (pending && pending.notifications && pending.notifications.length) {
            await LocalNotifications.cancel({
              notifications: pending.notifications.map(n => ({ id: n.id }))
            });
          }
        }
      } catch (e) {
        console.warn('Failed to cancel native alarms:', e);
      }
    }
  },

  show(title, body) {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
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
        if (LocalNotifications) {
          await LocalNotifications.schedule({
            notifications: [{
              title,
              body,
              largeBody: body,
              summaryText: type === 'morning_briefing' ? `Section ${Storage.getSection().toUpperCase()} Timetable` : '',
              id: Math.floor(Math.random() * 1000000),
              iconColor: type === 'class_test' ? '#f97316' : (type === 'online_class' ? '#10b981' : (type === 'cancellation' ? '#f43f5e' : '#38bdf8'))
            }]
          });
        }
      } catch (e) {
        console.warn('Failed to trigger native notification:', e);
      }
    } else {
      this.show(title, body);
    }
    NotificationLog.add({ type, title, body });
  },

  async maybeShowBanner() {
    try {
      if (!this.isSupported()) return;
      const perm = await this.getPermission();
      if (perm !== 'default' && perm !== 'prompt') return;
      if (Storage.isBannerDismissed(Storage.BANNER_DISMISS_KEY)) return;
      if (DOM.notifBanner) DOM.notifBanner.classList.add('show');
    } catch (e) {}
  },

  async init() {
    try {
      await this.updatePermissionUI();
      const settings = Storage.getNotifSettings();
      if (settings.enabled) {
        this.scheduleForToday(true);
      }
    } catch (e) {
      console.warn('Notifications.init error:', e);
    }
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
      Notifications.scheduleForToday(true);
      Notifications.updatePermissionUI();
    });

    DOM.notifLeadTime.addEventListener('change', () => {
      const settings = Storage.getNotifSettings();
      settings.leadTime = parseInt(DOM.notifLeadTime.value);
      Storage.saveNotifSettings(settings);
      Notifications.scheduleForToday(true);
      showToast(`Alert time: ${settings.leadTime} min before class`, 'info');
    });

    DOM.notifBriefingToggle.addEventListener('change', () => {
      const settings = Storage.getNotifSettings();
      settings.briefingEnabled = DOM.notifBriefingToggle.checked;
      Storage.saveNotifSettings(settings);
      Notifications.scheduleForToday(true);
      showToast(settings.briefingEnabled ? 'Morning briefing enabled' : 'Morning briefing disabled', 'info');
    });

    DOM.notifBriefingTime.addEventListener('change', () => {
      const settings = Storage.getNotifSettings();
      settings.briefingTime = parseInt(DOM.notifBriefingTime.value);
      Storage.saveNotifSettings(settings);
      Notifications.scheduleForToday(true);
      const h = Math.floor(settings.briefingTime / 60);
      const m = settings.briefingTime % 60;
      showToast(`Briefing time set to ${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`, 'info');
    });

    if (DOM.testBriefingBtn) {
      DOM.testBriefingBtn.addEventListener('click', async () => {
        const todayIdx = new Date().getDay();
        const classes = State.schedule[todayIdx] || [];
        const holidayOverride = getOverrideFor(todayIdx);
        const isHoliday = holidayOverride && holidayOverride.type === 'holiday';

        const brief = buildBriefingPayload(classes, isHoliday, holidayOverride, todayIdx);
        await Notifications.showInstant(brief.title, brief.body, 'morning_briefing');
        showToast('Morning briefing test notification sent!', 'success');
      });
    }

    DOM.notifClassEndToggle.addEventListener('change', () => {
      const settings = Storage.getNotifSettings();
      settings.classEndEnabled = DOM.notifClassEndToggle.checked;
      Storage.saveNotifSettings(settings);
      Notifications.scheduleForToday(true);
      showToast(settings.classEndEnabled ? 'Class end alerts enabled' : 'Class end alerts disabled', 'info');
    });

    DOM.notifDayDoneToggle.addEventListener('change', () => {
      const settings = Storage.getNotifSettings();
      settings.dayDoneEnabled = DOM.notifDayDoneToggle.checked;
      Storage.saveNotifSettings(settings);
      Notifications.scheduleForToday(true);
      showToast(settings.dayDoneEnabled ? 'Day complete alerts enabled' : 'Day complete alerts disabled', 'info');
    });
  }
};
