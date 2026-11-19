/**
 * Notices page view (#announcementsAppView, redesigned 2026-11-18).
 *  - Two tabs: Notices (your section) and Suggestions (classmates' posts waiting for votes)
 *  - Icon filter chips; the selected one shows its name
 *  - Feed in folding groups (Pinned, Today, Tomorrow, This week, Later, Other notices, Past);
 *    Today, Tomorrow and anything unread open by default
 *  - Cards say each thing once: headline + one detail line, tinted by type
 *  - Detail sheet: facts, join link, calendar, share, "Show in routine", admin actions
 */
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { escapeHtml, setHtmlIfChanged } from '../core/utils.js';
import { showToast } from '../toast/toast.js';
import { openModal, closeModal, showConfirm } from '../modals/modal.js';
import { Announcements } from './announcements.js';
import { Suggestions } from './suggestions.js';
import {
  FILTERS, groupFeed, bundleHolidays, filterCounts, matchesQuery, dayLabel, longDate, countdown,
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

/* ── Card markup ───────────────────────────────────────────────────────── */
function whenText(n) {
  if (!n.date) return '';
  return [dayLabel(n.date), n.time].filter(Boolean).join(', ');
}

function audienceTag(n) {
  return n.audience.isWide ? `<span class="nt-aud">${escapeHtml(n.audience.short)}</span>` : '';
}

/** A class link opens straight from the card: Join for online classes, Upload for assignments. */
function linkButtonHtml(n) {
  if (!n.link || n.past) return '';
  const label = n.type === 'assignment' ? 'Upload' : 'Join';
  const icon = n.type === 'assignment'
    ? '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'
    : UI.play;
  return `<a class="nt-link-btn" href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer" aria-label="${label}: ${escapeHtml(hostOf(n.link) || n.link)}">${svg(icon)}<span>${label}</span></a>`;
}

/** "Sat 28 – Sun 29 Nov": the month once, when both days are in it. */
function rangeLabel(a, b) {
  const x = dayLabel(a), y = dayLabel(b);
  const mx = x.match(/ ([A-Z][a-z]{2})$/), my = y.match(/ ([A-Z][a-z]{2})$/);
  return mx && my && mx[1] === my[1] ? `${x.slice(0, -4)} – ${y}` : `${x} – ${y}`;
}

/**
 * One notice as a list ROW (not a box). Scan order, like Gmail, Linear and Classroom:
 *   headline ........................ day
 *   one detail line
 *   [Join / Upload]   confirmed       who posted it, when
 * A small neutral icon names the type; there are no type colours. Unread = a thin bar on the
 * left plus a bolder headline. Rows sit on one shared surface per time group.
 */
export function cardHtml(n, read, i, group = '') {
  // Inside the Today / Tomorrow groups the day is already the heading: show the time instead
  const inDayGroup = group === 'today' || group === 'tomorrow';
  const when = inDayGroup
    ? (n.time && !String(n.detail || '').includes(n.time) ? n.time : '')
    : (n.dateEnd ? rangeLabel(n.date, n.dateEnd) : (n.date ? dayLabel(n.date) : ''));
  const soon = !inDayGroup && n.date && ['Today', 'Tomorrow'].includes(dayLabel(n.date));
  const confirmed = n.raw && n.raw.source === 'community';
  const link = linkButtonHtml(n);
  const foot = [link, confirmed ? '<span class="nt-community">Confirmed by votes</span>' : '', audienceTag(n)].join('');
  return `<div role="button" tabindex="0" class="nt-card tone-${n.tone}${read ? '' : ' is-unread'}${n.past ? ' is-past' : ''}" data-id="${escapeHtml(n.id)}" style="--i:${Math.min(i, 10)}">
    <span class="nt-ico" title="${escapeHtml(n.meta.label)}">${svg(ICONS[n.tone] || ICONS.general)}</span>
    <span class="nt-main">
      <span class="nt-line1">
        <span class="nt-title">${escapeHtml(n.headline || n.title)}</span>
        ${n.pinned ? `<span class="nt-pin" title="Pinned">${svg(UI.pin)}</span>` : ''}
        ${when ? `<span class="nt-day${soon ? ' is-soon' : ''}">${escapeHtml(when)}</span>` : ''}
      </span>
      ${n.detail ? `<span class="nt-summary">${escapeHtml(n.detail)}</span>` : ''}
      <span class="nt-line3">
        ${foot}
        <span class="nt-by">${escapeHtml([n.author, postedAgo(n.createdAt)].filter(Boolean).join(', '))}</span>
      </span>
    </span>
  </div>`;
}

function emptyHtml(title, sub) {
  return `<div class="nt-empty"><span class="nt-empty-icon">${svg(UI.bell)}</span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(sub)}</span></div>`;
}

/* ── Suggestions tab ───────────────────────────────────────────────────── */
const SG_ARROW = {
  up: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'
};
export const TAB_ICON = {
  notices: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  suggestions: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>'
};

/** Compact, like a comment thread: vote column on the left, the post on the right. */
function suggestionCard(s, admin) {
  const ctx = { semester: String(Storage.getSemester() || '').toLowerCase(), section: String(Storage.getSection() || '').toLowerCase() };
  const n = toNotice(Object.assign({}, s, { id: 's' + s.id }), ctx);
  const p = Suggestions.progress(s);
  const mine = Suggestions.myVote(s.id);
  const own = Suggestions.isMine(s.id);
  const score = p.up - p.down;
  const when = whenText(n);
  return `<article class="sg-card tone-${n.tone}" data-sid="${escapeHtml(String(s.id))}">
    <div class="sg-votes" role="group" aria-label="Vote">
      <button type="button" class="sg-arrow is-up${mine === 1 ? ' is-on' : ''}" data-vote="1" aria-pressed="${mine === 1}" aria-label="Agree">${svg(SG_ARROW.up)}</button>
      <span class="sg-score${score > 0 ? ' is-pos' : score < 0 ? ' is-neg' : ''}" aria-label="${p.up} agree, ${p.down} disagree">${score}</span>
      <button type="button" class="sg-arrow is-down${mine === -1 ? ' is-on' : ''}" data-vote="-1" aria-pressed="${mine === -1}" aria-label="Disagree">${svg(SG_ARROW.down)}</button>
    </div>
    <div class="sg-main">
      <div class="sg-head">
        <span class="nt-ico" title="${escapeHtml(n.meta.label)}">${svg(ICONS[n.tone] || ICONS.general)}</span>
        <span class="sg-title">${escapeHtml(n.headline || n.title)}</span>
        <span class="sg-tag${s.state === 'hidden' ? ' is-hidden' : ''}">${s.state === 'hidden' ? 'Hidden' : 'Unconfirmed'}</span>
      </div>
      ${n.detail ? `<p class="sg-detail">${escapeHtml(n.detail)}</p>` : ''}
      <p class="sg-foot">
        ${when ? `<span class="nt-when">${escapeHtml(when)}</span>` : ''}
        <span>${own ? 'You' : escapeHtml(n.author || 'Classmate')}, ${escapeHtml(postedAgo(n.createdAt))}</span>
        <span class="sg-need" title="Confirmed at ${p.goal} votes with most agreeing">${p.total}/${p.goal} votes</span>
      </p>
      ${admin ? `<div class="sg-admin">
        <button type="button" class="sg-act" data-sg-act="approve">${svg(UI.check)}<span>Publish</span></button>
        <button type="button" class="sg-act is-danger" data-sg-act="reject">${svg(UI.x)}<span>Reject</span></button>
      </div>` : ''}
    </div>
  </article>`;
}

export function renderSuggestions() {
  const box = $('ntSuggest');
  if (!box) return;
  renderTabs();
  const on = Announcements.tab === 'suggestions';
  box.hidden = !on;
  if (!on) return;
  const admin = Announcements.isAdminMode && Array.isArray(Suggestions.adminRows);
  const rows = admin ? Suggestions.adminRows : Suggestions.list;
  const html = `<div class="sg-intro">
      <p>Classmates suggest what they heard. Vote up if it is right, down if it is not. Enough agrees make it an official notice.</p>
      <button type="button" class="sg-new" data-sg="new">${svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')}<span>Suggest something</span></button>
    </div>
    ${rows.length
      ? `<div class="sg-list">${rows.map(s => suggestionCard(s, admin)).join('')}</div>`
      : emptyHtml('No suggestions right now', 'Heard about a cancelled class or a test? Suggest it and your section can confirm it.')}`;
  setHtmlIfChanged(box, html);
  // Seen now: the tab count turns from "new" red to a plain total, and the dock badge drops them
  if (Suggestions.unseenCount() > 0) {
    Suggestions.markSeen();
    renderTabs();
  }
  Announcements.checkBadge();
}

/* ── Page render ───────────────────────────────────────────────────────── */
function renderTabs() {
  const tabs = $('ntTabs');
  if (!tabs) return;
  const unread = Announcements.unreadCount();
  const fresh = Suggestions.unseenCount();
  tabs.querySelectorAll('button[data-tab]').forEach(b => {
    const on = b.dataset.tab === Announcements.tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
    const c = b.querySelector('.nt-tab-count');
    if (!c) return;
    const n = b.dataset.tab === 'notices' ? unread : (fresh || Suggestions.list.length);
    c.textContent = n ? String(n) : '';
    c.hidden = !n;
    c.classList.toggle('is-new', b.dataset.tab === 'notices' ? unread > 0 : fresh > 0);
  });
  const notices = Announcements.tab !== 'suggestions';
  ['ntSearchWrap', 'announceFilterBar', 'announceList'].forEach(id => { const el = $(id); if (el) el.hidden = !notices; });
}

function renderHeader() {
  const sub = $('announceSubtitle');
  if (sub) sub.textContent = `Semester ${Storage.getSemester()}, section ${String(Storage.getSection()).toUpperCase()}`;
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

const FILTER_ICON = {
  all: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  class_test: ICONS.exam, assignment: ICONS.task, cancellation: ICONS.cancel, online_class: ICONS.online,
  rescheduled: ICONS.moved, holiday: ICONS.holiday, general: ICONS.general
};
const FILTER_TONE = { all: '', class_test: 'exam', assignment: 'task', cancellation: 'cancel', online_class: 'online', rescheduled: 'moved', holiday: 'holiday', general: 'general' };

/** Icon chips; only the selected one spells out its name. */
function renderFilters(counts) {
  const bar = $('announceFilterBar');
  if (!bar) return;
  if (Announcements.activeFilter !== 'all' && !counts[Announcements.activeFilter]) Announcements.activeFilter = 'all';
  const list = FILTERS.filter(f => f.id === 'all' || counts[f.id] > 0);
  bar.hidden = Announcements.tab === 'suggestions' || list.length < 3; // "All" plus one type: nothing to filter
  setHtmlIfChanged(bar, list.map(f => {
    const on = f.id === Announcements.activeFilter;
    return `<button type="button" role="tab" class="nt-chip${on ? ' active' : ''}${FILTER_TONE[f.id] ? ` tone-${FILTER_TONE[f.id]}` : ''}" data-filter="${f.id}" aria-selected="${on}" aria-label="${f.label}, ${counts[f.id] || 0}" title="${f.label}">
      ${svg(FILTER_ICON[f.id])}${on ? `<span>${f.label}</span>` : ''}<span class="nt-chip-count">${counts[f.id] || 0}</span></button>`;
  }).join(''));
}

/* Groups fold. Opening the page unfolds Today, Tomorrow and any group with something new;
   what the person opens or closes after that stays as they left it until they leave. */
const GROUPS = [['pinned', 'Pinned'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This week'], ['later', 'Later'], ['recent', 'Other notices'], ['past', 'Past']];
let _groupOpen = null;
function groupIsOpen(key, items, read) {
  if (Announcements.query || Announcements.activeFilter !== 'all') return true;
  if (!_groupOpen) _groupOpen = {};
  if (!(key in _groupOpen)) _groupOpen[key] = key === 'today' || key === 'tomorrow' || items.some(n => !n.past && !read.has(n.id));
  return _groupOpen[key];
}

export function renderNotices() {
  const feed = $('announceList');
  if (!feed) return;
  renderHeader();
  renderTabs();
  renderSuggestions();

  const read = Announcements.getReadIds();
  const all = Announcements.notices();
  _lastNotices = all;

  const searched = all.filter(n => matchesQuery(n, Announcements.query));
  renderFilters(filterCounts(searched));
  const filtered = Announcements.activeFilter === 'all' ? searched : searched.filter(n => n.type === Announcements.activeFilter);

  if (!all.length) {
    setHtmlIfChanged(feed, Announcements._loadError
      ? emptyHtml('Could not load notices', 'Check your connection. Saved notices show up here when available.')
      : emptyHtml('No notices yet', 'Posts for your section show up here. Tap New to suggest or announce something.'));
    bindObserver(feed);
    return;
  }

  const g = groupFeed(bundleHolidays(filtered));
  let i = 0;
  let html = '';
  GROUPS.forEach(([k, label]) => {
    const items = g[k];
    if (!items.length) return;
    const open = groupIsOpen(k, items, read);
    const fresh = items.filter(n => !n.past && !read.has(n.id)).length;
    html += `<section class="nt-group${open ? ' is-open' : ''}" data-group="${k}">
      <button type="button" class="nt-group-head" data-group-toggle="${k}" aria-expanded="${open}">
        <span>${label}</span><span class="nt-group-count">${items.length}</span>
        ${fresh && !open ? `<span class="nt-group-new">${fresh} new</span>` : ''}
        ${svg('<polyline points="6 9 12 15 18 9"/>', 'nt-group-chev')}
      </button>
      ${open ? `<div class="nt-group-list">${items.map(n => cardHtml(n, k === 'past' || read.has(n.id), i++, k)).join('')}</div>` : ''}
    </section>`;
  });
  if (!html) {
    html = Announcements.query
      ? emptyHtml(`Nothing matches “${Announcements.query}”`, 'Try a course code, a teacher or a word from the notice.')
      : emptyHtml('You are all caught up', 'Nothing in this category right now.');
  }
  setHtmlIfChanged(feed, html);
  bindObserver(feed);
  if (_openId && $('ntSheet') && $('ntSheet').classList.contains('open')) renderSheet(_openId);
}

/** Opening Notices with something unread: unfold its group and bring the first one into view. */
function jumpToNew() {
  if (Announcements.tab !== 'notices') return;
  const card = document.querySelector('#announceList .nt-card.is-unread');
  if (card) card.scrollIntoView({ block: 'center', behavior: 'auto' });
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
          renderTabs();
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
    <h2 class="nt-sheet-title" id="ntSheetTitle">${escapeHtml(n.headline || n.title)}</h2>
    ${when ? `<div class="nt-sheet-when"><span>${escapeHtml(when)}</span>${cd && !n.past ? `<span class="nt-countdown">${escapeHtml(cd)}</span>` : ''}${n.past ? '<span class="nt-countdown is-past">Past</span>' : ''}</div>` : ''}
    ${facts.length ? `<dl class="nt-facts">${facts.map(d => `<div><dt>${escapeHtml(d.label)}</dt><dd${d.mono ? ' class="is-mono"' : ''}>${escapeHtml(d.value)}</dd></div>`).join('')}</dl>` : ''}
    ${text ? `<div class="nt-text">${textLabel ? `<div class="nt-text-label">${escapeHtml(textLabel)}</div>` : ''}<p>${escapeHtml(text)}</p></div>` : ''}
    ${n.link ? `<a class="nt-join" href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer">${svg(UI.play)}<span>${n.type === 'assignment' ? 'Open the upload page' : 'Join class'}</span><span class="nt-join-host">${escapeHtml(hostOf(n.link))}</span></a>` : ''}
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
  Suggestions._render = renderSuggestions;
  // Department-wide browsing is off for now: the page shows your section's notices only
  Announcements.scope = 'mine';
  Announcements.tab = 'notices';
  try { localStorage.removeItem(SCOPE_KEY); } catch (e) {}

  /**
   * Opening the page: start from a fresh fold state. With nothing unread in the notices but
   * new suggestions, open the Suggestions tab; with unread notices, scroll to the first one.
   */
  window.__fetchAndRenderAnnouncements = () => {
    _groupOpen = null;
    if (Announcements.unreadCount() === 0 && Suggestions.unseenCount() > 0) Announcements.tab = 'suggestions';
    else Announcements.tab = 'notices';
    renderNotices();
    requestAnimationFrame(jumpToNew);
    Announcements.fetchAll();
  };
  window.__openNotice = openNotice;

  const back = $('announcePageBackBtn');
  if (back) back.addEventListener('click', () => window.switchAppView && window.switchAppView('home'));
  const post = $('newAnnounceBtn');
  if (post) post.addEventListener('click', () => window.switchAppView && window.switchAppView('post_announcement', Announcements.tab === 'suggestions' ? { __suggest: true } : null));
  const notifBtn = $('ntNotifBtn');
  if (notifBtn) notifBtn.addEventListener('click', () => { const b = $('notifSettingsBtn'); if (b) b.click(); });

  const admin = $('adminNoticeModeBtn');
  if (admin) admin.addEventListener('click', () => {
    if (Announcements.isAdminMode) {
      Announcements.isAdminMode = false;
      renderNotices();
      return;
    }
    const enable = () => { Announcements.isAdminMode = true; Suggestions.loadAdmin(); renderNotices(); showToast('Manage mode on: open a notice to pin, edit or delete it', 'info'); };
    if (State.sessionDeletePassword) { enable(); return; }
    showConfirm('Manage notices', 'Enter the admin password to pin, edit and delete notices.', async pwd => {
      if (!pwd) { showToast('Password is required.', 'warning'); return; }
      try { await Announcements.checkPassword(pwd); enable(); }
      catch (e) { showToast(e.message || 'Wrong password', 'error'); }
    }, true, 'unlock');
  });
  const exitAdmin = $('ntAdminExit');
  if (exitAdmin) exitAdmin.addEventListener('click', () => { Announcements.isAdminMode = false; renderNotices(); });

  const tabs = $('ntTabs');
  if (tabs) tabs.addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (!b || b.dataset.tab === Announcements.tab) return;
    Announcements.tab = b.dataset.tab;
    renderNotices();
  });

  const sgBox = $('ntSuggest');
  if (sgBox) sgBox.addEventListener('click', e => {
    const card = e.target.closest('.sg-card');
    const vote = e.target.closest('[data-vote]');
    if (vote && card) { Suggestions.vote(card.dataset.sid, Number(vote.dataset.vote)); return; }
    const act = e.target.closest('[data-sg-act]');
    if (act && card) { Suggestions.decide(card.dataset.sid, act.dataset.sgAct === 'reject' ? 'reject' : 'approve'); return; }
    const b = e.target.closest('[data-sg="new"]');
    if (b && window.switchAppView) window.switchAppView('post_announcement', { __suggest: true });
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
    if (!b) return;
    // Tapping the selected chip again goes back to everything
    Announcements.activeFilter = b.dataset.filter === Announcements.activeFilter ? 'all' : b.dataset.filter;
    renderNotices();
  });

  const page = $('announcementsAppView');
  if (page) page.addEventListener('click', e => {
    const head = e.target.closest('[data-group-toggle]');
    if (head) {
      const k = head.dataset.groupToggle;
      if (!_groupOpen) _groupOpen = {};
      _groupOpen[k] = head.getAttribute('aria-expanded') !== 'true';
      renderNotices();
      return;
    }
    if (e.target.closest('.nt-link-btn')) return; // Join / Upload open the link, not the sheet
    const card = e.target.closest('.nt-card');
    if (card && card.dataset.id) openNotice(card.dataset.id);
  });
  // Cards are role="button" divs: open them from the keyboard too
  if (page) page.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.nt-card[role="button"]');
    if (!card || e.target !== card || !card.dataset.id) return;
    e.preventDefault();
    openNotice(card.dataset.id);
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
