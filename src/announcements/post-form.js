/**
 * New post: a guided composer (#postAnnounceAppView, rebuilt 2026-11-18).
 *  1. Suggest it (anyone, no password, the section votes) or Announce it (posting password)
 *  2. What it is about: one list, each option explained; picking one moves on
 *  3. Details for that type (course lists come from the target section's routine,
 *     quick day chips under every date)
 *  4. Check it: the post as it will look, who gets it, what happens, then send.
 *     The name fills in from Settings; the password is only asked for Announce.
 * Edit (Manage mode) starts at the details. Class-sheet quick actions (__prefill) skip step 2.
 * Payloads go through validateAnnouncementPayload, as before.
 */
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { showToast } from '../toast/toast.js';
import { escapeHtml, format12h, parseTo24h, toMinutes, localDateStr } from '../core/utils.js';
import { DAY_NAMES } from '../core/config.js';
import { Notifications } from '../notifications/notifications.js';
import { Announcements } from './announcements.js';
import { Suggestions } from './suggestions.js';
import { ANNOUNCEMENT_LIMITS, collapseNewlines, validateAnnouncementPayload } from './validation.js';
import { toNotice } from './notice-model.js';
import { cardHtml, ICONS } from './notices-view.js';

const AUTHOR_KEY = 'routine_notice_author';
const CLASS_TIED = new Set(['cancellation', 'online_class', 'class_test', 'rescheduled', 'assignment']);

const TYPES = [
  { id: 'cancellation', tone: 'cancel', label: 'A class is cancelled', desc: 'The class is crossed out in the routine for that day.' },
  { id: 'class_test', tone: 'exam', label: 'A class test', desc: 'Date, course and syllabus. It shows on that day and everyone gets a reminder.' },
  { id: 'assignment', tone: 'task', label: 'An assignment', desc: 'What to hand in and when. Reminders go out before the deadline.' },
  { id: 'rescheduled', tone: 'moved', label: 'A class moved', desc: 'To another day, time or room. The routine shows it in the new slot.' },
  { id: 'online_class', tone: 'online', label: 'An online or extra class', desc: 'Added to the routine for that day, with the link or the room.' },
  { id: 'holiday', tone: 'holiday', label: 'A holiday', desc: 'Every class that day is off.' },
  { id: 'general', tone: 'general', label: 'Something else', desc: 'A message for the class: a reminder, a change, news from a teacher.' }
];
const typeMeta = id => TYPES.find(t => t.id === id) || TYPES[TYPES.length - 1];

const STEP_TEXT = {
  mode: { title: 'What do you want to do?', sub: () => 'Pick one. You can go back at any step.' },
  type: { title: 'What is it about?', sub: () => (st.mode === 'suggest' ? 'Pick the one that fits. Your section will vote on it.' : 'Pick the one that fits.') },
  details: { title: 'Add the details', sub: () => (CLASS_TIED.has(st.type) ? 'The courses come from the routine of the section it goes to.' : 'Fill in the details.') },
  review: { title: () => (st.editId ? 'Check your changes' : (st.mode === 'suggest' ? 'Check your suggestion' : 'Check it before it goes out')), sub: () => 'This is how it will look.' }
};

const st = {
  mode: '',               // 'suggest' | 'announce'
  steps: [],
  stepIdx: 0,
  skipType: false,        // class-sheet prefill: the type is already known
  type: 'general',
  aud: 'mine',            // mine | sections
  sem: '',
  secs: new Set(),
  classMode: 'online',    // online | extra
  editId: '',
  editRow: null,
  routine: null,          // routine (dayIdx -> classes) of the class-tied target section
  routineKey: ''
};
const routineCache = new Map();

const $ = id => document.getElementById(id);
const val = id => ($(id) ? $(id).value : '');
const mySem = () => String(Storage.getSemester() || '');
const mySec = () => String(Storage.getSection() || '').toLowerCase();
const step = () => st.steps[st.stepIdx];
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const svg = (paths, w = '1.9') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const CHEV = '<polyline points="9 6 15 12 9 18"/>';

function nextDayStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}
const dayIdxOf = ymd => { const [y, m, d] = String(ymd).split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

/* ── Audience (sections only; department-wide posts are off for now) ───── */
async function structure() {
  const { loadCachedStructure } = await import('../events/init.js');
  return loadCachedStructure() || {};
}

/** {semester, section} pairs this post goes to. Suggestions always go to my section. */
export function audienceTargets(state = st, me = { sem: mySem(), sec: mySec() }) {
  if (state.mode !== 'suggest' && state.aud === 'sections') return Array.from(state.secs).map(sec => ({ semester: state.sem, section: sec }));
  return [{ semester: me.sem, section: me.sec }];
}

function targetsLabel(targets) {
  if (!targets.length) return 'Pick at least one section';
  if (targets.length === 1) {
    const t = targets[0];
    if (!t.semester) return 'Everyone in the department';
    if (!t.section) return `Semester ${t.semester}, all sections`;
    const isMine = t.semester === mySem() && t.section === mySec();
    return `Semester ${t.semester}, section ${t.section.toUpperCase()}${isMine ? ' (yours)' : ''}`;
  }
  return `${targets.length} sections in semester ${targets[0].semester}: ${targets.map(t => t.section.toUpperCase()).join(', ')}`;
}

async function renderAudience() {
  const box = $('paAudBox');
  if (!box) return;
  const seg = $('paAudSeg');
  const locked = $('paAudLocked');
  const pick = $('paAudPick');
  const note = $('paAudNote');
  const tied = CLASS_TIED.has(st.type);

  box.hidden = st.mode === 'suggest' && !st.editId;
  if (st.editId) {
    seg.hidden = true; pick.hidden = true;
    locked.hidden = false;
    const r = st.editRow || {};
    locked.textContent = targetsLabel([{ semester: String(r.semester || ''), section: String(r.section || '').toLowerCase() }]);
    note.textContent = 'Who it goes to cannot be changed after publishing. Delete it and post again instead.';
    await loadTargetRoutine();
    return;
  }
  locked.hidden = true;
  seg.hidden = false;
  if (tied && st.secs.size > 1) st.secs = new Set([Array.from(st.secs)[0]]);
  seg.querySelectorAll('button').forEach(b => {
    const a = b.dataset.aud;
    b.classList.toggle('active', a === st.aud);
    b.setAttribute('aria-pressed', String(a === st.aud));
    if (a === 'sections') b.textContent = tied ? 'Another section' : 'Other sections';
  });

  pick.hidden = st.aud !== 'sections';
  if (!pick.hidden) {
    const s = await structure();
    const sems = Object.keys(s).sort((a, b) => Number(a) - Number(b));
    if (!st.sem || !s[st.sem]) st.sem = sems.includes(mySem()) ? mySem() : (sems[0] || '');
    $('paAudSem').innerHTML = sems.map(x => `<option value="${x}"${x === st.sem ? ' selected' : ''}>Semester ${x}</option>`).join('');
    const secs = (s[st.sem] || []).map(x => String(x).toLowerCase());
    st.secs = new Set(Array.from(st.secs).filter(x => secs.includes(x)));
    $('paAudSecs').innerHTML = secs.map(x => `<button type="button" class="pa-sec${st.secs.has(x) ? ' active' : ''}" data-sec="${x}" aria-pressed="${st.secs.has(x)}">${x.toUpperCase()}${st.sem === mySem() && x === mySec() ? '<span>yours</span>' : ''}</button>`).join('');
  }
  note.textContent = st.aud === 'sections' ? (tied ? 'Class changes go to one section at a time.' : 'Pick one or more sections.') : '';
  note.hidden = !note.textContent;
  await loadTargetRoutine();
}

async function loadTargetRoutine() {
  const tied = CLASS_TIED.has(st.type);
  const t = audienceTargets();
  let key = 'mine';
  if (st.editId && st.editRow && st.editRow.semester && st.editRow.section &&
      !(String(st.editRow.semester) === mySem() && String(st.editRow.section).toLowerCase() === mySec())) {
    key = `${st.editRow.semester}/${String(st.editRow.section).toLowerCase()}`;
  } else if (tied && st.mode !== 'suggest' && st.aud === 'sections') {
    key = t.length === 1 ? `${t[0].semester}/${t[0].section}` : '';
  }
  if (key === st.routineKey && st.routine) return;
  st.routineKey = key;
  if (key === 'mine') { st.routine = State.schedule || {}; refreshCourseLists(); return; }
  if (!key) { st.routine = {}; refreshCourseLists(); return; }
  if (routineCache.has(key)) { st.routine = routineCache.get(key); refreshCourseLists(); return; }
  st.routine = {};
  refreshCourseLists('Loading routine…');
  try {
    const [sem, sec] = key.split('/');
    const { fetchSectionSchedule } = await import('../events/init.js');
    const r = await fetchSectionSchedule(sem, sec);
    if (st.routineKey !== key) return;
    st.routine = r || {};
    routineCache.set(key, st.routine);
  } catch (e) {
    st.routine = {};
  }
  refreshCourseLists();
}

/* ── Course lists from the target routine ──────────────────────────────── */
const dayClasses = ymd => (ymd ? ((st.routine || {})[dayIdxOf(ymd)] || []) : []);
function allCourses() {
  const set = new Set();
  Object.values(st.routine || {}).forEach(list => (list || []).forEach(c => { if (c.title) set.add(c.title); }));
  return Array.from(set).sort();
}
function fillSelect(id, values, selected, emptyText, withNone = false) {
  const el = $(id);
  if (!el) return;
  const keep = selected !== undefined ? selected : el.value;
  if (!values.length && !withNone) {
    el.innerHTML = `<option value="">${escapeHtml(emptyText)}</option>`;
    return;
  }
  el.innerHTML = (withNone ? '<option value="">None</option>' : '') +
    values.map(v => `<option value="${escapeHtml(v)}"${v === keep ? ' selected' : ''}>${escapeHtml(v)}</option>`).join('');
  if (keep && values.includes(keep)) el.value = keep;
}

function refreshCourseLists(loadingText) {
  const wait = loadingText || '';
  const daySubjects = (dateId, allId) => {
    const all = $(allId) && $(allId).checked;
    return all ? allCourses() : Array.from(new Set(dayClasses(val(dateId)).map(c => c.title).filter(Boolean))).sort();
  };
  const noClass = dateId => wait || (val(dateId) ? `No classes on ${DAY_NAMES[dayIdxOf(val(dateId))]}` : 'Pick a day first');

  fillSelect('paSubject', allCourses(), undefined, '', true);
  fillSelect('paCancelSubject', daySubjects('paCancelDate'), undefined, noClass('paCancelDate'));
  fillSelect('paClassSubject', allCourses(), undefined, wait || 'No courses in this routine');
  fillSelect('paTestSubject', daySubjects('paTestDate', 'paTestAll'), undefined, noClass('paTestDate'));
  fillSelect('paTaskSubject', daySubjects('paTaskDate', 'paTaskAll'), undefined, noClass('paTaskDate'));

  // Moved class: the classes on the original day, with their times
  const mv = $('paMoveClass');
  if (mv) {
    const keep = mv.value;
    const list = dayClasses(val('paMoveFromDate'));
    mv.innerHTML = list.length
      ? list.map(c => {
          const start = c.start ? format12h(c.start) : '';
          const end = c.end ? format12h(c.end) : '';
          const label = `${c.title}${start ? `, ${start}${end ? `–${end}` : ''}` : ''}${c.room ? `, room ${c.room}` : ''}`;
          return `<option value="${escapeHtml(c.title)}" data-start="${escapeHtml(start)}" data-room="${escapeHtml(c.room || '')}"${c.title === keep ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('')
      : `<option value="">${escapeHtml(noClass('paMoveFromDate'))}</option>`;
  }
  autofillClassTime();
  checkMoveOverlap();
  renderDayChips();
}

function autofillClassTime() {
  const d = val('paClassDate'), s = val('paClassSubject');
  if (!d || !s || st.editId) return;
  const match = dayClasses(d).find(c => String(c.title).toUpperCase() === s.toUpperCase());
  if (match) {
    if ($('paClassStart')) $('paClassStart').value = parseTo24h(match.start) || $('paClassStart').value;
    if ($('paClassEnd') && match.end) $('paClassEnd').value = parseTo24h(match.end) || '';
    if ($('paClassTeacher') && !$('paClassTeacher').value && match.instructor) $('paClassTeacher').value = match.instructor;
  }
}

function checkMoveOverlap() {
  const warn = $('paMoveWarn');
  if (!warn) return;
  const d = val('paMoveToDate'), t = val('paMoveToStart');
  if (!d || !t) { warn.hidden = true; return; }
  const s = toMinutes(t), e = s + 75;
  const clash = dayClasses(d).find(c => {
    const cs = toMinutes(c.start), ce = c.end ? toMinutes(c.end) : cs + 75;
    return s < ce && e > cs && !(d === val('paMoveFromDate') && c.title === val('paMoveClass'));
  });
  warn.hidden = !clash;
  if (clash) warn.textContent = `This overlaps ${clash.title} (${format12h(clash.start)}${clash.end ? `–${format12h(clash.end)}` : ''}) on that day.`;
}

/* ── Day chips under every date field ──────────────────────────────────── */
const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function renderDayChips() {
  const today = localDateStr();
  const days = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i);
    days.push(localDateStr(d));
  }
  document.querySelectorAll('#paFields input[type="date"]').forEach(input => {
    const field = input.closest('.pa-field');
    if (!field) return;
    let row = field.querySelector('.pa-days');
    if (!row) {
      row = document.createElement('div');
      row.className = 'pa-days';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', 'Quick pick a day');
      field.appendChild(row);
      row.addEventListener('click', e => {
        const b = e.target.closest('button[data-day]');
        if (!b) return;
        input.value = b.dataset.day;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    const wantsClass = input.id !== 'paHolidayStart' && input.id !== 'paHolidayEnd' && input.id !== 'paMoveToDate' && input.id !== 'paTaskDate';
    const html = days.map((ymd, i) => {
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${SHORT_DAY[dayIdxOf(ymd)]} ${Number(ymd.slice(8))}`;
      const quiet = wantsClass && st.routine && !dayClasses(ymd).length;
      const on = input.value === ymd;
      return `<button type="button" class="pa-day${on ? ' active' : ''}${quiet ? ' is-quiet' : ''}" data-day="${ymd}" aria-pressed="${on}"${ymd < (input.min || today) && !st.editId ? ' disabled' : ''}>${label}</button>`;
    }).join('');
    if (row.innerHTML !== html) row.innerHTML = html;
  });
}

/* ── Choice lists (mode, type) ─────────────────────────────────────────── */
function renderTypeList() {
  const grid = $('paTypeGrid');
  if (!grid) return;
  grid.innerHTML = TYPES.map(t => `<button type="button" role="radio" class="pa-choice tone-${t.tone}${t.id === st.type && st.typePicked ? ' active' : ''}" data-type="${t.id}" aria-checked="${t.id === st.type && !!st.typePicked}">
    <span class="nt-tile">${svg(ICONS[t.tone])}</span>
    <span class="pa-choice-text"><strong>${t.label}</strong><span>${t.desc}</span></span>
    ${svg(CHEV, '2')}
  </button>`).join('');
}

function renderChosen() {
  const el = $('paChosen');
  if (!el) return;
  const t = typeMeta(st.type);
  const mode = st.editId ? 'Editing a notice' : (st.mode === 'suggest' ? 'Suggestion' : 'Announcement');
  el.className = `pa-chosen tone-${t.tone}`;
  el.disabled = !!st.editId;
  el.innerHTML = `<span class="nt-tile">${svg(ICONS[t.tone])}</span>
    <span class="pa-chosen-text"><span>${escapeHtml(mode)}</span><strong>${escapeHtml(t.label)}</strong></span>
    ${st.editId ? '' : '<span class="pa-chosen-change">Change</span>'}`;
}

function setType(type) {
  st.type = type;
  if ($('paType')) $('paType').value = type;
  document.querySelectorAll('#paFields [data-for]').forEach(fs => { fs.hidden = fs.dataset.for !== type; });
  // A suggestion is about one day
  const multi = $('paHolidayMulti') && $('paHolidayMulti').closest('.pa-check');
  if (multi) multi.hidden = st.mode === 'suggest' || !!st.editId;
  if (st.mode === 'suggest' && $('paHolidayMulti')) { $('paHolidayMulti').checked = false; if ($('paHolidayEndRow')) $('paHolidayEndRow').hidden = true; }
  renderChosen();
  renderAudience();
  updateSubmitLabel();
}

function setClassMode(mode) {
  st.classMode = mode === 'extra' ? 'extra' : 'online';
  document.querySelectorAll('#paClassMode button').forEach(b => {
    const on = b.dataset.mode === st.classMode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  if ($('paClassLinkRow')) $('paClassLinkRow').hidden = st.classMode !== 'online';
  if ($('paClassRoomRow')) $('paClassRoomRow').hidden = st.classMode !== 'extra';
}

/* ── Steps ─────────────────────────────────────────────────────────────── */
function goTo(idx, { focus = true } = {}) {
  st.stepIdx = Math.max(0, Math.min(idx, st.steps.length - 1));
  const cur = step();
  document.querySelectorAll('#postAnnounceAppView .pa-panel').forEach(p => { p.hidden = p.dataset.step !== cur; });
  const n = st.steps.length;
  if ($('paStepCount')) $('paStepCount').textContent = `Step ${st.stepIdx + 1} of ${n}`;
  if ($('paProgressBar')) $('paProgressBar').style.transform = `scaleX(${(st.stepIdx + 1) / n})`;
  const txt = STEP_TEXT[cur];
  if ($('postAnnounceFormTitle')) $('postAnnounceFormTitle').textContent = typeof txt.title === 'function' ? txt.title() : txt.title;
  if ($('postAnnounceFormSubtitle')) $('postAnnounceFormSubtitle').textContent = txt.sub();
  if ($('paBackLabel')) $('paBackLabel').textContent = st.stepIdx === 0 ? 'Notices' : 'Back';
  if (cur === 'mode') renderModeList();
  if (cur === 'type') renderTypeList();
  if (cur === 'details') { renderChosen(); renderDayChips(); hideError(); }
  if (cur === 'review') renderReview();

  const scroller = document.querySelector('#postAnnounceAppView .pa-scroll');
  if (scroller) scroller.scrollTop = 0;
  const panel = document.querySelector(`#postAnnounceAppView .pa-panel[data-step="${cur}"]`);
  if (panel && !reduceMotion() && panel.animate) panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  if (focus && $('postAnnounceFormTitle')) { $('postAnnounceFormTitle').setAttribute('tabindex', '-1'); $('postAnnounceFormTitle').focus({ preventScroll: true }); }
}

function goToStep(name) {
  const i = st.steps.indexOf(name);
  if (i >= 0) goTo(i);
}

function back() {
  if (st.stepIdx > 0) {
    // A prefilled type has no type step to return to
    let i = st.stepIdx - 1;
    if (st.steps[i] === 'type' && st.skipType) i -= 1;
    goTo(Math.max(0, i));
    return;
  }
  if (window.switchAppView) window.switchAppView('announcements');
}

function renderModeList() {
  document.querySelectorAll('#paModeList .pa-choice').forEach(b => {
    const on = b.dataset.mode === st.mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
}

function pickMode(mode) {
  st.mode = mode;
  renderModeList();
  setType(st.type);
  goToStep(st.skipType ? 'details' : 'type');
}

function pickType(type) {
  st.typePicked = true;
  setType(type);
  goToStep('details');
}

/* ── Payloads ──────────────────────────────────────────────────────────── */
function holidayDates() {
  const start = val('paHolidayStart');
  if (!start) return [];
  if (!($('paHolidayMulti') && $('paHolidayMulti').checked) || st.editId || st.mode === 'suggest') return [start];
  const end = val('paHolidayEnd');
  if (!end || end < start) return [start];
  const out = [];
  for (let d = new Date(start + 'T00:00:00'), last = new Date(end + 'T00:00:00'); d <= last; d.setDate(d.getDate() + 1)) out.push(localDateStr(d));
  return out;
}

const fmtDay = ymd => new Date(ymd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** One validated payload for the current type (date = first/only date). */
function buildPayload(name, dateOverride) {
  const type = st.type;
  switch (type) {
    case 'general':
      return validateAnnouncementPayload({ name, type, title: val('paTitle'), announcement: val('paContent'), subject: val('paSubject') });
    case 'cancellation': {
      const subject = val('paCancelSubject'), date = val('paCancelDate');
      const note = collapseNewlines(val('paCancelNote'));
      const text = note || (subject && date ? `The ${subject} class on ${fmtDay(date)} is cancelled.` : '');
      return validateAnnouncementPayload({ name, type, title: `${subject} Class`, announcement: text, subject, date_override: date, subject_override: subject });
    }
    case 'holiday': {
      const dates = holidayDates();
      const holidayName = val('paHolidayName');
      const first = dates[0], last = dates[dates.length - 1];
      const text = dates.length > 1
        ? `Holiday from ${fmtDay(first)} to ${fmtDay(last)}. All classes are off.`
        : (first ? `Holiday on ${fmtDay(first)}. All classes are off.` : '');
      return validateAnnouncementPayload({ name, type, title: holidayName.trim() || 'Holiday', holiday_name: holidayName, announcement: text, date_override: dateOverride || first || '' });
    }
    case 'online_class': {
      const online = st.classMode === 'online';
      const subject = val('paClassSubject');
      return validateAnnouncementPayload({
        name, type, title: `${subject} ${online ? 'Online Class' : 'Extra Class'}`,
        platform: online ? val('paClassLink') : '', room: online ? '' : val('paClassRoom'),
        teacher: val('paClassTeacher'),
        start_time: val('paClassStart') ? format12h(val('paClassStart')) : '',
        end_time: val('paClassEnd') ? format12h(val('paClassEnd')) : '',
        is_extra_class: true, is_online: online,
        date_override: val('paClassDate'), subject_override: subject
      });
    }
    case 'class_test':
      return validateAnnouncementPayload({ name, type, exam_name: val('paTestName') || 'Class Test', topics: val('paTestTopics'), date_override: val('paTestDate'), subject_override: val('paTestSubject') });
    case 'rescheduled': {
      const sel = $('paMoveClass');
      const opt = sel && sel.options[sel.selectedIndex];
      const subject = val('paMoveClass');
      return validateAnnouncementPayload({
        name, type, title: `Rescheduled: ${subject}`,
        date_override: val('paMoveFromDate'), subject_override: subject,
        original_date: val('paMoveFromDate'),
        original_start_time: opt ? opt.getAttribute('data-start') || '' : '',
        original_room: opt ? opt.getAttribute('data-room') || '' : '',
        new_date: val('paMoveToDate'),
        new_start_time: val('paMoveToStart') ? format12h(val('paMoveToStart')) : '',
        new_room: val('paMoveRoom'), reason: val('paMoveReason')
      });
    }
    case 'assignment':
      return validateAnnouncementPayload({ name, type, date_override: val('paTaskDate'), subject_override: val('paTaskSubject'), task_title: val('paTaskTitle') || 'Assignment', due_time: val('paTaskDue') ? format12h(val('paTaskDue')) : '11:59 PM', description: val('paTaskNotes'), link: val('paTaskLink').trim() });
  }
  return { valid: false, error: 'Pick what it is about.' };
}

/** The date a post is about, for the "already passed" guard. */
function primaryDate() {
  switch (st.type) {
    case 'cancellation': return val('paCancelDate');
    case 'holiday': return val('paHolidayStart');
    case 'online_class': return val('paClassDate');
    case 'class_test': return val('paTestDate');
    case 'rescheduled': return val('paMoveFromDate');
    case 'assignment': return val('paTaskDate');
    default: return '';
  }
}

const currentName = () => val('paName').trim();

/** Problems that stop the details step, in plain words. '' when it is fine. */
function detailsProblem() {
  const v = buildPayload(currentName() || 'You');
  if (!v.valid) return v.error;
  const d = primaryDate();
  if (!st.editId && d && d < localDateStr()) return 'That day has already passed. Pick today or a later day.';
  if (st.type === 'holiday' && $('paHolidayMulti') && $('paHolidayMulti').checked && !st.editId && val('paHolidayEnd') < val('paHolidayStart')) return 'The last day must be after the first.';
  if (!st.editId && !audienceTargets().length) return 'Pick at least one section.';
  return '';
}
function showError(msg) { const e = $('paDetailsError'); if (e) { e.textContent = msg; e.hidden = false; } }
function hideError() { const e = $('paDetailsError'); if (e) e.hidden = true; }

/* ── Review ────────────────────────────────────────────────────────────── */
function renderPreview() {
  const box = $('paPreview');
  if (!box) return;
  const name = currentName() || 'You';
  const v = buildPayload(name);
  const t = audienceTargets()[0] || { semester: mySem(), section: mySec() };
  let row;
  if (v.valid) {
    const s = v.sanitized;
    row = { id: 'preview', name: s.name, title: s.title, announcement: s.announcement, type: st.type, subject: s.subject || '', date_override: s.date_override || '', subject_override: s.subject_override || '', semester: t.semester, section: t.section, created_at: new Date().toISOString() };
  } else {
    row = { id: 'preview', name, title: typeMeta(st.type).label, announcement: '', type: st.type, date_override: primaryDate(), semester: t.semester, section: t.section, created_at: new Date().toISOString() };
  }
  const n = toNotice(row, { semester: mySem().toLowerCase(), section: mySec() });
  n.pinned = st.mode === 'announce' && !!($('paPin') && $('paPin').checked);
  let html = cardHtml(n, true, 0);
  if (st.mode === 'suggest') html = html.replace('class="nt-card ', 'class="nt-card is-suggestion ');
  box.innerHTML = html;
  const err = $('paPreviewNote');
  if (err) { err.textContent = v.valid ? '' : v.error; err.hidden = v.valid; }
}

function renderReview() {
  renderPreview();
  const name = currentName();
  if ($('paNameShown')) $('paNameShown').textContent = name || 'No name yet';
  if ($('paNameRow')) $('paNameRow').hidden = !!name && !st.nameOpen;
  const suggest = st.mode === 'suggest' && !st.editId;
  if ($('paPasswordRow')) $('paPasswordRow').hidden = suggest;
  if ($('paPinRow')) $('paPinRow').hidden = suggest;
  if ($('paAudShown')) {
    $('paAudShown').textContent = st.editId
      ? targetsLabel([{ semester: String((st.editRow || {}).semester || ''), section: String((st.editRow || {}).section || '').toLowerCase() }])
      : targetsLabel(audienceTargets());
  }
  if ($('paOutcome')) {
    const routine = CLASS_TIED.has(st.type) || st.type === 'holiday';
    $('paOutcome').textContent = st.editId
      ? 'The changes apply for everyone it was sent to.'
      : suggest
        ? `Classmates vote on it.${routine ? ' With 2 more agrees than disagrees it shows in the routine as not confirmed.' : ''} At 8 votes, mostly agrees, it becomes official. Otherwise it goes away after 7 days.`
        : `It is published now and gets sent as a notification.${routine ? ' The routine changes for that day.' : ''}`;
  }
  updateSubmitLabel();
}

function postCount() {
  const targets = st.editId ? 1 : audienceTargets().length;
  const days = st.type === 'holiday' && !st.editId ? holidayDates().length || 1 : 1;
  return { targets, days, total: targets * days };
}

function updateSubmitLabel() {
  const label = $('postAnnounceSubmitLabel');
  if (!label) return;
  if (st.editId) { label.textContent = 'Save changes'; return; }
  if (st.mode === 'suggest') { label.textContent = 'Send suggestion'; return; }
  const { targets, total } = postCount();
  label.textContent = targets > 1 ? `Publish to ${targets} sections` : (total > 1 ? `Publish (${total} days)` : 'Publish');
}

/* ── Open ──────────────────────────────────────────────────────────────── */
function resetFields(today) {
  ['paTitle', 'paContent', 'paCancelNote', 'paHolidayName', 'paClassLink', 'paClassRoom', 'paClassTeacher', 'paTestName', 'paTestTopics', 'paMoveRoom', 'paMoveReason', 'paTaskTitle', 'paTaskNotes', 'paTaskLink']
    .forEach(id => { if ($(id)) $(id).value = ''; });
  ['paCancelDate', 'paHolidayStart', 'paClassDate', 'paTestDate', 'paMoveFromDate', 'paMoveToDate', 'paTaskDate']
    .forEach(id => { if ($(id)) { $(id).value = today; $(id).min = today; } });
  if ($('paHolidayEnd')) { $('paHolidayEnd').value = nextDayStr(today); $('paHolidayEnd').min = nextDayStr(today); }
  ['paHolidayMulti', 'paTestAll', 'paTaskAll', 'paPin'].forEach(id => { if ($(id)) $(id).checked = false; });
  if ($('paHolidayEndRow')) $('paHolidayEndRow').hidden = true;
  if ($('paClassStart')) $('paClassStart').value = '09:45';
  if ($('paClassEnd')) $('paClassEnd').value = '';
  if ($('paMoveToStart')) $('paMoveToStart').value = '15:00';
  if ($('paTaskDue')) $('paTaskDue').value = '23:59';
}

/**
 * existing: a notice row to edit (Manage mode), or { __prefill } from a class card,
 * or { __suggest: true } to start as a suggestion, or null for a new post.
 */
export function openPostForm(existing = null) {
  const startSuggest = !!(existing && existing.__suggest);
  if (startSuggest) existing = null;
  const prefill = existing && existing.__prefill ? existing.__prefill : null;
  if (prefill) existing = null;
  const today = localDateStr();
  resetFields(today);
  st.routine = null; st.routineKey = '';
  st.editId = existing ? String(existing.id) : '';
  st.editRow = existing || null;
  st.aud = 'mine'; st.secs = new Set(); st.sem = '';
  st.nameOpen = false;
  st.typePicked = false;
  st.skipType = !!prefill;
  st.mode = existing ? 'announce' : (startSuggest ? 'suggest' : '');
  if ($('paEditId')) $('paEditId').value = st.editId;

  let author = '';
  try { author = localStorage.getItem(AUTHOR_KEY) || ''; } catch (e) {}
  // The name fills in by itself: the last name used here, else the name from Settings
  const autoName = (author || Storage.getDisplayName() || '').trim().slice(0, ANNOUNCEMENT_LIMITS.AUTHOR_NAME);
  if ($('paName')) $('paName').value = existing ? (existing.name || '') : autoName;
  if ($('paPassword')) $('paPassword').value = State.sessionDeletePassword || '';

  setClassMode('online');
  if (existing) {
    const p = (() => { try { return JSON.parse(existing.announcement); } catch (e) { return {}; } })() || {};
    const subj = existing.subject_override || existing.subject || '';
    const date = existing.date_override || today;
    ['paCancelDate', 'paHolidayStart', 'paClassDate', 'paTestDate', 'paMoveFromDate', 'paMoveToDate', 'paTaskDate'].forEach(id => { if ($(id)) $(id).min = ''; });
    if ($('paPin')) $('paPin').checked = existing.is_pinned === true;
    st.type = existing.type || 'general';
    switch (st.type) {
      case 'general':
        $('paTitle').value = existing.title || '';
        $('paContent').value = existing.announcement || '';
        $('paSubject').dataset.keep = existing.subject || '';
        break;
      case 'cancellation':
        $('paCancelDate').value = date;
        $('paCancelSubject').dataset.keep = subj;
        $('paCancelNote').value = /^(The|Reminding you that the) .* (class|scheduled)/.test(existing.announcement || '') ? '' : (existing.announcement || '');
        break;
      case 'holiday':
        $('paHolidayStart').value = date;
        $('paHolidayName').value = String(existing.title || '').replace(/^Holiday:\s*/i, '');
        break;
      case 'online_class':
        setClassMode(p.is_online === false ? 'extra' : 'online');
        $('paClassDate').value = date;
        $('paClassSubject').dataset.keep = subj;
        $('paClassStart').value = parseTo24h(p.start_time) || '09:45';
        $('paClassEnd').value = parseTo24h(p.end_time) || '';
        $('paClassLink').value = p.platform || '';
        $('paClassRoom').value = p.room || '';
        $('paClassTeacher').value = p.teacher || '';
        break;
      case 'class_test':
        $('paTestDate').value = date;
        $('paTestSubject').dataset.keep = subj;
        $('paTestAll').checked = true;
        $('paTestName').value = p.exam_name || '';
        $('paTestTopics').value = p.topics && p.topics !== 'Not Specified' ? p.topics : '';
        break;
      case 'rescheduled':
        $('paMoveFromDate').value = p.original_date || date;
        $('paMoveToDate').value = p.new_date || p.original_date || date;
        $('paMoveToStart').value = parseTo24h(p.new_start_time) || '15:00';
        $('paMoveRoom').value = p.new_room || '';
        $('paMoveReason').value = p.reason || '';
        $('paMoveClass').dataset.keep = subj;
        break;
      case 'assignment':
        $('paTaskDate').value = date;
        $('paTaskSubject').dataset.keep = subj;
        $('paTaskAll').checked = true;
        $('paTaskTitle').value = p.task_title || '';
        $('paTaskDue').value = parseTo24h(p.due_time) || '23:59';
        $('paTaskNotes').value = p.description || '';
        if ($('paTaskLink')) $('paTaskLink').value = p.link || '';
        break;
    }
    st.steps = ['details', 'review'];
  } else {
    st.type = prefill && TYPES.some(t => t.id === prefill.type) ? prefill.type : 'general';
    if (prefill) applyPrefill(prefill);
    st.steps = ['mode', 'type', 'details', 'review'];
  }
  setType(st.type);
  // Restore course selections once the lists exist
  const restore = () => document.querySelectorAll('#paFields select[data-keep]').forEach(sel => {
    const k = sel.dataset.keep;
    if (k && !Array.from(sel.options).some(o => o.value === k)) sel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`);
    if (k) sel.value = k;
    delete sel.dataset.keep;
  });
  loadTargetRoutine().then(() => { restore(); refreshCounters(); renderDayChips(); });
  refreshCounters();
  const first = existing ? 0 : (startSuggest ? st.steps.indexOf(st.skipType ? 'details' : 'type') : 0);
  goTo(first, { focus: false });
}

/** Fill a new post from a class card: date, class, time, teacher, and its section. */
function applyPrefill(p) {
  const date = p.date || '';
  const keep = (id, v) => { if ($(id) && v) $(id).dataset.keep = v; };
  const setDate = id => { if ($(id) && date) $(id).value = date; };
  switch (p.type) {
    case 'cancellation': setDate('paCancelDate'); keep('paCancelSubject', p.subject); break;
    case 'class_test': setDate('paTestDate'); keep('paTestSubject', p.subject); break;
    case 'rescheduled': setDate('paMoveFromDate'); setDate('paMoveToDate'); keep('paMoveClass', p.subject); break;
    case 'assignment': setDate('paTaskDate'); keep('paTaskSubject', p.subject); break;
    case 'online_class':
      setDate('paClassDate'); keep('paClassSubject', p.subject);
      if (p.start && $('paClassStart')) $('paClassStart').value = parseTo24h(p.start) || $('paClassStart').value;
      if (p.teacher && $('paClassTeacher')) $('paClassTeacher').value = p.teacher;
      break;
  }
  if (p.semester && p.section && !(String(p.semester) === mySem() && String(p.section).toLowerCase() === mySec())) {
    st.aud = 'sections';
    st.sem = String(p.semester);
    st.secs = new Set([String(p.section).toLowerCase()]);
  }
}

/* ── Counters ──────────────────────────────────────────────────────────── */
function refreshCounters() {
  document.querySelectorAll('#postAnnounceAppView [data-max]').forEach(el => {
    const c = el.closest('.pa-field') && el.closest('.pa-field').querySelector('.pa-count');
    if (!c) return;
    const max = Number(el.dataset.max), len = el.value.trim().length;
    c.textContent = `${len}/${max}`;
    c.classList.toggle('is-near', len >= max - 2 && len < max);
    c.classList.toggle('is-full', len >= max);
  });
}

/* ── Send ──────────────────────────────────────────────────────────────── */
async function submitSuggestion(first, targets) {
  const btn = $('postAnnounceSubmit');
  const s = first.sanitized;
  const label = $('postAnnounceSubmitLabel');
  btn.disabled = true;
  if (label) label.textContent = 'Sending…';
  const r = await Suggestions.suggest({
    name: s.name, title: s.title, announcement: s.announcement, type: st.type, subject: s.subject || '',
    date_override: s.date_override || '', subject_override: s.subject_override || '',
    semester: targets[0].semester, section: targets[0].section
  });
  btn.disabled = false;
  updateSubmitLabel();
  if (r.ok) showToast('Suggestion sent. Your section can vote on it now.', 'success');
  else if (r.duplicateId) showToast('Someone already suggested this. Your vote on it counts instead.', 'info');
  else { showToast(r.error || 'Could not send the suggestion', 'error'); return; }
  if (window.switchAppView) window.switchAppView('announcements');
}

async function submit() {
  const btn = $('postAnnounceSubmit');
  const name = currentName();
  const password = val('paPassword');
  const suggest = st.mode === 'suggest' && !st.editId;
  if (!name) { st.nameOpen = true; renderReview(); showToast('Add your name. It is shown on the post.', 'warning'); $('paName').focus(); return; }
  if (!password && !suggest) { showToast('Enter the posting password.', 'warning'); $('paPassword').focus(); return; }

  const problem = detailsProblem();
  if (problem) { goToStep('details'); showError(problem); return; }
  const targets = st.editId ? [] : audienceTargets();
  const first = buildPayload(name);
  try { localStorage.setItem(AUTHOR_KEY, name); } catch (e) {}

  if (suggest) { await submitSuggestion(first, targets); return; }

  const pin = !!($('paPin') && $('paPin').checked);
  const label = $('postAnnounceSubmitLabel');
  btn.disabled = true;
  const restoreBtn = () => { btn.disabled = false; updateSubmitLabel(); };

  if (st.editId) {
    if (label) label.textContent = 'Saving…';
    const s = first.sanitized;
    const ok = await Announcements.update(st.editId, s.name, s.title, s.announcement, password, {
      type: st.type, subject: s.subject || '', date_override: s.date_override || '', subject_override: s.subject_override || '', is_pinned: pin
    });
    restoreBtn();
    if (ok && window.switchAppView) window.switchAppView('announcements');
    return;
  }

  const dates = st.type === 'holiday' ? holidayDates() : [null];
  const jobs = [];
  targets.forEach(t => dates.forEach(date => jobs.push({ t, date })));
  let done = 0;
  try {
    for (const job of jobs) {
      if (label) label.textContent = jobs.length > 1 ? `Publishing ${done + 1} of ${jobs.length}…` : 'Publishing…';
      const v = job.date ? buildPayload(name, job.date) : first;
      if (!v.valid) throw new Error(v.error);
      const s = v.sanitized;
      await Announcements.publish(s.name, s.title, s.announcement, password, {
        type: st.type, subject: s.subject || '', date_override: s.date_override || '', subject_override: s.subject_override || '',
        semester: job.t.semester, section: job.t.section, is_pinned: pin, quiet: true
      });
      done++;
    }
  } catch (err) {
    showToast(done ? `Published ${done} of ${jobs.length}. Stopped: ${err.message}` : (err.message || 'Could not publish'), 'error');
    restoreBtn();
    if (done) Announcements.fetchAll();
    return;
  }
  showToast(jobs.length > 1 ? `Published ${jobs.length} posts` : 'Published', 'success');
  Notifications.scheduleForToday();
  await Announcements.fetchAll();
  restoreBtn();
  if (window.switchAppView) window.switchAppView('announcements');
}

/* ── Init ──────────────────────────────────────────────────────────────── */
let _inited = false;
export function initPostForm() {
  window.__openPostAnnounceForm = item => openPostForm(item || null);
  if (_inited) return;
  _inited = true;

  const page = $('postAnnounceAppView');
  if (!page) return;
  // Back walks the steps first; the Android back button clicks this too (events/back-button.js)
  $('postAnnounceBackBtn')?.addEventListener('click', back);

  $('paModeList')?.addEventListener('click', e => {
    const b = e.target.closest('.pa-choice[data-mode]');
    if (b) pickMode(b.dataset.mode);
  });
  $('paTypeGrid')?.addEventListener('click', e => {
    const b = e.target.closest('.pa-choice[data-type]');
    if (b) pickType(b.dataset.type);
  });
  $('paChosen')?.addEventListener('click', () => {
    if (st.editId) return;
    st.skipType = false;
    goToStep('type');
  });
  $('paNextBtn')?.addEventListener('click', () => {
    const problem = detailsProblem();
    if (problem) { showError(problem); return; }
    hideError();
    goToStep('review');
  });
  $('paNameEdit')?.addEventListener('click', () => {
    st.nameOpen = true;
    if ($('paNameRow')) $('paNameRow').hidden = false;
    $('paName')?.focus();
  });

  $('paAudSeg')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-aud]');
    if (!b || b.disabled || b.dataset.aud === st.aud) return;
    st.aud = b.dataset.aud;
    renderAudience().then(updateSubmitLabel);
  });
  $('paAudSem')?.addEventListener('change', e => {
    st.sem = e.target.value; st.secs = new Set();
    renderAudience().then(updateSubmitLabel);
  });
  $('paAudSecs')?.addEventListener('click', e => {
    const b = e.target.closest('.pa-sec');
    if (!b) return;
    const s = b.dataset.sec;
    if (CLASS_TIED.has(st.type)) st.secs = new Set([s]);
    else if (st.secs.has(s)) st.secs.delete(s); else st.secs.add(s);
    renderAudience().then(updateSubmitLabel);
  });
  $('paClassMode')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (b) setClassMode(b.dataset.mode);
  });
  $('paHolidayMulti')?.addEventListener('change', e => {
    $('paHolidayEndRow').hidden = !e.target.checked;
    if (e.target.checked && val('paHolidayEnd') <= val('paHolidayStart')) $('paHolidayEnd').value = nextDayStr(val('paHolidayStart'));
    updateSubmitLabel();
  });
  $('paHolidayStart')?.addEventListener('change', () => {
    const min = nextDayStr(val('paHolidayStart'));
    $('paHolidayEnd').min = min;
    if (val('paHolidayEnd') < min) $('paHolidayEnd').value = min;
  });

  ['paCancelDate', 'paTestDate', 'paTaskDate', 'paMoveFromDate', 'paTestAll', 'paTaskAll'].forEach(id => $(id)?.addEventListener('change', () => refreshCourseLists()));
  ['paClassDate', 'paClassSubject'].forEach(id => $(id)?.addEventListener('change', autofillClassTime));
  ['paMoveToDate', 'paMoveToStart', 'paMoveClass'].forEach(id => $(id)?.addEventListener('input', checkMoveOverlap));

  let t = null;
  page.addEventListener('input', e => {
    if (e.target.matches('[data-max]')) refreshCounters();
    if (step() === 'details') hideError();
    clearTimeout(t);
    t = setTimeout(() => { if (step() === 'review') renderReview(); }, 120);
  });
  page.addEventListener('change', () => { renderDayChips(); if (step() === 'review') renderReview(); });
  page.querySelectorAll('textarea').forEach(ta => ta.addEventListener('blur', () => { ta.value = collapseNewlines(ta.value); refreshCounters(); }));

  $('postAnnounceSubmit')?.addEventListener('click', submit);

  // Limits come from validation.js so the counters never disagree with the validator
  const L = ANNOUNCEMENT_LIMITS;
  const limits = { paName: L.AUTHOR_NAME, paTitle: L.TITLE, paHolidayName: L.HOLIDAY_NAME, paClassLink: L.PLATFORM_LINK, paClassRoom: L.ROOM,
    paTestName: L.EXAM_NAME, paTestTopics: L.TOPICS, paMoveRoom: L.ROOM, paMoveReason: L.REASON, paTaskTitle: L.TASK_TITLE, paTaskNotes: L.ASSIGNMENT_DESC, paTaskLink: L.PLATFORM_LINK, paCancelNote: L.REASON };
  Object.entries(limits).forEach(([id, max]) => { const el = $(id); if (el) { el.dataset.max = max; el.maxLength = max; } });
}
