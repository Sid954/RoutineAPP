import { Storage } from '../storage/storage.js';
import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { showToast } from '../toast/toast.js';
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

      if (isHoliday) return;

      // ── Capacitor Native Platform Scheduling ──
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        const { LocalNotifications } = window.Capacitor.Plugins;
        if (!LocalNotifications) return;

        const nativeNotifs = [];
        let notifId = 100;

        classes.forEach((cls) => {
          const startMins = toMinutes(cls.start);
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
        });

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
        classes.forEach((cls) => {
          const startMins = toMinutes(cls.start);
          if (isCancelledClass(todayIdx, cls.title)) return;

          // Pre-class / Pre-exam Reminder
          const alertMins = startMins - settings.leadTime;
          if (alertMins > now) {
            const delay = (alertMins - now) * 60000;
            this.timeouts.push(setTimeout(() => {
              const payload = buildReminderPayload(cls, settings, todayIdx);
              this.show(payload.title, payload.body);
            }, delay));
          }
        });
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
              summaryText: '',
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
  }
};
