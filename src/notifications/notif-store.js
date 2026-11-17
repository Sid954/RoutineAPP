/**
 * Notification preferences, skips and pause, kept in localStorage (DOM-free).
 *   notif_prefs_v2   normalizePrefs() object (planner.js)
 *   notif_skips_v1   { classes: { [date]: [classKey] }, days: [date], items: [key], deadlines: [id] }
 *   notif_pause      ms timestamp, -1 = until resumed, 0/absent = not paused
 */
import { normalizePrefs } from './planner.js';

const PREFS_KEY = 'notif_prefs_v2';
const SKIPS_KEY = 'notif_skips_v1';
const PAUSE_KEY = 'notif_pause';

const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function getPrefs() { return normalizePrefs(read(PREFS_KEY, null)); }
export function savePrefs(p) { write(PREFS_KEY, normalizePrefs(p)); }
/** Shallow-merge one section, e.g. updatePrefs('classes', { lead: 15 }) or updatePrefs({ enabled: false }). */
export function updatePrefs(section, patch) {
  const p = getPrefs();
  if (typeof section === 'object') Object.assign(p, section);
  else p[section] = (p[section] && typeof p[section] === 'object' && !Array.isArray(p[section])) ? { ...p[section], ...patch } : patch;
  savePrefs(p);
  return getPrefs();
}

/** Skips, with entries for past dates dropped. */
export function getSkips(now = new Date()) {
  const s = read(SKIPS_KEY, {}) || {};
  const today = ymd(now);
  const classes = {};
  Object.entries(s.classes || {}).forEach(([d, keys]) => { if (d >= today && Array.isArray(keys) && keys.length) classes[d] = keys; });
  return {
    classes,
    days: (s.days || []).filter(d => d >= today),
    items: (s.items || []).filter(k => { const m = String(k).match(/\d{4}-\d{2}-\d{2}/); return !m || m[0] >= today; }),
    deadlines: (s.deadlines || []).slice(-200)
  };
}
function saveSkips(s) { write(SKIPS_KEY, s); }

export function isClassSkipped(date, key) { return ((getSkips().classes[date]) || []).includes(key); }
export function setClassSkipped(date, key, skipped) {
  const s = getSkips();
  const set = new Set(s.classes[date] || []);
  skipped ? set.add(key) : set.delete(key);
  s.classes[date] = Array.from(set);
  saveSkips(s);
}
export function isDaySkipped(date) { return getSkips().days.includes(date); }
export function setDaySkipped(date, skipped) {
  const s = getSkips();
  const set = new Set(s.days);
  skipped ? set.add(date) : set.delete(date);
  s.days = Array.from(set);
  saveSkips(s);
}
export function isItemSkipped(key) { return getSkips().items.includes(key); }
export function setItemSkipped(key, skipped) {
  const s = getSkips();
  const set = new Set(s.items);
  skipped ? set.add(key) : set.delete(key);
  s.items = Array.from(set);
  saveSkips(s);
}
export function setDeadlineDone(id, done = true) {
  const s = getSkips();
  const set = new Set(s.deadlines.map(String));
  done ? set.add(String(id)) : set.delete(String(id));
  s.deadlines = Array.from(set);
  saveSkips(s);
}

/** ms timestamp the pause ends, -1 = until resumed, 0 = not paused (expired pauses read as 0). */
export function getPause(now = Date.now()) {
  const v = Number(read(PAUSE_KEY, 0)) || 0;
  if (v > 0 && v <= now) return 0;
  return v;
}
export function setPause(until) { write(PAUSE_KEY, until || 0); }

/** End of today (23:59:59) for "rest of today". */
export function endOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
}
