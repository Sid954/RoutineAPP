/**
 * Attendance page (#attendancePage, a full page like Settings): every subject with its percentage,
 * "can miss N more" / "need N in a row", and per subject a month calendar of every class that took
 * place since the semester start, to mark Present / Absent. Counts are an estimate built from the
 * routine and the notices (cancelled and holiday classes removed, extra and rescheduled ones added).
 */
import { CONFIG, DAY_NAMES, MONTHS, FULL_COURSE_NAMES } from '../core/config.js';
import { escapeHtml, format12h } from '../core/utils.js';
import { openModal } from '../modals/modal.js';
import { setMark, setBase, setMinPercent, setSemesterStartOverride, getSemesterStart, isSkipped, addExtra, removeExtra } from './attendance.js';
import { attendanceData, invalidateHeld } from './attendance-data.js';

const $ = id => document.getElementById(id);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const svg = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const NEXT = { '': 'present', present: 'absent', absent: '' };

let _subject = '';     // '' = the list; otherwise one subject's page
let _adding = '';      // the date whose "add a class" popup is open
let _pop = null;
let _warned = false;   // the not-recorded warning is shown once per visit to this page
let _monthIdx = null;  // which month of the calendar is shown (null = the current month)
let _focusDate = '';   // highlighted on open from the notification

function ring(pct, risk) {
  const p = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const C = 2 * Math.PI * 20;
  return `<span class="att-ring${risk ? ' is-risk' : ''}${pct === null ? ' is-empty' : ''}"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" class="att-ring-bg"/><circle cx="24" cy="24" r="20" class="att-ring-fg" stroke-dasharray="${(C * p / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 24 24)"/></svg><b>${pct === null ? '–' : `${Math.round(p)}%`}</b></span>`;
}
function verdict(s, min) {
  if (!s.counted) return 'No classes counted yet';
  if (s.atRisk) return s.needInRow === Infinity ? `Below ${min}%` : `Below ${min}%: attend the next ${s.needInRow} in a row`;
  return s.canMiss ? `You can miss ${s.canMiss} more` : `At the limit: don't miss the next one`;
}

function shortVerdict(s) {
  if (!s.counted) return 'Nothing counted';
  if (s.atRisk) return s.needInRow === Infinity ? 'Below minimum' : `Attend next ${s.needInRow}`;
  return s.canMiss ? `Can miss ${s.canMiss}` : 'At the limit';
}
const dayWord = date => { const n = Math.round((fromYmd(ymd(new Date())) - fromYmd(date)) / 864e5); return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : longDate(date); };
const relDay = dayWord;
/** Today's and yesterday's finished classes that are not marked yet (newest first, at most 6). */
function toMark(d) {
  const today = new Date();
  const recent = [ymd(today), ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))];
  return d.held.filter(h => recent.includes(h.date) && !d.att.marks[h.key] && !isSkipped(h.key)).slice(-6).reverse();
}

function listHtml(d) {
  const { stats, att, start } = d;
  const subjects = stats.filter(s => s.held || s.base.held);
  const counted = subjects.reduce((a, s) => a + s.counted, 0);
  const attended = subjects.reduce((a, s) => a + s.attended, 0);
  const overall = counted ? Math.round((attended / counted) * 1000) / 10 : null;
  const unknown = subjects.reduce((a, s) => a + s.unknown, 0);
  const dayList = _focusDate ? d.held.filter(h => h.date === _focusDate) : [];
  const dayBlock = dayList.length ? `<div class="st-sec"><h3 class="st-sec-title">${escapeHtml(longDate(_focusDate))}</h3>
      <div class="st-sec-card">${dayList.map(h => `<div class="st-item att-mark"><span><strong>${escapeHtml(h.subject)}</strong><span>${escapeHtml(format12h(h.start))}</span></span>
        <button type="button" class="hm-att-btn is-yes${d.att.marks[h.key] === 'present' ? ' is-on' : ''}" data-mark="${escapeHtml(h.key)}" data-val="present">Present</button>
        <button type="button" class="hm-att-btn is-no${d.att.marks[h.key] === 'absent' ? ' is-on' : ''}" data-mark="${escapeHtml(h.key)}" data-val="absent">Absent</button></div>`).join('')}</div></div>` : '';
  const risky = subjects.filter(s => s.atRisk).length;
  const ask = _focusDate ? [] : toMark(d);
  const askBlock = ask.length ? `<div class="st-sec"><h3 class="st-sec-title">Were you there?</h3>
      <div class="st-sec-card att-ask">${ask.map(h => `<div class="st-item att-mark"><span><strong>${escapeHtml(h.subject)}</strong><span>${escapeHtml(relDay(h.date))} · ${escapeHtml(format12h(h.start))}</span></span>
        <button type="button" class="hm-att-btn is-yes is-icon" data-mark="${escapeHtml(h.key)}" data-val="present" aria-label="Present at ${escapeHtml(h.subject)}">${svg('<polyline points="20 6 9 17 4 12"/>', 2.6)}</button>
        <button type="button" class="hm-att-btn is-no is-icon" data-mark="${escapeHtml(h.key)}" data-val="absent" aria-label="Absent from ${escapeHtml(h.subject)}">${svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 2.6)}</button></div>`).join('')}</div></div>` : '';
  return `${dayBlock}
    <div class="att-app">
      <div class="att-app-ring">${ring(overall, overall !== null && overall < att.min)}</div>
      <div class="att-app-text">
        <span class="att-app-k">Overall attendance</span>
        <strong>${overall === null ? 'Start marking your classes' : (overall >= att.min ? 'You are on track' : `Below ${att.min}%`)}</strong>
        <span>${counted ? `${attended} of ${counted} classes counted` : 'Tap a subject, then the dates you were there'}</span>
      </div>
      <div class="att-chips">
        <span class="att-chip${risky ? ' is-risk' : ' is-ok'}">${risky ? `${risky} at risk` : 'On track'}</span>
        ${unknown ? `<span class="att-chip">${unknown} to mark</span>` : ''}
        <span class="att-chip">Min ${att.min}%</span>
      </div>
    </div>
    ${askBlock}
    <div class="st-sec"><h3 class="st-sec-title">Subjects</h3>
      ${subjects.length ? `<div class="att-tiles">${subjects.map(s => `
        <button type="button" class="att-tile${s.atRisk ? ' is-risk' : ''}" data-subj="${escapeHtml(s.subject)}">
          ${ring(s.pct, s.atRisk)}
          <strong>${escapeHtml(s.subject)}</strong>
          <span class="att-tile-v">${escapeHtml(shortVerdict(s))}</span>
          <span class="att-tile-n">${s.attended}/${s.counted} classes</span>
        </button>`).join('')}</div>` : '<div class="st-sec-card"><div class="att-empty">No classes have taken place since the semester started.</div></div>'}
    </div>
    <div class="st-sec"><h3 class="st-sec-title">Settings</h3>
      <div class="st-sec-card">
        <div class="st-item att-set"><span><strong>Minimum attendance</strong><span>Subjects below this are marked at risk</span></span>
          <div class="nf-seg att-seg">${[60, 70, 75, 80, 85].map(v => `<button type="button" class="${v === att.min ? 'active' : ''}" data-min="${v}">${v}%</button>`).join('')}</div></div>
        <label class="st-item att-set att-start"><span><strong>Semester started</strong><span>${start ? `Counting from ${escapeHtml(longDate(start))}` : 'Set the first day of classes'}${getSemesterStart('') ? ' (your own date)' : ''}</span></span>
          <input type="date" class="st-input" id="attStart" value="${escapeHtml(start || '')}"></label>
        ${getSemesterStart('') ? '<div class="st-item"><button type="button" class="hm-btn is-ghost" data-reset-start="1">Use the shared date again</button></div>' : ''}
      </div>
      <p class="st-sec-note">Classes held are an estimate from your routine and the notices: cancelled classes and holidays are left out, extra and rescheduled classes are added. A class you don't mark counts as absent.</p>
    </div>`;
}

function longDate(s) { const d = fromYmd(s); return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; }

function subjectHtml(d, subj) {
  const s = d.stats.find(x => x.subject === subj) || { subject: subj, held: 0, present: 0, absent: 0, unknown: 0, attended: 0, counted: 0, pct: null, base: { attended: 0, held: 0 } };
  const mine = d.held.filter(h => h.subject === subj);
  const byDate = {};
  mine.forEach(h => { (byDate[h.date] = byDate[h.date] || []).push(h); });
  // Months from the semester start to today
  const months = [];
  if (d.start) {
    const a = fromYmd(d.start);
    const now = new Date();
    for (let y = a.getFullYear(), m = a.getMonth(); y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth()); m === 11 ? (y++, m = 0) : m++) months.push([y, m]);
  }
  const monthHtml = months.map(([y, m]) => {
    const first = new Date(y, m, 1);
    const days = new Date(y, m + 1, 0).getDate();
    const lead = (first.getDay() + 1) % 7; // weeks start on Saturday
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="att-day is-pad"></span>';
    for (let day = 1; day <= days; day++) {
      const ds = ymd(new Date(y, m, day));
      const list = byDate[ds];
      if (!list) {
        const addable = ds <= ymd(new Date()) && ds >= (d.start || '');
        cells += addable ? `<button type="button" class="att-day is-free${ds === _adding ? ' is-adding' : ''}" data-add="${ds}" aria-label="${escapeHtml(longDate(ds))}: no class recorded. Add one">${day}</button>` : `<span class="att-day">${day}</span>`;
        continue;
      }
      const marks = list.map(h => d.att.marks[h.key] || '');
      const state = marks.every(v => v === 'present') ? 'present' : marks.every(v => v === 'absent') ? 'absent' : marks.some(v => v) ? 'mixed' : 'unknown';
      cells += `<button type="button" class="att-day is-held is-${state}${list.some(h => h.extra) ? ' is-extra' : ''}${ds === _focusDate ? ' is-focus' : ''}" data-day="${ds}" aria-label="${escapeHtml(longDate(ds))}: ${state === 'unknown' ? 'not marked' : state}">${day}${list.length > 1 ? `<i>${list.length}</i>` : ''}</button>`;
    }
    return `<div class="att-month"><div class="att-wk">${['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(w => `<span>${w}</span>`).join('')}</div><div class="att-grid">${cells}</div></div>`;
  });
  const mi = months.length ? Math.max(0, Math.min(months.length - 1, _monthIdx === null ? months.length - 1 : _monthIdx)) : 0;
  const nav = months.length ? `<div class="att-monthnav"><button type="button" data-mo="-1" aria-label="Previous month"${mi === 0 ? ' disabled' : ''}>${svg('<polyline points="15 18 9 12 15 6"/>', 2.4)}</button><strong>${MONTHS[months[mi][1]]} ${months[mi][0]}</strong><button type="button" data-mo="1" aria-label="Next month"${mi === months.length - 1 ? ' disabled' : ''}>${svg('<polyline points="9 6 15 12 9 18"/>', 2.4)}</button></div>` : '';
  const cal = months.length ? nav + monthHtml[mi] : '';
  return `
    <div class="att-hero">
      ${ring(s.pct, s.atRisk)}
      <div><strong>${escapeHtml(subj)}${FULL_COURSE_NAMES[subj] ? ` · ${escapeHtml(FULL_COURSE_NAMES[subj])}` : ''}</strong>
      <span class="${s.atRisk ? 'is-risk' : ''}">${escapeHtml(verdict(s, d.att.min))}</span></div>
    </div>
    <div class="att-facts">
      <div><b>${mine.length}</b><span>held so far (estimate)</span></div>
      <div><b>${s.present}</b><span>present</span></div>
      <div><b>${s.absent}</b><span>absent</span></div>
      <div><b>${s.unknown}</b><span>not marked (absent)</span></div>
    </div>
    <div class="st-sec"><h3 class="st-sec-title">Tap a date: present, then absent, then clear. Empty dates can be added by hand.</h3>
      <div class="st-sec-card att-cal">${cal || '<div class="att-empty">Set the semester start first.</div>'}
        <div class="att-legend"><span class="is-present">Present</span><span class="is-absent">Absent</span><span class="is-unknown">Not marked</span><span class="is-extra">Added by you</span></div>
      </div>
    </div>
    <div class="st-sec"><h3 class="st-sec-title">Before you started tracking (optional)</h3>
      <div class="st-sec-card"><div class="st-item att-base">
        <label><span>Attended</span><input type="number" min="0" inputmode="numeric" class="st-input" id="attBaseAtt" value="${s.base.attended || ''}"></label>
        <label><span>Out of</span><input type="number" min="0" inputmode="numeric" class="st-input" id="attBaseHeld" value="${s.base.held || ''}"></label>
        <button type="button" class="hm-btn" data-base="${escapeHtml(subj)}">Save</button>
      </div></div>
      <p class="st-sec-note">Only for classes the dates above don't cover. They are added to your totals.</p>
    </div>`;
}

/* ── "Add a class" popup: the same small popup as the week strip's icon details ── */
function closeAddPop() {
  if (_pop) { _pop.remove(); _pop = null; }
  _adding = '';
  document.removeEventListener('pointerdown', onPopOutside, true);
  document.removeEventListener('keydown', onPopKey, true);
  document.querySelectorAll('#attendancePage .att-day.is-adding').forEach(c => c.classList.remove('is-adding'));
}
function onPopOutside(e) { if (_pop && !_pop.contains(e.target)) closeAddPop(); }
function onPopKey(e) { if (e.key === 'Escape') closeAddPop(); }

function openAddPop(cell) {
  const date = cell.dataset.add;
  const wasSame = _adding === date;
  closeAddPop();
  if (wasSame) return;
  _adding = date;
  cell.classList.add('is-adding');
  const pop = document.createElement('div');
  pop.className = 'day-pop att-pop';
  pop.setAttribute('role', 'alertdialog');
  const showWarn = !_warned;
  _warned = true;
  pop.innerHTML = `<div class="day-pop-head">${escapeHtml(longDate(date))}${showWarn ? '' : ` · add ${escapeHtml(_subject)}`}</div>
    ${showWarn ? `<div class="day-pop-row is-static">
      <span class="day-pop-ico warn">${svg('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 2.4)}</span>
      <div class="day-pop-text"><strong>Add ${escapeHtml(_subject)}?</strong><span>No class is recorded for this day in your routine or the notices. If you add it, it counts in your percentage. Only add it if the class really took place.</span></div>
    </div>` : ''}
    <div class="att-pop-btns"><button type="button" class="hm-att-btn is-yes" data-pop-val="present">Present</button><button type="button" class="hm-att-btn is-no" data-pop-val="absent">Absent</button></div>`;
  document.body.appendChild(pop);
  pop.addEventListener('click', e => {
    const b = e.target.closest('[data-pop-val]');
    if (!b) return;
    addExtra(date, _subject, b.dataset.popVal);
    closeAddPop();
    invalidateHeld(); render(); refreshHome();
  });
  const r = cell.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  const above = r.bottom + 10 + h > window.innerHeight - 90 && r.top - 10 - h > 12; // no room below (the bottom bar): open upward
  pop.style.left = `${left}px`;
  pop.style.top = `${above ? r.top - 10 - h : r.bottom + 10}px`;
  pop.classList.toggle('is-above', above);
  pop.style.setProperty('--arrow-x', `${Math.max(14, Math.min(w - 14, r.left + r.width / 2 - left))}px`);
  _pop = pop;
  document.addEventListener('pointerdown', onPopOutside, true);
  document.addEventListener('keydown', onPopKey, true);
}

function render() {
  const page = $('attendancePage');
  if (!page) return;
  const d = attendanceData(new Date());
  const title = page.querySelector('.page-title');
  const sub = page.querySelector('.page-subtitle');
  const back = page.querySelector('#attBack span');
  if (title) title.textContent = _subject || 'Attendance';
  if (sub) sub.textContent = _subject ? 'Mark the classes you were in' : `Minimum ${d.att.min}% · counting from ${d.start ? longDate(d.start) : '—'}`;
  if (back) back.textContent = _subject ? 'Attendance' : 'Back';
  const body = $('attBody');
  const keep = page.querySelector('.md') ? page.querySelector('.md').scrollTop : 0;
  body.innerHTML = _subject ? subjectHtml(d, _subject) : listHtml(d);
  if (page.querySelector('.md')) page.querySelector('.md').scrollTop = keep;
}

function ensure() {
  if (_pop && !document.getElementById('attendancePage')) closeAddPop();
  if ($('attendancePage')) return $('attendancePage');
  const page = document.createElement('div');
  page.className = 'mo mo-page st-page att-page';
  page.id = 'attendancePage';
  page.innerHTML = `<div class="md md-wide view-md st-md">
      <div class="md-h page-style-header st-header">
        <button class="page-back-btn" id="attBack" title="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="15 18 9 12 15 6"></polyline></svg><span>Back</span></button>
        <div class="page-title-group"><h2 class="page-title">Attendance</h2><span class="page-subtitle"></span></div>
      </div>
      <div class="st-body" id="attBody"></div>
    </div>`;
  document.body.appendChild(page);
  page.addEventListener('click', e => {
    if (e.target.closest('#attBack')) {
      if (_subject) { _subject = ''; closeAddPop(); render(); page.querySelector('.md').scrollTop = 0; }
      else import('../modals/modal.js').then(m => m.closeModal(page));
      return;
    }
    const subj = e.target.closest('[data-subj]');
    if (subj) { _subject = subj.dataset.subj; _monthIdx = null; closeAddPop(); render(); page.querySelector('.md').scrollTop = 0; return; }
    const mo = e.target.closest('[data-mo]');
    if (mo && !mo.disabled) { closeAddPop(); const d0 = attendanceData(new Date()); const a = fromYmd(d0.start || ymd(new Date())); const now = new Date(); const total = (now.getFullYear() - a.getFullYear()) * 12 + now.getMonth() - a.getMonth() + 1; const cur = _monthIdx === null ? total - 1 : _monthIdx; _monthIdx = Math.max(0, Math.min(total - 1, cur + Number(mo.dataset.mo))); render(); return; }
    const free = e.target.closest('[data-add]');
    if (free) { openAddPop(free); return; }
    const day = e.target.closest('[data-day]');
    if (day) {
      const d = attendanceData(new Date());
      d.held.filter(h => h.subject === _subject && h.date === day.dataset.day).forEach(h => {
        const next = NEXT[d.att.marks[h.key] || ''] || null;
        if (h.extra && !next) removeExtra(h.key); else setMark(h.key, next); // a class added by hand disappears when cleared
      });
      invalidateHeld(); render(); refreshHome(); return;
    }
    const mk = e.target.closest('[data-mark]');
    if (mk) { const cur = attendanceData(new Date()).att.marks[mk.dataset.mark]; setMark(mk.dataset.mark, cur === mk.dataset.val ? null : mk.dataset.val); render(); refreshHome(); return; }
    const min = e.target.closest('[data-min]');
    if (min) { setMinPercent(Number(min.dataset.min)); render(); refreshHome(); return; }
    const base = e.target.closest('[data-base]');
    if (base) { setBase(base.dataset.base, { attended: $('attBaseAtt').value, held: $('attBaseHeld').value }); render(); refreshHome(); return; }
    if (e.target.closest('[data-reset-start]')) { setSemesterStartOverride(''); invalidateHeld(); render(); refreshHome(); }
  });
  page.addEventListener('change', e => {
    if (e.target.id === 'attStart') {
      const v = e.target.value;
      setSemesterStartOverride(v && v !== CONFIG.semesterStart ? v : '');
      invalidateHeld(); render(); refreshHome();
    }
  });
  return page;
}
const refreshHome = () => { if (window.__renderHome) window.__renderHome(); };

/** Open the page, optionally on a date (from the evening notification: it lists that day's classes). */
export function openAttendance(date = '', subject = '') {
  const page = ensure();
  _warned = false;
  _monthIdx = null;
  _subject = String(subject || '').trim().toUpperCase();
  _focusDate = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : '';
  render();
  openModal(page);
  const md = page.querySelector('.md');
  if (md) md.scrollTop = 0;
}

export function initAttendancePage() {
  ensure();
  window.__openAttendance = openAttendance;
}
