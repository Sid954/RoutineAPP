/**
 * Home / Routine data model (no DOM). Everything reads through getEffectiveClassesForDay(),
 * so cancellations, holidays, online moves, reschedules and extra classes are applied the
 * same way as everywhere else (flags, never removal). Class tests come from getOverrideFor.
 */
import { CONFIG, DAY_NAMES, FULL_COURSE_NAMES } from '../core/config.js';
import { toMinutes, format12h, formatRoom } from '../core/utils.js';
import { getEffectiveClassesForDay } from '../schedule/queries.js';
import { getOverrideFor, getDeadlinesForDate, normalizeDate, getDateForDayIndex } from '../announcements/overrides.js';
import { getFullName } from '../teachers/teacher-names.js';

const activeDays = () => (CONFIG.activeDays && CONFIG.activeDays.length ? CONFIG.activeDays : [6, 0, 1, 2, 3]);
export const isClassDay = dayIdx => activeDays().includes(dayIdx);

const parse = raw => {
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw || '{}') || {}; } catch (e) { return {}; }
};

/** "1h 20m" / "45m" */
export function dur(mins) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}
/** 615 -> "10:15 AM" (no leading zero) */
export function t12(mins) {
  if (typeof mins !== 'number' || mins < 0) return '';
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
const dateOnly = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const ymd = d => normalizeDate(d);

/**
 * One day's classes, normalised.
 * status: normal | cancelled | moved_away | moved_in | extra | online
 * flags:  isLab, isExam (+ exam {name, topics})
 */
export function getDay(dayIdx, date) {
  const dateStr = getDateForDayIndex(dayIdx, date);
  const raw = getEffectiveClassesForDay(dayIdx, date);
  return raw.map(c => {
    const startM = toMinutes(c.start);
    let endM = toMinutes(c.end);
    if (!(endM > startM)) endM = startM >= 0 ? startM + 75 : -1;
    let status = 'normal';
    if (c.isCancelled) status = 'cancelled';
    else if ('rescheduledTo' in c) status = 'moved_away';
    else if (c.isRescheduled) status = 'moved_in';
    else if (c.isExtraClass) status = c.isOnline ? 'online' : 'extra';
    else if (c.isMovedOnline || c.isOnline) status = 'online';

    const ov = status === 'cancelled' || status === 'moved_away' ? null : getOverrideFor(dateStr, c.title);
    const isExam = !!(c.isExam || (ov && ov.type === 'class_test'));
    const exam = isExam ? (() => { const p = parse(ov && ov.announcement && ov.announcement.announcement); return { name: p.exam_name || 'Class test', topics: p.topics && p.topics !== 'Not Specified' ? p.topics : '' }; })() : null;
    const teacher = String(c.instructor || c.teacher || '').trim();
    const online = status === 'online';
    const room = online ? 'Online' : (formatRoom(String(c.room || '')) || '');
    return {
      raw: c,
      title: c.title || c.subject || 'Class',
      name: FULL_COURSE_NAMES[c.title] || '',
      start: c.start, end: c.end,
      startM, endM,
      hasEnd: toMinutes(c.end) > startM,
      room: room && !/^tba$/i.test(room) ? room : '',
      teacher,
      teacherName: teacher ? (getFullName(teacher) || teacher) : '',
      isLab: String(c.type || '').toLowerCase() === 'lab',
      status, isExam, exam,
      platform: c.platform || '',
      cancelReason: c.cancelReason || '',
      movedTo: c.rescheduledTo || '',
      movedReason: c.rescheduledReason || '',
      origDate: c.origDate || '',
      origStart: c.origStart || '',
      dayIdx, dateStr
    };
  }).filter(c => c.startM >= 0).sort((a, b) => a.startM - b.startM);
}

export const isHeld = c => c.status !== 'cancelled' && c.status !== 'moved_away';

/** Holiday override for a date, if any. */
export function holidayOn(date) {
  const ov = getOverrideFor(ymd(date));
  return ov && ov.type === 'holiday' ? { title: (ov.announcement && ov.announcement.title) || 'Holiday', note: (ov.announcement && ov.announcement.announcement) || '' } : null;
}

/** Assignments due on a date. */
export function deadlinesOn(date) {
  return getDeadlinesForDate(ymd(date)).map(d => {
    const p = parse(d.announcement);
    const dueM = toMinutes(p.due_time || '11:59 PM');
    return { id: String(d.id), title: p.task_title || 'Assignment', subject: d.subject_override || d.subject || '', dueM: dueM >= 0 ? dueM : 1439, dueText: format12h(p.due_time || '11:59 PM').replace(/^0/, '') };
  }).sort((a, b) => a.dueM - b.dueM);
}

/** Summary line for a day: count, span, class time, longest break, labs, tests. */
export function daySummary(classes) {
  const held = classes.filter(isHeld);
  if (!held.length) return { count: 0, cancelled: classes.filter(c => c.status === 'cancelled').length };
  const first = held[0].startM;
  const last = Math.max(...held.map(c => c.endM));
  // Merge overlapping classes: busy = time in class, longestGap = longest break between them
  let busy = 0, longestGap = 0, cursor = first;
  held.forEach(c => {
    if (c.startM > cursor) longestGap = Math.max(longestGap, c.startM - cursor);
    if (c.endM > cursor) busy += c.endM - Math.max(c.startM, cursor);
    cursor = Math.max(cursor, c.endM);
  });
  return {
    count: held.length, first, last, busyMins: busy, longestGap,
    labs: held.filter(c => c.isLab).length,
    tests: held.filter(c => c.isExam).length,
    cancelled: classes.filter(c => c.status === 'cancelled').length,
    moved: classes.filter(c => c.status === 'moved_away').length
  };
}

/**
 * Timeline items for a day, in time order:
 *  {kind:'class', c, state:'past'|'live'|'next'|'later'}
 *  {kind:'gap', from, to, isNow}   breaks of 10+ minutes between held classes
 *  {kind:'deadline', d}
 */
export function buildTimeline(classes, deadlines, { isToday = false, nowM = -1 } = {}) {
  const items = [];
  const nextHeld = isToday ? classes.find(c => isHeld(c) && c.startM > nowM) : null;
  let cursor = null;
  classes.forEach(c => {
    const held = isHeld(c);
    if (held && cursor !== null && c.startM - cursor >= 10) {
      items.push({ kind: 'gap', from: cursor, to: c.startM, sortM: cursor, isNow: isToday && nowM >= cursor && nowM < c.startM });
    }
    let state = 'later';
    if (isToday) {
      if (held && nowM >= c.startM && nowM < c.endM) state = 'live';
      else if (c.endM <= nowM) state = 'past';
      else if (c === nextHeld) state = 'next';
    }
    items.push({ kind: 'class', c, state, sortM: c.startM });
    if (held) cursor = cursor === null ? c.endM : Math.max(cursor, c.endM);
  });
  deadlines.forEach(d => items.push({ kind: 'deadline', d, sortM: d.dueM }));
  // Stable: gaps keep their place before the class that ends them
  return items.map((it, i) => ({ it, i })).sort((a, b) => (a.it.sortM - b.it.sortM) || (a.i - b.i)).map(x => x.it);
}

/** Next held class strictly after `now`, looking up to 8 days ahead. */
export function findNextClass(now = new Date()) {
  const nowM = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < 8; i++) {
    const d = dateOnly(now); d.setDate(d.getDate() + i);
    const list = getDay(d.getDay(), d).filter(isHeld);
    const c = list.find(x => i > 0 || x.startM > nowM);
    if (c) return { c, date: d, daysAhead: i };
  }
  return null;
}

/**
 * The "now" card state for the real current moment.
 * kind: holiday | off | before | live | break | done
 */
export function nowState(now = new Date()) {
  const today = dateOnly(now);
  const nowM = now.getHours() * 60 + now.getMinutes();
  const todayIdx = today.getDay();
  const classes = getDay(todayIdx, today);
  const held = classes.filter(isHeld);
  const holiday = holidayOn(today);
  const exams = held.filter(c => c.isExam && c.endM > nowM);
  const deadlines = deadlinesOn(today).filter(d => d.dueM > nowM);
  const base = { nowM, classes, held, exams, deadlines, summary: daySummary(classes) };

  const live = held.find(c => nowM >= c.startM && nowM < c.endM);
  if (live) {
    const after = held.find(c => c.startM >= live.endM) || null;
    return { ...base, kind: 'live', c: live, after, pct: Math.min(100, Math.max(0, ((nowM - live.startM) / (live.endM - live.startM)) * 100)), leftMins: live.endM - nowM, index: held.indexOf(live) + 1 };
  }
  const next = held.find(c => c.startM > nowM);
  if (next) {
    const started = held.some(c => c.endM <= nowM);
    const left = held.filter(c => c.startM > nowM).length;
    return { ...base, kind: started ? 'break' : 'before', c: next, inMins: next.startM - nowM, left };
  }
  const upcoming = findNextClass(new Date(today.getTime() + 86399000));
  if (holiday && !held.length) return { ...base, kind: 'holiday', holiday, upcoming };
  if (!held.length) return { ...base, kind: 'off', upcoming, isClassDay: isClassDay(todayIdx) };
  return { ...base, kind: 'done', upcoming };
}

/** "Tomorrow" / "Saturday" / "today" */
export function relDay(date, now = new Date()) {
  const diff = Math.round((dateOnly(date) - dateOnly(now)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return DAY_NAMES[date.getDay()];
  return `${DAY_NAMES[date.getDay()].slice(0, 3)} ${date.getDate()}`;
}

/** Academic week (Thu → Wed) containing `anchor`, as dates. */
export function academicWeek(anchor = new Date()) {
  const a = dateOnly(anchor);
  const off = (a.getDay() - 4 + 7) % 7;
  const start = new Date(a); start.setDate(a.getDate() - off);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}
