/**
 * Faculty directory page (#facultyAppView, redesigned Nov 2026).
 * Search, filter chips (All / My teachers / In class / Today) and an A–Z list where every
 * row carries the teacher's live status. Tapping a row opens the profile sheet.
 */
import { FULL_COURSE_NAMES } from '../core/config.js';
import { getCurrentMinutes, escapeHtml, setHtmlIfChanged } from '../core/utils.js';
import { searchTeachers, getTeacherWeeklySubjects } from './teacher-finder.js';
import { getTeacherInfo } from './teacher-names.js';
import { activeDays, getTeacherDay, getTeacherStatus, getMyTeacherCodes, getTeacherDisplay, fmtMins } from './faculty-data.js';

const ICON = {
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'My teachers' },
  { id: 'now', label: 'In class' },
  { id: 'today', label: 'Today' }
];

let _query = '';
let _filter = 'all';
let _rows = [];           // last computed rows (all teachers, unfiltered)
let _bound = false;

/* ── Search ───────────────────────────────────────────────────────────────── */
const STOP_WORDS = new Set(['and', 'to', 'of', 'the', 'in', 'for', 'on', 'with', '&', 'lab', 'laboratory']);
function norm(str) {
  return String(str || '').toLowerCase()
    .replace(/electronics/g, 'electronic').replace(/laboratories|laboratory/g, 'lab')
    .replace(/structures/g, 'structure').replace(/devices/g, 'device').replace(/networks/g, 'network')
    .replace(/systems/g, 'system').replace(/algorithms/g, 'algorithm')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Name, code, designation, name acronym, course code/title/acronym, or room. */
export function matchesTeacherQuery(teacherKey, query) {
  if (!query) return true;
  const qRaw = query.toLowerCase().trim();
  const qNorm = norm(query);
  const words = qRaw.split(/[\s.\-_&]+/).filter(w => w && !STOP_WORDS.has(w));
  const multi = words.length >= 2;
  const qAcr = multi ? words.map(w => w[0]).join('') : '';

  const code = String(teacherKey || '').toLowerCase();
  const info = getTeacherInfo(teacherKey) || {};
  const name = String(info.name || '').toLowerCase();
  const desig = String(info.designation || '').toLowerCase();

  if (code === qRaw || (qRaw.length >= 2 && code.includes(qRaw))) return true;
  if (name.includes(qRaw) || norm(name).includes(qNorm) || desig.includes(qRaw)) return true;
  if (multi && qAcr && code.includes(qAcr)) return true;

  const weekly = getTeacherWeeklySubjects(teacherKey);
  const qRoom = qRaw.replace(/^room\s*/, '');
  if (qRoom && weekly.rooms.some(r => r.toLowerCase() === qRoom || (qRoom.length >= 2 && r.toLowerCase().startsWith(qRoom)))) return true;

  for (const sub of weekly.subjects) {
    const s = sub.toLowerCase();
    if (s === qRaw || s.startsWith(qRaw)) return true;
    if (multi && qAcr.length >= 2 && (s === qAcr || s === qAcr + 'l')) return true;
    const title = FULL_COURSE_NAMES[sub] || '';
    if (title) {
      const tNorm = norm(title);
      const tWords = title.toLowerCase().split(/[\s.\-_&]+/).filter(w => w && !STOP_WORDS.has(w));
      const tAcr = tWords.length >= 2 ? tWords.map(w => w[0]).join('') : '';
      if (qNorm && tNorm.includes(qNorm)) return true;
      if (tAcr && (tAcr === qRaw || (multi && tAcr === qAcr))) return true;
      if (multi && words.every(w => tNorm.includes(w))) return true;
    }
  }
  return false;
}

/* ── Data ─────────────────────────────────────────────────────────────────── */
function buildRows() {
  const today = new Date().getDay();
  const now = getCurrentMinutes();
  const isClassDay = activeDays().includes(today);
  const mine = getMyTeacherCodes();
  const keys = (searchTeachers(today, now).teachers || []).map(t => t.teacher);

  return keys.map(key => {
    const d = getTeacherDisplay(key);
    const todayClasses = isClassDay ? getTeacherDay(d.key, today) : [];
    const status = getTeacherStatus(todayClasses, now, isClassDay);
    return {
      ...d,
      status,
      teachesToday: todayClasses.some(c => !c.isCancelled && !c.isRescheduled),
      isMine: mine.has(String(d.key).toUpperCase()),
      sortKey: (d.hasName ? d.name.replace(/^(dr|md|mr|mrs|ms|prof)\.?\s+/i, '') : d.key).toLowerCase()
    };
  }).sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: 'base' }));
}

/** The current row list (used by the profile sheet to open from a row). */
export function getDirectoryRow(key) {
  return _rows.find(r => r.key === key) || null;
}

/* ── Rendering ────────────────────────────────────────────────────────────── */
export function statusLine(status) {
  if (!status) return null;
  const roomOf = c => (c.isMovedOnline ? 'Online' : (c.room ? `Room ${c.room}` : ''));
  switch (status.kind) {
    case 'in_class': {
      const c = status.current;
      return { cls: 'is-in', text: [c.isMovedOnline ? 'Teaching online' : 'In class', roomOf(c) !== 'Online' ? roomOf(c) : '', `until ${fmtMins(c.endM)}`].filter(Boolean).join(' · ') };
    }
    case 'next': {
      const c = status.next;
      return { cls: 'is-next', text: [`Next at ${fmtMins(c.startM)}`, roomOf(c)].filter(Boolean).join(' · ') };
    }
    case 'done': return { cls: 'is-done', text: 'Done for today' };
    case 'none': return { cls: 'is-none', text: 'No classes today' };
    default: return null;
  }
}

export function avatarHtml(d, cls = 'fd-avatar') {
  const img = d.photo
    ? `<img src="${escapeHtml(d.photo)}" alt="" loading="lazy" decoding="async" data-fd-img>`
    : '';
  return `<span class="${cls}${d.photo ? ' has-photo' : ''}" aria-hidden="true"><span class="fd-initials">${escapeHtml(d.initials)}</span>${img}</span>`;
}

function rowHtml(r, i) {
  const st = statusLine(r.status);
  const meta = [r.designation, r.isGuest && !/guest/i.test(r.designation) ? 'Guest' : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="fd-row${r.status.kind === 'in_class' ? ' is-live' : ''}" data-teacher="${escapeHtml(r.key)}" style="--i:${Math.min(i, 12)}">
    ${avatarHtml(r)}
    <span class="fd-row-main">
      <span class="fd-row-top">
        <span class="fd-row-name">${escapeHtml(r.name)}</span>
        ${r.hasName ? `<span class="fd-code">${escapeHtml(r.key)}</span>` : ''}
      </span>
      ${meta ? `<span class="fd-row-meta">${escapeHtml(meta)}</span>` : ''}
      ${st ? `<span class="fd-status ${st.cls}"><span class="fd-dot" aria-hidden="true"></span>${escapeHtml(st.text)}</span>` : ''}
    </span>
    <span class="fd-chev">${ICON.chev}</span>
  </button>`;
}

function emptyHtml(title, sub, icon = ICON.people) {
  return `<div class="fd-empty"><span class="fd-empty-icon">${icon}</span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(sub)}</span></div>`;
}

function applyFilter(rows, filter) {
  switch (filter) {
    case 'mine': return rows.filter(r => r.isMine);
    case 'now': return rows.filter(r => r.status.kind === 'in_class');
    case 'today': return rows.filter(r => r.teachesToday);
    default: return rows;
  }
}

function renderFilters(rows) {
  const wrap = document.getElementById('fdFilters');
  if (!wrap) return;
  const isClassDay = activeDays().includes(new Date().getDay());
  const counts = { all: rows.length, mine: rows.filter(r => r.isMine).length, now: rows.filter(r => r.status.kind === 'in_class').length, today: rows.filter(r => r.teachesToday).length };
  const visible = FILTERS.filter(f => {
    if (f.id === 'mine') return counts.mine > 0;
    if (f.id === 'now' || f.id === 'today') return isClassDay;
    return true;
  });
  if (!visible.some(f => f.id === _filter)) _filter = 'all';
  setHtmlIfChanged(wrap, visible.map(f => `<button type="button" role="tab" class="fd-chip${f.id === _filter ? ' active' : ''}" data-filter="${f.id}" aria-selected="${f.id === _filter}">
      ${f.id === 'now' ? '<span class="fd-dot" aria-hidden="true"></span>' : ''}<span>${f.label}</span><span class="fd-chip-count">${counts[f.id]}</span>
    </button>`).join(''));
}

export function renderFacultyDirectory() {
  const list = document.getElementById('teacherFinderGrid');
  if (!list) return;

  _rows = buildRows();
  renderFilters(_rows);

  const sub = document.getElementById('fdSubtitle');
  if (sub) {
    const inClass = _rows.filter(r => r.status.kind === 'in_class').length;
    sub.textContent = _rows.length
      ? `${_rows.length} people${inClass ? ` · ${inClass} in class now` : ''}`
      : 'Department of CSE';
  }

  if (!_rows.length) {
    setHtmlIfChanged(list, emptyHtml('Loading faculty…', 'This needs a connection the first time.'));
    return;
  }

  const filtered = applyFilter(_rows, _filter).filter(r => matchesTeacherQuery(r.key, _query));

  if (!filtered.length) {
    setHtmlIfChanged(list, _query
      ? emptyHtml(`No one matches “${_query}”`, 'Try a name, a teacher code, a course or a room.', ICON.search)
      : emptyHtml(_filter === 'now' ? 'No one is in class right now' : 'Nobody here yet', _filter === 'now' ? 'Check “Today” to see who teaches later.' : 'Try another filter.'));
    return;
  }

  let html = '';
  let i = 0;
  if (_query || _filter !== 'all') {
    html += `<div class="fd-group"><div class="fd-group-head"><span>${filtered.length} result${filtered.length === 1 ? '' : 's'}</span></div><div class="fd-group-list">`;
    html += filtered.map(r => rowHtml(r, i++)).join('');
    html += '</div></div>';
  } else {
    const named = filtered.filter(r => r.hasName);
    const others = filtered.filter(r => !r.hasName);
    const groups = new Map();
    named.forEach(r => {
      const letter = (r.sortKey[0] || '#').toUpperCase();
      const k = /[A-Z]/.test(letter) ? letter : '#';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    });
    groups.forEach((rows, letter) => {
      html += `<div class="fd-group"><div class="fd-group-head"><span class="fd-letter">${letter}</span></div><div class="fd-group-list">${rows.map(r => rowHtml(r, i++)).join('')}</div></div>`;
    });
    if (others.length) {
      html += `<div class="fd-group"><div class="fd-group-head"><span>Other instructors</span><span class="fd-group-count">${others.length}</span></div>
        <p class="fd-group-note">Only a teacher code is known. Tap one to add their name.</p>
        <div class="fd-group-list">${others.map(r => rowHtml(r, i++)).join('')}</div></div>`;
    }
  }
  setHtmlIfChanged(list, html);
}

/* ── Events ───────────────────────────────────────────────────────────────── */
export function initFacultyDirectory(onOpenTeacher) {
  if (_bound) return;
  _bound = true;

  const page = document.getElementById('facultyAppView');
  const input = document.getElementById('teacherFinderSearchInput');
  const clear = document.getElementById('teacherFinderSearchClear');
  const chips = document.getElementById('fdFilters');
  const list = document.getElementById('teacherFinderGrid');
  const back = document.getElementById('facultyPageBackBtn');

  if (back) back.addEventListener('click', () => window.switchAppView && window.switchAppView('apps'));

  let t = null;
  if (input) {
    input.addEventListener('input', () => {
      _query = input.value.trim();
      if (clear) clear.hidden = !_query;
      clearTimeout(t);
      t = setTimeout(renderFacultyDirectory, 80);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  }
  if (clear && input) {
    clear.addEventListener('click', () => {
      input.value = '';
      _query = '';
      clear.hidden = true;
      renderFacultyDirectory();
      input.focus({ preventScroll: true });
    });
  }
  if (chips) {
    chips.addEventListener('click', e => {
      const b = e.target.closest('.fd-chip');
      if (!b || b.dataset.filter === _filter) return;
      _filter = b.dataset.filter;
      renderFacultyDirectory();
    });
  }
  if (list) {
    list.addEventListener('click', e => {
      const row = e.target.closest('.fd-row');
      if (row && row.dataset.teacher) onOpenTeacher(row.dataset.teacher);
    });
    // Broken photo -> keep the initials underneath
    list.addEventListener('error', e => {
      if (e.target && e.target.matches && e.target.matches('img[data-fd-img]')) {
        const box = e.target.parentElement;
        e.target.remove();
        if (box) box.classList.remove('has-photo');
      }
    }, true);
  }

  // Live statuses: re-render each minute while the page is on screen
  setInterval(() => {
    if (page && page.style.display !== 'none' && !document.hidden) renderFacultyDirectory();
  }, 60000);
}
