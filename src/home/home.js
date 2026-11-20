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
import { getDeadlinesDone, setDeadlineDoneFlag } from './home-deadlines.js';
import { setMark, getSemesterStart } from '../attendance/attendance.js';
import { wasHeld } from '../attendance/held-classes.js';
import { attendanceData } from '../attendance/attendance-data.js';
import { listNotes, toggleNote, notesForSubject } from '../notes/notes-store.js';
import { listOwnExams, upcomingExams, daysUntil } from '../exams/exams-store.js';
import { CARDS, getLayout, saveLayout, resetLayout } from './layout-store.js';
import { openNoteSheet, openExamSheet } from './home-sheets.js';

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
  const left = today.filter(c => toMinutes(c.end) > nowM);
  let sum;
  if (hol && hol.type === 'holiday' && !today.length) sum = 'Campus closed today';
  else if (!today.length) sum = 'No classes today';
  else if (!left.length) sum = `Done for today · ${today.length} ${today.length === 1 ? 'class' : 'classes'}`;
  else sum = `${today.length} ${today.length === 1 ? 'class' : 'classes'} today · ${left.length === today.length ? `first at ${format12h(today[0].start)}` : `${left.length} to go`}`;
  const t = `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `<div class="hm-top">
      <button type="button" class="hm-date" data-act="calendar">${escapeHtml(`${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`)}</button>
      <button type="button" class="hm-gear" data-act="settings" aria-label="Settings">${svg(IC.gear)}</button>
    </div>
    <div class="hm-clock"><span class="hm-clock-t">${t}</span><span class="hm-clock-p">${h >= 12 ? 'PM' : 'AM'}</span></div>
    <p class="hm-hello">${escapeHtml(hi)}, <strong>${escapeHtml(name)}</strong></p>
    <p class="hm-sum">${escapeHtml(sum)}</p>`;
}

function nowCard(now) {
  const nowM = now.getHours() * 60 + now.getMinutes();
  const todayList = heldOn(now);
  const cur = todayList.find(c => toMinutes(c.start) <= nowM && nowM < toMinutes(c.end));
  const later = todayList.filter(c => toMinutes(c.start) > nowM);
  const room = c => (c.isOnline || c.isMovedOnline) ? 'Online' : (formatRoom(c.room) ? `Room ${formatRoom(c.room)}` : 'Room TBA');
  const teacher = c => { const code = c.instructor || c.teacher || ''; const i = code ? getTeacherInfo(code) : null; return (i && i.name) || code; };
  const badge = c => (c.isUnconfirmed ? confirmBadgeHtml('unverified', c.unconfirmedId || '', 'cf-inline') : '');
  const joinBtn = (c, date) => {
    if (!(c.isOnline || c.isMovedOnline)) return '';
    const ov = getOverrideFor(ymd(date), c.title);
    const link = ov && ov.announcement ? toNotice(ov.announcement, noticeCtx()).link : '';
    return link ? `<a class="hm-join" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${svg(IC.play)}Join online class</a>` : '';
  };
  const examTag = (c, d) => (isExamClass(c, d) ? '<span class="hm-tag is-exam">Test</span>' : '');
  if (cur) {
    const s = toMinutes(cur.start), e = toMinutes(cur.end);
    const next = later[0];
    const prog = Math.min(1, Math.max(0, (nowM - s) / Math.max(1, e - s)));
    return `<button type="button" class="hm-hero is-live" data-act="class" data-date="${ymd(now)}" data-title="${escapeHtml(cur.title)}" data-start="${escapeHtml(cur.start)}">
        <span class="hm-hero-k"><i class="hm-live-dot"></i>Now · ${escapeHtml(inMins(e - nowM))} left</span>
        <span class="hm-hero-t">${escapeHtml(cur.title)}${examTag(cur, now)}${badge(cur)}</span>
        <span class="hm-hero-s">${escapeHtml(room(cur))} · ${escapeHtml(teacher(cur))} · until ${escapeHtml(format12h(cur.end))}</span>
        <span class="hm-bar"><i style="transform:scaleX(${prog.toFixed(3)})"></i></span>
        <span class="hm-hero-n">${next ? `Next: <strong>${escapeHtml(next.title)}</strong> at ${escapeHtml(format12h(next.start))} · ${escapeHtml(room(next))}` : 'Last class today'}</span>
      </button>${joinBtn(cur, now)}`;
  }
  if (later.length) {
    const n = later[0];
    const wait = toMinutes(n.start) - nowM;
    const hadOne = todayList.some(c => toMinutes(c.end) <= nowM);
    return `<button type="button" class="hm-hero" data-act="class" data-date="${ymd(now)}" data-title="${escapeHtml(n.title)}" data-start="${escapeHtml(n.start)}">
        <span class="hm-hero-k">${hadOne ? `Break · free for ${escapeHtml(inMins(wait))}` : `Next class in ${escapeHtml(inMins(wait))}`}</span>
        <span class="hm-hero-t">${escapeHtml(n.title)}${examTag(n, now)}${badge(n)}</span>
        <span class="hm-hero-s">${escapeHtml(format12h(n.start))} · ${escapeHtml(room(n))} · ${escapeHtml(teacher(n))}</span>
      </button>${joinBtn(n, now)}${hadOne && wait >= 30 ? `<button type="button" class="hm-link" data-act="rooms">${svg(IC.door)}Find a free room for the break</button>` : ''}`;
  }
  const d = focusDay(now);
  const first = heldOn(d)[0];
  const word = dayWord(d, now);
  if (!first) return `<div class="hm-empty">No classes in the next two weeks.</div>`;
  return `<button type="button" class="hm-hero" data-act="class" data-date="${ymd(d)}" data-title="${escapeHtml(first.title)}" data-start="${escapeHtml(first.start)}">
      <span class="hm-hero-k">${todayList.length ? 'Done for today · ' : ''}${escapeHtml(word)}'s first class</span>
      <span class="hm-hero-t">${escapeHtml(first.title)}${examTag(first, d)}${badge(first)}</span>
      <span class="hm-hero-s">${escapeHtml(format12h(first.start))} · ${escapeHtml(room(first))} · ${escapeHtml(teacher(first))}</span>
    </button>`;
}

const CHANGE_TYPES = new Set(['cancellation', 'rescheduled', 'online_class', 'class_test', 'holiday']);
function changesCard(now) {
  const days = [ymd(now)];
  const f = ymd(focusDay(now));
  if (!days.includes(f)) days.push(f);
  const tomorrow = ymd(addDays(now, 1));
  if (!days.includes(tomorrow)) days.push(tomorrow);
  const ctx = noticeCtx();
  const items = (State.announcementsList || []).filter(a => CHANGE_TYPES.has(a.type) && days.includes(String(a.date_override || '').slice(0, 10)))
    .map(a => ({ a, n: toNotice(a, ctx) }))
    .sort((x, y) => String(x.n.date).localeCompare(String(y.n.date)));
  if (!items.length) return `${cardHead('changes', 'What changed')}<div class="hm-empty">No changes to your routine for ${days.length > 1 ? 'today or the next class day' : 'today'}.</div>`;
  return `${cardHead('changes', 'What changed', { more: 'Notices', moreAct: 'notices' })}<div class="hm-rows">${items.slice(0, 6).map(({ a, n }) => `
      <button type="button" class="hm-row" data-act="notice" data-id="${escapeHtml(String(a.id))}">
        <span class="hm-row-ico tone-${n.tone}">${svg(ICONS[n.tone] || ICONS.general, 1.9)}</span>
        <span class="hm-row-main"><strong>${escapeHtml(n.headline || n.title)}</strong><span>${escapeHtml(dayWord(fromYmd(n.date), now))}${(n.lines || [])[0] ? ` · ${escapeHtml(n.lines[0])}` : ''}</span></span>
        ${a.is_unconfirmed ? confirmBadgeHtml('unverified', a.id, 'cf-inline') : ''}
      </button>`).join('')}</div>`;
}

function attendanceCard(now) {
  const start = getSemesterStart(CONFIG.semesterStart);
  if (!start) return `${cardHead('attendance', 'Attendance')}<div class="hm-empty">Set when your semester started to start tracking.<button type="button" class="hm-btn" data-act="attendance">Set up</button></div>`;
  const { held, att, stats } = attendanceData(now);
  const recent = [ymd(now), ymd(addDays(now, -1))];
  const ask = held.filter(h => recent.includes(h.date) && !att.marks[h.key]).slice(-4).reverse();
  const risky = stats.filter(s => s.atRisk);
  const counted = stats.filter(s => s.counted);
  const unmarked = held.filter(h => !att.marks[h.key]).length;
  const line = !counted.length ? (unmarked ? `${unmarked} classes since ${fromYmd(start).getDate()} ${MONTHS[fromYmd(start).getMonth()]} to mark. Tap to start.` : 'Mark a class to start your percentages.')
    : risky.length ? `${risky.map(s => `${s.subject} ${s.pct}%`).join(' · ')} below ${att.min}%`
    : `All subjects at or above ${att.min}%`;
  return `${cardHead('attendance', 'Attendance', { more: 'Details', moreAct: 'attendance' })}
    ${ask.length ? `<p class="hm-att-q">Were you in ${ask.length === 1 ? 'this class' : 'these classes'}?</p><div class="hm-rows">${ask.map(h => `
      <div class="hm-att">
        <span class="hm-row-main"><strong>${escapeHtml(h.subject)}</strong><span>${escapeHtml(dayWord(fromYmd(h.date), now))} · ${escapeHtml(format12h(h.start).replace(/^0/, ''))}</span></span>
        <button type="button" class="hm-att-btn is-yes is-icon" data-act="mark" data-key="${escapeHtml(h.key)}" data-val="present" aria-label="Present at ${escapeHtml(h.subject)}" title="Present">${svg(IC.check, 2.6)}</button>
        <button type="button" class="hm-att-btn is-no is-icon" data-act="mark" data-key="${escapeHtml(h.key)}" data-val="absent" aria-label="Absent from ${escapeHtml(h.subject)}" title="Absent">${svg(IC.x, 2.6)}</button>
      </div>`).join('')}</div>` : ''}
    <button type="button" class="hm-att-sum${risky.length ? ' is-risk' : ''}" data-act="attendance">${escapeHtml(line)}</button>`;
}

function todayCard(now) {
  const d = focusDay(now);
  const word = dayWord(d, now);
  const list = classesOn(d).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const isToday = ymd(d) === ymd(now);
  const nowM = now.getHours() * 60 + now.getMinutes();
  const nextIdx = isToday ? list.findIndex(c => wasHeld(c) && toMinutes(c.start) > nowM) : list.findIndex(wasHeld);
  const rows = list.map((c, i) => {
    let st = '';
    if (!wasHeld(c)) st = c.isCancelled ? 'Cancelled' : 'Moved';
    else if (isToday && toMinutes(c.end) <= nowM) st = 'Done';
    else if (isToday && toMinutes(c.start) <= nowM) st = 'Now';
    else if (i === nextIdx) st = 'Next';
    const tags = [isExamClass(c, d) ? 'Test' : '', notesForSubject(c.title).length ? 'Note' : ''].filter(Boolean);
    return `<button type="button" class="hm-cls${!wasHeld(c) ? ' is-off' : ''}${st === 'Done' ? ' is-done' : ''}${st === 'Now' ? ' is-now' : ''}" data-act="class" data-date="${ymd(d)}" data-title="${escapeHtml(c.title)}" data-start="${escapeHtml(c.start)}">
        <span class="hm-cls-t">${escapeHtml(format12h(c.start))}</span>
        <span class="hm-cls-main"><strong>${escapeHtml(c.title)}</strong><span>${escapeHtml((c.isOnline || c.isMovedOnline) ? 'Online' : formatRoom(c.room) ? `Room ${formatRoom(c.room)}` : 'Room TBA')}${tags.length ? ` · ${tags.join(' · ')}` : ''}</span></span>
        ${st ? `<span class="hm-st is-${st.toLowerCase()}">${st}</span>` : ''}
      </button>`;
  }).join('');
  return `${cardHead('today', `${word}'s classes`, { more: 'Full day', moreAct: 'day' })}${rows ? `<div class="hm-rows">${rows}</div>` : '<div class="hm-empty">No classes.</div>'}`;
}

function dueCard(now) {
  const items = [];
  const done = getDeadlinesDone();
  const ctx = noticeCtx();
  for (let i = 0; i < 8; i++) {
    const d = addDays(now, i);
    let dl = [];
    try { dl = getDeadlinesForDate(ymd(d)); } catch (e) {}
    dl.forEach(item => {
      if (done.has(String(item.id))) return;
      const n = toNotice(item, ctx);
      items.push({ id: String(item.id), date: ymd(d), kind: 'Due', title: n.headline || n.title, time: n.focus && n.focus.hasTime ? `${n.focus.big} ${n.focus.ampm}` : '', task: true });
    });
  }
  (State.announcementsList || []).filter(a => a.type === 'class_test').forEach(a => {
    const date = String(a.date_override || '').slice(0, 10);
    if (!date || date < ymd(now) || date > ymd(addDays(now, 7))) return;
    const n = toNotice(a, ctx);
    items.push({ id: String(a.id), date, kind: 'Test', title: n.headline || n.title, time: n.focus && n.focus.hasTime ? `${n.focus.big} ${n.focus.ampm}` : '' });
  });
  items.sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length) return `${cardHead('due', 'Due soon')}<div class="hm-empty">Nothing due in the next 7 days.</div>`;
  const when = date => { const n = daysUntil(date, ymd(now)); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`; };
  return `${cardHead('due', 'Due soon')}<div class="hm-rows">${items.slice(0, 6).map(it => `
      <div class="hm-due">
        <button type="button" class="hm-row" data-act="notice" data-id="${escapeHtml(it.id)}">
          <span class="hm-due-when ${daysUntil(it.date, ymd(now)) <= 1 ? 'is-soon' : ''}">${escapeHtml(when(it.date))}</span>
          <span class="hm-row-main"><strong>${escapeHtml(it.title)}</strong><span>${it.kind}${it.time ? ` · ${escapeHtml(it.time)}` : ''}</span></span>
        </button>
        ${it.task ? `<button type="button" class="hm-tick" data-act="done" data-id="${escapeHtml(it.id)}" aria-label="Mark as done">${svg(IC.check, 2.6)}</button>` : ''}
      </div>`).join('')}</div>`;
}

function examsCard(now) {
  const ctx = noticeCtx();
  const tests = (State.announcementsList || []).filter(a => a.type === 'class_test').map(a => {
    const n = toNotice(a, ctx);
    let name = 'Class test';
    try { const j = typeof a.announcement === 'string' ? JSON.parse(a.announcement) : (a.announcement || {}); if (j && j.exam_name) name = String(j.exam_name).trim() || name; } catch (e) {}
    return { id: a.id, subject: n.subject || a.subject_override || a.subject, date: String(a.date_override || '').slice(0, 10), name, time: n.focus && n.focus.hasTime ? `${n.focus.big} ${n.focus.ampm}` : '' };
  });
  const list = upcomingExams(listOwnExams(), tests, ymd(now));
  const add = `<button type="button" class="hm-more" data-act="add-exam">${svg(IC.plus, 2.4)}Add</button>`;
  if (!list.length) return `${cardHead('exams', 'Exam countdown', { right: add })}<div class="hm-empty">No exams coming up. Add your midterm and final dates.</div>`;
  const [first, ...rest] = list;
  const days = daysUntil(first.date, ymd(now));
  const big = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
  const rowAct = e => (e.source === 'notice' ? `data-act="notice" data-id="${escapeHtml(String(e.noticeId))}"` : `data-act="edit-exam" data-id="${escapeHtml(e.id)}"`);
  return `${cardHead('exams', 'Exam countdown', { right: add })}
    <button type="button" class="hm-exam-big" ${rowAct(first)}>
      <span class="hm-exam-n">${escapeHtml(big)}</span>
      <span class="hm-row-main"><strong>${escapeHtml(first.subject)} · ${escapeHtml(first.label)}</strong><span>${escapeHtml(fullName(first.subject) || '')}${fullName(first.subject) ? ' · ' : ''}${escapeHtml(DAY_NAMES[fromYmd(first.date).getDay()])} ${fromYmd(first.date).getDate()} ${MONTHS[fromYmd(first.date).getMonth()]}${first.time ? ` · ${escapeHtml(first.time)}` : ''}</span></span>
    </button>
    ${rest.length ? `<div class="hm-rows">${rest.slice(0, 4).map(e => `<button type="button" class="hm-row" ${rowAct(e)}><span class="hm-due-when">${daysUntil(e.date, ymd(now))}d</span><span class="hm-row-main"><strong>${escapeHtml(e.subject)} · ${escapeHtml(e.label)}</strong><span>${escapeHtml(DAY_NAMES[fromYmd(e.date).getDay()])} ${fromYmd(e.date).getDate()} ${MONTHS[fromYmd(e.date).getMonth()]}</span></span></button>`).join('')}</div>` : ''}`;
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

function notesCard() {
  const notes = listNotes({ openOnly: true });
  const add = `<button type="button" class="hm-more" data-act="add-note">${svg(IC.plus, 2.4)}Add</button>`;
  if (!notes.length) return `${cardHead('notes', 'Notes', { right: add })}<div class="hm-empty">Jot down a task for a class, like "bring the lab report".</div>`;
  return `${cardHead('notes', 'Notes', { right: add })}<div class="hm-rows">${notes.slice(0, 5).map(n => `
      <div class="hm-note">
        <button type="button" class="hm-check" data-act="note-done" data-id="${n.id}" aria-label="Mark as done">${svg(IC.check, 2.6)}</button>
        <button type="button" class="hm-row" data-act="edit-note" data-id="${n.id}">
          <span class="hm-row-main"><strong>${escapeHtml(n.text)}</strong><span>${escapeHtml([n.subject, n.date ? `${DAY_NAMES[fromYmd(n.date).getDay()]} ${fromYmd(n.date).getDate()} ${MONTHS[fromYmd(n.date).getMonth()]}` : ''].filter(Boolean).join(' · ') || 'General')}</span></span>
        </button>
      </div>`).join('')}</div>`;
}

function actionsCard() {
  const a = [['rooms', IC.door, 'Free rooms'], ['faculty', IC.search, 'Find a teacher'], ['routine', IC.grid, 'Weekly routine'], ['suggest', IC.bulb, 'Suggest'],
    ['notif', IC.notices, 'Notifications'], ['attendance', IC.attendance, 'Attendance'], ['add-exam', IC.exams, 'Add exam'], ['add-note', IC.notes, 'Add note']];
  return `${cardHead('actions', 'Quick actions')}<div class="hm-actions">${a.map(([act, ic, label]) => `<button type="button" class="hm-action" data-act="${act}"><span>${svg(ic)}</span>${escapeHtml(label)}</button>`).join('')}</div>`;
}

const RENDER = { header: headerCard, now: nowCard, changes: changesCard, attendance: attendanceCard, today: todayCard, due: dueCard, exams: examsCard, teachers: teachersCard, notices: noticesCard, suggestions: suggestionsCard, notes: notesCard, actions: actionsCard };

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
    if (setHtmlIfChanged(body, html) && fade && body.animate) body.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
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
    case 'teacher': return openTeacherDetailByCode(el.dataset.code);
    case 'mark': setMark(el.dataset.key, el.dataset.val); return renderHome();
    case 'done': setDeadlineDoneFlag(el.dataset.id); return renderHome();
    case 'vote': { const pending = Suggestions.vote(el.dataset.id, Number(el.dataset.val)); renderHome(); await pending; return renderHome(); } // show the vote at once (optimistic), settle after the server answers
    case 'note-done': toggleNote(el.dataset.id); return renderHome();
    case 'add-note': return openNoteSheet(null, renderHome);
    case 'edit-note': return openNoteSheet(el.dataset.id, renderHome);
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

  window.__renderHome = renderHome;
  // Minute tick while Home is visible (the clock, now/next, countdowns)
  setInterval(() => {
    if (document.hidden || (window.__currentAppViewId || 'home') !== 'home' || _editing) return;
    renderHome();
  }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && (window.__currentAppViewId || 'home') === 'home') renderHome(); });
  renderHome(true);
}
