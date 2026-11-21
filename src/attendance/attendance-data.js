/** Attendance numbers for the app (Home card, Attendance page): held classes since the semester start + marks. */
import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { getEffectiveClassesForDay } from '../schedule/queries.js';
import { getAttendance, computeStats, getSemesterStart } from './attendance.js';
import { heldClassesBetween } from './held-classes.js';

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const classesOn = date => { try { return getEffectiveClassesForDay(date.getDay(), ymd(date)); } catch (e) { return []; } };

let _cache = { key: '', list: [] };
/** Held classes from the semester start to now (cached for 5 minutes or until the notices change). */
export function heldSoFar(now = new Date()) {
  const start = getSemesterStart(CONFIG.semesterStart);
  const key = `${start}|${ymd(now)}|${Math.floor((now.getHours() * 60 + now.getMinutes()) / 5)}|${(State.announcementsList || []).length}|${Object.keys(State.schedule || {}).length}`;
  if (_cache.key !== key) _cache = { key, list: heldClassesBetween(start, classesOn, now) };
  return _cache.list;
}
export function invalidateHeld() { _cache.key = ''; }

export function attendanceData(now = new Date()) {
  const att = getAttendance();
  const mine = Object.entries(att.extra || {}).map(([key, e]) => ({ date: e.date, key, subject: e.subject, title: e.subject, start: '', end: '', extra: true }));
  const held = mine.length ? heldSoFar(now).concat(mine).sort((a, b) => a.date.localeCompare(b.date)) : heldSoFar(now);
  return { start: getSemesterStart(CONFIG.semesterStart), held, att, stats: computeStats(held, att) };
}
