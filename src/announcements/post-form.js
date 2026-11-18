/**
 * Post / edit a notice (#postAnnounceAppView, redesigned Nov 2026).
 *  1. Type: seven tiles
 *  2. For: my section, other section(s), a whole semester, or everyone. Class-tied types
 *     (cancel, class, test, reschedule, assignment) go to ONE section, because their course
 *     list comes from that section's routine.
 *  3. Details for the type (course lists come from the target section's routine)
 *  4. Live preview using the feed's own card
 *  5. Name (remembered), admin password, optional pin, Publish
 * Payloads go through validateAnnouncementPayload, exactly as before.
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
  { id: 'general', tone: 'general', label: 'Notice', desc: 'Anything else to tell the class' },
  { id: 'class_test', tone: 'exam', label: 'Class test', desc: 'Exam date, course and syllabus' },
  { id: 'assignment', tone: 'task', label: 'Assignment', desc: 'Task with a due date and time' },
  { id: 'cancellation', tone: 'cancel', label: 'Cancel a class', desc: 'Marks the class cancelled in the routine' },
  { id: 'online_class', tone: 'online', label: 'Online / extra class', desc: 'Adds a session to the routine' },
  { id: 'rescheduled', tone: 'moved', label: 'Reschedule', desc: 'Moves a class to a new time' },
  { id: 'holiday', tone: 'holiday', label: 'Holiday', desc: 'Day off: one day or a range' }
];

const st = {
  type: 'general',
  aud: 'mine',            // mine | sections | semester | all
  sem: '',
  secs: new Set(),
  classMode: 'online',    // online | extra
  editId: '',
  editRow: null,
  suggest: false,        // community suggestion mode: no password, goes to the Suggestions section
  routine: null,          // routine (dayIdx -> classes) of the class-tied target section
  routineKey: ''
};
const routineCache = new Map();

const $ = id => document.getElementById(id);
const val = id => ($(id) ? $(id).value : '');
const mySem = () => String(Storage.getSemester() || '');
const mySec = () => String(Storage.getSection() || '').toLowerCase();

function nextDayStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}
const dayIdxOf = ymd => { const [y, m, d] = String(ymd).split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

/* ── Audience ──────────────────────────────────────────────────────────── */
async function structure() {
  const { loadCachedStructure } = await import('../events/init.js');
  return loadCachedStructure() || {};
}

/** {semester, section} pairs this post goes to. */
export function audienceTargets(state = st, me = { sem: mySem(), sec: mySec() }) {
  switch (state.aud) {
    case 'sections': return Array.from(state.secs).map(sec => ({ semester: state.sem, section: sec }));
    case 'semester': return state.sem ? [{ semester: state.sem, section: '' }] : [];
    case 'all': return [{ semester: '', section: '' }];
    default: return [{ semester: me.sem, section: me.sec }];
  }
}

function targetsLabel(targets) {
  if (!targets.length) return 'Pick who it is for';
  if (targets.length === 1) {
    const t = targets[0];
    if (!t.semester) return 'Everyone in the department';
    if (!t.section) return `Semester ${t.semester}, all sections`;
    const isMine = t.semester === mySem() && t.section === mySec();
    return `Semester ${t.semester} · Section ${t.section.toUpperCase()}${isMine ? ' (yours)' : ''}`;
  }
  return `${targets.length} sections in semester ${targets[0].semester}`;
}

async function renderAudience() {
  const box = $('paAudBox');
  if (!box) return;
  const seg = $('paAudSeg');
  const locked = $('paAudLocked');
  const pick = $('paAudPick');
  const note = $('paAudNote');
  const tied = CLASS_TIED.has(st.type);

  if (st.editId) {
    seg.hidden = true; pick.hidden = true;
    locked.hidden = false;
    const r = st.editRow || {};
    locked.textContent = `For: ${targetsLabel([{ semester: String(r.semester || ''), section: String(r.section || '').toLowerCase() }])}`;
    note.textContent = 'The audience of a published notice cannot be changed. Delete it and post again instead.';
    return;
  }
  locked.hidden = true;
  seg.hidden = false;
  if (st.suggest && (st.aud === 'sections' || st.aud === 'semester')) st.aud = 'mine'; // suggestions: my section or everyone
  if (tied && (st.aud === 'semester' || st.aud === 'all')) st.aud = 'mine';
  if (tied && st.secs.size > 1) st.secs = new Set([Array.from(st.secs)[0]]);
  seg.querySelectorAll('button').forEach(b => {
    const a = b.dataset.aud;
    b.classList.toggle('active', a === st.aud);
    b.setAttribute('aria-pressed', String(a === st.aud));
    b.disabled = tied && (a === 'semester' || a === 'all');
    b.hidden = st.suggest && (a === 'sections' || a === 'semester');
    if (a === 'sections') b.textContent = tied ? 'Another section' : 'Other sections';
  });

  pick.hidden = !(st.aud === 'sections' || st.aud === 'semester');
  if (!pick.hidden) {
    const s = await structure();
    const sems = Object.keys(s).sort((a, b) => Number(a) - Number(b));
    if (!st.sem || !s[st.sem]) st.sem = sems.includes(mySem()) ? mySem() : (sems[0] || '');
    const semSel = $('paAudSem');
    semSel.innerHTML = sems.map(x => `<option value="${x}"${x === st.sem ? ' selected' : ''}>Semester ${x}</option>`).join('');
    const secWrap = $('paAudSecs');
    secWrap.hidden = st.aud !== 'sections';
    const secs = (s[st.sem] || []).map(x => String(x).toLowerCase());
    st.secs = new Set(Array.from(st.secs).filter(x => secs.includes(x)));
    secWrap.innerHTML = secs.map(x => `<button type="button" class="pa-sec${st.secs.has(x) ? ' active' : ''}" data-sec="${x}" aria-pressed="${st.secs.has(x)}">${x.toUpperCase()}${st.sem === mySem() && x === mySec() ? '<span>yours</span>' : ''}</button>`).join('');
  }
  const targets = audienceTargets();
  note.textContent = tied
    ? `${targetsLabel(targets)}. Course lists below come from that section's routine.`
    : targetsLabel(targets);
  await loadTargetRoutine();
}

async function loadTargetRoutine() {
  const tied = CLASS_TIED.has(st.type);
  const t = audienceTargets();
  let key = 'mine';
  if (tied && st.aud === 'sections') key = t.length === 1 ? `${t[0].semester}/${t[0].section}` : '';
  if (key === st.routineKey && st.routine) return;
  st.routineKey = key;
  if (key === 'mine') { st.routine = State.schedule || {}; refreshCourseLists(); return; }
  if (!key) { st.routine = {}; refreshCourseLists(); return; }
  if (routineCache.has(key)) { st.routine = routineCache.get(key); refreshCourseLists(); return; }
  st.routine = {};
  refreshCourseLists('Loading routine…');
  try {
    const { fetchSectionSchedule } = await import('../events/init.js');
    const r = await fetchSectionSchedule(t[0].semester, t[0].section);
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
  const noClass = dateId => wait || (val(dateId) ? `No classes on ${DAY_NAMES[dayIdxOf(val(dateId))]}` : 'Pick a date first');

  fillSelect('paSubject', allCourses(), undefined, '', true);
  fillSelect('paCancelSubject', daySubjects('paCancelDate'), undefined, noClass('paCancelDate'));
  fillSelect('paClassSubject', allCourses(), undefined, wait || 'No courses in this routine');
  fillSelect('paTestSubject', daySubjects('paTestDate', 'paTestAll'), undefined, noClass('paTestDate'));
  fillSelect('paTaskSubject', daySubjects('paTaskDate', 'paTaskAll'), undefined, noClass('paTaskDate'));

  // Reschedule: the classes on the original day, with their times
  const mv = $('paMoveClass');
  if (mv) {
    const keep = mv.value;
    const list = dayClasses(val('paMoveFromDate'));
    mv.innerHTML = list.length
      ? list.map(c => {
          const start = c.start ? format12h(c.start) : '';
          const end = c.end ? format12h(c.end) : '';
          const label = `${c.title}${start ? ` · ${start}${end ? `–${end}` : ''}` : ''}${c.room ? ` · ${c.room}` : ''}`;
          return `<option value="${escapeHtml(c.title)}" data-start="${escapeHtml(start)}" data-room="${escapeHtml(c.room || '')}"${c.title === keep ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('')
      : `<option value="">${escapeHtml(noClass('paMoveFromDate'))}</option>`;
  }
  autofillClassTime();
  checkMoveOverlap();
  renderPreview();
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
  if (clash) warn.textContent = `Overlaps ${clash.title} (${format12h(clash.start)}${clash.end ? `–${format12h(clash.end)}` : ''}) on that day.`;
}

/* ── Type ──────────────────────────────────────────────────────────────── */
function renderTypeGrid() {
  const grid = $('paTypeGrid');
  if (!grid) return;
  grid.innerHTML = TYPES.map(t => `<button type="button" role="radio" class="pa-type tone-${t.tone}${t.id === st.type ? ' active' : ''}" data-type="${t.id}" aria-checked="${t.id === st.type}"${st.editId && t.id !== st.type ? ' disabled' : ''}>
    <span class="nt-tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[t.tone]}</svg></span>
    <span class="pa-type-text"><strong>${t.label}</strong><span>${t.desc}</span></span>
  </button>`).join('');
}

function setType(type) {
  st.type = type;
  if ($('paType')) $('paType').value = type;
  renderTypeGrid();
  document.querySelectorAll('#paFields [data-for]').forEach(fs => { fs.hidden = fs.dataset.for !== type; });
  renderAudience();
  updateSubmitLabel();
  renderPreview();
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
  renderPreview();
}

/* ── Payloads ──────────────────────────────────────────────────────────── */
function holidayDates() {
  const start = val('paHolidayStart');
  if (!start) return [];
  if (!($('paHolidayMulti') && $('paHolidayMulti').checked) || st.editId) return [start];
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
      return validateAnnouncementPayload({ name, type, date_override: val('paTaskDate'), subject_override: val('paTaskSubject'), task_title: val('paTaskTitle') || 'Assignment', due_time: val('paTaskDue') ? format12h(val('paTaskDue')) : '11:59 PM', description: val('paTaskNotes') });
  }
  return { valid: false, error: 'Pick a type.' };
}

/** The dates a notice affects, for the "past date" guard. */
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

/* ── Preview + submit label ────────────────────────────────────────────── */
function renderPreview() {
  const box = $('paPreview');
  if (!box) return;
  const name = (val('paName') || 'You').trim();
  const v = buildPayload(name);
  const t = audienceTargets()[0] || { semester: mySem(), section: mySec() };
  let row;
  if (v.valid) {
    const s = v.sanitized;
    row = { id: 'preview', name: s.name, title: s.title, announcement: s.announcement, type: st.type, subject: s.subject || '', date_override: s.date_override || '', subject_override: s.subject_override || '', semester: t.semester, section: t.section, created_at: new Date().toISOString() };
  } else {
    const meta = TYPES.find(x => x.id === st.type);
    row = { id: 'preview', name, title: st.type === 'general' ? (val('paTitle') || 'Your title') : (meta ? meta.label : 'Notice'), announcement: val('paContent') || '', type: st.type, date_override: primaryDate(), semester: t.semester, section: t.section, created_at: new Date().toISOString() };
  }
  const n = toNotice(row, { semester: mySem().toLowerCase(), section: mySec() });
  n.pinned = !!($('paPin') && $('paPin').checked);
  box.innerHTML = cardHtml(n, false, 0).replace('<button', '<div').replace(/<\/button>\s*$/, '</div>');
  const err = $('paPreviewNote');
  if (err) { err.textContent = v.valid ? '' : v.error; err.hidden = v.valid; }
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
  if (st.suggest) { label.textContent = 'Send suggestion'; return; }
  const { targets, total } = postCount();
  label.textContent = targets > 1 ? `Publish to ${targets} sections` : (total > 1 ? `Publish (${total} days)` : 'Publish');
}

/* ── Open ──────────────────────────────────────────────────────────────── */
function resetFields(today) {
  ['paTitle', 'paContent', 'paCancelNote', 'paHolidayName', 'paClassLink', 'paClassRoom', 'paClassTeacher', 'paTestName', 'paTestTopics', 'paMoveRoom', 'paMoveReason', 'paTaskTitle', 'paTaskNotes']
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

export function openPostForm(existing = null) {
  const suggest = !!(existing && existing.__suggest);
  if (suggest) existing = null;
  st.suggest = suggest;
  // Quick action from a class card: create mode, prefilled (class-detail.js)
  const prefill = existing && existing.__prefill ? existing.__prefill : null;
  if (prefill) existing = null;
  const today = localDateStr();
  resetFields(today);
  st.routine = null; st.routineKey = '';
  st.editId = existing ? String(existing.id) : '';
  st.editRow = existing || null;
  st.aud = 'mine'; st.secs = new Set(); st.sem = '';
  if ($('paEditId')) $('paEditId').value = st.editId;

  let author = '';
  try { author = localStorage.getItem(AUTHOR_KEY) || ''; } catch (e) {}
  if ($('paName')) $('paName').value = existing ? (existing.name || '') : author;
  if ($('paPassword')) $('paPassword').value = State.sessionDeletePassword || '';
  const pwField = $('paPassword') && $('paPassword').closest('.pa-field');
  if (pwField) pwField.hidden = suggest;
  const pinRow = $('paPin') && $('paPin').closest('.pa-check');
  if (pinRow) pinRow.hidden = suggest;

  if ($('postAnnounceFormTitle')) $('postAnnounceFormTitle').textContent = existing ? 'Edit notice' : (suggest ? 'Suggest a notice' : 'New notice');
  if ($('postAnnounceFormSubtitle')) $('postAnnounceFormSubtitle').textContent = existing
    ? 'Changes apply for everyone it was sent to'
    : (suggest ? 'Your section votes on it. It stays marked not confirmed until then.' : 'Everyone it is for gets a notification');

  setClassMode('online');
  if (existing) {
    const p = (() => { try { return JSON.parse(existing.announcement); } catch (e) { return {}; } })() || {};
    const subj = existing.subject_override || existing.subject || '';
    const date = existing.date_override || today;
    ['paCancelDate', 'paHolidayStart', 'paClassDate', 'paTestDate', 'paMoveFromDate', 'paMoveToDate', 'paTaskDate'].forEach(id => { if ($(id)) $(id).min = ''; });
    if ($('paPin')) $('paPin').checked = existing.is_pinned === true;
    const type = existing.type || 'general';
    st.type = type;
    // Class-tied edits use the routine of the section the notice was sent to
    if (CLASS_TIED.has(type) && existing.semester && existing.section &&
        !(String(existing.semester) === mySem() && String(existing.section).toLowerCase() === mySec())) {
      st.aud = 'sections'; st.sem = String(existing.semester); st.secs = new Set([String(existing.section).toLowerCase()]);
    }
    switch (type) {
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
        break;
    }
  } else {
    st.type = prefill && TYPES.some(t => t.id === prefill.type) ? prefill.type : 'general';
    if (prefill) applyPrefill(prefill);
  }
  setType(st.type);
  // Restore course selections once the lists exist
  const restore = () => document.querySelectorAll('#paFields select[data-keep]').forEach(sel => {
    const k = sel.dataset.keep;
    if (k && !Array.from(sel.options).some(o => o.value === k)) sel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`);
    if (k) sel.value = k;
    delete sel.dataset.keep;
  });
  loadTargetRoutine().then(() => { restore(); refreshCounters(); renderPreview(); });
  refreshCounters();
  const scroller = document.querySelector('#postAnnounceAppView .pa-scroll');
  if (scroller) scroller.scrollTop = 0;
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

/* ── Submit ────────────────────────────────────────────────────────────── */
/** Community suggestion: one notice, one audience, no password. */
async function submitSuggestion(first, targets, name) {
  const btn = $('postAnnounceSubmit');
  const dates = st.type === 'holiday' ? holidayDates() : [null];
  if (dates.length > 1 || targets.length !== 1) { showToast('Suggest one day for one audience at a time.', 'warning'); return; }
  const v = dates[0] ? buildPayload(name, dates[0]) : first;
  if (!v.valid) { showToast(v.error, 'warning'); return; }
  const s = v.sanitized;
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
  if (r.ok) showToast('Suggestion sent. Your section can vote on it.', 'success');
  else if (r.duplicateId) showToast('Someone already suggested this. Open Suggestions and vote on it.', 'info');
  else { showToast(r.error || 'Could not send the suggestion', 'error'); return; }
  if (window.switchAppView) window.switchAppView('announcements');
}

async function submit() {
  const btn = $('postAnnounceSubmit');
  const name = val('paName').trim();
  const password = val('paPassword');
  if (!name) { showToast('Add your name.', 'warning'); $('paName').focus(); return; }
  if (!password && !st.suggest) { showToast('Enter the posting password.', 'warning'); $('paPassword').focus(); return; }

  const today = localDateStr();
  const d = primaryDate();
  if (!st.editId && d && d < today) { showToast('That date has already passed.', 'warning'); return; }
  if (st.type === 'holiday' && $('paHolidayMulti').checked && !st.editId && val('paHolidayEnd') < val('paHolidayStart')) {
    showToast('The last day must be after the first.', 'warning'); return;
  }
  const targets = st.editId ? [] : audienceTargets();
  if (!st.editId && !targets.length) { showToast('Pick at least one section.', 'warning'); return; }

  const first = buildPayload(name);
  if (!first.valid) { showToast(first.error, 'warning'); return; }
  try { localStorage.setItem(AUTHOR_KEY, name); } catch (e) {}

  if (st.suggest) { await submitSuggestion(first, targets, name); return; }

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
  showToast(jobs.length > 1 ? `Published ${jobs.length} notices` : 'Notice published', 'success');
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
  $('postAnnounceBackBtn')?.addEventListener('click', () => window.switchAppView && window.switchAppView('announcements'));

  $('paTypeGrid')?.addEventListener('click', e => {
    const b = e.target.closest('.pa-type');
    if (b && !b.disabled && b.dataset.type !== st.type) setType(b.dataset.type);
  });
  $('paAudSeg')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-aud]');
    if (!b || b.disabled || b.dataset.aud === st.aud) return;
    st.aud = b.dataset.aud;
    renderAudience().then(() => { updateSubmitLabel(); renderPreview(); });
  });
  $('paAudSem')?.addEventListener('change', e => {
    st.sem = e.target.value; st.secs = new Set();
    renderAudience().then(() => { updateSubmitLabel(); renderPreview(); });
  });
  $('paAudSecs')?.addEventListener('click', e => {
    const b = e.target.closest('.pa-sec');
    if (!b) return;
    const s = b.dataset.sec;
    if (CLASS_TIED.has(st.type)) st.secs = new Set([s]);
    else if (st.secs.has(s)) st.secs.delete(s); else st.secs.add(s);
    renderAudience().then(() => { updateSubmitLabel(); renderPreview(); });
  });
  $('paClassMode')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (b) setClassMode(b.dataset.mode);
  });
  $('paHolidayMulti')?.addEventListener('change', e => {
    $('paHolidayEndRow').hidden = !e.target.checked;
    if (e.target.checked && val('paHolidayEnd') <= val('paHolidayStart')) $('paHolidayEnd').value = nextDayStr(val('paHolidayStart'));
    updateSubmitLabel(); renderPreview();
  });
  $('paHolidayStart')?.addEventListener('change', () => {
    const min = nextDayStr(val('paHolidayStart'));
    $('paHolidayEnd').min = min;
    if (val('paHolidayEnd') < min) $('paHolidayEnd').value = min;
  });

  ['paCancelDate', 'paTestDate', 'paTaskDate', 'paMoveFromDate', 'paTestAll', 'paTaskAll'].forEach(id => $(id)?.addEventListener('change', () => refreshCourseLists()));
  ['paClassDate', 'paClassSubject'].forEach(id => $(id)?.addEventListener('change', () => { autofillClassTime(); renderPreview(); }));
  ['paMoveToDate', 'paMoveToStart', 'paMoveClass'].forEach(id => $(id)?.addEventListener('input', checkMoveOverlap));

  let t = null;
  page.addEventListener('input', e => {
    if (e.target.matches('[data-max]')) refreshCounters();
    clearTimeout(t);
    t = setTimeout(() => { updateSubmitLabel(); renderPreview(); }, 120);
  });
  page.addEventListener('change', () => { updateSubmitLabel(); renderPreview(); });
  page.querySelectorAll('textarea').forEach(ta => ta.addEventListener('blur', () => { ta.value = collapseNewlines(ta.value); refreshCounters(); }));

  $('postAnnounceSubmit')?.addEventListener('click', submit);

  // Limits come from validation.js so the counters never disagree with the validator
  const L = ANNOUNCEMENT_LIMITS;
  const limits = { paName: L.AUTHOR_NAME, paTitle: L.TITLE, paHolidayName: L.HOLIDAY_NAME, paClassLink: L.PLATFORM_LINK, paClassRoom: L.ROOM,
    paTestName: L.EXAM_NAME, paTestTopics: L.TOPICS, paMoveRoom: L.ROOM, paMoveReason: L.REASON, paTaskTitle: L.TASK_TITLE, paTaskNotes: L.ASSIGNMENT_DESC, paCancelNote: L.REASON };
  Object.entries(limits).forEach(([id, max]) => { const el = $(id); if (el) { el.dataset.max = max; el.maxLength = max; } });
}
