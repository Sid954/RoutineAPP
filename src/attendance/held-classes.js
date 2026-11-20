/**
 * Classes that actually took place, for attendance (pure, tested).
 * A class counts when it was held (not cancelled, not moved away to another day) and has ended.
 * Extra and rescheduled-in classes count, because getClasses() is getEffectiveClassesForDay.
 * "Approximate": notices older than the app's cached list may be missing.
 */
import { parseTime } from '../notifications/planner.js';
import { subjectOf, markKey } from './attendance.js';

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

export const wasHeld = c => !c.isCancelled && !('rescheduledTo' in c);

/**
 * @param startDate 'YYYY-MM-DD' (semester start)
 * @param getClasses (date: Date) => effective classes of that date
 * @param now Date
 * @returns [{ date, key, subject, title, start, end }] oldest first
 */
export function heldClassesBetween(startDate, getClasses, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '')) return [];
  const out = [];
  const today = ymd(now);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (let d = fromYmd(startDate); ymd(d) <= today; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const date = ymd(d);
    let classes = [];
    try { classes = getClasses(d) || []; } catch (e) { classes = []; }
    classes.filter(wasHeld).forEach(c => {
      const end = parseTime(c.end);
      if (date === today && !(end >= 0 && end <= nowMins)) return; // still running or later today
      out.push({ date, key: markKey(date, c.title, c.start), subject: subjectOf(c.title), title: c.title, start: c.start, end: c.end });
    });
    if (out.length > 5000) break;
  }
  return out;
}

/** Today's (or a date's) classes that have ended and are not marked yet. */
export function unmarkedEnded(held, marks, dates) {
  const want = new Set(dates);
  return held.filter(h => want.has(h.date) && !marks[h.key]);
}
