// Feature flags — set any to false to disable that feature entirely
export const FEATURES = {
  particles:        window.innerWidth >= 768 && !(window.Capacitor && window.Capacitor.isNativePlatform()),   // background canvas animation (disabled on mobile/native WebView for performance)
  streak:           true,   // daily streak counter
  notifications:    true,   // browser/native notifications
  notificationLog:  true,   // notification history panel
  announcements:    true,   // announcements feed + post form
  weeklyMatrix:     true,   // full-week timetable modal
  editSchedule:     true,   // edit/import/export schedule
  installBanner:    true,   // PWA install prompt banner
  notifBanner:      true,   // enable-notifications banner
};
