/**
 * Notices page view (#announcementsAppView, redesigned 2026-11-18).
 *  - Two tabs: Notices (your section) and Suggestions (classmates' posts waiting for votes)
 *  - Icon filter chips; the selected one shows its name
 *  - Feed in folding groups (Pinned, Today, Tomorrow, This week, Later, Other notices, Past);
 *    Pinned, Today, Tomorrow and anything unread open by default
 *  - Cards say each thing once: headline + one detail line, tinted by type
 *  - Detail sheet: facts, join link, calendar, share, "Show in routine", admin actions
 */
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { escapeHtml, setHtmlIfChanged, toMinutes } from '../core/utils.js';
import { bindMouseDrag } from '../core/desktop-input.js';
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
const STAY_NEW_WHILE_HERE = true;
const _openedHere = new Set();
let _observer = null;
let _timers = new Map();
let _lastNotices = [];
let _filterOrder = ['all'];

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

/** "Sat 21 Nov" -> "Sat 21" */
const noMonth = label => String(label || '').replace(/ [A-Z][a-z]{2}$/, '');

/** "21 – 23 Nov": a bundled holiday's days, the month once. */
function daySpan(a, b) {
  const x = dayLabel(a), y = dayLabel(b);
  const mx = x.match(/ ([A-Z][a-z]{2})$/), my = y.match(/ ([A-Z][a-z]{2})$/);
  const num = l => String(l).replace(/^[A-Za-z]{3} /, '');
  return mx && my && mx[1] === my[1] ? `${num(noMonth(x))} – ${num(y)}` : `${num(x)} – ${num(y)}`;
}

/**
 * The small "when" at the top right. Only what is real: a time the poster gave (or the class's own
 * slot for a cancelled class / test), and the day when the group does not already say it.
 * Nothing to say = nothing shown (no "All day", no filler).
 */
function whenHtml(n, group) {
  const inDay = group === 'today' || group === 'tomorrow';
  const f = n.focus || {};
  const time = f.hasTime ? `${f.big} ${f.ampm}`.trim() : '';
  let day = '';
  if (!inDay && n.date) day = n.dateEnd ? daySpanLabel(n.date, n.dateEnd) : noMonth(dayLabel(n.date));
  if (!day && !time) return '';
  const timeHtml = time ? `<span class="nt-whentime">${f.note ? `${escapeHtml(f.note)} ` : ''}${escapeHtml(time)}</span>` : '';
  return `<span class="nt-when">${day ? `<span class="nt-whenday">${escapeHtml(day)}</span>` : ''}${timeHtml}</span>`;
}

/** "Sat 21 – Mon 23": a bundled holiday's days. */
function daySpanLabel(a, b) { return `${noMonth(dayLabel(a))} – ${noMonth(dayLabel(b))}`; }

/**
 * One notice as a list ROW (not a box), in scan order:
 *   icon  headline ...................... time / day (only when real)
 *         one fact per line
 *         [Join / Upload]                who posted it
 * Neutral icon for the type, no type colours. Unread = a thin bar on the left and a heavier headline.
 */
export function cardHtml(n, read, i, group = '') {
  const confirmed = n.raw && n.raw.source === 'community';
  const link = linkButtonHtml(n);
  const foot = [link, confirmed ? '<span class="nt-community">Confirmed by votes</span>' : '', audienceTag(n)].join('');
  const by = !n.date ? n.author : [n.author, postedAgo(n.createdAt)].filter(Boolean).join(', ');
  const lines = (n.lines || (n.detail ? [n.detail] : [])).map(l => `<span class="nt-summary">${escapeHtml(l)}</span>`).join('');
  return `<div role="button" tabindex="0" class="nt-card tone-${n.tone}${read ? '' : ' is-unread'}${n.past ? ' is-past' : ''}" data-id="${escapeHtml(n.id)}" style="--i:${Math.min(i, 10)}">
    <span class="nt-ico" title="${escapeHtml(n.meta.label)}">${svg(ICONS[n.tone] || ICONS.general)}</span>
    <span class="nt-main">
      <span class="nt-line1">
        <span class="nt-title">${escapeHtml(n.headline || n.title)}</span>
        ${n.pinned ? `<span class="nt-pin" title="Pinned">${svg(UI.pin)}</span>` : ''}
        ${whenHtml(n, group)}
      </span>
      ${lines}
      <span class="nt-line3">
        ${foot}
        <span class="nt-by">${escapeHtml(by)}</span>
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
      ${(n.lines || []).map(l => `<p class="sg-detail">${escapeHtml(l)}</p>`).join('')}
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
  const readAll = $('ntReadAll');
  if (readAll) readAll.hidden = Announcements.tab === 'suggestions' || Announcements.unreadCount() === 0;
}

const FILTER_ICON = {
  all: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  class_test: ICONS.exam, assignment: ICONS.task, cancellation: ICONS.cancel, online_class: ICONS.online,
  rescheduled: ICONS.moved, holiday: ICONS.holiday, general: ICONS.general
};
const FILTER_TONE = { all: '', class_test: 'exam', assignment: 'task', cancellation: 'cancel', online_class: 'online', rescheduled: 'moved', holiday: 'holiday', general: 'general' };

/** Icon chips; only the selected one spells out its name. */
let _chipCounts = null; // { all, current }: every notice, and only the ones that are not past

/** The number on a chip counts what is current. Past notices are added only while the Past group is open. */
function chipNumber(id) {
  if (!_chipCounts) return 0;
  const withPast = !!(_groupOpen && _groupOpen.past);
  return (withPast ? _chipCounts.all : _chipCounts.current)[id] || 0;
}

function renderFilters(counts, current = counts) {
  _chipCounts = { all: counts, current };
  const bar = $('announceFilterBar');
  if (!bar) return;
  if (Announcements.activeFilter !== 'all' && !counts[Announcements.activeFilter]) Announcements.activeFilter = 'all';
  const list = FILTERS.filter(f => f.id === 'all' || counts[f.id] > 0);
  bar.hidden = Announcements.tab === 'suggestions' || list.length < 3; // "All" plus one type: nothing to filter
  _filterOrder = list.map(f => f.id);
  setHtmlIfChanged(bar, list.map(f => {
    const on = f.id === Announcements.activeFilter;
    return `<button type="button" role="tab" class="nt-chip${on ? ' active' : ''}${FILTER_TONE[f.id] ? ` tone-${FILTER_TONE[f.id]}` : ''}" data-filter="${f.id}" aria-selected="${on}" aria-label="${f.label}${chipNumber(f.id) ? `, ${chipNumber(f.id)}` : ''}" title="${f.label}">
      ${svg(FILTER_ICON[f.id])}${on ? `<span>${f.label}</span>` : ''}${chipNumber(f.id) ? `<span class="nt-chip-count">${chipNumber(f.id)}</span>` : ''}</button>`;
  }).join(''));
}

/* Groups fold. Opening the page unfolds Today, Tomorrow and any group with something new;
   what the person opens or closes after that stays as they left it until they leave. */
const WD3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The grey date beside "Today" / "Tomorrow": "Thu 19 Nov". */
function groupDateHtml(key) {
  if (key !== 'today' && key !== 'tomorrow') return '';
  const d = new Date(); d.setDate(d.getDate() + (key === 'tomorrow' ? 1 : 0));
  return `<span class="nt-group-date">${WD3[d.getDay()]} ${d.getDate()} ${MON3[d.getMonth()]}</span>`;
}
const GROUPS = [['pinned', 'Pinned'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This week'], ['later', 'Later'], ['recent', 'Other notices'], ['past', 'Past']];
let _groupOpen = null;
function groupIsOpen(key, items, read) {
  if (Announcements.query || Announcements.activeFilter !== 'all') return true;
  if (!_groupOpen) _groupOpen = {};
  if (!(key in _groupOpen)) _groupOpen[key] = key === 'pinned' || key === 'today' || key === 'tomorrow' || items.some(n => !n.past && !read.has(n.id));
  return _groupOpen[key];
}

let _groupItems = {};

/** The Past group can be long: show the newest few and let the reader ask for more. */
const PAST_STEP = 10;
let _pastShown = PAST_STEP;

/** One folding group: its heading and, when open, its rows. Used by the full render and by a fold. */
function groupSectionHtml(k, label, items, read, startIndex = 0) {
  const open = groupIsOpen(k, items, read);
  const fresh = items.filter(n => !n.past && !read.has(n.id)).length;
  const shown = k === 'past' ? items.slice(0, _pastShown) : items;
  const more = items.length - shown.length;
  let i = startIndex;
  return `<section class="nt-group${open ? ' is-open' : ''}" data-group="${k}">
      <button type="button" class="nt-group-head" data-group-toggle="${k}" aria-expanded="${open}">
        <span>${label}</span>${groupDateHtml(k)}
        <span class="nt-group-meta">
          ${fresh && !open ? `<span class="nt-group-new">${fresh} new</span>` : ''}
          ${k === 'past' && !open ? '' : `<span class="nt-group-count">${items.length}</span>`}
          ${svg('<polyline points="6 9 12 15 18 9"/>', 'nt-group-chev')}
        </span>
      </button>
      ${open ? `<div class="nt-group-list">${shown.map(n => cardHtml(n, k === 'past' || read.has(n.id), i++, k)).join('')}</div>${more > 0 ? `<button type="button" class="nt-past-toggle" data-past-more>Show ${Math.min(more, PAST_STEP)} more</button>` : ''}` : ''}
    </section>`;
}

/**
 * Fold / unfold ONE group in place. The page is not re-drawn, nothing fades and the scroll
 * position does not move: only this group's own markup changes.
 */
const FX_EASE = 'cubic-bezier(0.2, 0, 0, 1)';
const fxOn = () => document.documentElement.dataset.motion !== 'off' && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Category / tab switch: the new content fades in, easing a few pixels in from the side it came from. */
function swapFx(el, dir = 0) {
  if (!el || !el.animate || !fxOn() || el.hidden) return;
  el.animate([{ opacity: 0.2, transform: `translateX(${dir * 16}px)` }, { opacity: 1, transform: 'none' }], { duration: 240, easing: FX_EASE });
}

/** Category chips: the picked one opens up to show its name while the old one shuts back to an icon. */
function chipWidths() {
  const m = new Map();
  document.querySelectorAll('#announceFilterBar .nt-chip').forEach(c => m.set(c.dataset.filter, c.getBoundingClientRect().width));
  return m;
}
function morphChips(before) {
  if (!before || !fxOn()) return;
  document.querySelectorAll('#announceFilterBar .nt-chip').forEach(c => {
    const from = before.get(c.dataset.filter);
    if (from == null || !c.animate) return;
    const to = c.getBoundingClientRect().width;
    if (Math.abs(from - to) < 1) return;
    c.style.overflow = 'hidden';
    c.style.whiteSpace = 'nowrap';
    const done = () => { c.style.overflow = ''; c.style.whiteSpace = ''; };
    c.animate([{ width: `${from}px` }, { width: `${to}px` }], { duration: 280, easing: FX_EASE }).finished.then(done, done);
    if (c.classList.contains('active')) {
      const label = c.querySelector('svg + span:not(.nt-chip-count)');
      if (label) label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 70, easing: FX_EASE, fill: 'backwards' });
    }
  });
}

const _folding = new Set();

/** Fold: the rows slide shut and fade, the chevron turns back. Resolves when done. */
function foldOutFx(section) {
  const list = section.querySelector('.nt-group-list');
  if (!list || !list.animate || !fxOn()) return Promise.resolve();
  const h = list.offsetHeight;
  list.style.overflow = 'hidden';
  const chev = section.querySelector('.nt-group-chev');
  if (chev) chev.animate([{ transform: 'none' }, { transform: 'rotate(-90deg)' }], { duration: 220, easing: FX_EASE, fill: 'forwards' });
  return list.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 240, easing: FX_EASE, fill: 'forwards' }).finished.catch(() => {});
}

/** Unfold: the rows grow open and fade in, the chevron turns down. */
function foldInFx(section) {
  const list = section.querySelector('.nt-group-list');
  if (!list || !list.animate || !fxOn()) return;
  const h = list.offsetHeight;
  list.style.overflow = 'hidden';
  const chev = section.querySelector('.nt-group-chev');
  if (chev) chev.animate([{ transform: 'rotate(-90deg)' }, { transform: 'none' }], { duration: 240, easing: FX_EASE });
  const a = list.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 260, easing: FX_EASE });
  a.finished.then(() => { list.style.overflow = ''; }).catch(() => { list.style.overflow = ''; });
}

function toggleGroup(k, keepFold = false) {
  const data = _groupItems[k];
  const feed = $('announceList');
  const section = feed && feed.querySelector(`.nt-group[data-group="${k}"]`);
  if (!data || !section || _folding.has(k)) return;
  if (!_groupOpen) _groupOpen = {};
  const wasOpen = section.classList.contains('is-open');
  _groupOpen[k] = keepFold ? wasOpen : !wasOpen;
  if (k === 'past' && _chipCounts) renderFilters(_chipCounts.all, _chipCounts.current); // chip numbers include past only while it is open
  const swap = () => {
    const read = Announcements.getReadIds();
    const html = groupSectionHtml(k, data.label, data.items, read);
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    const fresh = tpl.content.firstElementChild;
    section.replaceWith(fresh);
    // The feed's remembered markup must match what is on screen, or the next full render would skip
    const feedEl = $('announceList');
    if (feedEl) feedEl.__html = feedEl.innerHTML;
    bindObserver(feedEl);
    if (!keepFold && !wasOpen) foldInFx(fresh);
  };
  if (!keepFold && wasOpen) {
    _folding.add(k);
    foldOutFx(section).then(() => { _folding.delete(k); swap(); });
  } else swap();
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
  renderFilters(filterCounts(searched), filterCounts(searched.filter(n => !n.past)));
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
  _groupItems = {};
  GROUPS.forEach(([k, label]) => {
    const items = g[k];
    if (!items.length) return;
    _groupItems[k] = { label, items };
    html += groupSectionHtml(k, label, items, read, i);
    i += items.length;
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
  // New notices stay marked "new" for as long as the reader is on this page; they are marked read
  // when the reader moves to another page (leaveNotices). The on-screen timer below is not used.
  if (STAY_NEW_WHILE_HERE) return;
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
          renderHeader(); // the "Mark all read" button goes away with the last unread notice
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

/** "starts in 2h 10m" when it is today and has a time; otherwise "in 3 days", "tomorrow", "today", "past". */
function whenCountdown(n) {
  if (!n.date) return '';
  if (n.past) return 'Past';
  const f = n.focus || {};
  const t = f.hasTime ? toMinutes(`${f.big} ${f.ampm}`) : -1;
  if (dayLabel(n.date) === 'Today' && t >= 0) {
    const now = new Date();
    const left = t - (now.getHours() * 60 + now.getMinutes());
    if (left > 0) {
      const span = left >= 60 ? `${Math.floor(left / 60)}h${left % 60 ? ` ${left % 60}m` : ''}` : `${left}m`;
      return `${f.note === 'due' ? 'due' : 'starts'} in ${span}`;
    }
    if (left > -90 && f.note !== 'due') return 'happening now';
  }
  return countdown(n.date);
}

/**
 * The detail sheet, in reading order:
 *   type + who it is for      (small)
 *   headline                  (big)
 *   WHEN: the day, and the time only if it is real, with how far away it is
 *   one big action            (Join / Open the upload page), when there is a link
 *   the facts, as a plain list; long text (reason, syllabus, message) as a paragraph
 *   secondary actions         (calendar, routine, share)
 *   who posted it
 */
function renderSheet(id) {
  const body = $('ntSheetBody');
  const n = findNotice(id);
  if (!body || !n) return false;
  const f = n.focus || {};
  const time = f.hasTime ? `${f.big} ${f.ampm}`.trim() : '';
  const cd = whenCountdown(n);
  const SKIP = new Set(['Starts', 'Due', 'To', 'Exam', 'Task', 'Syllabus', 'Notes', 'Reason']);
  const facts = n.details.filter(d => !SKIP.has(d.label)).map(d => ({ ...d, label: d.label === 'From' ? 'Was' : d.label }));
  // Room from the routine (cancelled class / test) when the notice itself has none
  (n.lines || []).forEach(l => {
    if (/^Room /.test(l) && !facts.some(x => /room|where/i.test(x.label))) facts.push({ label: 'Room', value: l.replace(/^Room /, ''), mono: true });
  });
  const longText = n.details.find(d => ['Syllabus', 'Notes', 'Reason'].includes(d.label));
  const text = n.type === 'general' || n.type === 'holiday' || n.type === 'cancellation' ? n.body : (longText ? longText.value : '');
  const textLabel = longText ? ({ Syllabus: 'Covers', Notes: 'Notes', Reason: 'Reason' }[longText.label]) : (n.type === 'cancellation' ? 'Reason' : (n.type === 'general' ? '' : 'Note'));
  const canRoutine = !!n.date && n.audience.isMine && !n.past;
  const confirmed = n.raw && n.raw.source === 'community';
  const upload = n.type === 'assignment';
  const uploadIcon = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>';

  body.innerHTML = `
    <div class="ns-top tone-${n.tone}">
      <span class="ns-ico">${svg(ICONS[n.tone] || ICONS.general)}</span>
      <span class="ns-kind">${escapeHtml(n.meta.label)}<span class="ns-aud">${escapeHtml(n.audience.short || n.audience.label)}</span></span>
      ${n.pinned ? `<span class="ns-pin">${svg(UI.pin)}Pinned</span>` : ''}
    </div>
    <h2 class="ns-title" id="ntSheetTitle">${escapeHtml(n.headline || n.title)}</h2>
    ${n.date ? `<div class="ns-when">
      <div class="ns-when-main">
        <span class="ns-day">${escapeHtml(longDate(n.date))}</span>
        ${cd ? `<span class="ns-away${n.past ? ' is-past' : ''}">${escapeHtml(cd)}</span>` : ''}
      </div>
      ${time ? `<div class="ns-time">${f.note ? `<span>${escapeHtml(f.note)}</span>` : ''}${escapeHtml(time)}</div>` : ''}
    </div>` : ''}
    ${n.link ? `<a class="ns-primary" href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer">
      ${svg(upload ? uploadIcon : UI.play)}
      <span>${upload ? 'Open the upload page' : 'Join class'}</span><span class="ns-host">${escapeHtml(hostOf(n.link))}</span></a>` : ''}
    ${facts.length ? `<dl class="ns-facts">${facts.map(d => `<div><dt>${escapeHtml(d.label)}</dt><dd${d.mono ? ' class="is-mono"' : ''}>${escapeHtml(d.value)}</dd></div>`).join('')}</dl>` : ''}
    ${text ? `<div class="ns-text">${textLabel ? `<div class="ns-text-label">${escapeHtml(textLabel)}</div>` : ''}<p>${escapeHtml(text)}</p></div>` : ''}
    <div class="ns-actions">
      ${n.date ? `<button type="button" class="ns-action" data-act="calendar">${svg(UI.cal)}<span>Calendar</span></button>` : ''}
      ${canRoutine ? `<button type="button" class="ns-action" data-act="routine">${svg(UI.route)}<span>In routine</span></button>` : ''}
      <button type="button" class="ns-action" data-act="share">${svg(UI.share)}<span>Share</span></button>
    </div>
    <div class="ns-meta">
      <span>Posted by <strong>${escapeHtml(n.author || 'Unknown')}</strong>, ${escapeHtml(postedAgo(n.createdAt))}${n.isEdited ? ', edited' : ''}</span>
      ${confirmed ? '<span class="ns-confirmed">Confirmed by votes</span>' : ''}
    </div>
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
  // On the Notices page the notice keeps its "new" mark until the reader leaves the page
  if (window.__currentAppViewId === 'announcements') { _openedHere.add(String(id)); return; }
  Announcements.markItemAsRead(id);
  const card = document.querySelector(`.nt-card[data-id="${CSS.escape(String(id))}"]`);
  if (card) { card.classList.remove('is-unread'); const d = card.querySelector('.nt-dot'); if (d) d.remove(); }
}

/** The reader moved to another page: everything that was shown as new counts as read now. */
function leaveNotices() {
  const ids = new Set([..._openedHere].map(String));
  document.querySelectorAll('#announceList .nt-card.is-unread').forEach(c => { if (c.dataset.id) ids.add(c.dataset.id); });
  _openedHere.clear();
  if (!ids.size) return;
  ids.forEach(id => Announcements.markItemAsRead(id));
  renderTabs();
  renderHeader();
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
    _pastShown = PAST_STEP;
    if (Announcements.unreadCount() === 0 && Suggestions.unseenCount() > 0) Announcements.tab = 'suggestions';
    else Announcements.tab = 'notices';
    renderNotices();
    requestAnimationFrame(jumpToNew);
    Announcements.fetchAll();
  };
  window.__openNotice = openNotice;
  window.__leaveNotices = leaveNotices;

  const back = $('announcePageBackBtn');
  if (back) back.addEventListener('click', () => window.switchAppView && window.switchAppView('home'));
  const post = $('newAnnounceBtn');
  if (post) post.addEventListener('click', () => window.switchAppView && window.switchAppView('post_announcement', Announcements.tab === 'suggestions' ? { __suggest: true } : null));
  const readAll = $('ntReadAll');
  if (readAll) readAll.addEventListener('click', () => {
    Announcements.markAllRead();
    renderNotices();
    showToast('All notices marked as read', 'success');
  });
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
    const dir = b.dataset.tab === 'suggestions' ? 1 : -1;
    swapFx($(b.dataset.tab === 'suggestions' ? 'ntSuggest' : 'announceList'), dir);
    if (b.dataset.tab !== 'suggestions') swapFx($('announceFilterBar'), dir);
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
    const prevIdx = _filterOrder.indexOf(Announcements.activeFilter);
    const widths = chipWidths();
    Announcements.activeFilter = b.dataset.filter === Announcements.activeFilter ? 'all' : b.dataset.filter;
    renderNotices();
    morphChips(widths);
    const nextIdx = _filterOrder.indexOf(Announcements.activeFilter);
    swapFx($('announceList'), nextIdx === prevIdx ? 0 : (nextIdx > prevIdx ? 1 : -1));
  });

  /* Swipe the list sideways to move to the next / previous type (touch and mouse). Starts on the
     chips, the search box or a tab are left alone: those scroll or type on their own. */
  const pageEl = $('announcementsAppView');
  if (pageEl) {
    let sw = null;
    const begin = (x, y, el) => {
      if (Announcements.tab !== 'notices' || _filterOrder.length < 3) { sw = null; return false; }
      if (el && el.closest && el.closest('.nt-filters, .nt-search, #ntTabs, .nt-admin-bar, input, textarea, select')) { sw = null; return false; }
      sw = { x, y, t: performance.now() };
    };
    const finish = (x, y) => {
      if (!sw) return;
      const dx = x - sw.x, dy = y - sw.y, dt = performance.now() - sw.t;
      sw = null;
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6 || dt > 700) return;
      const i = Math.max(0, _filterOrder.indexOf(Announcements.activeFilter));
      const next = _filterOrder[i + (dx < 0 ? 1 : -1)];
      if (!next) return; // already at the first / last type
      const widths = chipWidths();
      Announcements.activeFilter = next;
      renderNotices();
      morphChips(widths);
      swapFx($('announceList'), dx < 0 ? 1 : -1);
      const chip = document.querySelector('#announceFilterBar .nt-chip.active');
      if (chip && chip.scrollIntoView) chip.scrollIntoView({ block: 'nearest', inline: 'center' });
    };
    pageEl.addEventListener('touchstart', e => { if (e.touches.length === 1) begin(e.touches[0].clientX, e.touches[0].clientY, e.target); }, { passive: true });
    pageEl.addEventListener('touchend', e => { const t = e.changedTouches && e.changedTouches[0]; if (t) finish(t.clientX, t.clientY); }, { passive: true });
    pageEl.addEventListener('touchcancel', () => { sw = null; }, { passive: true });
    bindMouseDrag(pageEl, { start: (x, y, el) => begin(x, y, el), move() {}, end: (x, y, ev) => { if (ev) finish(x, y); else sw = null; } });
  }

  const page = $('announcementsAppView');
  if (page) page.addEventListener('click', e => {
    if (e.target.closest('[data-past-more]')) { _pastShown += PAST_STEP; toggleGroup('past', true); return; }
    const head = e.target.closest('[data-group-toggle]');
    if (head) {
      const k = head.dataset.groupToggle;
      toggleGroup(k);
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
