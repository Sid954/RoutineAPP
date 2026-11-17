/**
 * Faculty profile sheet (#teacherDetailModal, redesigned Nov 2026).
 * Hero, a live "now" card, contact actions, a day-by-day schedule (announcement overrides
 * applied, flagged not removed) and the courses the teacher teaches. Rows open the class
 * detail sheet on top.
 */
import { DAY_NAMES, DAY_SHORT, FULL_COURSE_NAMES } from '../core/config.js';
import { getCurrentMinutes, escapeHtml, LAB_LABEL_HTML } from '../core/utils.js';
import { openModal, closeModal } from '../modals/modal.js';
import { showClassDetails } from '../timeline/class-detail.js';
import { resolveTeacherCode } from './teacher-names.js';
import {
  activeDays, getTeacherWeek, getTeacherStatus, summarizeTeaching, getTeacherDisplay,
  fmtMins, durationLabel, semSecShort, parseSemSec
} from './faculty-data.js';
import { avatarHtml } from './faculty-directory.js';

const I = {
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
};

let _key = '';
let _week = {};
let _day = 'week';        // dayIdx (number) or 'week'
let _rowsShown = [];      // classes in the visible schedule, for row taps

const $ = id => document.getElementById(id);

/* ── Now card ─────────────────────────────────────────────────────────────── */
function nextClassAfterToday(week, today) {
  const days = activeDays();
  const order = days.map(d => ({ d, off: (d - today + 7) % 7 })).filter(x => x.off > 0).sort((a, b) => a.off - b.off);
  for (const { d } of order) {
    const c = (week[d] || []).find(x => !x.isCancelled && !x.isRescheduled);
    if (c) return { dayIdx: d, cls: c };
  }
  return null;
}

function classLabel(c) {
  return [c.subject, c.isMovedOnline ? 'Online' : (c.room ? `Room ${c.room}` : ''), semSecShort(c.semSec) ? `Sec ${semSecShort(c.semSec)}` : '']
    .filter(Boolean).join(' · ');
}

function nowCardHtml(week) {
  const today = new Date().getDay();
  const now = getCurrentMinutes();
  const isClassDay = activeDays().includes(today);
  const todays = isClassDay ? (week[today] || []) : [];
  const st = getTeacherStatus(todays, now, isClassDay);
  const cancelled = todays.filter(c => c.isCancelled).length;
  const note = cancelled ? `<span class="fd-now-note">${cancelled} class${cancelled === 1 ? '' : 'es'} cancelled today</span>` : '';

  if (st.kind === 'in_class') {
    const c = st.current;
    const pct = Math.max(0, Math.min(100, ((now - c.startM) / (c.endM - c.startM)) * 100));
    return `<div class="fd-now is-in">
      <div class="fd-now-row"><span class="fd-now-label"><span class="fd-dot"></span>${c.isMovedOnline ? 'Teaching online now' : 'In class now'}</span><span class="fd-now-time">until ${fmtMins(c.endM)}</span></div>
      <div class="fd-now-what">${escapeHtml(classLabel(c))}</div>
      <div class="fd-now-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><span style="width:${pct.toFixed(1)}%"></span></div>
      ${st.next ? `<div class="fd-now-after">Then ${escapeHtml(st.next.subject)} at ${fmtMins(st.next.startM)}</div>` : ''}
      ${note}
    </div>`;
  }
  if (st.kind === 'next') {
    const c = st.next;
    const mins = c.startM - now;
    const inTxt = mins < 60 ? `in ${mins} min` : `at ${fmtMins(c.startM)}`;
    return `<div class="fd-now is-next">
      <div class="fd-now-row"><span class="fd-now-label">Free now</span><span class="fd-now-time">next ${inTxt}</span></div>
      <div class="fd-now-what">${escapeHtml(classLabel(c))}${mins < 60 ? ` · ${fmtMins(c.startM)}` : ''}</div>
      ${note}
    </div>`;
  }
  const upcoming = nextClassAfterToday(week, today);
  const label = st.kind === 'done' ? 'Done for today' : (st.kind === 'off' ? 'Off today' : 'No classes today');
  const after = upcoming
    ? `<div class="fd-now-what">Next: ${escapeHtml(upcoming.cls.subject)} · ${DAY_NAMES[upcoming.dayIdx]} ${fmtMins(upcoming.cls.startM)}</div>`
    : '<div class="fd-now-what">No classes in the routine this week</div>';
  return `<div class="fd-now is-quiet"><div class="fd-now-row"><span class="fd-now-label">${label}</span></div>${after}${note}</div>`;
}

/* ── Actions ──────────────────────────────────────────────────────────────── */
function actionsHtml(d) {
  const btn = (href, icon, label, sub, ext) => href
    ? `<a class="fd-action" href="${escapeHtml(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${icon}<span class="fd-action-label">${label}</span>${sub ? `<span class="fd-action-sub">${escapeHtml(sub)}</span>` : ''}</a>`
    : `<span class="fd-action is-off" aria-disabled="true">${icon}<span class="fd-action-label">${label}</span><span class="fd-action-sub">Not added</span></span>`;
  const tel = d.phone ? `tel:${d.phone.replace(/[^\d+]/g, '')}` : '';
  const html = `<div class="fd-actions">
    ${btn(d.email ? `mailto:${d.email}` : '', I.mail, 'Email', d.email, false)}
    ${btn(tel, I.phone, 'Call', d.phone, false)}
    ${btn(d.profileUrl, I.globe, 'Profile', d.profileUrl ? 'cse.puc.ac.bd' : '', true)}
  </div>`;
  const missing = !d.email || !d.phone;
  return html + (missing ? `<button type="button" class="fd-link" data-fd-edit>Know their ${!d.email && !d.phone ? 'email or phone' : (!d.email ? 'email' : 'phone')}? Suggest it</button>` : '');
}

/* ── Schedule ─────────────────────────────────────────────────────────────── */
function daysHtml(week) {
  const today = new Date().getDay();
  const days = activeDays().map(d => {
    const n = (week[d] || []).length;
    return `<button type="button" role="tab" class="fd-day${_day === d ? ' active' : ''}${d === today ? ' is-today' : ''}${n ? '' : ' is-empty'}" data-day="${d}" aria-selected="${_day === d}">
      <span class="fd-day-name">${DAY_SHORT[d]}</span><span class="fd-day-count">${n || '–'}</span></button>`;
  }).join('');
  const total = activeDays().reduce((s, d) => s + (week[d] || []).length, 0);
  return days + `<button type="button" role="tab" class="fd-day fd-day-week${_day === 'week' ? ' active' : ''}" data-day="week" aria-selected="${_day === 'week'}">
    <span class="fd-day-name">Week</span><span class="fd-day-count">${total}</span></button>`;
}

function flagHtml(c, isNow) {
  if (c.isCancelled) return '<span class="fd-tag is-cancel">Cancelled</span>';
  if (c.isRescheduled) return '<span class="fd-tag is-warn">Moved</span>';
  if (c.isMovedOnline) return '<span class="fd-tag is-online">Online</span>';
  if (isNow) return '<span class="fd-tag is-now">Now</span>';
  return '';
}

function tlRowHtml(c, idx, isToday, now) {
  const isNow = isToday && !c.isCancelled && now >= c.startM && now < c.endM;
  const isPast = isToday && now >= c.endM;
  const sec = semSecShort(c.semSec);
  const meta = [c.isMovedOnline ? 'Online' : (c.room ? `Room ${c.room}` : ''), sec ? `Sec ${sec}` : '', durationLabel(c.startM, c.endM)].filter(Boolean).join(' · ');
  return `<button type="button" class="fd-tl-row${isNow ? ' is-now' : ''}${isPast ? ' is-past' : ''}${c.isCancelled ? ' is-cancelled' : ''}" data-idx="${idx}">
    <span class="fd-tl-time"><span>${fmtMins(c.startM)}</span><span>${fmtMins(c.endM)}</span></span>
    <span class="fd-tl-body">
      <span class="fd-tl-title"><span class="fd-tl-subj">${escapeHtml(c.subject)}</span>${c.isLab ? `<span class="fd-tag is-lab">${LAB_LABEL_HTML}</span>` : ''}${flagHtml(c, isNow)}</span>
      ${c.courseName ? `<span class="fd-tl-name">${escapeHtml(c.courseName)}</span>` : ''}
      ${meta ? `<span class="fd-tl-meta">${escapeHtml(meta)}</span>` : ''}
    </span>
    <span class="fd-chev">${I.chev}</span>
  </button>`;
}

function scheduleHtml(week) {
  const today = new Date().getDay();
  const now = getCurrentMinutes();
  _rowsShown = [];
  const push = c => { _rowsShown.push(c); return _rowsShown.length - 1; };

  if (_day === 'week') {
    const parts = activeDays().filter(d => (week[d] || []).length).map(d => `
      <div class="fd-tl-day"><span>${DAY_NAMES[d]}</span>${d === today ? '<span class="fd-today-pill">Today</span>' : ''}</div>
      ${(week[d] || []).map(c => tlRowHtml(c, push(c), d === today, now)).join('')}`);
    return parts.length ? parts.join('') : `<div class="fd-tl-empty">${I.cal}<span>No classes in the routine this week</span></div>`;
  }
  const list = week[_day] || [];
  if (!list.length) return `<div class="fd-tl-empty">${I.cal}<span>No classes on ${DAY_NAMES[_day]}</span></div>`;
  return list.map(c => tlRowHtml(c, push(c), _day === today, now)).join('');
}

function teachesHtml(week) {
  const courses = summarizeTeaching(week);
  if (!courses.length) return '';
  return `<section class="fd-sec">
    <h3 class="fd-sec-title">Teaches <span class="fd-sec-count">${courses.length}</span></h3>
    <div class="fd-courses">${courses.map(c => `
      <div class="fd-course">
        <div class="fd-course-top"><span class="fd-course-code">${escapeHtml(c.subject)}</span>${c.isLab ? `<span class="fd-tag is-lab">${LAB_LABEL_HTML}</span>` : ''}<span class="fd-course-freq">${c.perWeek}× a week</span></div>
        ${c.name ? `<div class="fd-course-name">${escapeHtml(c.name)}</div>` : ''}
        ${c.sections.length ? `<div class="fd-course-secs">${c.sections.map(s => `<span class="fd-sec-chip">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
      </div>`).join('')}
    </div>
  </section>`;
}

/**
 * Keep the schedule the same height on every day tab: reserve room for the busiest day of
 * the week, so switching from a 5-class day to an empty one doesn't shrink and grow the sheet.
 */
function lockScheduleHeight(list) {
  if (_day === 'week') { list.style.minHeight = ''; return; }
  const max = Math.max(1, ...activeDays().map(d => (_week[d] || []).length));
  const row = list.querySelector('.fd-tl-row');
  const rowH = row ? row.offsetHeight : (list._rowH || 66);
  if (row) list._rowH = rowH;
  list.style.minHeight = `${max * rowH + (max - 1) * 8}px`;
}

function renderSchedule() {
  const days = $('fdProfileDays');
  const list = $('fdProfileTimeline');
  if (days) days.innerHTML = daysHtml(_week);
  if (list) {
    list.innerHTML = scheduleHtml(_week);
    lockScheduleHeight(list);
  }
}

function defaultDay(week) {
  const today = new Date().getDay();
  const days = activeDays();
  if (days.includes(today) && (week[today] || []).length) return today;
  const next = days.map(d => ({ d, off: (d - today + 7) % 7 })).sort((a, b) => a.off - b.off).find(x => (week[x.d] || []).length);
  return next ? next.d : 'week';
}

/* ── Open / close ─────────────────────────────────────────────────────────── */
export function renderTeacherProfile(teacherKey, keepDay = false) {
  const body = $('facultyProfileHero');
  if (!body) return;
  _key = resolveTeacherCode(teacherKey) || String(teacherKey);
  _week = getTeacherWeek(_key);
  if (!keepDay) _day = defaultDay(_week);

  const d = getTeacherDisplay(_key);
  const subline = [d.designation, d.isGuest && !/guest/i.test(d.designation) ? 'Guest faculty' : ''].filter(Boolean).join(' · ');

  body.innerHTML = `
    <header class="fd-hero">
      ${avatarHtml(d, 'fd-avatar fd-avatar-lg')}
      <div class="fd-hero-text">
        <h2 class="fd-hero-name" id="fdSheetName">${escapeHtml(d.name)}</h2>
        <div class="fd-hero-sub">
          ${d.hasName ? `<span class="fd-code">${escapeHtml(d.key)}</span>` : ''}
          ${subline ? `<span>${escapeHtml(subline)}</span>` : (d.hasName ? '' : '<span>Name not added yet</span>')}
        </div>
      </div>
    </header>
    ${nowCardHtml(_week)}
    ${actionsHtml(d)}
    <section class="fd-sec">
      <h3 class="fd-sec-title">Schedule</h3>
      <div class="fd-days" id="fdProfileDays" role="tablist" aria-label="Day"></div>
      <div class="fd-tl" id="fdProfileTimeline"></div>
    </section>
    ${teachesHtml(_week)}
  `;
  renderSchedule();
}

export function openTeacherProfile(teacherKey) {
  const modal = $('teacherDetailModal');
  if (!modal || !teacherKey) return;
  renderTeacherProfile(teacherKey);
  const sheet = modal.querySelector('.fd-sheet-body');
  if (sheet) sheet.scrollTop = 0;
  openModal(modal);
}

export function closeTeacherProfile() {
  const modal = $('teacherDetailModal');
  if (modal) closeModal(modal);
}

export function refreshTeacherProfileIfOpen() {
  const modal = $('teacherDetailModal');
  if (modal && modal.classList.contains('open') && _key) renderTeacherProfile(_key, true);
}

function openClassFromRow(c) {
  const { sem, sec } = parseSemSec(c.semSec);
  const d = getTeacherDisplay(_key);
  const start = fmtMins(c.startM), end = fmtMins(c.endM);
  const classModal = $('classDetailModal');
  if (classModal) classModal.style.zIndex = '100040'; // above the profile sheet (100035)
  showClassDetails({
    code: c.subject, title: c.subject, subject: c.subject,
    name: c.courseName || FULL_COURSE_NAMES[c.subject] || c.subject,
    type: c.type || (c.isLab ? 'Lab' : 'Theory'),
    room: c.room, instructor: _key, teacher: _key, instructorName: d.name,
    start, end, timing: `${start} – ${end}`, duration: durationLabel(c.startM, c.endM),
    hasExplicitEndTime: true,
    dayName: DAY_NAMES[c.dayIdx], dayIdx: c.dayIdx, dayShort: DAY_SHORT[c.dayIdx],
    semSec: c.semSec || '', semester: sem, section: sec,
    isCancelled: !!c.isCancelled, isOnline: !!c.isMovedOnline
  });
}

export function initTeacherProfile() {
  const modal = $('teacherDetailModal');
  if (!modal) return;
  const closeBtn = $('teacherDetailCloseBtn');
  const editBtn = $('teacherDetailEditBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeTeacherProfile);
  if (editBtn) editBtn.addEventListener('click', () => window.__openFacultyEditModal && window.__openFacultyEditModal(_key));
  modal.addEventListener('click', e => {
    if (e.target === modal) { closeTeacherProfile(); return; }
    const day = e.target.closest('.fd-day');
    if (day) {
      _day = day.dataset.day === 'week' ? 'week' : parseInt(day.dataset.day, 10);
      renderSchedule();
      return;
    }
    const row = e.target.closest('.fd-tl-row');
    if (row) {
      const c = _rowsShown[parseInt(row.dataset.idx, 10)];
      if (c) openClassFromRow(c);
      return;
    }
    if (e.target.closest('[data-fd-edit]') && window.__openFacultyEditModal) window.__openFacultyEditModal(_key);
  });
  modal.addEventListener('error', e => {
    if (e.target && e.target.matches && e.target.matches('img[data-fd-img]')) {
      const box = e.target.parentElement;
      e.target.remove();
      if (box) box.classList.remove('has-photo');
    }
  }, true);
  // Keep the "now" card honest while the sheet stays open
  setInterval(() => { if (!document.hidden) refreshTeacherProfileIfOpen(); }, 60000);
}
