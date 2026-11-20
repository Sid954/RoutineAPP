/** "Done" on an assignment from Home: the same flag the notification's Done button sets (stops its alerts). */
import { getSkips, setDeadlineDone } from '../notifications/notif-store.js';
import { Notifications } from '../notifications/notifications.js';

export function getDeadlinesDone() { return new Set((getSkips().deadlines || []).map(String)); }
export function setDeadlineDoneFlag(id) {
  setDeadlineDone(id, true);
  try { Notifications.scheduleForToday(); } catch (e) {}
}
