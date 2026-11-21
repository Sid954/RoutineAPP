/**
 * Home (Nov 2026): a dashboard of cards that answers "where do I need to be, what changed, what is due,
 * where can I sit". The day timeline moved to the Day page (#dashboardView, center dock button).
 * Plan and decisions: HOMEPAGE_PLAN.md. Cards can be reordered and hidden (long-press → edit mode).
 *
 * Every override shown here reads through getEffectiveClassesForDay() / the announcements list.
 * Re-renders go through setHtmlIfChanged per card, so the minute tick touches only what changed.
 */
import { State } from '../core/state.js';
import { CONFIG, DAY_NAMES, MONTHS, FULL_COURSE_NAMES } from '../core/config.js';
import { Storage } from '../storage/storage.js';
import { escapeHtml, setHtmlIfChanged, format12h, formatRoom, toMinutes, getCurrentMinutes } from '../core/utils.js';
import { getEffectiveClassesForDay, shouldRollOver } from '../schedule/queries.js';
import { getOverrideFor, getDeadlinesForDate } from '../announcements/overrides.js';
import { toNotice } from '../announcements/notice-model.js';
import { ICONS } from '../announcements/notices-view.js';
import { Announcements } from '../announcements/announcements.js';
import { Suggestions } from '../announcements/suggestions.js';
import { confirmBadgeHtml } from '../announcements/confirm-badge.js';
import { getTeacherInfo } from '../teachers/teacher-names.js';
import { openTeacherDetailByCode } from '../teachers/teacher-modal.js';
import { showClassDetails } from '../timeline/class-detail.js';
import { bindMouseDrag } from '../core/desktop-input.js';
import { getDeadlinesDone, toggleDeadlineDone } from './home-deadlines.js';
import { parseTime } from '../notifications/planner.js';
import { setMark, setSkipped, isSkipped, markKey } from '../attendance/attendance.js';
import { wasHeld } from '../attendance/held-classes.js';
import { attendanceData } from '../attendance/attendance-data.js';
import { listOwnExams, upcomingExams, daysUntil } from '../exams/exams-store.js';
import { CARDS, getLayout, saveLayout, resetLayout } from './layout-store.js';
import { openExamSheet } from './home-sheets.js';

const $ = id => document.getElementById(id);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fromYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fullName = code => FULL_COURSE_NAMES[String(code || '').toUpperCase()] || '';
const svg = (paths, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const IC = {
  now: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  changes: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/>',
  attendance: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  today: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  due: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  exams: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  teachers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  notices: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  suggestions: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
  notes: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  actions: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  chev: '<polyline points="9 6 15 12 9 18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  room: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  up: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  grip: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>',
  door: '<path d="M3 21h18"/><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17"/><circle cx="15" cy="12" r="1"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>'
};
const COLOR = { now: '#0EA5E9', changes: '#F43F5E', attendance: '#10B981', today: '#3B82F6', due: '#A855F7', exams: '#F97316', teachers: '#6366F1', notices: '#F59E0B', suggestions: '#EAB308', notes: '#14B8A6', actions: '#64748B' };

/* ── Data helpers ─────────────────────────────────────────────────────────── */
function classesOn(date) {
  try { return getEffectiveClassesForDay(date.getDay(), ymd(date)); } catch (e) { return []; }
}
/** End minute of a class; a missing or broken end time counts as a 90 minute class. */
const endOf = c => { const s = toMinutes(c.start), e = toMinutes(c.end); return e > s ? e : s + 90; };
/**
 * Has something dated TODAY (a test, an exam, a change) already happened? Used to drop it from Home.
 * The whole day counts as over after the rollover hour with no class left; otherwise it is over when
 * its class has ended, or (no class found) 90 minutes after its start time.
 */
function passedToday(now, subject, startMin) {
  if (shouldRollOver(now)) return true;
  const nowM = now.getHours() * 60 + now.getMinutes();
  const subj = String(subject || '').trim().toUpperCase();
  const mine = subj ? classesOn(now).filter(c => wasHeld(c) && String(c.title || '').trim().toUpperCase() === subj) : [];
  if (mine.length) return mine.every(c => endOf(c) <= nowM);
  return startMin !== null && startMin >= 0 && nowM >= startMin + 90;
}
const minOf = s => { const m = parseTime(String(s || '').trim()); return m >= 0 ? m : null; };

const heldOn = date => classesOn(date).filter(wasHeld).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

/** The day Home is about: today, or (after 6 pm with nothing left, or a day with no classes) the next class day. */
function focusDay(now = new Date()) {
  let d = shouldRollOver(now) ? addDays(now, 1) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < 14 && !heldOn(d).length; i++) d = addDays(d, 1);
  return d;
}
function dayWord(date, now = new Date()) {
  const diff = Math.round((fromYmd(ymd(date)) - fromYmd(ymd(now))) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return DAY_NAMES[date.getDay()];
}
const isExamClass = (c, date) => !!(c.isExam || ((getOverrideFor(ymd(date), c.title) || {}).type === 'class_test'));
const inMins = m => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`);

function detailFor(c, date) {
  return {
    title: c.title, code: c.title, start: format12h(c.start), end: format12h(c.end), room: c.room,
    instructor: c.instructor || c.teacher || '', type: c.type, isCancelled: !!c.isCancelled,
    isOnline: !!(c.isOnline || c.isMovedOnline), isExam: isExamClass(c, date), dayIdx: date.getDay(),
    dayName: DAY_NAMES[date.getDay()], semester: Storage.getSemester(), section: (Storage.getSection() || '').toUpperCase(),
    isFromTimeline: true
  };
}
function noticeCtx() { return { semester: String(Storage.getSemester() || '').toLowerCase(), section: String(Storage.getSection() || '').toLowerCase() }; }

/* ── Cards ────────────────────────────────────────────────────────────────── */
function cardHead(id, title, { more = '', moreAct = '', right = '' } = {}) {
  return `<header class="hm-head"><span class="hm-ico" style="--ic:${COLOR[id] || '#64748B'}">${svg(IC[id] || IC.now)}</span><h2>${escapeHtml(title)}</h2>${right}${more ? `<button type="button" class="hm-more" data-act="${moreAct}">${escapeHtml(more)}${svg(IC.chev, 2.2)}</button>` : ''}</header>`;
}

function headerCard(now) {
  const h = now.getHours();
  const hi = h >= 5 && h < 12 ? 'Good morning' : h < 17 && h >= 12 ? 'Good afternoon' : h >= 17 && h < 21 ? 'Good evening' : 'Good night';
  const name = Storage.getDisplayName() || 'Student';
  const today = heldOn(now);
  const hol = getOverrideFor(ymd(now));
  const nowM = now.getHours() * 60 + now.getMinutes();
  const left = today.filter(c => endOf(c) > nowM);
  let sum;
  if (hol && hol.type === 'holiday' && !today.length) sum = 'Campus closed today';
  else if (!today.length) sum = 'No classes today';
  else if (!left.length) sum = `Done for today · ${today.length} ${today.length === 1 ? 'class' : 'classes'}`;
  else sum = `${today.length} ${today.length === 1 ? 'class' : 'classes'} today · ${left.length === today.length ? `first at ${format12h(today[0].start)}` : `${left.length} to go`}`;
  const t = `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `<div class="hm-top">
      <button type="button" class="hm-date" data-act="calendar">${escapeHtml(`${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`)}</button>
      <div class="hm-top-r"><button type="button" class="hm-notes-btn" data-act="notes">${svg(IC.notes, 2.1)}Notes</button><button type="button" class="hm-gear" data-act="settings" aria-label="Settings">${svg(IC.gear)}</button></div>
    </div>
    <div class="hm-clock"><span class="hm-clock-t">${t}</span><span class="hm-clock-p">${h >= 12 ? 'PM' : 'AM'}</span></div>
    <p class="hm-hello">${escapeHtml(hi)}, <strong>${escapeHtml(name)}</strong></p>
    <p class="hm-sum">${escapeHtml(sum)}</p>`;
}

/* ── The day card: today's classes while there are any left, else the next class day ───────────
   Same design always (running or not): time, class, room, and on the right the subject's attendance.
   Once a class has ended that right-hand slot becomes a Present / Absent checker (with Skip) until the
   student answers or the day ends (11:59 pm: the checkers only exist for today's classes). */
function attendanceByTitle() {
  const map = new Map();
  let marks = {}, tracking = false;
  try { const d = attendanceData(new Date()); d.stats.forEach(s => map.set(s.subject, s)); marks = d.att.marks || {}; tracking = !!d.start; } catch (e) {}
  return { stat: title => map.get(String(title || '').trim().toUpperCase()) || null, marks, tracking };
}

let _markedAt = {};     // markKey -> ms: just answered; the row keeps showing for a few seconds with the new percentage
let _markTimer = null;
const MARK_SHOW_MS = 6000;
const recentlyMarked = key => Date.now() - (_markedAt[key] || 0) < MARK_SHOW_MS;

/** Held classes of today that already ended and still wait for an answer. */
function pendingToday(now, att) {
  if (!att.tracking) return [];
  const nowM = now.getHours() * 60 + now.getMinutes();
  return heldOn(now).filter(c => endOf(c) <= nowM).map(c => ({ c, key: markKey(ymd(now), c.title, c.start) }))
    .filter(x => !att.marks[x.key] && !isSkipped(x.key));
}

function attSlot(c, d, att, pending) {
  if (!wasHeld(c)) return '';
  const key = markKey(ymd(d), c.title, c.start);
  if (pending) {
    return `<span class="hm-chk" role="group" aria-label="Were you at ${escapeHtml(c.title)}?">
        <button type="button" class="hm-chk-b is-yes" data-act="mark" data-key="${escapeHtml(key)}" data-val="present" aria-label="Present at ${escapeHtml(c.title)}">${svg(IC.check, 2.7)}</button>
        <button type="button" class="hm-chk-b is-no" data-act="mark" data-key="${escapeHtml(key)}" data-val="absent" aria-label="Absent from ${escapeHtml(c.title)}">${svg(IC.x, 2.7)}</button>
      </span>`;
  }
  const s = att.stat(c.title);
  const pct = s && s.pct !== null ? s : null;
  return `<button type="button" class="hm-pct${pct ? (pct.atRisk ? ' is-risk' : ' is-ok') : ''}" data-act="att-subject" data-subject="${escapeHtml(String(c.title || '').trim().toUpperCase())}" aria-label="${escapeHtml(c.title)} attendance ${pct ? `${Math.round(pct.pct)}%` : 'not tracked yet'}. Open it"><b>${pct ? `${Math.round(pct.pct)}%` : '–'}</b><i>${pct ? 'attended' : 'no data'}</i></button>`;
}

function timeParts(s) { const m = String(format12h(s)).match(/^(\d{1,2}:\d{2})\s*([AP]M)$/i); return m ? [m[1], m[2].toUpperCase()] : [String(format12h(s)), '']; }

function classRow(c, d, ctx) {
  const { nowM, isToday, att, cur, next } = ctx;
  const off = !wasHeld(c);
  const ended = isToday && endOf(c) <= nowM;
  const live = !!cur && c === cur;
  const key = markKey(ymd(d), c.title, c.start);
  const pending = isToday && ended && !off && att.tracking && !att.marks[key] && !isSkipped(key);
  const room = (c.isOnline || c.isMovedOnline) ? 'Online' : (formatRoom(c.room) ? `Room ${formatRoom(c.room)}` : 'Room TBA');
  const isExam = !off && isExamClass(c, d);
  const tags = [off ? (c.isCancelled ? 'Cancelled' : 'Moved') : '', !off && !live && next && c === next ? 'Next' : ''].filter(Boolean);
  const prog = live ? Math.min(1, Math.max(0, (nowM - toMinutes(c.start)) / Math.max(1, endOf(c) - toMinutes(c.start)))) : 0;
  const badge = c.isUnconfirmed ? confirmBadgeHtml('unverified', c.unconfirmedId || '', 'cf-inline') : '';
  const [tm, ap] = timeParts(c.start);
  return `<div class="hm-cls hm-tmr-row${off ? ' is-off' : ''}${ended && !pending ? ' is-done' : ''}${live ? ' is-now' : ''}${pending ? ' is-pending' : ''}${isExam ? ' is-exam' : ''}">
      <button type="button" class="hm-cls-btn" data-act="class" data-date="${ymd(d)}" data-title="${escapeHtml(c.title)}" data-start="${escapeHtml(c.start)}">
        <span class="hm-cls-t"><b>${escapeHtml(tm)}</b><i>${escapeHtml(ap)}</i></span>
        <span class="hm-cls-main">
          <strong>${escapeHtml(c.title)}${isExam ? '<b class="hm-exam-tag">Exam</b>' : ''}${badge}</strong>
          <span class="hm-cls-sub">${escapeHtml(room)}${tags.length ? ` · ${escapeHtml(tags.join(' · '))}` : ''}</span>
          ${live ? `<span class="hm-live-line"><i class="hm-live-dot"></i>Now · ${escapeHtml(inMins(endOf(c) - nowM))} left</span><span class="hm-bar"><i style="transform:scaleX(${prog.toFixed(3)})"></i></span>` : ''}
        </span>
      </button>
      ${attSlot(c, d, att, pending)}
    </div>`;
}

function nowCard(now) {
  const nowM = now.getHours() * 60 + now.getMinutes();
  const att = attendanceByTitle();
  Object.keys(_markedAt).forEach(k => { if (!recentlyMarked(k)) delete _markedAt[k]; });
  const d = focusDay(now);
  const isToday = ymd(d) === ymd(now);
  const list = classesOn(d).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const heldList = list.filter(wasHeld);
  if (!heldList.length) return '<div class="hm-empty">No classes in the next two weeks.</div>';
  const cur = isToday ? heldList.find(c => toMinutes(c.start) <= nowM && nowM < endOf(c)) : null;
  const next = isToday ? heldList.find(c => toMinutes(c.start) > nowM) : heldList[0];
  const ctx = { now, nowM, isToday, att, cur, next };
  const n = heldList.length;
  const word = dayWord(d, now);
  const left = isToday ? 'Today' : word;
  const countText = `${n} ${n === 1 ? 'class' : 'classes'}`;
  const dayExams = collectExams(now).filter(e => e.date === ymd(d));
  const examText = dayExams.length ? ` · ${dayExams.length} ${dayExams.length === 1 ? 'exam' : 'exams'}` : '';
  // Exams the class list does not show by itself (the student's own midterm / final, a test for a subject with no class that day)
  const shownTitles = new Set(list.filter(wasHeld).map(c => String(c.title || '').trim().toUpperCase()));
  const extraExams = dayExams.filter(e => e.source === 'own' || !shownTitles.has(String(e.subject || '').trim().toUpperCase()));
  const examRows = extraExams.map(e => `<button type="button" class="hm-examrow" ${e.source === 'notice' ? `data-act="notice" data-id="${escapeHtml(String(e.noticeId))}"` : `data-act="edit-exam" data-id="${escapeHtml(e.id)}"`}><span class="hm-examrow-ico">${svg(IC.exams, 2)}</span><span class="hm-examrow-t"><strong>${escapeHtml(e.subject)} · ${escapeHtml(e.label)}</strong><span>${isToday ? 'Today' : escapeHtml(word)}${e.time ? ` · ${escapeHtml(e.time)}` : ''}</span></span><b class="hm-exam-tag">Exam</b></button>`).join('');

  // Evening: today is over and the list shows tomorrow, but today's answers are still due (until midnight)
  let ask = '';
  if (!isToday && att.tracking) {
    const pend = pendingToday(now, att);
    const recent = heldOn(now).filter(c => recentlyMarked(markKey(ymd(now), c.title, c.start)));
    const rows = [...new Map([...pend.map(x => x.c), ...recent].map(c => [`${c.title}@${c.start}`, c])).values()]
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    if (rows.length) {
      const ctxToday = { now, nowM, isToday: true, att, cur: null, next: null };
      ask = `<div class="hm-ask-h"><span class="hm-tmr-k">Today · were you there?</span>${pend.length ? '<button type="button" class="hm-chk-skip" data-act="skip-all">Skip all</button>' : ''}</div>
        <div class="hm-rows hm-ask">${rows.map(c => classRow(c, now, ctxToday)).join('')}</div>`;
    }
  }
  const joinBtn = (c) => {
    if (!c || !(c.isOnline || c.isMovedOnline)) return '';
    const ov = getOverrideFor(ymd(d), c.title);
    const link = ov && ov.announcement ? toNotice(ov.announcement, noticeCtx()).link : '';
    return link ? `<a class="hm-join" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${svg(IC.play)}Join online class</a>` : '';
  };
  const hadOne = isToday && heldList.some(c => endOf(c) <= nowM);
  const gap = next && !cur && isToday ? toMinutes(next.start) - nowM : 0;
  // Today's last class is over (the list still shows today): one Skip all for whatever is unanswered
  const dayOver = isToday && heldList.every(c => endOf(c) <= nowM);
  const skipAll = dayOver && pendingToday(now, att).length ? '<button type="button" class="hm-chk-skip" data-act="skip-all">Skip all</button>' : '';
  return `${ask}${ask ? '<div class="hm-ask-gap"></div>' : ''}<div class="hm-ask-h"><span class="hm-tmr-k">${escapeHtml(left)}</span><span class="hm-k-right">${skipAll}<span class="hm-k-count">${escapeHtml(countText)}${examText ? `<b class="hm-k-exam">${escapeHtml(examText)}</b>` : ''}</span></span></div>
    ${examRows ? `<div class="hm-examrows">${examRows}</div>` : ''}
    <div class="hm-rows">${list.map(c => classRow(c, d, ctx)).join('')}</div>
    ${joinBtn(cur)}${isToday && !cur && hadOne && gap >= 30 ? `<button type="button" class="hm-link" data-act="rooms">${svg(IC.door)}Free for ${escapeHtml(inMins(gap))}: find a free room</button>` : ''}`;
}

const CHANGE_TYPES = new Set(['cancellation', 'rescheduled', 'online_class', 'class_test', 'holiday']);
function compactHead(id, title, count, act, tone = '') {
  return `<button type="button" class="hm-chead" data-act="${act}"><span class="hm-ico sm" style="--ic:${COLOR[id] || '#64748B'}">${svg(IC[id] || IC.now)}</span><h2>${escapeHtml(title)}</h2>${count ? `<b class="hm-cnt${tone ? ` is-${tone}` : ''}">${count}</b>` : ''}</button>`;
}

/** One short line for a change: what happened and when. Nothing the subject line already says. */
function changeLine(a, n, now) {
  const day = dayWord(fromYmd(n.date), now);
  const time = n.focus && n.focus.hasTime ? `${String(n.focus.big).replace(/:00$/, '')} ${n.focus.ampm}` : ''; // 11:00 AM -> 11 AM
  let what = '';
  switch (a.type) {
    case 'cancellation': what = 'Cancelled'; break;
    case 'rescheduled': what = time ? `Moved to ${time}` : 'Moved'; break;
    case 'online_class': what = time ? `Online, ${time}` : 'Online'; break;
    case 'class_test': { const nm = String(n.title || '').split(':')[0].trim(); what = nm && nm.toUpperCase() !== String(n.subject || '').toUpperCase() ? nm : 'Class test'; break; }
    case 'holiday': what = 'No classes'; break;
    default: what = n.meta.label;
  }
  return `${what} · ${day}`;
}

function changesCard(now) {
  const days = [ymd(now)];
  const f = ymd(focusDay(now));
  if (!days.includes(f)) days.push(f);
  const tomorrow = ymd(addDays(now, 1));
  if (!days.includes(tomorrow)) days.push(tomorrow);
  const ctx = noticeCtx();
  const items = (State.announcementsList || []).filter(a => CHANGE_TYPES.has(a.type) && days.includes(String(a.date_override || '').slice(0, 10)))
    .map(a => ({ a, n: toNotice(a, ctx) }))
    .filter(({ n }) => { const nd = String(n.date || '').slice(0, 10); return !(nd && (nd < ymd(now) || (nd === ymd(now) && passedToday(now, n.subject, n.focus && n.focus.hasTime ? minOf(`${n.focus.big} ${n.focus.ampm}`) : null)))); }) // what already happened is not news
    .sort((x, y) => String(x.n.date).localeCompare(String(y.n.date)));
  if (!items.length) return `${compactHead('changes', 'Changes', 0, 'notices')}<div class="hm-empty hm-empty-sm">Nothing changed in your routine.</div>`;
  const shown = items.slice(0, 3);
  return `${compactHead('changes', 'Changes', items.length, 'notices')}<div class="hm-minis">${shown.map(({ a, n }) => {
    const head = a.type === 'holiday' ? (String(a.title || '').trim() || 'Campus closed') : (n.subject || n.headline || n.title);
    return `
      <button type="button" class="hm-mini" data-act="notice" data-id="${escapeHtml(String(a.id))}">
        <span class="hm-row-ico sm tone-${n.tone}">${svg(ICONS[n.tone] || ICONS.general, 2)}</span>
        <span class="hm-mini-t"><strong>${escapeHtml(head)}</strong><span>${escapeHtml(changeLine(a, n, now))}</span></span>
      </button>`;
  }).join('')}${items.length > shown.length ? `<button type="button" class="hm-more-line" data-act="notices">+${items.length - shown.length} more</button>` : ''}</div>`;
}

let _dueOrder = null; // ids in the order last settled (a refresh clears it): ticking a card does not move it until then

function dueCard(now) {
  const items = [];
  const done = getDeadlinesDone();
  const ctx = noticeCtx();
  for (let i = 0; i < 8; i++) {
    const d = addDays(now, i);
    let dl = [];
    try { dl = getDeadlinesForDate(ymd(d)); } catch (e) {}
    dl.forEach(item => {
      const n = toNotice(item, ctx);
      const dueMin = n.focus && n.focus.hasTime ? minOf(`${n.focus.big} ${n.focus.ampm}`) : null;
      if (i === 0 && dueMin !== null && now.getHours() * 60 + now.getMinutes() >= dueMin) return; // its time has passed
      items.push({ id: String(item.id), date: ymd(d), kind: 'Assignment', title: n.headline || n.title, time: n.focus && n.focus.hasTime ? `${n.focus.big} ${n.focus.ampm}` : '', task: true, done: done.has(String(item.id)) });
    });
  }
  (State.announcementsList || []).filter(a => a.type === 'class_test').forEach(a => {
    const date = String(a.date_override || '').slice(0, 10);
    if (!date || date < ymd(now) || date > ymd(addDays(now, 7))) return;
    const n = toNotice(a, ctx);
    if (date === ymd(now) && passedToday(now, n.subject, n.focus && n.focus.hasTime ? minOf(`${n.focus.big} ${n.focus.ampm}`) : null)) return; // already taken
    items.push({ id: String(a.id), date, kind: 'Class test', title: n.headline || n.title, time: n.focus && n.focus.hasTime ? `${n.focus.big} ${n.focus.ampm}` : '', done: false });
  });
  // Open ones first, by date; finished ones go to the end instead of disappearing
  items.sort((a, b) => (a.done - b.done) || a.date.localeCompare(b.date));
  if (_dueOrder) {
    const at = id => { const i = _dueOrder.indexOf(id); return i < 0 ? 999 : i; };
    items.sort((a, b) => at(a.id) - at(b.id));
  }
  _dueOrder = items.map(i => i.id);
  const open = items.filter(i => !i.done).length;
  if (!items.length) return `${compactHead('due', 'Due soon', 0, 'notices')}<div class="hm-empty hm-empty-sm">Nothing due this week.</div>`;
  const when = date => { const n = daysUntil(date, ymd(now)); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`; };
  // The count is what is still unchecked: red when any of it is due today or tomorrow, a green tick when all is done
  const urgent = items.some(i => !i.done && daysUntil(i.date, ymd(now)) <= 1);
  const countLabel = open ? String(open) : svg(IC.check, 3);
  return `${compactHead('due', 'Due soon', countLabel, 'notices', open ? (urgent ? 'red' : '') : 'green')}<div class="hm-dscroll" role="list">${items.map(it => {
    const soon = !it.done && daysUntil(it.date, ymd(now)) <= 1;
    return `<div class="hm-dcard${it.done ? ' is-done' : ''}${soon ? ' is-soon' : ''}${it.kind === 'Class test' ? ' is-test' : ''}" data-did="${escapeHtml(it.id)}" role="listitem">
        <button type="button" class="hm-dmain" data-act="notice" data-id="${escapeHtml(it.id)}">
          <span class="hm-dwhen">${it.done ? 'Done' : escapeHtml(when(it.date))}</span>
          <strong>${escapeHtml(it.title)}</strong>
          <span class="hm-dmeta">${it.kind}${it.time ? ` · ${escapeHtml(it.time)}` : ''}</span>
        </button>
        ${it.task ? `<button type="button" class="hm-dtick${it.done ? ' is-on' : ''}" data-act="done" data-id="${escapeHtml(it.id)}" aria-pressed="${it.done}" aria-label="${it.done ? 'Mark as not done' : 'Mark as done'}">${svg(IC.check, 2.6)}<span>${it.done ? 'Undo' : 'Done'}</span></button>` : `<span class="hm-dflag">${svg(IC.exams)}Test</span>`}
      </div>`;
  }).join('')}</div>${items.length > 1 ? `<div class="hm-dots" role="presentation">${items.map((_, i) => `<i class="${i === 0 ? 'is-on' : ''}"></i>`).join('')}</div>` : ''}`;
}

/** Every upcoming exam: class tests from notices plus the student's own, soonest first. */
function collectExams(now) {
  const ctx = noticeCtx();
  const tests = (State.announcementsList || []).filter(a => a.type === 'class_test').map(a => {
    const n = toNotice(a, ctx);
    let name = 'Class test';
    try { const j = typeof a.announcement === 'string' ? JSON.parse(a.announcement) : (a.announcement || {}); if (j && j.exam_name) name = String(j.exam_name).trim() || name; } catch (e) {}
    return { id: a.id, subject: n.subject || a.subject_override || a.subject, date: String(a.date_override || '').slice(0, 10), name, time: n.focus && n.focus.hasTime ? `${n.focus.big} ${n.focus.ampm}` : '' };
  });
  return upcomingExams(listOwnExams(), tests, ymd(now)).filter(e => !(e.date === ymd(now) && passedToday(now, e.subject, minOf(e.time))));
}

function examsCard(now) {
  const list = collectExams(now);
  const add = `<button type="button" class="hm-more" data-act="add-exam">${svg(IC.plus, 2.4)}Add</button>`;
  if (!list.length) return `${cardHead('exams', 'Exams', { right: add })}<div class="hm-xempty"><span>${svg(IC.exams, 1.8)}</span><p>No exams coming up. Add your midterm and final dates and the countdown shows here.</p></div>`;
  const [first, ...rest] = list;
  const days = daysUntil(first.date, ymd(now));
  const rowAct = e => (e.source === 'notice' ? `data-act="notice" data-id="${escapeHtml(String(e.noticeId))}"` : `data-act="edit-exam" data-id="${escapeHtml(e.id)}"`);
  const fd = fromYmd(first.date);
  const count = days === 0 ? ['Today', ''] : days === 1 ? ['1', 'day left'] : [String(days), 'days left'];
  const inText = n => (n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n}d`);
  const soon = days <= 3;
  return `${cardHead('exams', 'Exams', { right: add })}
    <button type="button" class="hm-xhero${soon ? ' is-soon' : ''}" ${rowAct(first)}>
      <span class="hm-xcount${count[1] ? '' : ' is-word'}"><b>${escapeHtml(count[0])}</b>${count[1] ? `<i>${count[1]}</i>` : ''}</span>
      <span class="hm-xmain">
        <strong>${escapeHtml(first.subject)}</strong>
        <span>${escapeHtml(first.label)} · ${escapeHtml(DAY_NAMES[fd.getDay()])} ${fd.getDate()} ${escapeHtml(MONTHS[fd.getMonth()])}${first.time ? ` · ${escapeHtml(first.time)}` : ''}</span>
        ${fullName(first.subject) ? `<em>${escapeHtml(fullName(first.subject))}</em>` : ''}
      </span>
    </button>
    ${rest.length ? `<div class="hm-xlist">${rest.slice(0, 3).map(e => {
      const d = fromYmd(e.date);
      return `<button type="button" class="hm-xrow" ${rowAct(e)}>
        <span class="hm-xdate"><b>${d.getDate()}</b><i>${escapeHtml(MONTHS[d.getMonth()].slice(0, 3))}</i></span>
        <span class="hm-xt"><strong>${escapeHtml(e.subject)} · ${escapeHtml(e.label)}</strong><span>${escapeHtml(DAY_NAMES[d.getDay()])}${e.time ? ` · ${escapeHtml(e.time)}` : ''}</span></span>
        <span class="hm-xin">${inText(daysUntil(e.date, ymd(now)))}</span>
      </button>`;
    }).join('')}</div>${rest.length > 3 ? `<p class="hm-xmore">+${rest.length - 3} more exams</p>` : ''}` : ''}`;
}

function teachersCard(now) {
  const d = focusDay(now);
  const seen = new Map();
  heldOn(d).forEach(c => {
    const code = String(c.instructor || c.teacher || '').trim();
    if (!code || seen.has(code)) return;
    seen.set(code, c);
  });
  if (!seen.size) return `${cardHead('teachers', `${dayWord(d, now)}'s teachers`)}<div class="hm-empty">No teachers listed.</div>`;
  return `${cardHead('teachers', `${dayWord(d, now)}'s teachers`)}<div class="hm-rows">${[...seen.entries()].map(([code, c]) => {
    const i = getTeacherInfo(code) || {};
    const email = (i.emails || [])[0] || '';
    const initials = String(i.name || code).replace(/^(Dr\.|Mr\.|Ms\.|Mrs\.|Prof\.)\s*/i, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `<div class="hm-teacher">
        <button type="button" class="hm-row" data-act="teacher" data-code="${escapeHtml(code)}">
          <span class="hm-avatar">${i.photo ? `<img src="${escapeHtml(i.photo)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<b>${escapeHtml(initials)}</b></span>
          <span class="hm-row-main"><strong>${escapeHtml(i.name || code)}</strong><span>${escapeHtml(c.title)} · ${escapeHtml(format12h(c.start))} · ${escapeHtml(formatRoom(c.room) ? `Room ${formatRoom(c.room)}` : 'Room TBA')}</span></span>
        </button>
        ${email ? `<a class="hm-tick" href="mailto:${escapeHtml(email)}" aria-label="Email ${escapeHtml(i.name || code)}">${svg(IC.mail)}</a>` : ''}
      </div>`;
  }).join('')}</div>`;
}

function noticesCard() {
  const ctx = noticeCtx();
  const list = (Announcements.list || []).filter(a => !Announcements.isRead(a.id))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  if (!list.length) return `${cardHead('notices', 'Unread notices', { more: 'All', moreAct: 'notices' })}<div class="hm-empty">You're all caught up.</div>`;
  return `${cardHead('notices', `Unread notices · ${list.length}`, { more: 'All', moreAct: 'notices' })}<div class="hm-rows">${list.slice(0, 3).map(a => {
    const n = toNotice(a, ctx);
    return `<button type="button" class="hm-row" data-act="notice" data-id="${escapeHtml(String(a.id))}">
        <span class="hm-row-ico tone-${n.tone}">${svg(ICONS[n.tone] || ICONS.general, 1.9)}</span>
        <span class="hm-row-main"><strong>${escapeHtml(n.headline || n.title)}</strong><span>${escapeHtml(n.meta.label)}${n.date ? ` · ${escapeHtml(dayWord(fromYmd(n.date)))}` : ''}</span></span>
        ${a.source === 'community' ? confirmBadgeHtml('verified', a.id, 'cf-inline') : ''}
      </button>`;
  }).join('')}</div>`;
}

function suggestionsCard() {
  const ctx = noticeCtx();
  const list = (Suggestions.list || []).filter(s => s.state !== 'hidden').slice(0, 3);
  if (!list.length) return `${cardHead('suggestions', 'Suggestions to vote', { more: 'All', moreAct: 'suggestions' })}<div class="hm-empty">Nothing to vote on right now.</div>`;
  return `${cardHead('suggestions', 'Suggestions to vote', { more: 'All', moreAct: 'suggestions' })}<div class="hm-rows">${list.map(s => {
    const n = toNotice(Object.assign({}, s, { id: 's' + s.id }), ctx);
    const p = Suggestions.progress(s);
    const mine = Suggestions.myVote(s.id);
    return `<div class="hm-sug">
        <button type="button" class="hm-vote${mine === 1 ? ' is-on' : ''}" data-act="vote" data-id="${escapeHtml(String(s.id))}" data-val="1" aria-label="Agree">${svg(IC.up, 2.4)}</button>
        <button type="button" class="hm-row" data-act="suggestion" data-id="${escapeHtml(String(s.id))}">
          <span class="hm-row-main"><strong>${escapeHtml(n.headline || n.title)}</strong><span>${p.up - p.down >= 0 ? '+' : ''}${p.up - p.down} · ${p.total}/${p.goal} votes</span></span>
        </button>
        <button type="button" class="hm-vote${mine === -1 ? ' is-on is-down' : ''}" data-act="vote" data-id="${escapeHtml(String(s.id))}" data-val="-1" aria-label="Disagree">${svg(IC.down, 2.4)}</button>
      </div>`;
  }).join('')}</div>`;
}

function actionsCard() {
  const a = [['rooms', IC.door, 'Free rooms'], ['faculty', IC.search, 'Find a teacher'], ['routine', IC.grid, 'Weekly routine'], ['suggest', IC.bulb, 'Suggest'],
    ['notif', IC.notices, 'Alerts'], ['attendance', IC.attendance, 'Attendance'], ['notes', IC.notes, 'Notes'], ['add-exam', IC.exams, 'Add exam']];
  return `${cardHead('actions', 'Quick actions')}<div class="hm-qa">${a.map(([act, ic, label]) => `<button type="button" class="hm-action" data-act="${act}"><span>${svg(ic)}</span>${escapeHtml(label)}</button>`).join('')}</div>`;
}

const RENDER = { header: headerCard, now: nowCard, changes: changesCard, due: dueCard, exams: examsCard, teachers: teachersCard, notices: noticesCard, suggestions: suggestionsCard, actions: actionsCard };

/* ── Shell, render, edit mode ─────────────────────────────────────────────── */
let _editing = false;
let _fadeNext = false; // after a tap: cards whose content changed fade in (motion rule: no snapping)
let _shellSig = '';
let _dragging = null;

function shell(layout) {
  const label = id => (CARDS.find(c => c.id === id) || {}).label || id;
  return `<div class="hm-list${_editing ? ' is-editing' : ''}">
      ${_editing ? `<div class="hm-editbar"><span>Drag to reorder · switch cards on or off</span><button type="button" class="hm-btn is-ghost" data-act="reset-layout">Reset</button><button type="button" class="hm-btn" data-act="edit-done">Done</button></div>` : ''}
      ${layout.order.filter(id => _editing || !layout.hidden.includes(id)).map(id => `
        <section class="hm-card hm-${id}${layout.hidden.includes(id) ? ' is-hidden' : ''}" data-card="${id}">
          ${_editing && id !== 'header' ? `<div class="hm-edit-row"><span class="hm-grip" data-grip="${id}" aria-label="Drag ${escapeHtml(label(id))}">${svg(IC.grip, 2.4)}</span><span class="hm-edit-label">${escapeHtml(label(id))}</span>
            <label class="hm-switch"><input type="checkbox" data-show="${id}" ${layout.hidden.includes(id) ? '' : 'checked'}><span></span></label></div>` : ''}
          <div class="hm-body" id="hmBody-${id}"></div>
        </section>`).join('')}
      ${_editing ? '' : '<button type="button" class="hm-edit-home" data-act="edit">Edit Home</button>'}
    </div>`;
}

export function renderHome(force = false) {
  const root = $('homeView');
  if (!root || _dragging) return;
  const layout = getLayout();
  const sig = `${layout.order.join(',')}|${layout.hidden.join(',')}|${_editing}`;
  if (force || sig !== _shellSig || !root.querySelector('.hm-list')) {
    root.innerHTML = shell(layout);
    _shellSig = sig;
  }
  const now = new Date();
  const fade = _fadeNext && document.documentElement.dataset.motion !== 'off';
  _fadeNext = false;
  layout.order.forEach(id => {
    const body = $(`hmBody-${id}`);
    if (!body) return;
    if (_editing && layout.hidden.includes(id)) { setHtmlIfChanged(body, ''); return; }
    let html = '';
    try { html = RENDER[id](now); } catch (e) { console.warn('Home card failed:', id, e); html = '<div class="hm-empty">Could not load this card.</div>'; }
    const pager = id === 'due' ? body.querySelector('.hm-dscroll') : null;
    const keepLeft = pager ? pager.scrollLeft : 0;
    const changedBody = setHtmlIfChanged(body, html);
    if (changedBody && pager && keepLeft) { const np = body.querySelector('.hm-dscroll'); if (np) { np.scrollLeft = keepLeft; syncDots(np); } }
    if (changedBody && fade && body.animate) body.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  });
}

function setEditing(on) {
  _editing = on;
  renderHome(true);
  const root = $('homeView');
  if (root && root.animate && document.documentElement.dataset.motion !== 'off') root.querySelector('.hm-list')?.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
}

function openClass(date, title, start) {
  const d = fromYmd(date);
  const c = classesOn(d).find(x => x.title === title && String(x.start) === String(start));
  if (c) showClassDetails(detailFor(c, d));
}

/** Dots under the Due soon pager: the dot of the card in view is the long one. */
function syncDots(scroller) {
  if (!scroller) return;
  const first = scroller.firstElementChild;
  const step = first ? first.offsetWidth + 10 : 0;
  const idx = step ? Math.min(scroller.children.length - 1, Math.round(scroller.scrollLeft / step)) : 0;
  const dots = scroller.parentElement && scroller.parentElement.querySelectorAll('.hm-dots i');
  if (dots) dots.forEach((d, i) => d.classList.toggle('is-on', i === idx));
}

/** Mark an assignment done (or undo). The card stays where it is, only greyed; it moves to the end on the next refresh. */
function markDueDone(id) {
  _fadeNext = false;
  const nowDone = toggleDeadlineDone(id);
  renderHome();
  const card = document.querySelector(`.hm-dcard[data-did="${CSS.escape(String(id))}"]`);
  const next = document.querySelector('.hm-dscroll');
  if (next) syncDots(next);
  if (card && card.animate && document.documentElement.dataset.motion !== 'off') card.animate([{ opacity: nowDone ? 1 : 0.55 }, { opacity: nowDone ? 0.55 : 1 }], { duration: 320, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
}

/** A real refresh (pull down, coming back to Home, reopening the app): finished cards settle at the end. */
function settleDue() { _dueOrder = null; }

async function onAct(act, el) {
  const view = v => window.switchAppView && window.switchAppView(v);
  switch (act) {
    case 'class': return openClass(el.dataset.date, el.dataset.title, el.dataset.start);
    case 'notice': {
      const id = el.dataset.id;
      if (/^s\d+/.test(id)) return window.__openSuggestion && window.__openSuggestion(id.slice(1));
      view('announcements');
      return window.__openNotice && window.__openNotice(id);
    }
    case 'suggestion': return window.__openSuggestion && window.__openSuggestion(el.dataset.id);
    case 'suggestions': view('announcements'); setTimeout(() => { const b = document.querySelector('#ntTabs button[data-tab="suggestions"]'); if (b && !b.classList.contains('active')) b.click(); }, 60); return undefined;
    case 'notices': return view('announcements');
    case 'day': return view('day');
    case 'rooms': return view('free_rooms');
    case 'faculty': return view('faculty');
    case 'routine': return document.getElementById('dockRoutineBtn')?.click();
    case 'suggest': return view('post_announcement', { __suggest: true });
    case 'notif': return document.getElementById('notifSettingsBtn')?.click();
    case 'settings': return document.getElementById('editBtn')?.click();
    case 'calendar': view('day'); return window.openCalendarPicker && window.openCalendarPicker();
    case 'attendance': return window.__openAttendance && window.__openAttendance();
    case 'mark': setMark(el.dataset.key, el.dataset.val); _markedAt[el.dataset.key] = Date.now(); clearTimeout(_markTimer); _markTimer = setTimeout(() => renderHome(), MARK_SHOW_MS + 150); return renderHome();
    case 'skip-all': { const now = new Date(); pendingToday(now, attendanceByTitle()).forEach(x => setSkipped(x.key, true)); return renderHome(); }
    case 'att-subject': return window.__openAttendance && window.__openAttendance('', el.dataset.subject);
    case 'notes': return window.__openNotes && window.__openNotes();
    case 'teacher': return openTeacherDetailByCode(el.dataset.code);
    case 'done': return markDueDone(el.dataset.id);
    case 'vote': { const pending = Suggestions.vote(el.dataset.id, Number(el.dataset.val)); renderHome(); await pending; return renderHome(); } // show the vote at once (optimistic), settle after the server answers
    case 'add-exam': return openExamSheet(null, renderHome);
    case 'edit-exam': return openExamSheet(el.dataset.id, renderHome);
    case 'edit': return setEditing(true);
    case 'edit-done': return setEditing(false);
    case 'reset-layout': resetLayout(); return renderHome(true);
    default: return undefined;
  }
}

/* Drag to reorder (edit mode). One start/move/end core for touch and mouse (desktop-input.js rule).
   Card positions are measured once when the drag starts; moving only sets transforms. */
function dragStart(grip, y) {
  const root = $('homeView');
  const list = root.querySelector('.hm-list');
  const cards = [...list.querySelectorAll('.hm-card')].filter(c => c.dataset.card !== 'header');
  const card = grip.closest('.hm-card');
  const rects = cards.map(c => { const r = c.getBoundingClientRect(); return { el: c, top: r.top, h: r.height }; });
  const from = cards.indexOf(card);
  const gap = rects.length > 1 ? Math.max(0, rects[1].top - (rects[0].top + rects[0].h)) : 10;
  _dragging = { root, list, cards, rects, from, to: from, y0: y, y, card, gap, s0: root.scrollTop, timer: null };
  card.classList.add('is-dragging');
  cards.forEach(c => { if (c !== card) c.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)'; });
  // Near the top or bottom edge the page scrolls on its own, so a card can travel the whole list
  _dragging.timer = setInterval(() => {
    const d = _dragging;
    if (!d) return;
    const edge = 110;
    const v = d.y < edge ? -Math.ceil((edge - d.y) / 6) : d.y > window.innerHeight - edge - 60 ? Math.ceil((d.y - (window.innerHeight - edge - 60)) / 6) : 0;
    if (!v) return;
    const before = d.root.scrollTop;
    d.root.scrollTop = before + v;
    if (d.root.scrollTop !== before) dragMove(d.y);
  }, 16);
}
function dragMove(y) {
  const d = _dragging;
  if (!d) return;
  d.y = y;
  const ds = d.root.scrollTop - d.s0; // page scrolled since the drag began
  const dy = y - d.y0 + ds;
  d.card.style.transform = `translateY(${dy}px)`;
  const mid = d.rects[d.from].top + d.rects[d.from].h / 2 + dy;
  let to = d.from;
  d.rects.forEach((r, i) => {
    if (i < d.from && mid < r.top + r.h / 2) to = Math.min(to, i);
    if (i > d.from && mid > r.top + r.h / 2) to = Math.max(to, i);
  });
  d.to = to;
  const shift = d.rects[d.from].h + d.gap;
  d.cards.forEach((c, i) => {
    if (i === d.from) return;
    const off = (d.from < to && i > d.from && i <= to) ? -shift : (d.from > to && i >= to && i < d.from) ? shift : 0;
    c.style.transform = off ? `translateY(${off}px)` : '';
  });
}
function dragEnd() {
  const d = _dragging;
  if (!d) return;
  clearInterval(d.timer);
  _dragging = null;
  const ids = d.cards.map(c => c.dataset.card);
  const [moved] = ids.splice(d.from, 1);
  ids.splice(d.to, 0, moved);
  d.cards.forEach(c => { c.style.transform = ''; c.style.transition = ''; c.classList.remove('is-dragging'); });
  const layout = getLayout();
  saveLayout({ order: ['header', ...ids], hidden: layout.hidden });
  const keep = d.root.scrollTop;
  renderHome(true);
  d.root.scrollTop = keep;
}

let _bound = false;
export function initHome() {
  const root = $('homeView');
  if (!root || _bound) return;
  _bound = true;
  root.addEventListener('click', e => {
    if (e.target.closest('.cf-badge')) return;
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el) || _dragging) return;
    if (el.tagName === 'A') return;
    e.preventDefault();
    _fadeNext = true;
    Promise.resolve(onAct(el.dataset.act, el)).finally(() => { _fadeNext = false; });
  });
  root.addEventListener('change', e => {
    const id = e.target.dataset && e.target.dataset.show;
    if (!id) return;
    const layout = getLayout();
    const hidden = new Set(layout.hidden);
    e.target.checked ? hidden.delete(id) : hidden.add(id);
    saveLayout({ order: layout.order, hidden: [...hidden] });
    const card = e.target.closest('.hm-card');
    if (card) card.classList.toggle('is-hidden', !e.target.checked);
    _shellSig = `${getLayout().order.join(',')}|${[...hidden].join(',')}|${_editing}`;
    renderHome();
  });

  // Long-press a card → edit mode (a scroll or a move cancels it)
  let lp = null;
  const lpCancel = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
  root.addEventListener('touchstart', e => {
    if (_editing || e.touches.length !== 1 || e.target.closest('input, a, .hm-att-btn, .hm-vote')) return;
    const t = e.touches[0];
    lp = { x: t.clientX, y: t.clientY, t: setTimeout(() => { lp = null; if (window.__motion) window.__motion.haptic('heavy'); setEditing(true); }, 550) };
  }, { passive: true });
  root.addEventListener('touchmove', e => {
    if (lp) { const t = e.touches[0]; if (Math.hypot(t.clientX - lp.x, t.clientY - lp.y) > 10) lpCancel(); }
    if (_dragging) dragMove(e.touches[0].clientY);
  }, { passive: true });
  root.addEventListener('touchend', () => { lpCancel(); if (_dragging) dragEnd(); }, { passive: true });
  root.addEventListener('touchcancel', () => { lpCancel(); if (_dragging) dragEnd(); }, { passive: true });
  root.addEventListener('contextmenu', e => { if (!_editing && e.target.closest('.hm-card')) { e.preventDefault(); setEditing(true); } });
  // Drag handles: touch (the grip has touch-action: none, so the page does not scroll under the finger)
  root.addEventListener('touchstart', e => {
    const g = e.target.closest('[data-grip]');
    if (!_editing || !g) return;
    dragStart(g, e.touches[0].clientY);
  }, { passive: true });
  // … and the mouse
  bindMouseDrag(root, {
    start: (x, y, el) => { const g = el.closest && el.closest('[data-grip]'); if (!_editing || !g) return false; dragStart(g, y); return true; },
    move: (x, y) => dragMove(y),
    end: () => dragEnd()
  });

  // The Due soon pager: its dots follow the card in view (scroll does not bubble, so listen while capturing)
  root.addEventListener('scroll', e => { const t = e.target; if (t && t.classList && t.classList.contains('hm-dscroll')) syncDots(t); }, true);

  window.__renderHome = renderHome;
  window.__homeRefresh = () => { settleDue(); renderHome(true); };
  // Minute tick while Home is visible (the clock, now/next, countdowns)
  setInterval(() => {
    if (document.hidden || (window.__currentAppViewId || 'home') !== 'home' || _editing) return;
    renderHome();
  }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && (window.__currentAppViewId || 'home') === 'home') { settleDue(); renderHome(); } });
  renderHome(true);
}
