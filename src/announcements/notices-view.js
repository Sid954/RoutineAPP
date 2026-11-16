/**
 * Notices page view (#announcementsAppView, redesigned Nov 2026).
 *  - Scope: My section / Department (every section, with audience tags)
 *  - "Coming up": countdown strip of dated items in the next two weeks
 *  - Search, type filters with counts, unread bar with "Mark all read"
 *  - Feed grouped by event date (Pinned, Today, Tomorrow, This week, Later, Notices, Past)
 *  - Detail sheet: facts, join link, calendar, share, "Show in routine", admin actions
 */
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { escapeHtml } from '../core/utils.js';
import { showToast } from '../toast/toast.js';
import { openModal, closeModal, showConfirm } from '../modals/modal.js';
import { Announcements } from './announcements.js';
import {
  FILTERS, groupFeed, comingUp, filterCounts, matchesQuery, dayLabel, longDate, countdown,
  postedAgo, shareText, buildIcs, googleCalendarUrl, toNotice
} from './notice-model.js';

const SCOPE_KEY = 'routine_notices_scope';

export const ICONS = {
  general: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  cancel: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
  holiday: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  online: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  extra: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  exam: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>',
  moved: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/><polyline points="12 7 12 12 15 14"/>',
  task: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>'
};
const svg = (paths, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const UI = {
  pin: '<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  route: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  chev: '<polyline points="9 6 15 12 9 18"/>'
};

let _openId = null;
let _observer = null;
let _timers = new Map();
let _lastNotices = [];

const $ = id => document.getElementById(id);

/* ── Card + strip markup ───────────────────────────────────────────────── */
function whenText(n) {
  if (!n.date) return '';
  return [dayLabel(n.date), n.time].filter(Boolean).join(' · ');
}

function audienceTag(n) {
  const show = Announcements.scope === 'dept' || n.audience.isWide;
  return show ? `<span class="nt-aud${n.audience.isMine ? ' is-mine' : ''}">${escapeHtml(n.audience.short)}</span>` : '';
}

export function cardHtml(n, read, i) {
  const when = whenText(n);
  return `<button type="button" class="nt-card tone-${n.tone}${read ? '' : ' is-unread'}${n.past ? ' is-past' : ''}" data-id="${escapeHtml(n.id)}" style="--i:${Math.min(i, 10)}">
    <span class="nt-tile">${svg(ICONS[n.tone] || ICONS.general)}</span>
    <span class="nt-card-main">
      <span class="nt-card-top">
        <span class="nt-type">${escapeHtml(n.meta.label)}</span>
        ${audienceTag(n)}
        ${n.pinned ? `<span class="nt-pin" title="Pinned">${svg(UI.pin)}</span>` : ''}
        ${read ? '' : '<span class="nt-dot" aria-label="New"></span>'}
      </span>
      <span class="nt-title">${escapeHtml(n.title)}</span>
      ${n.summary && n.summary !== n.title ? `<span class="nt-summary">${escapeHtml(n.summary)}</span>` : ''}
      <span class="nt-card-foot">
        ${when ? `<span class="nt-when${n.date && !n.past && when.startsWith('Today') ? ' is-today' : ''}">${escapeHtml(when)}</span>` : ''}
        <span class="nt-by">${escapeHtml([n.author, postedAgo(n.createdAt)].filter(Boolean).join(' · '))}</span>
      </span>
    </span>
  </button>`;
}

function upcomingHtml(list) {
  if (!list.length) return '';
  return `<div class="nt-up-head"><h2>Coming up</h2><span>${list.length}</span></div>
    <div class="nt-up-row">${list.map(n => `<button type="button" class="nt-up tone-${n.tone}" data-id="${escapeHtml(n.id)}">
      <span class="nt-up-when">${escapeHtml(countdown(n.date))}</span>
      <span class="nt-up-title">${escapeHtml(n.title)}</span>
      <span class="nt-up-meta">${svg(ICONS[n.tone] || ICONS.general)}<span>${escapeHtml([n.meta.label, n.time].filter(Boolean).join(' · '))}</span></span>
    </button>`).join('')}</div>`;
}

function emptyHtml(title, sub) {
  return `<div class="nt-empty"><span class="nt-empty-icon">${svg(UI.bell)}</span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(sub)}</span></div>`;
}

/* ── Page render ───────────────────────────────────────────────────────── */
function renderHeader() {
  const sub = $('announceSubtitle');
  if (sub) {
    sub.textContent = Announcements.scope === 'dept'
      ? 'Every section in the department'
      : `Semester ${Storage.getSemester()} · Section ${String(Storage.getSection()).toUpperCase()}`;
  }
  const scope = $('ntScope');
  if (scope) scope.querySelectorAll('button').forEach(b => {
    const on = b.dataset.scope === Announcements.scope;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  const admin = $('adminNoticeModeBtn');
  if (admin) {
    admin.classList.toggle('active', Announcements.isAdminMode);
    admin.setAttribute('aria-pressed', String(Announcements.isAdminMode));
    const label = $('adminNoticeModeLabel');
    if (label) label.textContent = Announcements.isAdminMode ? 'Done' : 'Manage';
  }
  const banner = $('ntAdminBar');
  if (banner) banner.hidden = !Announcements.isAdminMode;
}

function renderFilters(counts) {
  const bar = $('announceFilterBar');
  if (!bar) return;
  if (Announcements.activeFilter !== 'all' && !counts[Announcements.activeFilter]) Announcements.activeFilter = 'all';
  bar.innerHTML = FILTERS.filter(f => f.id === 'all' || counts[f.id] > 0).map(f =>
    `<button type="button" role="tab" class="nt-chip${f.id === Announcements.activeFilter ? ' active' : ''}" data-filter="${f.id}" aria-selected="${f.id === Announcements.activeFilter}">
      <span>${f.label}</span><span class="nt-chip-count">${counts[f.id] || 0}</span></button>`).join('');
}

export function renderNotices() {
  const feed = $('announceList');
  if (!feed) return;
  renderHeader();

  const read = Announcements.getReadIds();
  const all = Announcements.notices();
  _lastNotices = all;
  const live = all.filter(n => !n.past || n.pinned);

  // Unread bar (my scope only; the badge counts my section)
  const unread = Announcements.scope === 'mine' ? all.filter(n => !n.past && !read.has(n.id)).length : 0;
  const ub = $('ntUnreadBar');
  if (ub) {
    ub.hidden = unread === 0;
    const t = $('ntUnreadText');
    if (t) t.textContent = `${unread} new notice${unread === 1 ? '' : 's'}`;
  }

  // Coming up (hidden while searching or filtering)
  const up = $('ntUpcoming');
  const searching = !!Announcements.query || Announcements.activeFilter !== 'all';
  if (up) {
    const list = searching ? [] : comingUp(live);
    up.innerHTML = upcomingHtml(list);
    up.hidden = !list.length;
  }

  const searched = all.filter(n => matchesQuery(n, Announcements.query));
  renderFilters(filterCounts(searched.filter(n => !n.past || n.pinned || Announcements.showPast)));
  const filtered = Announcements.activeFilter === 'all' ? searched : searched.filter(n => n.type === Announcements.activeFilter);

  if (!all.length) {
    feed.innerHTML = Announcements._loadError
      ? emptyHtml('Could not load notices', 'Check your connection. Saved notices appear here when available.')
      : emptyHtml('No notices yet', Announcements.scope === 'dept' ? 'Nothing has been posted in the department.' : 'Notices for your section will appear here.');
    bindObserver(feed);
    return;
  }

  const g = groupFeed(filtered);
  const sections = [
    ['pinned', 'Pinned'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This week'],
    ['later', 'Later'], ['recent', 'Notices']
  ];
  let i = 0;
  let html = '';
  sections.forEach(([k, label]) => {
    if (!g[k].length) return;
    html += `<section class="nt-group"><h3 class="nt-group-head"><span>${label}</span><span class="nt-group-count">${g[k].length}</span></h3>
      <div class="nt-group-list">${g[k].map(n => cardHtml(n, read.has(n.id), i++)).join('')}</div></section>`;
  });
  if (!html && !g.past.length) {
    html = Announcements.query
      ? emptyHtml(`Nothing matches “${Announcements.query}”`, 'Try a course code, a teacher or a word from the notice.')
      : emptyHtml('You are all caught up', 'Nothing upcoming in this category.');
  } else if (!html) {
    html = emptyHtml('You are all caught up', 'Nothing upcoming right now.');
  }
  if (g.past.length) {
    html += `<button type="button" class="nt-past-toggle" id="announcePastToggle" aria-expanded="${Announcements.showPast}">
      ${Announcements.showPast ? 'Hide' : 'Show'} ${g.past.length} past notice${g.past.length === 1 ? '' : 's'}</button>`;
    if (Announcements.showPast) {
      html += `<section class="nt-group"><h3 class="nt-group-head"><span>Past</span><span class="nt-group-count">${g.past.length}</span></h3>
        <div class="nt-group-list">${g.past.map(n => cardHtml(n, true, i++)).join('')}</div></section>`;
    }
  }
  feed.innerHTML = html;
  bindObserver(feed);
  if (_openId && $('ntSheet') && $('ntSheet').classList.contains('open')) renderSheet(_openId);
}

/* Unread cards become read once they have been on screen for a moment */
function bindObserver(feed) {
  if (_observer) { _observer.disconnect(); _observer = null; }
  _timers.forEach(t => clearTimeout(t));
  _timers.clear();
  if (Announcements.scope !== 'mine' || !('IntersectionObserver' in window)) return;
  const cards = feed.querySelectorAll('.nt-card.is-unread');
  if (!cards.length) return;
  _observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const id = e.target.dataset.id;
      if (e.isIntersecting) {
        if (_timers.has(id)) return;
        _timers.set(id, setTimeout(() => {
          Announcements.markItemAsRead(id);
          e.target.classList.remove('is-unread');
          const dot = e.target.querySelector('.nt-dot');
          if (dot) dot.remove();
          if (_observer) _observer.unobserve(e.target);
          _timers.delete(id);
          const left = Announcements.unreadCount();
          const ub = $('ntUnreadBar');
          if (ub) ub.hidden = left === 0;
          const t = $('ntUnreadText');
          if (t) t.textContent = `${left} new notice${left === 1 ? '' : 's'}`;
        }, 900));
      } else if (_timers.has(id)) {
        clearTimeout(_timers.get(id));
        _timers.delete(id);
      }
    });
  }, { threshold: 0.6 });
  cards.forEach(c => _observer.observe(c));
}

/* ── Detail sheet ──────────────────────────────────────────────────────── */
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

function findNotice(id) {
  const n = _lastNotices.find(x => x.id === String(id));
  if (n) return n;
  // Opened from the other scope or before a render: build it from any list
  const raw = (State.allAnnouncementsList || []).concat(Announcements.list).find(a => String(a.id) === String(id));
  if (!raw) return null;
  return toNotice(raw, { semester: String(Storage.getSemester() || '').toLowerCase(), section: String(Storage.getSection() || '').toLowerCase() });
}

function renderSheet(id) {
  const body = $('ntSheetBody');
  const n = findNotice(id);
  if (!body || !n) return false;
  const when = n.date ? [longDate(n.date), n.time].filter(Boolean).join(' · ') : '';
  const cd = n.date ? countdown(n.date) : '';
  const facts = n.details.filter(d => !(d.label === 'Course' && n.title.includes(d.value)) && d.label !== 'Syllabus' && d.label !== 'Notes' && d.label !== 'Reason');
  const longText = n.details.find(d => ['Syllabus', 'Notes', 'Reason'].includes(d.label));
  const text = n.type === 'general' || n.type === 'holiday' || n.type === 'cancellation' ? n.body : (longText ? longText.value : '');
  const textLabel = longText ? longText.label : (n.type === 'cancellation' ? 'Note' : '');
  const canRoutine = !!n.date && n.audience.isMine && !n.past;

  body.innerHTML = `
    <div class="nt-sheet-type tone-${n.tone}">
      <span class="nt-tile">${svg(ICONS[n.tone] || ICONS.general)}</span>
      <span class="nt-sheet-type-text"><strong>${escapeHtml(n.meta.label)}</strong><span>${escapeHtml(n.audience.label)}</span></span>
      ${n.pinned ? `<span class="nt-pin is-label">${svg(UI.pin)}Pinned</span>` : ''}
    </div>
    <h2 class="nt-sheet-title" id="ntSheetTitle">${escapeHtml(n.title)}</h2>
    ${when ? `<div class="nt-sheet-when"><span>${escapeHtml(when)}</span>${cd && !n.past ? `<span class="nt-countdown">${escapeHtml(cd)}</span>` : ''}${n.past ? '<span class="nt-countdown is-past">Past</span>' : ''}</div>` : ''}
    ${facts.length ? `<dl class="nt-facts">${facts.map(d => `<div><dt>${escapeHtml(d.label)}</dt><dd${d.mono ? ' class="is-mono"' : ''}>${escapeHtml(d.value)}</dd></div>`).join('')}</dl>` : ''}
    ${text ? `<div class="nt-text">${textLabel ? `<div class="nt-text-label">${escapeHtml(textLabel)}</div>` : ''}<p>${escapeHtml(text)}</p></div>` : ''}
    ${n.link ? `<a class="nt-join" href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer">${svg(UI.play)}<span>Join class</span><span class="nt-join-host">${escapeHtml(hostOf(n.link))}</span></a>` : ''}
    <div class="nt-actions">
      ${n.date ? `<button type="button" class="nt-action" data-act="calendar">${svg(UI.cal)}<span>Calendar</span></button>` : ''}
      ${canRoutine ? `<button type="button" class="nt-action" data-act="routine">${svg(UI.route)}<span>In routine</span></button>` : ''}
      <button type="button" class="nt-action" data-act="share">${svg(UI.share)}<span>Share</span></button>
    </div>
    <div class="nt-sheet-meta">Posted by <strong>${escapeHtml(n.author || 'Unknown')}</strong> · ${escapeHtml(postedAgo(n.createdAt))}${n.isEdited ? ' · edited' : ''}</div>
    ${Announcements.isAdminMode ? `<div class="nt-admin">
      <button type="button" class="nt-admin-btn" data-act="pin">${svg(UI.pin)}<span>${n.pinned ? 'Unpin' : 'Pin'}</span></button>
      <button type="button" class="nt-admin-btn" data-act="edit">${svg(UI.edit)}<span>Edit</span></button>
      <button type="button" class="nt-admin-btn is-danger" data-act="delete">${svg(UI.trash)}<span>Delete</span></button>
    </div>` : ''}
  `;
  return true;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

export function openNotice(id) {
  const sheet = $('ntSheet');
  if (!sheet || !renderSheet(id)) return;
  _openId = String(id);
  const body = $('ntSheetBody');
  if (body) body.scrollTop = 0;
  openModal(sheet);
  Announcements.markItemAsRead(id);
  const card = document.querySelector(`.nt-card[data-id="${CSS.escape(String(id))}"]`);
  if (card) { card.classList.remove('is-unread'); const d = card.querySelector('.nt-dot'); if (d) d.remove(); }
}

function closeNotice() {
  const sheet = $('ntSheet');
  if (sheet) closeModal(sheet);
  _openId = null;
  renderNotices();
}

async function doShare(n) {
  const text = shareText(n);
  try {
    if (navigator.share) { await navigator.share({ title: n.title, text }); return; }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  } catch (e) {
    showToast('Sharing is not available here', 'warning');
  }
}

function doCalendar(n) {
  if (isNative()) {
    const url = googleCalendarUrl(n);
    if (url) window.open(url, '_blank');
    return;
  }
  const ics = buildIcs(n);
  if (!ics) return;
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${n.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'notice'}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function askPassword(title, message, run) {
  if (State.sessionDeletePassword) { run(State.sessionDeletePassword); return; }
  showConfirm(title, message, pwd => {
    if (!pwd) { showToast('Password is required.', 'warning'); return; }
    run(pwd);
  }, true, 'unlock');
}

function onSheetAction(act) {
  const n = findNotice(_openId);
  if (!n) return;
  if (act === 'share') doShare(n);
  else if (act === 'calendar') doCalendar(n);
  else if (act === 'routine') {
    closeNotice();
    if (window.switchAppView) window.switchAppView('home');
    setTimeout(() => { if (window.navigateToDate) window.navigateToDate(n.date); }, 60);
  } else if (act === 'edit') {
    closeNotice();
    if (window.switchAppView) window.switchAppView('post_announcement', n.raw);
  } else if (act === 'pin') {
    askPassword('Pin notice', 'Enter the admin password:', async pwd => { await Announcements.togglePin(n.id, pwd); renderSheet(n.id); });
  } else if (act === 'delete') {
    showConfirm('Delete this notice?', 'It is removed for everyone, together with any routine change it made.', async pwd => {
      const ok = await Announcements.delete(n.id, State.sessionDeletePassword || pwd);
      if (ok) closeNotice();
    }, !State.sessionDeletePassword);
  }
}

/* ── Events ────────────────────────────────────────────────────────────── */
export function initAnnouncementEvents() {
  Announcements._render = renderNotices;
  try {
    const s = localStorage.getItem(SCOPE_KEY);
    if (s === 'dept' || s === 'mine') Announcements.scope = s;
  } catch (e) {}

  window.__fetchAndRenderAnnouncements = () => { renderNotices(); Announcements.fetchAll(); };
  window.__openNotice = openNotice;

  const back = $('announcePageBackBtn');
  if (back) back.addEventListener('click', () => window.switchAppView && window.switchAppView('home'));
  const post = $('newAnnounceBtn');
  if (post) post.addEventListener('click', () => window.switchAppView && window.switchAppView('post_announcement'));

  const admin = $('adminNoticeModeBtn');
  if (admin) admin.addEventListener('click', () => {
    if (Announcements.isAdminMode) {
      Announcements.isAdminMode = false;
      renderNotices();
      return;
    }
    const enable = () => { Announcements.isAdminMode = true; renderNotices(); showToast('Manage mode on: open a notice to pin, edit or delete it', 'info'); };
    if (State.sessionDeletePassword) { enable(); return; }
    showConfirm('Manage notices', 'Enter the admin password to pin, edit and delete notices.', async pwd => {
      if (!pwd) { showToast('Password is required.', 'warning'); return; }
      try { await Announcements.checkPassword(pwd); enable(); }
      catch (e) { showToast(e.message || 'Wrong password', 'error'); }
    }, true, 'unlock');
  });
  const exitAdmin = $('ntAdminExit');
  if (exitAdmin) exitAdmin.addEventListener('click', () => { Announcements.isAdminMode = false; renderNotices(); });

  const scope = $('ntScope');
  if (scope) scope.addEventListener('click', e => {
    const b = e.target.closest('button[data-scope]');
    if (!b || b.dataset.scope === Announcements.scope) return;
    Announcements.scope = b.dataset.scope;
    try { localStorage.setItem(SCOPE_KEY, Announcements.scope); } catch (err) {}
    renderNotices();
  });

  const input = $('ntSearch');
  const clear = $('ntSearchClear');
  let t = null;
  if (input) {
    input.addEventListener('input', () => {
      Announcements.query = input.value.trim();
      if (clear) clear.hidden = !Announcements.query;
      clearTimeout(t);
      t = setTimeout(renderNotices, 80);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  }
  if (clear && input) clear.addEventListener('click', () => {
    input.value = ''; Announcements.query = ''; clear.hidden = true; renderNotices();
  });

  const bar = $('announceFilterBar');
  if (bar) bar.addEventListener('click', e => {
    const b = e.target.closest('.nt-chip');
    if (!b || b.dataset.filter === Announcements.activeFilter) return;
    Announcements.activeFilter = b.dataset.filter;
    renderNotices();
  });

  const markAll = $('ntMarkAll');
  if (markAll) markAll.addEventListener('click', () => { Announcements.markAllRead(); showToast('All caught up', 'success'); });

  const page = $('announcementsAppView');
  if (page) page.addEventListener('click', e => {
    if (e.target.closest('#announcePastToggle')) {
      Announcements.showPast = !Announcements.showPast;
      renderNotices();
      return;
    }
    const card = e.target.closest('.nt-card, .nt-up');
    if (card && card.dataset.id) openNotice(card.dataset.id);
  });

  const sheet = $('ntSheet');
  if (sheet) {
    sheet.addEventListener('click', e => {
      if (e.target === sheet || e.target.closest('#ntSheetClose')) { closeNotice(); return; }
      const a = e.target.closest('[data-act]');
      if (a) onSheetAction(a.dataset.act);
    });
  }

  renderNotices();
}
