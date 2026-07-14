import { State } from '../core/state.js';

export const Storage = {
  SCHEDULE_KEY: 'genz_routine_data',
  NOTIF_KEY: 'routine_notif_settings',
  STREAK_KEY: 'routine_streak',
  BANNER_DISMISS_KEY: 'routine_notif_banner_dismissed',
  INSTALL_DISMISS_KEY: 'routine_install_dismissed',

  saveSchedule() {
    try { localStorage.setItem(this.SCHEDULE_KEY, JSON.stringify(State.schedule)); } catch {}
  },
  loadSchedule() {
    try {
      const saved = localStorage.getItem(this.SCHEDULE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  },

  getNotifSettings() {
    try {
      const saved = localStorage.getItem(this.NOTIF_KEY);
      return saved ? JSON.parse(saved) : { enabled: false, leadTime: 5, briefingEnabled: true, briefingTime: 450, classEndEnabled: false, dayDoneEnabled: true };
    } catch { return { enabled: false, leadTime: 5, briefingEnabled: true, briefingTime: 450, classEndEnabled: false, dayDoneEnabled: true }; }
  },
  saveNotifSettings(settings) {
    try { localStorage.setItem(this.NOTIF_KEY, JSON.stringify(settings)); } catch {}
  },

  getStreak() {
    try {
      const saved = localStorage.getItem(this.STREAK_KEY);
      return saved ? JSON.parse(saved) : { lastDate: null, count: 0 };
    } catch { return { lastDate: null, count: 0 }; }
  },
  saveStreak(data) {
    try { localStorage.setItem(this.STREAK_KEY, JSON.stringify(data)); } catch {}
  },

  isBannerDismissed(key) {
    try { return localStorage.getItem(key) === 'true'; } catch { return false; }
  },
  dismissBanner(key) {
    try { localStorage.setItem(key, 'true'); } catch {}
  }
};
