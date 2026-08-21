import { State } from '../core/state.js';
import { toMinutes } from '../core/utils.js';

export function getClassesForDay(dayIdx) {
  const target = dayIdx !== undefined ? dayIdx : State.currentViewDayIdx;
  const baseClasses = (State.schedule[target] || []).map(c => ({ ...c }));
  return baseClasses.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export function getActiveClass(entries, currentMins) {
  for (const item of entries) {
    if (currentMins >= toMinutes(item.start) && currentMins < toMinutes(item.end)) return item;
  }
  return null;
}

export function getNextClass(entries, currentMins) {
  let next = null;
  let minDiff = Infinity;
  for (const item of entries) {
    const startMins = toMinutes(item.start);
    const diff = startMins - currentMins;
    if (diff > 0 && diff < minDiff) { minDiff = diff; next = item; }
  }
  return next;
}
