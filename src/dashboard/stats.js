import { DOM } from '../core/dom.js';
import { getClassesForDay } from '../schedule/queries.js';
import { Streak } from '../streak/streak.js';
import { toMinutes } from '../core/utils.js';

export function updateStats() {
  const todayClasses = getClassesForDay(new Date().getDay());
  const count = todayClasses.length;

  // Total hours
  let totalMins = 0;
  todayClasses.forEach(c => { totalMins += toMinutes(c.end) - toMinutes(c.start); });
  const hours = totalMins / 60;

  // Count breaks (gaps between consecutive classes)
  let gaps = 0;
  const sorted = todayClasses.slice().sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].start) > toMinutes(sorted[i - 1].end)) gaps++;
  }

  // Streak
  const streak = Streak.getCount();

  if (DOM.statClasses) DOM.statClasses.textContent = count;
  if (DOM.statHours) DOM.statHours.textContent = hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
  if (DOM.statGaps) DOM.statGaps.textContent = gaps;
  if (DOM.statStreak) DOM.statStreak.textContent = `🔥 ${streak}`;
}
