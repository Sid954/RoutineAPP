/**
 * Home / Routine page (#dashboardView, redesigned Nov 2026).
 *  - "Now" card: in class (progress, time left, what's after), break (free for, next),
 *    before the first class, done for today, off day / holiday, plus today's test and
 *    deadline alerts. Always about the real now, whatever day is being browsed.
 *  - Heads up: dated notices for the next 7 days (opens the notice sheet)
 *  - Week strip (Thu → Wed) with held-class counts and override markers
 *  - Day header with stats, then the timeline: classes, breaks, deadlines, moved classes
 * Kept IDs: chG, focalStripContainer, timelineTitle, timelineSubtitle, dateBadgeBtn, dateD,
 * greetSalutation, greetText, greetSub, editBtn, hD/mD/apD (+ hidden legacy cc/nc block).
 */
import { State } from '../core/state.js';
import { DAY_NAMES } from '../core/config.js';
import { escapeHtml, getCurrentMinutes, LAB_LABEL_HTML } from '../core/utils.js';
import { Storage } from '../storage/storage.js';
import { getOverridesByDateMap } from '../announcements/overrides.js';
import { toNotice, comingUp, countdown } from '../announcements/notice-model.js';
import { showClassDetails } from '../timeline/class-detail.js';
import {
  getDay, isHeld, holidayOn, deadlinesOn, daySummary, buildTimeline, nowState,
  relDay, academicWeek, isClassDay, dur, t12, ymd
} from './home-model.js';

const $ = id => document.getElementById(id);
const P = {
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  task: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  exam: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>',
  moved: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  chev: '<polyline points="9 6 15 12 9 18"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
};
const svg = (d, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let _items = [];            // timeline items of the viewed day (for taps)
let _nowTarget = null;      // class the now card points at
let _lastHash = '';
let _lastDay = null;
let _bound = false;

/* ── Class detail payload (same shape the old timeline sent) ───────────── */
function detailsFor(c, state) {
  const timing = c.hasEnd ? `${t12(c.startM)} – ${t12(c.endM)}` : `Starts at ${t12(c.startM)}`;
  return {
    title: c.title, code: c.title, name: c.name || c.title,
    start: t12(c.startM), end: c.hasEnd ? t12(c.endM) : '', hasExplicitEndTime: c.hasEnd,
    timing, duration: c.hasEnd ? dur(c.endM - c.startM) : '',
    type: c.isLab ? 'Lab' : 'Theory',
    room: c.room || 'TBA',
    instructor: c.teacher || 'TBA', teacher: c.teacher || 'TBA', instructorName: c.teacherName || c.teacher || 'TBA',
    isExam: c.isExam, examName: c.exam ? c.exam.name : '', examTopics: c.exam ? c.exam.topics : '',
    isOnline: c.status === 'online', onlinePlatform: c.platform,
    isCancelled: c.status === 'cancelled', cancelReason: c.cancelReason,
    isRescheduled: c.status === 'moved_in' || c.status === 'moved_away', rescheduledReason: c.movedReason,
    origDate: c.origDate, origStart: c.origStart,
    isLive: state === 'live', isPast: state === 'past',
    dayName: DAY_NAMES[c.dayIdx], dayIdx: c.dayIdx,
    semSec: '', semester: Storage.getSemester(), section: String(Storage.getSection() || '').toUpperCase(),
    isFromTimeline: true
  };
}

/* ── Tags ──────────────────────────────────────────────────────────────── */
function tagsHtml(c) {
  const t = [];
  if (c.isExam) t.push(`<span class="hm-tag is-exam">${escapeHtml(c.exam.name)}</span>`);
  if (c.status === 'cancelled') t.push('<span class="hm-tag is-cancel">Cancelled</span>');
  else if (c.status === 'moved_away') t.push('<span class="hm-tag is-moved">Moved</span>');
  else if (c.status === 'moved_in') t.push('<span class="hm-tag is-moved">Rescheduled</span>');
  else if (c.status === 'online') t.push('<span class="hm-tag is-online">Online</span>');
  else if (c.status === 'extra') t.push('<span class="hm-tag is-extra">Extra</span>');
  if (c.isLab) t.push(`<span class="hm-tag is-lab">${LAB_LABEL_HTML}</span>`);
  return t.join('');
}
const teacherHtml = c => c.teacher
  ? `<span class="teacher-clickable-badge hm-teacher" data-teacher-code="${escapeHtml(c.teacher)}">${escapeHtml(c.teacherName || c.teacher)}</span>`
  : '';
const whereLine = c => [c.room ? (c.room === 'Online' ? 'Online' : `Room ${escapeHtml(c.room)}`) : '', teacherHtml(c)].filter(Boolean).join('<span class="hm-sep">·</span>');

/* ── Now card ──────────────────────────────────────────────────────────── */
function alertsInNow(s) {
  const out = [];
  s.exams.forEach(c => out.push(`<div class="hm-now-alert is-exam">${svg(P.exam)}<span><strong>${escapeHtml(c.exam.name)}</strong> in ${escapeHtml(c.title)} at ${t12(c.startM)}</span></div>`));
  s.deadlines.slice(0, 2).forEach(d => out.push(`<div class="hm-now-alert is-task">${svg(P.task)}<span><strong>${escapeHtml(d.title)}</strong>${d.subject ? ` (${escapeHtml(d.subject)})` : ''} due ${escapeHtml(d.dueText)}</span></div>`));
  return out.length ? `<div class="hm-now-alerts">${out.join('')}</div>` : '';
}

function upcomingLine(up, label = 'Next class') {
  if (!up) return '<div class="hm-now-foot">No classes in the next week</div>';
  return `<div class="hm-now-foot">${label}: <strong>${escapeHtml(up.c.title)}</strong> · ${escapeHtml(relDay(up.date))} ${t12(up.c.startM)}${up.c.room ? ` · ${escapeHtml(up.c.room)}` : ''}</div>`;
}

function renderNow() {
  const box = $('homeNow');
  if (!box) return;
  const s = nowState(new Date());
  _nowTarget = null;
  let html = '';
  if (s.kind === 'live') {
    const c = s.c;
    _nowTarget = { c, state: 'live' };
    const link = c.status === 'online' && /^https?:\/\//i.test(c.platform) ? c.platform : '';
    html = `<div class="hm-now is-live" role="button" tabindex="0" data-now-open>
      <div class="hm-now-top"><span class="hm-now-label"><span class="hm-live-dot"></span>In class now</span><span class="hm-now-step">${s.index} of ${s.summary.count}</span></div>
      <div class="hm-now-main">
        <div class="hm-now-text">
          <div class="hm-now-title">${escapeHtml(c.title)} ${tagsHtml(c)}</div>
          ${c.name ? `<div class="hm-now-name">${escapeHtml(c.name)}</div>` : ''}
          <div class="hm-now-where">${whereLine(c)}</div>
        </div>
        <div class="hm-now-big"><span>${dur(s.leftMins)}</span><small>left</small></div>
      </div>
      <div class="hm-bar"><span style="width:${s.pct.toFixed(1)}%"></span></div>
      <div class="hm-now-times"><span>${t12(c.startM)}</span><span>ends ${t12(c.endM)}</span></div>
      ${link ? `<a class="hm-join" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${svg(P.play)}Join class</a>` : ''}
      ${alertsInNow({ ...s, exams: s.exams.filter(x => x !== c) })}
      ${s.after ? `<div class="hm-now-foot">Then <strong>${escapeHtml(s.after.title)}</strong> at ${t12(s.after.startM)}${s.after.room ? ` · ${escapeHtml(s.after.room)}` : ''}${s.after.startM > c.endM ? ` · ${dur(s.after.startM - c.endM)} break` : ''}</div>` : '<div class="hm-now-foot">Last class today</div>'}
    </div>`;
  } else if (s.kind === 'break' || s.kind === 'before') {
    const c = s.c;
    _nowTarget = { c, state: 'next' };
    const soon = s.inMins <= 15;
    html = `<div class="hm-now is-${s.kind}${soon ? ' is-soon' : ''}" role="button" tabindex="0" data-now-open>
      <div class="hm-now-top"><span class="hm-now-label">${s.kind === 'before' ? (s.summary.count === 1 ? 'Your only class today' : 'First class today') : 'Free right now'}</span><span class="hm-now-step">${s.left} left today</span></div>
      <div class="hm-now-main">
        <div class="hm-now-text">
          <div class="hm-now-kicker">Next up</div>
          <div class="hm-now-title">${escapeHtml(c.title)} ${tagsHtml(c)}</div>
          <div class="hm-now-where">${whereLine(c)}</div>
        </div>
        <div class="hm-now-big"><small>in</small><span>${dur(s.inMins)}</span></div>
      </div>
      <div class="hm-now-times"><span>Starts ${t12(c.startM)}</span>${c.hasEnd ? `<span>until ${t12(c.endM)}</span>` : ''}</div>
      ${alertsInNow(s)}
    </div>`;
  } else {
    const isHol = s.kind === 'holiday';
    const night = s.nowM >= 18 * 60 || s.nowM < 5 * 60;
    const title = isHol ? escapeHtml(s.holiday.title) : (s.kind === 'done' ? 'Done for today' : (s.isClassDay ? 'No classes today' : 'Off day'));
    const sub = s.kind === 'done'
      ? `${s.summary.count} class${s.summary.count === 1 ? '' : 'es'} today${s.summary.busyMins ? ` · ${dur(s.summary.busyMins)} in class` : ''}`
      : (isHol ? 'Holiday · no classes' : 'Nothing scheduled');
    html = `<div class="hm-now is-rest${isHol ? ' is-holiday' : ''}"${s.upcoming ? ' role="button" tabindex="0" data-now-upcoming' : ''}>
      <div class="hm-now-rest">
        <span class="hm-now-icon">${svg(isHol ? P.cal : (night ? P.moon : (s.kind === 'done' ? P.check : P.sun)))}</span>
        <div><div class="hm-now-title">${title}</div><div class="hm-now-name">${sub}</div></div>
      </div>
      ${alertsInNow(s)}
      ${upcomingLine(s.upcoming)}
    </div>`;
    if (s.upcoming) _nowTarget = { c: s.upcoming.c, state: 'later', date: s.upcoming.date };
  }
  box.innerHTML = html;
}

/* ── Heads up (next 7 days of dated notices) ───────────────────────────── */
function renderAlerts() {
  const box = $('homeAlerts');
  if (!box) return;
  const ctx = { semester: String(Storage.getSemester() || '').toLowerCase(), section: String(Storage.getSection() || '').toLowerCase() };
  const list = comingUp((State.announcementsList || []).map(r => toNotice(r, ctx)), new Date(), 7, 8)
    .filter(n => ['class_test', 'assignment', 'holiday', 'cancellation', 'rescheduled', 'online_class'].includes(n.type));
  box.hidden = !list.length;
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="hm-sec-head"><h2>${svg(P.bell)}Heads up</h2><button type="button" class="hm-link" data-open-notices>All notices</button></div>
    <div class="hm-alert-row">${list.map(n => `<button type="button" class="hm-alert tone-${n.tone}" data-notice="${escapeHtml(n.id)}">
      <span class="hm-alert-when">${escapeHtml(countdown(n.date))}${n.time ? ` · ${escapeHtml(n.time)}` : ''}</span>
      <span class="hm-alert-title">${escapeHtml(n.title)}</span>
      <span class="hm-alert-type">${escapeHtml(n.meta.label)}</span>
    </button>`).join('')}</div>`;
}

/* ── Week strip ────────────────────────────────────────────────────────── */
export function renderWeekStrip() {
  const strip = $('focalStripContainer');
  if (!strip) return;
  const today = new Date();
  const view = State.viewDate || today;
  const map = getOverridesByDateMap();
  strip.innerHTML = academicWeek(view).map(d => {
    const dow = d.getDay();
    const ov = map.get(ymd(d));
    const held = getDay(dow, d).filter(isHeld).length;
    const sel = dow === State.currentViewDayIdx && sameDay(d, view);
    const isToday = sameDay(d, today);
    const off = !isClassDay(dow) && !held;
    const types = ov ? (ov.types || [ov.type]) : [];
    const mark = types.includes('holiday') ? 'holiday' : types.includes('class_test') ? 'exam' : types.includes('cancellation') ? 'cancel' : types.includes('assignment') ? 'task' : types.length ? 'other' : '';
    return `<button type="button" class="hm-day${sel ? ' active' : ''}${isToday ? ' is-today' : ''}${off ? ' is-off' : ''}" data-dow="${dow}" data-ts="${d.getTime()}" aria-pressed="${sel}" aria-label="${DAY_NAMES[dow]} ${d.getDate()}${held ? `, ${held} classes` : ''}">
      <span class="hm-day-name">${DAY_NAMES[dow].slice(0, 3)}</span>
      <span class="hm-day-num">${d.getDate()}</span>
      <span class="hm-day-count">${types.includes('holiday') ? 'Off' : (off ? '–' : held)}</span>
      ${mark ? `<span class="hm-day-mark is-${mark}" aria-hidden="true"></span>` : ''}
    </button>`;
  }).join('');

  const dateEl = $('dateD');
  if (dateEl) dateEl.textContent = `${DAY_NAMES[view.getDay()]}, ${view.getDate()} ${MON[view.getMonth()]}`;
  const todayBtn = $('homeTodayBtn');
  if (todayBtn) todayBtn.hidden = sameDay(view, today);
}

/* ── Timeline ──────────────────────────────────────────────────────────── */
function classCardHtml(it, i) {
  const c = it.c;
  const right = it.state === 'live' ? '<span class="hm-badge is-live">Now</span>'
    : it.state === 'next' ? '<span class="hm-badge is-next">Next</span>'
    : it.state === 'past' && isHeld(c) ? `<span class="hm-badge is-done">${svg(P.check)}</span>`
    : (c.hasEnd ? `<span class="hm-dur">${dur(c.endM - c.startM)}</span>` : '');
  let note = '';
  if (c.status === 'cancelled' && c.cancelReason) note = c.cancelReason;
  else if (c.status === 'moved_away') note = c.movedTo ? `Moved to ${relDay(new Date(c.movedTo + 'T00:00:00'))}` : 'Moved to another slot';
  else if (c.status === 'moved_in' && (c.origDate || c.origStart)) note = `Moved here from ${c.origDate ? relDay(new Date(c.origDate + 'T00:00:00')) : ''} ${c.origStart || ''}`.trim();
  if (c.movedReason) note += note ? ` · ${c.movedReason}` : c.movedReason;
  if (c.isExam && c.exam.topics) note = (note ? note + ' · ' : '') + `Syllabus: ${c.exam.topics}`;
  let pct = 0;
  if (it.state === 'live') { const now = getCurrentMinutes(); pct = Math.min(100, Math.max(0, ((now - c.startM) / (c.endM - c.startM)) * 100)); }
  return `<button type="button" class="hm-cls state-${it.state} st-${c.status}${c.isExam ? ' is-exam' : ''}${c.isLab ? ' is-lab' : ''}" data-i="${i}">
    <span class="hm-cls-time"><span>${t12(c.startM)}</span>${c.hasEnd ? `<span>${t12(c.endM)}</span>` : ''}</span>
    <span class="hm-cls-body">
      <span class="hm-cls-title"><span class="hm-cls-code">${escapeHtml(c.title)}</span>${tagsHtml(c)}</span>
      ${c.name ? `<span class="hm-cls-name">${escapeHtml(c.name)}</span>` : ''}
      <span class="hm-cls-where">${whereLine(c)}</span>
      ${note ? `<span class="hm-cls-note">${escapeHtml(note)}</span>` : ''}
      ${it.state === 'live' ? `<span class="hm-bar is-thin"><span style="width:${pct.toFixed(1)}%"></span></span>` : ''}
    </span>
    <span class="hm-cls-side">${right}</span>
  </button>`;
}

function gapHtml(it) {
  const len = it.to - it.from;
  const now = getCurrentMinutes();
  const label = it.isNow ? `Free now · ${dur(it.to - now)} left` : (len >= 60 ? `Free · ${dur(len)}` : `Break · ${dur(len)}`);
  return `<div class="hm-gap${it.isNow ? ' is-now' : ''}${len >= 60 ? ' is-long' : ''}">${svg(P.coffee)}<span>${label}</span><span class="hm-gap-time">${t12(it.from)} – ${t12(it.to)}</span></div>`;
}

function deadlineHtml(it) {
  const d = it.d;
  return `<button type="button" class="hm-deadline" data-notice="${escapeHtml(d.id)}">${svg(P.task)}<span><strong>${escapeHtml(d.title)}</strong>${d.subject ? ` · ${escapeHtml(d.subject)}` : ''}</span><span class="hm-deadline-time">Due ${escapeHtml(d.dueText)}</span></button>`;
}

function statsHtml(sum) {
  if (!sum.count) return '';
  const chips = [`${dur(sum.busyMins)} in class`];
  if (sum.longestGap >= 30) chips.push(`Longest break ${dur(sum.longestGap)}`);
  if (sum.labs) chips.push(`${sum.labs} lab${sum.labs === 1 ? '' : 's'}`);
  if (sum.tests) chips.push(`<span class="is-exam">${sum.tests} test${sum.tests === 1 ? '' : 's'}</span>`);
  if (sum.cancelled) chips.push(`<span class="is-cancel">${sum.cancelled} cancelled</span>`);
  if (sum.moved) chips.push(`${sum.moved} moved`);
  return chips.map(c => `<span class="hm-stat">${c}</span>`).join('');
}

function emptyDayHtml(date, holiday, isOff) {
  const up = (() => { const d = new Date(date); d.setHours(23, 59, 0, 0); return nowStateNext(d); })();
  return `<div class="hm-empty${holiday ? ' is-holiday' : ''}">
    <span class="hm-empty-icon">${svg(holiday ? P.cal : P.sun)}</span>
    <strong>${holiday ? escapeHtml(holiday.title) : (isOff ? 'Off day' : 'No classes')}</strong>
    <span>${holiday && holiday.note ? escapeHtml(holiday.note) : (isOff ? 'Thursday and Friday are off.' : 'Nothing in the routine for this day.')}</span>
    ${up ? `<button type="button" class="hm-link" data-jump="${up.date.getTime()}">Next class: ${escapeHtml(up.c.title)} · ${escapeHtml(relDay(up.date))} ${t12(up.c.startM)}</button>` : ''}
  </div>`;
}
// Next class after a given moment (wrapper so the empty state can point forward)
function nowStateNext(fromDate) {
  for (let i = 1; i < 9; i++) {
    const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + i);
    const c = getDay(d.getDay(), d).find(isHeld);
    if (c) return { c, date: d };
  }
  return null;
}

export function renderTimeline(force = false) {
  window.renderTimeline = renderTimeline;
  bindOnce();
  renderWeekStrip();
  renderNow();
  renderAlerts();

  const grid = $('chG');
  if (!grid) return;
  const today = new Date();
  const view = State.viewDate || today;
  const dow = State.currentViewDayIdx;
  const isToday = sameDay(view, today) && dow === today.getDay();
  const nowM = getCurrentMinutes();
  const classes = getDay(dow, view);
  const deadlines = deadlinesOn(view);
  const holiday = holidayOn(view);
  const sum = daySummary(classes);

  const hash = `${ymd(view)}:${dow}:${isToday ? nowM : -1}:${JSON.stringify(classes.map(c => [c.title, c.status, c.startM, c.isExam]))}:${deadlines.length}:${!!holiday}`;
  if (!force && hash === _lastHash) return;
  _lastHash = hash;

  // Header
  const title = $('timelineTitle');
  if (title) title.textContent = isToday ? 'Today' : relDay(view, today) === 'Tomorrow' ? 'Tomorrow' : DAY_NAMES[dow];
  const subtitle = $('timelineSubtitle');
  if (subtitle) subtitle.textContent = sum.count
    ? `${sum.count} class${sum.count === 1 ? '' : 'es'} · ${t12(sum.first)} – ${t12(sum.last)}`
    : (holiday ? 'Holiday' : 'No classes');
  const stats = $('homeDayStats');
  if (stats) { stats.innerHTML = statsHtml(sum); stats.hidden = !sum.count; }

  // Day change animation (swipes animate themselves)
  if (_lastDay !== null && _lastDay !== ymd(view) && !grid.classList.contains('swiping') && !grid.classList.contains('swipe-transition')) {
    grid.dataset.dir = view > new Date(_lastDay + 'T00:00:00') ? 'next' : 'prev';
    grid.classList.remove('day-swap'); void grid.offsetWidth; grid.classList.add('day-swap');
    grid.addEventListener('animationend', () => grid.classList.remove('day-swap'), { once: true });
  }
  _lastDay = ymd(view);

  _items = buildTimeline(classes, deadlines, { isToday, nowM });
  if (!classes.length && !deadlines.length) {
    grid.innerHTML = emptyDayHtml(view, holiday, !isClassDay(dow));
    return;
  }
  let html = holiday ? `<div class="hm-holiday-banner">${svg(P.cal)}<span><strong>${escapeHtml(holiday.title)}</strong> · classes are off unless moved online</span></div>` : '';
  html += _items.map((it, i) => it.kind === 'class' ? classCardHtml(it, i) : it.kind === 'gap' ? gapHtml(it) : deadlineHtml(it)).join('');
  if (isToday && sum.count && nowM >= sum.last) html += `<div class="hm-endcap">${svg(P.check)}<span>That's the day. ${dur(sum.busyMins)} of class done.</span></div>`;
  grid.innerHTML = html;
}

/* ── Events ────────────────────────────────────────────────────────────── */
function goToDay(dow, ts) {
  State.currentViewDayIdx = dow;
  State.viewDate = new Date(ts);
  State.lastRenderedMinute = -1;
  renderTimeline(true);
}

function openClass(c, state) {
  if (!c) return;
  showClassDetails(detailsFor(c, state));
}

function bindOnce() {
  if (_bound) return;
  _bound = true;
  const page = $('dashboardView');
  if (!page) return;

  page.addEventListener('click', e => {
    if (e.target.closest('.teacher-clickable-badge')) return; // global handler opens the profile
    const day = e.target.closest('.hm-day');
    if (day) { goToDay(Number(day.dataset.dow), Number(day.dataset.ts)); return; }
    const notice = e.target.closest('[data-notice]');
    if (notice) { if (window.__openNotice) window.__openNotice(notice.dataset.notice); return; }
    if (e.target.closest('[data-open-notices]')) { if (window.switchAppView) window.switchAppView('announcements'); return; }
    const jump = e.target.closest('[data-jump]');
    if (jump) { const d = new Date(Number(jump.dataset.jump)); goToDay(d.getDay(), d.getTime()); return; }
    if (e.target.closest('#homeTodayBtn')) { const t = new Date(); goToDay(t.getDay(), t.getTime()); return; }
    if (e.target.closest('.hm-join')) return;
    if (e.target.closest('[data-now-upcoming]') && _nowTarget && _nowTarget.date) { goToDay(_nowTarget.date.getDay(), _nowTarget.date.getTime()); return; }
    if (e.target.closest('[data-now-open]') && _nowTarget) { openClass(_nowTarget.c, _nowTarget.state); return; }
    const card = e.target.closest('.hm-cls');
    if (card) {
      const it = _items[Number(card.dataset.i)];
      if (!it || it.kind !== 'class') return;
      if (it.c.status === 'moved_away' && it.c.movedTo && window.navigateToDate) { window.navigateToDate(it.c.movedTo); return; }
      openClass(it.c, it.state);
    }
  });
  page.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-now-open], [data-now-upcoming]')) { e.preventDefault(); e.target.click(); }
  });
}

window.__switchTimelineDay = (dayIdx, timestamp) => goToDay(dayIdx, timestamp || (State.viewDate || new Date()).getTime());
