/**
 * Attendance (phone only, DOM-free, tested in tests/test_attendance.js).
 *   attendance_v1: { marks: { 'YYYY-MM-DD|TITLE@min': 'present'|'absent' },
 *                    base: { SUBJECT: { attended, held } },   // optional starting counts
 *                    min: 75 }                                   // "at risk" below this %
 * Subjects are course codes, so labs count on their own (DSL apart from DS).
 * Unanswered classes are not counted either way.
 */
import { parseTime } from '../notifications/planner.js';

const KEY = 'attendance_v1';
const START_KEY = 'semester_start_override';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };

export const subjectOf = title => String(title || '').trim().toUpperCase();
export const markKey = (date, title, start) => `${date}|${subjectOf(title)}@${parseTime(start)}`;

export function getAttendance() {
  const r = read();
  const min = Number(r.min);
  return {
    marks: r.marks && typeof r.marks === 'object' ? r.marks : {},
    base: r.base && typeof r.base === 'object' ? r.base : {},
    min: Number.isFinite(min) && min >= 1 && min <= 100 ? Math.round(min) : 75
  };
}
function save(a) { write(a); }

/** value: 'present' | 'absent' | null (clear) */
export function setMark(key, value) {
  const a = getAttendance();
  if (value === 'present' || value === 'absent') a.marks[key] = value; else delete a.marks[key];
  save(a);
}
export function getMark(key) { return getAttendance().marks[key] || null; }

/** Starting counts for a subject (classes before the app started counting); null clears them. */
export function setBase(subject, counts) {
  const a = getAttendance();
  const s = subjectOf(subject);
  const att = Math.max(0, Math.round(Number(counts && counts.attended) || 0));
  const held = Math.max(att, Math.round(Number(counts && counts.held) || 0));
  if (!counts || (!att && !held)) delete a.base[s]; else a.base[s] = { attended: att, held };
  save(a);
}
export function setMinPercent(n) {
  const a = getAttendance();
  a.min = Math.min(100, Math.max(1, Math.round(Number(n) || 75)));
  save(a);
}

/** Semester start: this phone's override, else the shared config value. */
export function getSemesterStart(configValue) {
  let o = '';
  try { o = localStorage.getItem(START_KEY) || ''; } catch (e) {}
  if (/^\d{4}-\d{2}-\d{2}$/.test(o)) return o;
  return /^\d{4}-\d{2}-\d{2}$/.test(configValue || '') ? configValue : '';
}
export function setSemesterStartOverride(date) {
  try { if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) localStorage.setItem(START_KEY, date); else localStorage.removeItem(START_KEY); } catch (e) {}
}

/** How many more classes can be missed and still stay at or above min%. */
export function canMissMore(attended, counted, minPct) {
  const m = minPct / 100;
  if (m <= 0) return Infinity;
  return Math.max(0, Math.floor(attended / m - counted + 1e-9));
}
/** How many classes in a row must be attended to get back to min% (0 when already there). */
export function needInRow(attended, counted, minPct) {
  const m = minPct / 100;
  if (m >= 1) return attended < counted ? Infinity : 0;
  return Math.max(0, Math.ceil((m * counted - attended) / (1 - m) - 1e-9));
}

/**
 * Per-subject numbers.
 * @param held  [{ date, key, subject }] classes that took place (from held-classes.js)
 * @returns [{ subject, held, present, absent, unknown, attended, counted, pct|null, canMiss, needInRow, atRisk, base }]
 */
export function computeStats(held, { marks = {}, base = {}, min = 75 } = {}) {
  const by = {};
  const ensure = s => (by[s] = by[s] || { subject: s, held: 0, present: 0, absent: 0, unknown: 0 });
  held.forEach(h => {
    const r = ensure(h.subject);
    r.held++;
    const v = marks[h.key];
    if (v === 'present') r.present++; else if (v === 'absent') r.absent++; else r.unknown++;
  });
  Object.keys(base).forEach(ensure);
  return Object.values(by).map(r => {
    const b = base[r.subject] || { attended: 0, held: 0 };
    const attended = r.present + b.attended;
    const counted = r.present + r.absent + b.held;
    const pct = counted ? Math.round((attended / counted) * 1000) / 10 : null;
    return {
      ...r, base: b, attended, counted, pct,
      canMiss: counted ? canMissMore(attended, counted, min) : null,
      needInRow: counted ? needInRow(attended, counted, min) : 0,
      atRisk: pct !== null && pct < min
    };
  }).sort((a, b) => a.subject.localeCompare(b.subject));
}
