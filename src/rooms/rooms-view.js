/**
 * Rooms app (redesigned Nov 2026).
 *
 * Job: "which room is free now — or at the time I pick — and for how long?"
 *  - A time scrubber across the class day + this week's day chips set the moment.
 *  - Every room shows a day strip: busy blocks, the free window from the selected time
 *    (green), and a marker at that time — so "free until when" is visible without tapping.
 *  - The status summary (Free / Soon / All) is also the filter; rooms are grouped by floor.
 *  - A room sheet shows that room's day as a timeline of classes and free gaps.
 *
 * Occupancy logic stays in room-engine.js / room-overrides.js / room-date-lifecycle.js
 * (all covered by tests). This file is presentation + interaction only.
 *
 * External contract (unchanged): initFreeRoomsUI(), window.__renderFreeRooms,
 * window.openRoomInFreeRooms(roomId, dayIdx, returnView), window.refreshFreeRoomsIfVisible.
 */
import { offDays, shouldHideDay } from '../core/off-days.js';
import { DAY_NAMES, CONFIG } from '../core/config.js';
import { openModal, closeModal } from '../modals/modal.js';
import { getCurrentMinutes, escapeHtml, setHtmlIfChanged } from '../core/utils.js';
import { getTeacherInfo } from '../teachers/teacher-names.js';
import { showClassDetails } from '../timeline/class-detail.js';
import { openTeacherDetailByCode } from '../teachers/teacher-modal.js';
import { normalizeDate } from '../announcements/overrides.js';
import {
  loadMasterRoomsData,
  searchAllRoomsAvailabilityWithOverrides,
  getEffectiveRoomDaySchedule,
  evaluateRoomStatus,
  getRoomDayTimeline,
  formatMinuteTo12h,
  formatDuration,
  getFloorLabel
} from './room-engine.js';
import { resolveFreeRoomsSelection } from './room-date-lifecycle.js';

// ── Constants ────────────────────────────────────────────────────────────────
const DAY_START = 480;   // 8:00 AM — strip & scrubber range (classes run 8:30–4:00)
const DAY_END = 990;     // 4:30 PM
const SOON_MINS = 30;    // "freeing soon" = busy but free within this many minutes
// Off days come from core/off-days.js (Settings → Your class)
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── State ────────────────────────────────────────────────────────────────────
let _dayOffset = 0;          // 0 = today … 6
let _mode = 'NOW';           // 'NOW' (live clock) | 'CUSTOM' (scrubbed / other day)
let _minute = getCurrentMinutes();
let _statusFilter = 'free';  // 'free' | 'soon' | 'all'
let _typeFilter = 'all';     // 'all' | 'classroom' | 'lab'
let _query = '';
let _returnView = null;
let _sheetRoom = null;       // room meta of the open sheet
let _sheetOffset = 0;        // day offset shown in the sheet
let _tickTimer = null;
let _renderQueued = false;

// ── Small helpers ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const pct = m => `${(((Math.min(DAY_END, Math.max(DAY_START, m)) - DAY_START) / (DAY_END - DAY_START)) * 100).toFixed(2)}%`;
const clampMinute = m => Math.min(DAY_END, Math.max(DAY_START, m));

function dateForOffset(offset) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
}

/** The moment being looked at: { date, minute, isLive } */
function getMoment() {
  const date = dateForOffset(_dayOffset);
  if (_mode === 'NOW' && _dayOffset === 0) {
    const sel = resolveFreeRoomsSelection('NOW', date, _minute);
    return { date: sel.date, minute: sel.targetMinute, isLive: true };
  }
  return { date, minute: _minute, isLive: false };
}

function shortTime(m) {
  // "10:30 AM" -> "10:30" style is too terse for status lines; keep the engine's 12h format
  return formatMinuteTo12h(m).replace(/^0/, '');
}

function occupyingClasses(classes) {
  return (classes || []).filter(c => !c.isCancelled && !c.isMovedOnline && !c.isRescheduled);
}

/** Freed classes (cancelled / moved online / rescheduled away) — shown as freed slots */
function freedClasses(classes) {
  return (classes || []).filter(c => c.isCancelled || c.isMovedOnline || c.isRescheduled);
}

function roomLabel(room) {
  const hasName = room.name && room.name !== `Room ${room.id}`;
  return { num: room.id, name: hasName ? room.name : (room.type === 'lab' ? 'Lab' : 'Classroom') };
}

/** Status bucket + human copy for one evaluated room */
function describe(item, minute) {
  if (item.status === 'FREE') {
    const noClassesAtAll = item.subText === 'No classes scheduled';
    const text = item.isFreeRestOfDay
      ? (noClassesAtAll ? 'Free all day' : 'Free for the rest of the day')
      : `Free until ${shortTime(item.freeUntilMins)}`;
    return { bucket: 'free', text, detail: item.isFreeRestOfDay ? '' : formatDuration(item.freeDurationMins) };
  }
  const soon = item.minsUntilFree > 0 && item.minsUntilFree <= SOON_MINS;
  return {
    bucket: soon ? 'soon' : 'busy',
    text: soon ? `Free in ${formatDuration(item.minsUntilFree)}` : `Busy until ${shortTime(item.occupiedUntilMins)}`,
    detail: item.hasConflict ? 'Double-booked' : ''
  };
}

// ── Day strip (the signature element) ────────────────────────────────────────
/**
 * Busy blocks across the class day, the free window from the selected minute up to the
 * next busy block (or the busy streak containing it), and a marker at the minute.
 */
function stripHtml(classes, minute, { large = false, plain = false } = {}) {
  const busy = occupyingClasses(classes).slice().sort((a, b) => a.startM - b.startM);
  const blocks = busy.map(c =>
    `<span class="rm-strip-busy" style="left:${pct(c.startM)};width:calc(${pct(c.endM)} - ${pct(c.startM)})"></span>`
  ).join('');

  let windowHtml = '';
  const inBusy = busy.some(c => minute >= c.startM && minute < c.endM);
  if (!plain && !inBusy && minute < DAY_END) {
    const next = busy.find(c => c.startM > minute);
    const end = next ? next.startM : DAY_END;
    if (end > Math.max(minute, DAY_START)) {
      windowHtml = `<span class="rm-strip-free" style="left:${pct(minute)};width:calc(${pct(end)} - ${pct(minute)})"></span>`;
    }
  }
  const showMarker = !plain && minute >= DAY_START && minute <= DAY_END;
  const marker = showMarker ? `<span class="rm-strip-marker" style="left:${pct(minute)}"></span>` : '';
  return `<div class="rm-strip${large ? ' is-large' : ''}" aria-hidden="true">${blocks}${windowHtml}${marker}</div>`;
}

function hourTicksHtml() {
  const ticks = [];
  for (let m = 540; m <= 960; m += 120) {
    const h = Math.floor(m / 60);
    const label = h === 12 ? '12' : String(h % 12);
    ticks.push(`<span style="left:${pct(m)}">${label}</span>`);
  }
  return ticks.join('');
}

// ── Main render ──────────────────────────────────────────────────────────────
function scheduleRender() {
  if (_renderQueued) return;
  _renderQueued = true;
  requestAnimationFrame(() => { _renderQueued = false; renderFreeRoomsView(); });
}

/** Choose the day (offset from today; any number, the chips only show a week). Today returns to live mode;
 *  other days keep the same time of day ("same time tomorrow"), clamped into class hours. */
function pickDayOffset(offset) {
  const keepMinute = clampMinute(getMoment().minute);
  _dayOffset = offset;
  if (offset === 0) { _mode = 'NOW'; _minute = getCurrentMinutes(); }
  else { _mode = 'CUSTOM'; _minute = keepMinute; }
  renderFreeRoomsView();
}

const midnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function offsetOfDate(d) { return Math.round((midnight(d) - midnight(new Date())) / 864e5); }

function openRoomsCalendar() {
  if (typeof window.openCalendarPicker !== 'function') return;
  window.openCalendarPicker({ date: dateForOffset(_dayOffset), onPick: d => pickDayOffset(offsetOfDate(d)) });
}

export function renderFreeRoomsView() {
  const list = $('rmList');
  if (!list) return;

  const { date, minute, isLive } = getMoment();
  const dayName = DAY_NAMES[date.getDay()] || 'Saturday';
  const dateStr = normalizeDate(date);

  renderDays($('rmDays'), _dayOffset, pickDayOffset);
  renderWhen(minute, isLive);
  // The header buttons light up when the day or the time is not the live one
  $('rmCalBtn')?.classList.toggle('is-active', _dayOffset !== 0);
  $('rmClockBtn')?.classList.toggle('is-active', !isLive);

  const evaluated = searchAllRoomsAvailabilityWithOverrides(dayName, minute, dateStr).map(item => ({
    ...item,
    classes: getEffectiveRoomDaySchedule(dayName, item.room.id, dateStr),
    view: describe(item, minute)
  }));

  // Counts reflect type + search (not the status filter), so the summary stays honest
  const matchesFind = item => {
    if (_typeFilter !== 'all' && item.room.type !== _typeFilter) return false;
    if (!_query) return true;
    const hay = `${item.room.id} ${item.room.name || ''} ${getFloorLabel(item.room.floor)}`.toLowerCase();
    return hay.includes(_query);
  };
  const pool = evaluated.filter(matchesFind);
  const counts = { free: 0, soon: 0, busy: 0 };
  pool.forEach(i => { counts[i.view.bucket]++; });
  renderStatusSeg(counts, pool.length);

  const visible = pool.filter(i => _statusFilter === 'all' ? true
    : _statusFilter === 'free' ? i.view.bucket === 'free'
    : i.view.bucket === 'soon');

  const subtitle = $('rmSubtitle');
  if (subtitle) {
    const when = isLive ? 'right now' : `${_dayOffset === 0 ? 'today' : SHORT_DAYS[date.getDay()]} at ${shortTime(minute)}`;
    subtitle.textContent = `${counts.free} of ${pool.length} free ${when}`;
  }

  if (visible.length === 0) {
    if (setHtmlIfChanged(list, emptyStateHtml(pool, counts, minute))) bindEmptyState(list);
    return;
  }

  // Group by floor (ascending), rooms in number order inside a floor (not by status: the filter above
  // already says which rooms are free, and a list that reshuffles every minute is hard to scan)
  const floors = [...new Set(visible.map(i => i.room.floor))].sort((a, b) => a - b);
  const html = floors.map(floor => {
    const inFloor = visible.filter(i => i.room.floor === floor).sort((a, b) =>
      String(a.room.id).localeCompare(String(b.room.id), undefined, { numeric: true }));
    const floorAll = pool.filter(i => i.room.floor === floor);
    const floorFree = floorAll.filter(i => i.view.bucket === 'free').length;
    return `
      <section class="rm-floor" aria-label="${escapeHtml(getFloorLabel(floor))}">
        <header class="rm-floor-head">
          <span class="rm-floor-name">${escapeHtml(getFloorLabel(floor))}</span>
          <span class="rm-floor-count">${floorFree} of ${floorAll.length} free</span>
        </header>
        ${inFloor.map(item => roomCardHtml(item, minute)).join('')}
      </section>`;
  }).join('');

  if (!setHtmlIfChanged(list, html)) return; // same rooms, same states: keep the DOM (and its handlers)
  list.querySelectorAll('.rm-room').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = evaluated.find(i => i.room.id === btn.dataset.roomId);
      if (item) openRoomScheduleSheet(item.room, _dayOffset);
    });
  });
}

function roomCardHtml(item, minute) {
  const { num, name } = roomLabel(item.room);
  const v = item.view;
  return `
    <button type="button" class="rm-room is-${v.bucket}" data-room-id="${escapeHtml(item.room.id)}">
      <span class="rm-room-id">
        <span class="rm-room-num">${escapeHtml(num)}</span>
        <span class="rm-room-name">${escapeHtml(name)}</span>
      </span>
      <span class="rm-room-state">
        <span class="rm-room-status">${escapeHtml(v.text)}</span>
        ${v.detail ? `<span class="rm-room-detail">${escapeHtml(v.detail)}</span>` : ''}
      </span>
      ${stripHtml(item.classes, minute)}
    </button>`;
}

function emptyStateHtml(pool, counts, minute) {
  if (pool.length === 0) {
    return `
      <div class="rm-empty">
        <div class="rm-empty-title">No rooms match “${escapeHtml(_query || (_typeFilter === 'lab' ? 'Labs' : 'Rooms'))}”</div>
        <div class="rm-empty-sub">Try another room number, or clear the search.</div>
        <button type="button" class="rm-empty-action" data-action="clear">Clear search</button>
      </div>`;
  }
  // Nothing in the chosen bucket: point at what *is* useful
  const soonest = pool.filter(i => i.status === 'OCCUPIED')
    .sort((a, b) => a.minsUntilFree - b.minsUntilFree)[0];
  const hint = soonest
    ? `${escapeHtml(soonest.room.id)} frees up first, at ${escapeHtml(shortTime(soonest.occupiedUntilMins))}.`
    : '';
  const title = _statusFilter === 'free'
    ? `Every room is busy at ${escapeHtml(shortTime(minute))}`
    : 'No rooms are about to free up';
  return `
    <div class="rm-empty">
      <div class="rm-empty-title">${title}</div>
      ${hint ? `<div class="rm-empty-sub">${hint}</div>` : ''}
      <button type="button" class="rm-empty-action" data-action="all">Show all ${pool.length} rooms</button>
    </div>`;
}

function bindEmptyState(list) {
  const btn = list.querySelector('.rm-empty-action');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (btn.dataset.action === 'clear') {
      _query = '';
      const input = $('rmSearch');
      if (input) input.value = '';
      syncSearchClear();
    } else {
      _statusFilter = 'all';
    }
    renderFreeRoomsView();
  });
}

// ── "When" controls ──────────────────────────────────────────────────────────
function renderDays(container, activeOffset, onPick) {
  if (!container) return;
  const html = [];
  let shown = 0;
  for (let o = 0; o < 7; o++) {
    const d = dateForOffset(o);
    const off = offDays().includes(d.getDay());
    if (shouldHideDay(d, { isToday: o === 0, isSelected: o === activeOffset })) continue;
    shown++;
    const label = o === 0 ? 'Today' : SHORT_DAYS[d.getDay()];
    html.push(`
      <button type="button" role="tab" class="rm-day${o === activeOffset ? ' active' : ''}${off ? ' is-off' : ''}"
        data-offset="${o}" aria-selected="${o === activeOffset}" title="${DAY_NAMES[d.getDay()]}${off ? ' (off day)' : ''}">
        <span class="rm-day-name">${label}</span>
        <span class="rm-day-num">${d.getDate()}</span>
      </button>`);
  }
  if (activeOffset < 0 || activeOffset > 6) {
    const d = dateForOffset(activeOffset);
    shown++;
    html.push(`
      <button type="button" role="tab" class="rm-day active" data-offset="${activeOffset}" aria-selected="true" title="${DAY_NAMES[d.getDay()]} ${d.getDate()}">
        <span class="rm-day-name">${SHORT_DAYS[d.getDay()]}</span>
        <span class="rm-day-num">${d.getDate()}</span>
      </button>`);
  }
  container.innerHTML = html.join('');
  container.style.setProperty('--rm-days', String(shown));
  container.querySelectorAll('.rm-day').forEach(btn => {
    btn.addEventListener('click', () => onPick(Number(btn.dataset.offset)));
  });
}

function renderWhen(minute, isLive) {
  const readout = $('rmTimeReadout');
  const range = $('rmTimeRange');
  const nowBtn = $('rmNowBtn');
  const when = $('rmWhen');
  if (readout) {
    const outside = minute < DAY_START || minute > DAY_END;
    readout.innerHTML = isLive
      ? `<span class="rm-live-dot" aria-hidden="true"></span>Now · ${escapeHtml(shortTime(minute))}${outside ? ' <span class="rm-readout-note">outside class hours</span>' : ''}`
      : escapeHtml(shortTime(minute));
  }
  if (range && document.activeElement !== range) range.value = String(clampMinute(minute));
  if (range) range.style.setProperty('--fill', pct(clampMinute(minute)));
  if (nowBtn) nowBtn.hidden = isLive;
  if (when) when.classList.toggle('is-live', isLive);
}

function renderStatusSeg(counts, total) {
  const seg = $('rmStatusSeg');
  if (!seg) return;
  const items = [
    { key: 'free', label: 'Free', n: counts.free },
    { key: 'soon', label: 'Soon', n: counts.soon },
    { key: 'all', label: 'All', n: total }
  ];
  seg.innerHTML = items.map(it => `
    <button type="button" role="tab" data-status="${it.key}" class="rm-status-btn is-${it.key}${_statusFilter === it.key ? ' active' : ''}"
      aria-selected="${_statusFilter === it.key}">
      <span class="rm-status-n">${it.n}</span><span class="rm-status-label">${it.label}</span>
    </button>`).join('');
  seg.querySelectorAll('.rm-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _statusFilter = btn.dataset.status;
      renderFreeRoomsView();
      replayListReveal();
    });
  });
}

function replayListReveal() {
  const list = $('rmList');
  if (!list) return;
  list.classList.remove('list-swap');
  void list.offsetWidth;
  list.classList.add('list-swap'); // motion.css §9
  setTimeout(() => list.classList.remove('list-swap'), 600);
}

function syncSearchClear() {
  const clear = $('rmSearchClear');
  if (clear) clear.hidden = !_query;
}

// ── Room sheet ───────────────────────────────────────────────────────────────
/**
 * Opens a room's day. dayIdxOrOffset: a day offset (0–6) from the list, or a weekday
 * index (0=Sun…6=Sat) from deep links — resolved to the next occurrence of that weekday.
 */
export function openRoomScheduleSheet(roomMeta, dayIdxOrOffset = 0, { isWeekday = false } = {}) {
  const sheet = $('roomScheduleSheet');
  if (!sheet || !roomMeta) return;
  _sheetRoom = roomMeta;
  _sheetOffset = isWeekday
    ? (dayIdxOrOffset - new Date().getDay() + 7) % 7
    : (Number(dayIdxOrOffset) || 0);
  renderRoomSheet();
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  setTimeout(() => $('rmSheetClose')?.focus({ preventScroll: true }), 50);
}

export function closeRoomScheduleSheet() {
  const sheet = $('roomScheduleSheet');
  if (!sheet || !sheet.classList.contains('open')) return;
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  _sheetRoom = null;
  if (!document.querySelector('.mo.open, .class-sheet-modal-overlay.open')) {
    document.body.classList.remove('modal-open');
  }
}

function renderRoomSheet() {
  if (!_sheetRoom) return;
  const room = _sheetRoom;
  const date = dateForOffset(_sheetOffset);
  const dayIdx = date.getDay();
  const dayName = DAY_NAMES[dayIdx];
  const dateStr = normalizeDate(date);
  const page = getMoment();
  // Same day as the page → use the page's moment; other days → start of class day
  const minute = _sheetOffset === _dayOffset ? page.minute : (_sheetOffset === 0 ? getCurrentMinutes() : DAY_START + 30);
  // Another day has no "now": the status line still reads at the start of the class day, but nothing on
  // the strip or the timeline is marked as current (the 8:30 class used to say "Now" on every other day)
  const isToday = _sheetOffset === 0;

  const classes = getEffectiveRoomDaySchedule(dayName, room.id, dateStr);
  const status = evaluateRoomStatus(room, classes, minute);
  const v = describe(status, minute);
  const { num, name } = roomLabel(room);

  $('rmSheetTitle').textContent = `${num}${name && room.type === 'lab' ? ` · ${name}` : ''}`;
  const meta = [getFloorLabel(room.floor), room.type === 'lab' ? 'Lab' : 'Classroom'];
  if (room.capacity) meta.push(`${room.capacity} seats`);
  $('rmSheetMeta').textContent = meta.join(' · ');

  const whenLabel = _sheetOffset === _dayOffset && page.isLive ? 'Right now' : `${_sheetOffset === 0 ? 'Today' : DAY_NAMES[dayIdx]} at ${shortTime(minute)}`;
  $('rmSheetStatus').className = `rm-sheet-status is-${v.bucket}`;
  $('rmSheetStatus').innerHTML = `
    <span class="rm-sheet-status-text">${escapeHtml(v.text)}</span>
    <span class="rm-sheet-status-when">${escapeHtml(whenLabel)}${v.detail ? ` · ${escapeHtml(v.detail)}` : ''}</span>`;

  renderDays($('rmSheetDays'), _sheetOffset, offset => { _sheetOffset = offset; renderRoomSheet(); });

  $('rmSheetStrip').innerHTML = `${stripHtml(classes, minute, { large: true, plain: !isToday })}<div class="rm-ticks">${hourTicksHtml()}</div>`;
  renderSheetTimeline(room, classes, isToday ? minute : -1, dayIdx);
}

function renderSheetTimeline(room, classes, minute, dayIdx) {
  const container = $('rmSheetTimeline');
  const blocks = getRoomDayTimeline(room, occupyingClasses(classes), minute);
  const freed = freedClasses(classes).map(c => ({
    freed: true,
    startM: c.startM,
    endM: c.endM,
    startStr: c.start || shortTime(c.startM),
    endStr: c.end || shortTime(c.endM),
    durationMins: c.endM - c.startM,
    subject: c.subject || c.title || 'Class',
    instructor: c.instructor || '',
    type: c.type || 'Theory',
    semSec: c.semSec || '',
    semester: c.semester || '',
    section: c.section || '',
    isCancelled: Boolean(c.isCancelled),
    isRescheduled: Boolean(c.isRescheduled || c.isRescheduledOverride),
    isMovedOnline: Boolean(c.isMovedOnline),
    reason: c.isCancelled ? 'Cancelled' : c.isMovedOnline ? 'Moved online' : 'Rescheduled'
  }));
  const rows = [...blocks, ...freed].sort((a, b) => a.startM - b.startM || (a.freed ? 1 : -1));

  if (rows.length === 1 && rows[0].isGap && rows[0].startM === 0) {
    container.innerHTML = `<div class="rm-tl-empty">No classes in this room ${dayIdx === new Date().getDay() && _sheetOffset === 0 ? 'today' : `on ${DAY_NAMES[dayIdx]}`}. It's free all day.</div>`;
    return;
  }

  container.innerHTML = rows.map((b, i) => {
    // Start over end, stacked (a single line wrapped mid-range: '9:45 AM – 11:00 / AM')
    const time = `<span class="rm-tl-start">${escapeHtml(shortTime(b.startM))}</span><span class="rm-tl-end">${escapeHtml(shortTime(b.endM))}</span>`;
    if (b.freed) {
      return `
        <div class="rm-tl-row is-freed" role="button" tabindex="0" data-idx="${i}">
          <span class="rm-tl-time">${time}</span>
          <div class="rm-tl-body">
            <span class="rm-tl-title">${escapeHtml(b.subject)} <span class="rm-tl-tag">${escapeHtml(b.reason)}</span></span>
            <span class="rm-tl-sub">Room is free during this slot</span>
          </div>
        </div>`;
    }
    if (b.isGap) {
      const isNow = minute >= b.startM && minute < b.endM;
      return `
        <div class="rm-tl-row is-gap${isNow ? ' is-now' : ''}">
          <span class="rm-tl-time">${time}</span>
          <div class="rm-tl-body">
            <span class="rm-tl-title">Free · ${escapeHtml(formatDuration(b.durationMins))}</span>
          </div>
        </div>`;
    }
    const info = b.instructor ? getTeacherInfo(b.instructor) : null;
    const teacherName = info?.name || b.instructor || '';
    return `
      <div class="rm-tl-row is-class is-${b.state}" role="button" tabindex="0" data-idx="${i}">
        <span class="rm-tl-time">${time}</span>
        <div class="rm-tl-body">
          <span class="rm-tl-title">${escapeHtml(b.subject)}
            <span class="rm-tl-tag ${(b.type || '').toLowerCase() === 'lab' ? 'is-lab' : ''}">${escapeHtml((b.type || 'Theory').toLowerCase() === 'lab' ? 'Lab' : 'Theory')}</span>
            ${b.semSec ? `<span class="rm-tl-tag is-muted">${escapeHtml(b.semSec)}</span>` : ''}
            ${b.state === 'current' ? '<span class="rm-tl-tag is-now">Now</span>' : ''}
          </span>
          ${teacherName ? `<button type="button" class="rm-tl-teacher" data-teacher="${escapeHtml(b.instructor)}">${escapeHtml(teacherName)}</button>` : ''}
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.rm-tl-row.is-class, .rm-tl-row.is-freed').forEach(row => {
    const open = e => {
      if (e.target.closest('.rm-tl-teacher')) return;
      const b = rows[Number(row.dataset.idx)];
      openClassDetailFor(b, room, dayIdx);
    };
    row.addEventListener('click', open);
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } });
  });
  container.querySelectorAll('.rm-tl-teacher').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.dataset.teacher) openTeacherDetailByCode(btn.dataset.teacher);
    });
  });
}

function openClassDetailFor(b, room, dayIdx) {
  const semMatch = String(b.semSec || '').match(/Sem\s*(\d+)(?:-([A-Za-z0-9]+))?/i);
  showClassDetails({
    code: b.subject,
    title: b.subject,
    subject: b.subject,
    room: room.id,
    instructor: b.instructor,
    teacher: b.instructor,
    instructorName: b.instructor,
    start: b.startStr,
    end: b.endStr,
    timing: `${b.startStr} – ${b.endStr}`,
    type: b.type,
    duration: formatDuration(b.durationMins),
    hasExplicitEndTime: true,
    dayIdx,
    dayName: DAY_NAMES[dayIdx],
    semSec: b.semSec || '',
    semester: semMatch ? semMatch[1] : (b.semester || ''),
    section: semMatch ? (semMatch[2] || '') : (b.section || ''),
    isCancelled: Boolean(b.isCancelled),
    isRescheduled: Boolean(b.isRescheduled),
    isOnline: Boolean(b.isMovedOnline),
    isFromRoom: true
  });
}

// ── Set the time by hand ─────────────────────────────────────────────────────
let _timeSheet = null;
const toHHMM = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function setTime(minute) {
  _mode = 'CUSTOM';
  _minute = Math.max(0, Math.min(1439, minute));
  renderFreeRoomsView();
}

function openTimeSheet() {
  if (!_timeSheet) {
    _timeSheet = document.createElement('div');
    _timeSheet.className = 'class-sheet-modal-overlay';
    _timeSheet.id = 'rmTimeSheet';
    _timeSheet.style.zIndex = '100050';
    _timeSheet.innerHTML = `<div class="nt-sheet rm-time-sheet" role="dialog" aria-modal="true" aria-labelledby="rmTimeTitle">
        <div class="nt-grip"></div>
        <button type="button" class="nt-sheet-close" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
        <div class="nt-sheet-body">
          <h2 class="rm-time-title" id="rmTimeTitle">Set the time</h2>
          <p class="rm-time-sub" id="rmTimeSub"></p>
          <input type="time" class="rm-time-input" id="rmTimeInput" aria-label="Time">
          <div class="rm-time-chips" id="rmTimeChips"></div>
          <div class="rm-time-actions">
            <button type="button" class="rm-time-go" data-act="set">Show rooms at this time</button>
            <button type="button" class="rm-time-now" data-act="now">Use the current time</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(_timeSheet);
    _timeSheet.addEventListener('click', e => {
      if (e.target === _timeSheet || e.target.closest('[data-close]')) { closeModal(_timeSheet); return; }
      const chip = e.target.closest('[data-min]');
      if (chip) { setTime(Number(chip.dataset.min)); closeModal(_timeSheet); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'now') {
        _mode = 'NOW'; _dayOffset = 0; _minute = getCurrentMinutes();
        renderFreeRoomsView();
      } else {
        const [h, m] = String($('rmTimeInput').value || '').split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) { $('rmTimeInput').focus(); return; }
        setTime(h * 60 + m);
      }
      closeModal(_timeSheet);
    });
  }
  const { date, minute } = getMoment();
  $('rmTimeSub').textContent = `Rooms on ${_dayOffset === 0 ? 'today' : `${SHORT_DAYS[date.getDay()]} ${date.getDate()}`}. Pick any time, or a class slot.`;
  $('rmTimeInput').value = toHHMM(Math.max(0, Math.min(1439, minute)));
  $('rmTimeChips').innerHTML = CONFIG.matrixIntervals.map(t => `<button type="button" class="rm-time-chip${t.startM === minute ? ' active' : ''}" data-min="${t.startM}">${escapeHtml(shortTime(t.startM))}</button>`).join('');
  openModal(_timeSheet);
}

// ── Init & external hooks ────────────────────────────────────────────────────
export function initFreeRoomsUI() {
  const ticks = $('rmTicks');
  if (ticks) ticks.innerHTML = hourTicksHtml();

  $('freeRoomsPageBackBtn')?.addEventListener('click', () => {
    const target = _returnView || 'apps';
    _returnView = null;
    closeRoomScheduleSheet();
    if (typeof window.switchAppView === 'function') window.switchAppView(target);
  });

  $('rmRefreshBtn')?.addEventListener('click', async () => {
    const btn = $('rmRefreshBtn');
    btn.classList.add('is-spinning');
    try { await loadMasterRoomsData(); } catch (e) {}
    renderFreeRoomsView();
    setTimeout(() => btn.classList.remove('is-spinning'), 500);
  });

  $('rmCalBtn')?.addEventListener('click', openRoomsCalendar);
  $('rmClockBtn')?.addEventListener('click', openTimeSheet);
  const readout = $('rmTimeReadout');
  if (readout) {
    readout.setAttribute('role', 'button'); readout.setAttribute('tabindex', '0'); readout.title = 'Tap to set the time';
    readout.addEventListener('click', openTimeSheet);
    readout.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTimeSheet(); } });
  }

  const range = $('rmTimeRange');
  range?.addEventListener('input', () => {
    _mode = 'CUSTOM';
    _minute = Number(range.value);
    scheduleRender();
  });

  $('rmNowBtn')?.addEventListener('click', () => {
    _mode = 'NOW';
    _dayOffset = 0;
    _minute = getCurrentMinutes();
    renderFreeRoomsView();
  });

  const search = $('rmSearch');
  search?.addEventListener('input', () => {
    _query = search.value.trim().toLowerCase();
    syncSearchClear();
    scheduleRender();
  });
  $('rmSearchClear')?.addEventListener('click', () => {
    _query = '';
    if (search) { search.value = ''; search.focus(); }
    syncSearchClear();
    renderFreeRoomsView();
  });

  $('rmTypeSeg')?.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      _typeFilter = btn.dataset.type;
      $('rmTypeSeg').querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      });
      renderFreeRoomsView();
      replayListReveal();
    });
  });

  // Sheet: close button, backdrop tap, Escape
  $('rmSheetClose')?.addEventListener('click', closeRoomScheduleSheet);
  $('roomScheduleSheet')?.addEventListener('click', e => {
    if (e.target.id === 'roomScheduleSheet') closeRoomScheduleSheet();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('roomScheduleSheet')?.classList.contains('open')) closeRoomScheduleSheet();
  });

  window.__renderFreeRooms = async function () {
    await loadMasterRoomsData();
    renderFreeRoomsView();
    startLiveTick();
  };
}

/** While the page is open in live mode, keep statuses current (minute-level). */
function startLiveTick() {
  clearInterval(_tickTimer);
  _tickTimer = setInterval(() => {
    if (window.__currentAppViewId !== 'free_rooms') { clearInterval(_tickTimer); return; }
    if (document.hidden) return;
    if (_mode === 'NOW' && _dayOffset === 0) {
      renderFreeRoomsView();
      if (_sheetRoom && _sheetOffset === 0) renderRoomSheet();
    }
  }, 30000);
}

/**
 * Deep link (e.g. the Room tile in class details): opens the Rooms page on that room's day.
 * dayIdx is a weekday index (0=Sun…6=Sat); returnView is where Back should go.
 */
export function openRoomInFreeRooms(rawRoomId, dayIdx = null, returnView = null) {
  _returnView = returnView || (window.__currentAppViewId === 'home' ? 'home' : 'apps');
  const backLabel = $('rmBackLabel');
  if (backLabel) backLabel.textContent = _returnView === 'home' ? 'Home' : 'Apps';

  if (typeof window.closeClassDetailSheet === 'function') window.closeClassDetailSheet();
  if (typeof window.closeTeacherDetailModal === 'function') window.closeTeacherDetailModal();
  if (typeof window.switchAppView === 'function') window.switchAppView('free_rooms');

  const hasDay = typeof dayIdx === 'number' && !isNaN(dayIdx);
  const offset = hasDay ? (dayIdx - new Date().getDay() + 7) % 7 : 0;
  _dayOffset = offset;
  _mode = offset === 0 ? 'NOW' : 'CUSTOM';
  _minute = offset === 0 ? getCurrentMinutes() : DAY_START + 30;
  _statusFilter = 'all'; // show the room even if it's busy

  const cleanRoom = String(rawRoomId || '').replace(/^room\s*/i, '').trim().toLowerCase();
  loadMasterRoomsData().then(master => {
    renderFreeRoomsView();
    if (!cleanRoom || cleanRoom === 'tba' || cleanRoom === 'online') return;
    const target = (master?.rooms || []).find(r =>
      r.id.toLowerCase() === cleanRoom || (r.name && r.name.toLowerCase() === cleanRoom));
    if (target) openRoomScheduleSheet(target, offset);
  });
}
window.openRoomInFreeRooms = openRoomInFreeRooms;

/** In-place refresh when announcements/overrides change. */
export function refreshFreeRoomsIfVisible() {
  if (window.__currentAppViewId === 'free_rooms') renderFreeRoomsView();
  if (_sheetRoom && $('roomScheduleSheet')?.classList.contains('open')) renderRoomSheet();
}
window.refreshFreeRoomsIfVisible = refreshFreeRoomsIfVisible;
