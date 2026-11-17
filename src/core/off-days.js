/**
 * University off days (default Thursday + Friday) and whether to hide them in day pickers
 * (Home week strip, Rooms day row) when nothing is happening that day. Settings → Your class.
 */
import { getEffectiveClassesForDay } from '../schedule/queries.js';
import { getOverridesByDateMap, normalizeDate } from '../announcements/overrides.js';

const OFF_KEY = 'off_days';
const HIDE_KEY = 'hide_off_days';

export function offDays() {
  try {
    const v = JSON.parse(localStorage.getItem(OFF_KEY) || 'null');
    if (Array.isArray(v) && v.every(n => Number.isInteger(n) && n >= 0 && n <= 6)) return v;
  } catch (e) {}
  return [4, 5];
}
export function setOffDays(days) {
  try { localStorage.setItem(OFF_KEY, JSON.stringify(Array.from(new Set(days)).sort())); } catch (e) {}
}
export function hideOffDays() {
  try { return localStorage.getItem(HIDE_KEY) !== 'off'; } catch (e) { return true; }
}
export function setHideOffDays(on) {
  try { localStorage.setItem(HIDE_KEY, on ? 'on' : 'off'); } catch (e) {}
}

/** True when a date has a held class or any announcement (holiday, test, extra class...). */
export function dayHasSomething(date, overridesMap = getOverridesByDateMap()) {
  if (overridesMap && overridesMap.get(normalizeDate(date))) return true;
  try {
    return getEffectiveClassesForDay(date.getDay(), date).some(c => !c.isCancelled && !('rescheduledTo' in c));
  } catch (e) {
    return false;
  }
}

/** Hide this date from a day picker? Never hides today or the selected date. */
export function shouldHideDay(date, { isToday = false, isSelected = false, overridesMap } = {}) {
  if (isToday || isSelected || !hideOffDays()) return false;
  if (!offDays().includes(date.getDay())) return false;
  return !dayHasSomething(date, overridesMap);
}
