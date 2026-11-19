import { State } from '../core/state.js';
import { FULL_COURSE_NAMES, DAY_NAMES } from '../core/config.js';
import { format12h, formatRoom, escapeHtml, toMinutes } from '../core/utils.js';
import { toNotice } from '../announcements/notice-model.js';
import { getTeacherInfo } from '../teachers/teacher-names.js';
import { openModal, closeModal } from '../modals/modal.js';
import { Storage } from '../storage/storage.js';

let _activeModalTeacherCode = 'MHE';
let _activeModalRoom = '';
let _activeModalDayIdx = new Date().getDay();

// Ghost-tap guard: on Android WebView the tap that opens this sheet (e.g. a Free Rooms class
// card) can land again on the freshly rendered Instructor/Room tile under the finger, opening
// the teacher profile instead of showing class details. Ignore tile taps briefly after opening.
const GHOST_TAP_GUARD_MS = 450;
let _openedAt = 0;
export function isWithinGhostTapWindow() {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) - _openedAt < GHOST_TAP_GUARD_MS;
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatClassSemSec(data) {
  let sem = data.semester || '';
  let sec = data.section || '';

  if (!sem && data.semSec) {
    const match = String(data.semSec).match(/Sem\s*(\d+)(?:-([A-Za-z0-9]+))?/i);
    if (match) {
      sem = match[1];
      sec = match[2] || '';
    }
  }

  // Fallback to active student routine preference ONLY for Timeline / student routine classes
  // (Prevents mislabeling department-wide room view classes if they ever lack semSec)
  if (!sem && (data.isFromTimeline || !data.isFromRoom)) {
    sem = Storage.getSemester();
    if (!sec) {
      sec = Storage.getSection();
    }
  }

  if (!sem) return '';

  const ord = getOrdinal(parseInt(sem, 10));
  if (sec) {
    return `${ord} Semester – Section ${sec.toUpperCase()}`;
  }
  return `${ord} Semester`;
}

export function getWeeklyRecurrences(courseCode) {
  const cleanCode = (courseCode || '').toUpperCase().trim();
  const recurrences = [];
  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'];
  const dayIndexMap = { Saturday: 6, Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3 };

  days.forEach(dayName => {
    const dayIdx = dayIndexMap[dayName];
    const list = State.schedule[dayIdx] || State.schedule[dayName] || [];
    list.forEach(item => {
      const itemCode = (item.subject || item.title || '').toUpperCase().trim();
      if (itemCode === cleanCode) {
        recurrences.push({
          day: dayName,
          dayIdx: dayIdx,
          dayShort: dayName.substring(0, 3).toUpperCase(),
          time: `${format12h(item.start)} – ${format12h(item.end)}`,
          start: item.start,
          end: item.end,
          room: formatRoom(item.room) || 'TBA',
          instructor: item.instructor || item.teacher || '',
          type: item.type || '',
          semSec: item.semSec || '',
          semester: item.semester || '',
          section: item.section || ''
        });
      }
    });
  });

  return recurrences;
}

let _quickData = null;

/** "Add an update" row: open the post form prefilled for this class and its date. */
function initQuickActions() {
  const row = document.getElementById('classQuickActions');
  if (!row || row._bound) return;
  row._bound = true;
  row.addEventListener('click', async e => {
    const btn = e.target.closest('[data-quick]');
    if (!btn || !_quickData) return;
    if (isWithinGhostTapWindow()) return;
    const d = _quickData;
    const { getDateForDayIndex } = await import('../announcements/overrides.js');
    let date = '';
    if (d.dayIdx !== undefined && d.dayIdx !== null) {
      date = getDateForDayIndex(d.dayIdx);
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (date < todayStr) {
        const dt = new Date(date + 'T00:00:00');
        dt.setDate(dt.getDate() + 7);
        date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      }
    }
    const semMatch = String(d.semSec || '').match(/Sem\s*(\d+)(?:-([A-Za-z0-9]+))?/i);
    closeClassDetails();
    if (window.switchAppView) window.switchAppView('post_announcement', {
      __prefill: {
        type: btn.dataset.quick,
        date,
        subject: d.code || d.title || '',
        start: d.start || '',
        room: d.room && d.room !== 'TBA' ? d.room : '',
        teacher: d.instructor && d.instructor !== 'TBA' ? d.instructor : '',
        semester: semMatch ? semMatch[1] : '',
        section: semMatch && semMatch[2] ? semMatch[2].toLowerCase() : ''
      }
    });
  });
}

/** Next date this class happens: the viewed weekday's date, rolled a week ahead if it has passed. */
async function classDate(dayIdx) {
  const { getDateForDayIndex } = await import('../announcements/overrides.js');
  let date = getDateForDayIndex(dayIdx);
  const t = new Date();
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  if (date < today) {
    const dt = new Date(date + 'T00:00:00');
    dt.setDate(dt.getDate() + 7);
    date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  return date;
}

/**
 * "Reminder" switch in the class sheet: skips (or restores) this class's alerts on its next date.
 * Shown only when an alert is actually planned for it (notifications on, not passed, not cancelled).
 */
let _remind = null;
async function updateRemindRow(data, dayIdx) {
  const row = document.getElementById('classRemindRow');
  const toggle = document.getElementById('classRemindToggle');
  if (!row || !toggle) return;
  row.hidden = true;
  _remind = null;
  try {
    const [{ Notifications }, { classKey, fmtTime }, store] = await Promise.all([
      import('../notifications/notifications.js'), import('../notifications/planner.js'), import('../notifications/notif-store.js')
    ]);
    const date = await classDate(dayIdx);
    const key = classKey({ title: data.code || data.title, start: data.start });
    const alerts = Notifications.getPlan({ ignoreSkips: true }).filter(n => n.date === date && n.classKey === key && (n.kind === 'class' || n.kind === 'test' || n.kind === 'start'));
    if (!alerts.length) return;
    _remind = { date, key };
    const on = !store.isClassSkipped(date, key);
    toggle.checked = on;
    const first = alerts[0];
    const d = new Date(`${date}T12:00:00`);
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const when = date === todayStr ? 'today' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    const at = new Date(first.at);
    document.getElementById('classRemindTitle').textContent = on ? 'Reminder on' : 'Reminder skipped';
    document.getElementById('classRemindSub').textContent = on
      ? `${fmtTime(at.getHours() * 60 + at.getMinutes())} ${when}${first.kind === 'test' ? ' (test)' : ''}`
      : `No alerts for this class ${when}`;
    row.hidden = false;
    if (!toggle._bound) {
      toggle._bound = true;
      toggle.addEventListener('change', () => {
        if (!_remind) return;
        Notifications.skipClass(_remind.date, _remind.key, !toggle.checked);
        updateRemindRow(_quickData, _activeModalDayIdx);
      });
    }
  } catch (e) { row.hidden = true; }
}

/* ── Class sheet v2 (2026-11-19) ─────────────────────────────────────────────
   Reading order: what class and what kind, WHAT IS HAPPENING on this date (live / starts in /
   cancelled / test / online / moved), when, where, who, notices about this class, reminder,
   the weekly pattern, quick updates. */

const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ymdOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nice = ymd => { const [y, m, d] = ymd.split('-').map(Number); const t = new Date(y, m - 1, d); return `${WD3[t.getDay()]} ${d} ${MON3[m - 1]}`; };
const daysUntil = ymd => { const [y, m, d] = ymd.split('-').map(Number); const t = new Date(); return Math.round((new Date(y, m - 1, d) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5); };
const span = mins => (mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`);
const SVG = (d, w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  live: '<circle cx="12" cy="12" r="3"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  cancel: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
  test: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>',
  online: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  moved: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  done: '<polyline points="20 6 9 17 4 12"/>',
  task: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>'
};

/**
 * The one status panel. Tells what is true for THIS date, in plain words:
 *   cancelled / test / online (+ Join) / moved (+ was) / extra, or for a normal class:
 *   "Live now, 25m left" with a progress bar, "Starts in 2h 10m", "Done for today", "Next: Sat 21 Nov".
 * Returns { html, tone } where tone only changes the lead word's colour for cancelled.
 */
function statusHtml(data, date) {
  const rows = [];
  const lead = (icon, text, cls = '') => `<div class="cs2-status-lead${cls ? ` ${cls}` : ''}">${SVG(icon, 17)}<span>${escapeHtml(text)}</span></div>`;
  const line = text => `<div class="cs2-status-line">${text}</div>`;
  const when = date ? (daysUntil(date) === 0 ? 'today' : daysUntil(date) === 1 ? 'tomorrow' : nice(date)) : '';

  if (data.isCancelled) {
    rows.push(lead(I.cancel, `Cancelled ${when}`.trim(), 'is-bad'));
    if (data.cancelReason && !/^Class cancelled for this date$/i.test(data.cancelReason)) rows.push(line(escapeHtml(data.cancelReason)));
    return rows.join('');
  }
  if (data.isExam) {
    rows.push(lead(I.test, `${data.examName || 'Class test'}${when ? `, ${when}` : ''}`));
    if (data.examTopics) rows.push(line(`<span class="cs2-k">Covers</span> ${escapeHtml(data.examTopics)}`));
    return rows.join('');
  }
  if (data.isOnline) {
    rows.push(lead(I.online, `Online ${when}`.trim()));
    const platform = String(data.onlinePlatform || '').trim();
    if (/^https?:\/\//i.test(platform)) {
      let host = '';
      try { host = new URL(platform).hostname.replace(/^www\./, ''); } catch (e) {}
      rows.push(`<a class="cs2-join" href="${escapeHtml(platform)}" target="_blank" rel="noopener noreferrer">${SVG(I.play, 16)}<span>Join class</span><span class="cs2-join-host">${escapeHtml(host)}</span></a>`);
    } else if (platform) {
      rows.push(line(`<span class="cs2-k">Where</span> ${escapeHtml(platform)}`));
    }
    return rows.join('');
  }
  if (data.isRescheduled) {
    rows.push(lead(I.moved, `Rescheduled ${when}`.trim()));
    if (data.origDate) {
      const [oy, om, od] = String(data.origDate).split('-').map(Number);
      if (oy && om && od) rows.push(line(`<span class="cs2-k">Was</span> ${escapeHtml(`${WD3[new Date(oy, om - 1, od).getDay()]} ${od} ${MON3[om - 1]}${data.origStart ? `, ${format12h(data.origStart)}` : ''}`)}`));
    }
    if (data.rescheduledReason) rows.push(line(`<span class="cs2-k">Reason</span> ${escapeHtml(data.rescheduledReason)}`));
    return rows.join('');
  }
  if (data.isExtraClass) {
    rows.push(lead(I.plus, `Extra class ${when}`.trim()));
    return rows.join('');
  }

  // A normal class: where is it in time?
  if (!date) return '';
  const start = toMinutes(data.start || ''), end = toMinutes(data.end || '');
  const d = daysUntil(date);
  if (d === 0 && start >= 0) {
    const now = new Date();
    const m = now.getHours() * 60 + now.getMinutes();
    if (end > start && m >= start && m < end) {
      const pct = Math.round(((m - start) / (end - start)) * 100);
      rows.push(lead(I.live, `Live now, ${span(end - m)} left`, 'is-live'));
      rows.push(`<div class="cs2-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`);
      return rows.join('');
    }
    if (m < start) return lead(I.clock, `Starts in ${span(start - m)}`);
    return lead(I.done, 'Done for today');
  }
  if (d === 1) return lead(I.clock, 'Tomorrow');
  return lead(I.clock, `Next: ${nice(date)}${d > 1 ? `, in ${d} days` : ''}`);
}

/** Notices about this class in the next two weeks (cancelled, tests, tasks, online, moved). */
function classNotices(code) {
  const types = new Set(['cancellation', 'class_test', 'assignment', 'online_class', 'rescheduled']);
  const today = ymdOf(new Date());
  const last = ymdOf(new Date(Date.now() + 14 * 864e5));
  const ctx = { semester: String(Storage.getSemester() || '').toLowerCase(), section: String(Storage.getSection() || '').toLowerCase(), schedule: State.schedule };
  return (State.announcementsList || [])
    .filter(a => types.has(a.type) && String(a.subject_override || a.subject || '').toUpperCase().trim() === code)
    .map(a => ({ raw: a, n: toNotice(a, ctx) }))
    .filter(x => x.n.date && x.n.date >= today && x.n.date <= last)
    .sort((a, b) => a.n.date.localeCompare(b.n.date))
    .slice(0, 5);
}

function noticesHtml(items) {
  if (!items.length) return '';
  return `<h3 class="cs2-h">Coming up for this class</h3><div class="cs2-notice-list">${items.map(({ raw, n }) => {
    const unconfirmed = raw.is_unconfirmed === true;
    const f = n.focus || {};
    const t = f.hasTime ? ` ${f.big} ${f.ampm}` : '';
    return `<div class="cs2-notice">
      <span class="cs2-notice-head"><span class="cs2-notice-title">${escapeHtml(n.headline)}</span>${unconfirmed ? '<span class="cs2-unconf">Unconfirmed</span>' : ''}</span>
      <span class="cs2-notice-when">${escapeHtml(nice(n.date))}${escapeHtml(t)}</span>
    </div>`;
  }).join('')}</div>`;
}

const SHOW_ICON = {
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  lab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9.5V2"/><line x1="8" y1="2" x2="16" y2="2"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'
};

let _statusTimer = null;
let _showToken = null;

export function showClassDetails(data) {
  _quickData = data;
  initQuickActions();
  const modal = document.getElementById('classDetailModal');
  if (!modal || !data) return;

  const code = (data.code || data.title || '').toUpperCase().trim();
  const fullTitle = FULL_COURSE_NAMES[code] || data.name || code;
  const isLab = (data.type || '').toLowerCase() === 'lab';
  const cleanRoom = formatRoom(data.room) || 'TBA';
  _activeModalRoom = cleanRoom;

  let classDayIdx = (data.dayIdx !== undefined && data.dayIdx !== null) ? data.dayIdx : undefined;
  if (classDayIdx === undefined) {
    if (data.dayName && DAY_NAMES.includes(data.dayName)) classDayIdx = DAY_NAMES.indexOf(data.dayName);
    else if (data.day && DAY_NAMES.includes(data.day)) classDayIdx = DAY_NAMES.indexOf(data.day);
  }
  if (classDayIdx === undefined || classDayIdx === -1) {
    classDayIdx = (State.currentViewDayIdx !== undefined && State.currentViewDayIdx !== -1) ? State.currentViewDayIdx : new Date().getDay();
  }
  _activeModalDayIdx = classDayIdx;
  updateRemindRow(data, classDayIdx);

  const teacherCode = (data.instructor || data.teacher || '').trim();
  const info = getTeacherInfo(teacherCode);
  const teacherName = data.instructorName || info.name || teacherCode || 'Not Assigned';
  const initials = (teacherName || teacherCode).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  _activeModalTeacherCode = teacherCode;

  const currentDayName = DAY_NAMES[new Date().getDay()];
  const recurrences = getWeeklyRecurrences(code);
  const $ = id => document.getElementById(id);

  const iconEl = $('modalSquircleIcon');
  if (iconEl) iconEl.innerHTML = (code === 'DSL' || code === 'DS') ? SHOW_ICON.code : (isLab ? SHOW_ICON.lab : SHOW_ICON.book);
  $('modalCourseCode').textContent = code;
  $('modalFullTitle').textContent = fullTitle;
  const semSecText = formatClassSemSec(data);
  const semEl = $('modalSemSec');
  if (semEl) { semEl.textContent = semSecText; semEl.hidden = !semSecText; }

  const badgeEl = $('modalTypeBadge');
  if (badgeEl) {
    badgeEl.textContent = data.isExam ? (data.examName || 'Class test')
      : data.isRescheduled ? 'Rescheduled'
      : data.isOnline ? 'Online class'
      : data.isCancelled ? 'Cancelled'
      : data.isExtraClass ? 'Extra class'
      : (isLab ? 'Laboratory' : 'Theory');
    badgeEl.className = 'cs2-kind';
  }

  // When
  const f12 = v => (typeof v === 'number' ? format12h(v) : v);
  const startTxt = f12(data.start), endTxt = f12(data.end);
  $('modalTiming').textContent = data.timing || (data.hasExplicitEndTime !== false && endTxt ? `${startTxt} – ${endTxt}` : `Starts ${startTxt}`);
  let durTxt = '';
  const sMin = toMinutes(startTxt || ''), eMin = toMinutes(endTxt || '');
  if (data.hasExplicitEndTime !== false && eMin > sMin && sMin >= 0) {
    const m = eMin - sMin;
    durTxt = m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`;
  } else if (data.duration) durTxt = String(data.duration);
  const durEl = $('modalDuration');
  durEl.textContent = durTxt;
  durEl.hidden = !durTxt;

  $('modalRoom').textContent = `Room ${cleanRoom}`;
  $('modalInstructor').textContent = teacherName;
  $('modalInstructorDesig').textContent = info.designation || (teacherCode && teacherCode !== 'TBA' ? 'Faculty' : '');
  $('modalFormat').textContent = data.isRescheduled ? 'Moved here for this date'
    : data.isExtraClass ? (data.isOnline ? 'Extra online class' : 'Extra class')
    : (isLab ? 'Laboratory session' : 'Theory lecture');
  const avatarEl = $('modalInstructorAvatar');
  if (avatarEl) {
    avatarEl.innerHTML = info.photo
      ? `<span class="faculty-avatar-initials">${escapeHtml(initials)}</span><img src="${escapeHtml(info.photo)}" alt="${escapeHtml(teacherCode)}" loading="lazy" decoding="async" onload="this.classList.add('loaded');" onerror="this.remove();" />`
      : `<span class="faculty-avatar-initials">${escapeHtml(initials)}</span>`;
  }

  // What is happening on this date; kept live every 30s while the sheet is open
  const statusBox = $('modalOverrideDetails');
  const noticesBox = $('classNoticesBox');
  clearInterval(_statusTimer);
  const paintStatus = date => {
    if (!statusBox) return;
    const html = statusHtml(data, date);
    statusBox.hidden = !html;
    if (statusBox.dataset.sig !== html) { statusBox.innerHTML = html; statusBox.dataset.sig = html; }
    statusBox.className = `cs2-status${data.isCancelled ? ' is-bad' : ''}`;
  };
  paintStatus('');
  if (noticesBox) { noticesBox.hidden = true; noticesBox.innerHTML = ''; }
  const token = {};
  _showToken = token;
  classDate(classDayIdx).then(date => {
    if (_showToken !== token) return;
    paintStatus(date);
    _statusTimer = setInterval(() => {
      if (!modal.classList.contains('open')) { clearInterval(_statusTimer); return; }
      paintStatus(date);
    }, 30000);
    try {
      const html = noticesHtml(classNotices(code));
      if (noticesBox) { noticesBox.innerHTML = html; noticesBox.hidden = !html; }
    } catch (err) { /* notices are optional */ }
  });

  // This class each week
  const listEl = $('modalRecurrenceList');
  if (listEl) {
    const displayList = recurrences.length ? recurrences : [{
      day: data.dayName || currentDayName,
      dayIdx: data.dayIdx !== undefined ? data.dayIdx : new Date().getDay(),
      dayShort: (data.dayName || currentDayName).substring(0, 3).toUpperCase(),
      time: data.timing || (data.start && data.end ? `${data.start} – ${data.end}` : 'Scheduled'),
      start: data.start, end: data.end, room: cleanRoom, instructor: teacherCode, type: data.type,
      semSec: data.semSec || '', semester: data.semester || '', section: data.section || ''
    }];
    const activeDay = data.dayName || currentDayName;
    const activeTime = data.timing || (data.start && data.end ? `${data.start} – ${data.end}` : '');
    listEl.parentElement.hidden = !recurrences.length;
    listEl.innerHTML = displayList.map((r, idx) => {
      const cur = r.day === activeDay && (!activeTime || r.time === activeTime || displayList.length === 1);
      return `<button type="button" class="cs2-week-row${cur ? ' is-current' : ''}" data-rec-idx="${idx}"${cur ? ' aria-current="true"' : ''}>
        <span class="cs2-week-day">${escapeHtml(r.dayShort)}</span>
        <span class="cs2-week-time">${escapeHtml(r.time)}</span>
        <span class="cs2-week-room">Room ${escapeHtml(r.room)}</span>
      </button>`;
    }).join('');
    listEl.querySelectorAll('.cs2-week-row').forEach(row => {
      row.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const r = displayList[parseInt(row.dataset.recIdx, 10)];
        if (!r) return;
        showClassDetails({
          ...data, code, title: code, name: fullTitle,
          start: r.start ? f12(r.start) : data.start,
          end: r.end ? f12(r.end) : data.end,
          timing: r.time || data.timing,
          room: r.room || 'TBA',
          instructor: r.instructor || data.instructor,
          teacher: r.instructor || data.teacher,
          type: r.type || data.type,
          dayName: r.day, dayIdx: r.dayIdx, hasExplicitEndTime: true,
          semSec: r.semSec || data.semSec, semester: r.semester || data.semester, section: r.section || data.section,
          // an override belongs to one date; another weekday shows the plain class
          isCancelled: false, isExam: false, isOnline: false, isRescheduled: false, isExtraClass: false
        });
      });
    });
  }

  _openedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  openModal(modal);
}

export function closeClassDetails() {
  const modal = document.getElementById('classDetailModal');
  if (modal) {
    closeModal(modal);
    modal.style.zIndex = '';
  }
}

export function initClassDetailEvents() {
  const modal = document.getElementById('classDetailModal');
  const closeBtn = document.getElementById('classDetailClose');
  const instructorTile = document.getElementById('modalInstructorTile');
  const roomTile = document.getElementById('modalRoomTile');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeClassDetails);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeClassDetails();
    });
  }

  if (roomTile) {
    roomTile.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isWithinGhostTapWindow()) return;
      if (typeof window.openRoomInFreeRooms === 'function') {
        window.openRoomInFreeRooms(_activeModalRoom, _activeModalDayIdx);
      }
    });
  }

  if (instructorTile) {
    instructorTile.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isWithinGhostTapWindow()) return;
      const code = _activeModalTeacherCode;
      if (!code || code === 'TBA' || code === '—' || code === 'Not Assigned') return;

      const teacherModal = document.getElementById('teacherDetailModal');
      const isTeacherModalOpen = teacherModal && teacherModal.classList.contains('open');

      if (isTeacherModalOpen) {
        // Teacher modal is already open behind class detail; closing class detail cleanly reveals it
        closeClassDetails();
      } else {
        if (typeof window.openTeacherDetailByCode === 'function') {
          window.openTeacherDetailByCode(code);
        } else if (typeof window.__openTeacherProfileByCode === 'function') {
          window.__openTeacherProfileByCode(code);
        }
      }
    });
  }

  window.openClassDetailSheet = showClassDetails;
  window.__classDetailGhostGuard = isWithinGhostTapWindow; // used by the global teacher-badge listener
  window.closeClassDetailSheet = closeClassDetails;
}
