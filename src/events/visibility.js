import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { FEATURES } from '../features.js';
import { updateClock } from '../clock/clock.js';
import { updateGreeting } from '../dashboard/greeting.js';
import { updateStats } from '../dashboard/stats.js';
import { updateDashboard, forceUpdate } from '../dashboard/update.js';
import { Notifications } from '../notifications/notifications.js';
import { fetchAnnouncementsAndNotify } from './init.js';

export function initVisibility() {
  let _resumeTimer = null;

  function handleResume() {
    // Debounce: visibilitychange + focus + appStateChange can all fire within 50ms
    // Only process the last one to avoid 3× redundant full re-renders
    if (_resumeTimer) clearTimeout(_resumeTimer);
    _resumeTimer = setTimeout(() => {
      _resumeTimer = null;
      updateClock();
      forceUpdate();
      updateGreeting();
      updateStats();
      if (FEATURES.notifications) {
        Notifications.scheduleForToday();
      }
      if (FEATURES.announcements) {
        fetchAnnouncementsAndNotify();
      }
    }, 200);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(State.clockIntervalId);
      clearInterval(State.dashboardIntervalId);
    } else {
      State.clockIntervalId = setInterval(updateClock, CONFIG.updateIntervalMs);
      State.dashboardIntervalId = setInterval(updateDashboard, CONFIG.updateIntervalMs);
      handleResume();
    }
  });

  window.addEventListener('focus', () => {
    if (!document.hidden) {
      handleResume();
    }
  });

  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    try {
      const { App } = window.Capacitor.Plugins;
      if (App) {
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            handleResume();
          }
        });
      }
    } catch (e) {}
  }
}
