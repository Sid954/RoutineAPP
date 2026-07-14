import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { updateClock } from '../clock/clock.js';
import { updateGreeting } from '../dashboard/greeting.js';
import { updateStats } from '../dashboard/stats.js';
import { updateDashboard, forceUpdate } from '../dashboard/update.js';
import { Notifications } from '../notifications/notifications.js';

export function initVisibility() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(State.clockIntervalId);
      clearInterval(State.dashboardIntervalId);
    } else {
      updateClock();
      forceUpdate();
      updateGreeting();
      updateStats();
      State.clockIntervalId = setInterval(updateClock, CONFIG.updateIntervalMs);
      State.dashboardIntervalId = setInterval(updateDashboard, CONFIG.updateIntervalMs);
      // Re-schedule notifications in case the day changed while hidden
      Notifications.scheduleForToday();
    }
  });
}
