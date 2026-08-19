import { State } from '../core/state.js';

export const Storage = {
  SCHEDULE_KEY: 'genz_routine_data',
  NOTIF_KEY: 'routine_notif_settings',
  STREAK_KEY: 'routine_streak',
  BANNER_DISMISS_KEY: 'routine_notif_banner_dismissed',
  INSTALL_DISMISS_KEY: 'routine_install_dismissed',
  SEMESTER_KEY: 'genz_routine_semester',
  SECTION_KEY: 'genz_routine_section',
  THEME_STYLE_KEY: 'routine_theme_style',
  THEME_COLOR_KEY: 'routine_theme_color',
  ONBOARDING_KEY: 'routine_onboarding_completed',

  isOnboardingCompleted() {
    try { return localStorage.getItem(this.ONBOARDING_KEY) === 'true'; } catch { return false; }
  },
  completeOnboarding() {
    try { localStorage.setItem(this.ONBOARDING_KEY, 'true'); } catch {}
  },

  getSemester() {
    try { return localStorage.getItem(this.SEMESTER_KEY) || '2'; } catch { return '2'; }
  },
  saveSemester(sem) {
    try { localStorage.setItem(this.SEMESTER_KEY, sem); } catch {}
  },
  getSection() {
    try { return localStorage.getItem(this.SECTION_KEY) || 'c'; } catch { return 'c'; }
  },
  saveSection(sec) {
    try { localStorage.setItem(this.SECTION_KEY, sec); } catch {}
  },

  getThemeStyle() {
    try { return localStorage.getItem(this.THEME_STYLE_KEY) || 'solid'; } catch { return 'solid'; }
  },
  saveThemeStyle(style) {
    try { localStorage.setItem(this.THEME_STYLE_KEY, style); } catch {}
  },
  getThemeColor() {
    try { return localStorage.getItem(this.THEME_COLOR_KEY) || 'dark'; } catch { return 'dark'; }
  },
  saveThemeColor(color) {
    try { localStorage.setItem(this.THEME_COLOR_KEY, color); } catch {}
  },

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
      return saved ? JSON.parse(saved) : { enabled: false, leadTime: 15, briefingEnabled: true, briefingTime: 450, classEndEnabled: false, dayDoneEnabled: true };
    } catch { return { enabled: false, leadTime: 15, briefingEnabled: true, briefingTime: 450, classEndEnabled: false, dayDoneEnabled: true }; }
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
