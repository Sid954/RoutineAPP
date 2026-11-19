import { DOM } from '../core/dom.js';
import { getPref } from '../settings/prefs.js';
import { State } from '../core/state.js';
import { DAY_NAMES, FULL_COURSE_NAMES } from '../core/config.js';
import { getClassesForDay, getEffectiveClassesForDay } from '../schedule/queries.js';
import { getOverrideFor, getOverridesByDateMap, normalizeDate, getDateForDayIndex, getExtraClassesForDate, getRescheduledClassesForDate, getDeadlinesForDate, getOverrideBadgeSlots } from '../announcements/overrides.js';
import { toMinutes, format12h, toTimeString, getCurrentMinutes, escapeHtml, formatRoom, LAB_LABEL_HTML } from '../core/utils.js';
import { getFullName } from '../teachers/teacher-names.js';
import { Storage } from '../storage/storage.js';
import { shouldHideDay, offDays } from '../core/off-days.js';

let _lastRenderHash = '';
let _lastSwapDayIdx = null;

// Academic week order (Thu → Wed), used to tell whether a day change moved forward or back

/** Day switches no longer animate (user request 2026-11-17: "no jumping"); content swaps in place. */
function playDaySwap(dayIdx) {
  _lastSwapDayIdx = dayIdx;
}

const OVERRIDE_ICONS = {
  cancellation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  holiday: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  class_test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  online_class: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>',
  rescheduled: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  assignment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>'
};

// Slow enough to follow with the eye (user 2026-11-17: "slowly unexpand ... smooth transition")
const STRIP_MORPH_MS = 460;
const STRIP_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
let _stripMorphTimer = null;

/** Where each day's pieces sit before the strip is rebuilt (positions relative to the cell). */
function snapshotStrip(container) {
  const snap = new Map();
  container.querySelectorAll(':scope > [data-date]').forEach(cell => {
    const cr = cell.getBoundingClientRect();
    const rel = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height, fs: parseFloat(getComputedStyle(el).fontSize) || 0 };
    };
    const cs = getComputedStyle(cell);
    const numEl = cell.querySelector('.focal-num-large, .satellite-num');
    snap.set(cell.dataset.date, {
      width: cr.width,
      bg: cs.backgroundColor,
      border: cs.borderColor,
      numColor: numEl ? getComputedStyle(numEl).color : '',
      focal: cell.classList.contains('focal-day-card'),
      num: rel(cell.querySelector('.focal-num-large, .satellite-num')),
      meta: cell.querySelector('.focal-meta') ? { ...rel(cell.querySelector('.focal-meta')), node: cell.querySelector('.focal-meta') } : null,
      name: cell.querySelector('.satellite-name') ? { ...rel(cell.querySelector('.satellite-name')), text: cell.querySelector('.satellite-name').textContent, color: getComputedStyle(cell.querySelector('.satellite-name')).color } : null
    });
  });
  return snap;
}

/**
 * Expand / collapse morph for the week strip. The strip is rebuilt as HTML, so every piece is
 * animated from where it was to where it ends up (FLIP):
 *  - each cell's width goes from its old width to its new one;
 *  - the day number glides from its old spot to its new one while scaling between the pill
 *    size and the focal size (it never disappears);
 *  - the tapped day's small "SAT" label floats up and fades out, and "SATURDAY / 4 CLASSES"
 *    slides in from the left as the card widens;
 *  - the previous focal day does the reverse: its long label is gone, "SUN" fades in above.
 * Children of a shrinking pill are pinned to their final positions so the centred layout
 * doesn't drift while the width changes. Nothing runs when nothing moved (minute refresh).
 */
function morphStripWidths(container, before) {
  if (!before || !before.size) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.documentElement.dataset.motion === 'off') return;
  const cells = [...container.querySelectorAll(':scope > [data-date]')];
  if (!cells.length) return;
  const finals = cells.map(c => c.getBoundingClientRect().width);
  const starts = cells.map((c, i) => (before.get(c.dataset.date) || {}).width ?? finals[i]);
  if (starts.every((w, i) => Math.abs(w - finals[i]) < 1)) return;

  // Final positions (measured at the final layout, before any width is overridden)
  const finalPos = cells.map(cell => {
    const cr = cell.getBoundingClientRect();
    const rel = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left - cr.left, y: r.top - cr.top, w: r.width, fs: parseFloat(getComputedStyle(el).fontSize) || 0 }; };
    return {
      num: rel(cell.querySelector('.focal-num-large, .satellite-num')),
      kids: [...cell.children].map(k => ({ k, x: rel(k).x }))
    };
  });

  clearTimeout(_stripMorphTimer);
  container.classList.add('is-morphing');
  const anims = [];
  const ghosts = [];
  const opts = (extra = {}) => ({ duration: STRIP_MORPH_MS, easing: STRIP_EASE, fill: 'both', ...extra });

  cells.forEach((c, i) => {
    c.style.transition = 'none';
    c.style.flex = '0 0 auto';
    c.style.minWidth = '0';
    c.style.width = `${starts[i]}px`;
  });

  cells.forEach((c, i) => {
    const old = before.get(c.dataset.date);
    if (!old) return;
    const isFocal = c.classList.contains('focal-day-card');
    const roleChanged = old.focal !== isFocal;
    const fp = finalPos[i];

    if (!isFocal && roleChanged) {
      // Pill shrinking out of the focal card: pin its centred children to their final x
      c.style.alignItems = 'flex-start';
      c.style.paddingLeft = '0';
      c.style.paddingRight = '0';
      fp.kids.forEach(({ k, x }) => {
        if (getComputedStyle(k).position === 'absolute') return;
        k.style.marginLeft = `${x}px`;
      });
    }

    if (!roleChanged) return;

    // Card colour blends (accent <-> dark) instead of switching
    const cs = getComputedStyle(c);
    if (old.bg && old.bg !== cs.backgroundColor) {
      anims.push(c.animate([{ backgroundColor: old.bg, borderColor: old.border }, { backgroundColor: cs.backgroundColor, borderColor: cs.borderColor }], opts()));
    }

    // Number: glide + scale from the old spot/size to the new one
    const n = c.querySelector('.focal-num-large, .satellite-num');
    if (n && old.num && fp.num && fp.num.fs) {
      const k = old.num.fs / fp.num.fs;
      const dx = old.num.x - fp.num.x;
      const dy = old.num.y - fp.num.y;
      n.style.transformOrigin = '0 0';
      if (getComputedStyle(n).display === 'inline') n.style.display = 'inline-block';
      const nc = getComputedStyle(n).color;
      anims.push(n.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${k})`, color: old.numColor || nc }, { transform: 'none', color: nc }], opts()));
    }

    if (isFocal) {
      // The old "SAT" label floats up and fades while the card widens
      if (old.name) {
        const g = document.createElement('span');
        g.className = 'strip-ghost-label';
        g.textContent = old.name.text;
        g.style.cssText = `position:absolute;left:${old.name.x}px;top:${old.name.y}px;width:${old.name.w}px;font-size:${old.name.fs}px;color:${old.name.color};pointer-events:none;text-align:center;font-weight:700;line-height:${old.name.h}px;letter-spacing:.3px`;
        c.appendChild(g);
        ghosts.push(g);
        anims.push(g.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], opts({ duration: STRIP_MORPH_MS * 0.55 })));
      }
      // "SATURDAY / 4 CLASSES" slides in on the right as room appears
      const meta = c.querySelector('.focal-meta');
      if (meta) anims.push(meta.animate([{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], opts({ delay: STRIP_MORPH_MS * 0.3, duration: STRIP_MORPH_MS * 0.7 })));
    } else {
      // The old "SUNDAY / 4 CLASSES" fades out to the left instead of vanishing
      if (old.meta && old.meta.node) {
        const g = old.meta.node;
        g.classList.add('strip-ghost-label');
        g.style.cssText = `position:absolute;left:${old.meta.x}px;top:${old.meta.y}px;width:${old.meta.w}px;height:${old.meta.h}px;margin:0;pointer-events:none`;
        c.appendChild(g);
        ghosts.push(g);
        anims.push(g.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-8px)' }], opts({ duration: STRIP_MORPH_MS * 0.5 })));
      }
      // Pill: its "SUN" label fades in from above as the card narrows
      const name = c.querySelector('.satellite-name');
      if (name) anims.push(name.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], opts({ delay: STRIP_MORPH_MS * 0.35, duration: STRIP_MORPH_MS * 0.65 })));
    }
  });

  void container.offsetWidth; // commit the start widths
  cells.forEach((c, i) => {
    c.style.transition = `width ${STRIP_MORPH_MS}ms ${STRIP_EASE}`;
    c.style.width = `${finals[i]}px`;
  });

  _stripMorphTimer = setTimeout(() => {
    anims.forEach(a => { try { a.cancel(); } catch (e) {} });
    ghosts.forEach(g => g.remove());
    cells.forEach(c => {
      c.style.transition = c.style.flex = c.style.minWidth = c.style.width = '';
      c.style.alignItems = c.style.paddingLeft = c.style.paddingRight = '';
      [...c.children].forEach(k => { k.style.marginLeft = ''; k.style.transformOrigin = ''; if (k.style.display === 'inline-block') k.style.display = ''; });
    });
    container.classList.remove('is-morphing');
  }, STRIP_MORPH_MS + 40);
}

/** Classes that actually take place on a date: excludes cancelled and rescheduled-away ones. */
function countHeldClasses(dayIdx, date) {
  return getEffectiveClassesForDay(dayIdx, date)
    .filter(c => !c.isCancelled && !('rescheduledTo' in c)).length;
}

/**
 * Corner badge stack for a week-strip day: up to 3 override icons (highest priority first),
 * with a "+N" chip in the last slot when more types share the date.
 * @param {'satellite'|'focal'} variant
 */
function renderOverrideBadges(override, variant) {
  if (!override) return '';
  const { icons, more } = getOverrideBadgeSlots(override.types || [override.type], variant === 'focal' ? 99 : 3);
  const cls = variant === 'focal' ? 'focal-override-badge' : 'satellite-override-badge';
  const badges = icons
    .map(t => `<span class="${cls} ${t}" title="${t.replace('_', ' ')}">${OVERRIDE_ICONS[t] || ''}</span>`)
    .join('');
  const moreChip = more > 0 ? `<span class="${cls} override-badge-more" title="${more} more">+${more}</span>` : '';
  return `<span class="override-badge-stack">${badges}${moreChip}</span>`;
}

const MONTH_SHORT =['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const POP_LABEL = { holiday: 'Campus closed', cancellation: 'Class cancelled', class_test: 'Class test', rescheduled: 'Class rescheduled', online_class: 'Online class', assignment: 'Assignment due' };
const POP_ORDER = ['holiday', 'cancellation', 'class_test', 'rescheduled', 'online_class', 'assignment'];
let _dayPop = null;

function closeDayPop() {
  if (!_dayPop) return;
  _dayPop.remove();
  _dayPop = null;
  document.removeEventListener('pointerdown', onPopOutside, true);
  document.removeEventListener('keydown', onPopKey, true);
}
function onPopOutside(e) { if (_dayPop && !_dayPop.contains(e.target)) closeDayPop(); }
function onPopKey(e) { if (e.key === 'Escape') closeDayPop(); }

/** Everything announced for one date, as [type, title] rows (rescheduled also counts on its new date). */
function announcementsOn(dateStr) {
  const rows = [];
  (State.announcementsList || []).forEach(item => {
    if (!item || !item.date_override) return;
    const type = item.type;
    if (!POP_LABEL[type]) return;
    let hit = normalizeDate(item.date_override) === dateStr;
    if (!hit && type === 'rescheduled') {
      let a = item.announcement;
      if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = {}; } }
      hit = !!(a && a.new_date && normalizeDate(a.new_date) === dateStr);
    }
    if (hit) rows.push([type, String(item.title || '').trim(), item.id == null ? '' : String(item.id)]);
  });
  rows.sort((a, b) => POP_ORDER.indexOf(a[0]) - POP_ORDER.indexOf(b[0]));
  return rows;
}

/** Small popup under a week-strip icon stack: what is going on that day. */
function openDayPop(stack) {
  closeDayPop();
  const cell = stack.closest('[data-date]');
  if (!cell) return;
  const dateStr = cell.dataset.date;
  const rows = announcementsOn(dateStr);
  if (!rows.length) return;
  const d = new Date(dateStr + 'T00:00:00');
  const heading = isNaN(d) ? dateStr : `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  const pop = document.createElement('div');
  pop.className = 'day-pop';
  pop.setAttribute('role', 'dialog');
  pop.innerHTML = `<div class="day-pop-head">${escapeHtml(heading)}</div>` + rows.map(([t, title, id]) => `
    <button type="button" class="day-pop-row" data-id="${escapeHtml(id)}"${id ? '' : ' disabled'}>
      <span class="day-pop-ico ${t}">${OVERRIDE_ICONS[t] || ''}</span>
      <div class="day-pop-text"><strong>${POP_LABEL[t]}</strong>${title ? `<span>${escapeHtml(title)}</span>` : ''}</div>
      ${id ? '<svg class="day-pop-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>' : ''}
    </button>`).join('');
  // Tap a row: close the popup and open that notice
  pop.addEventListener('click', e => {
    const row = e.target.closest('.day-pop-row');
    if (!row || !row.dataset.id) return;
    closeDayPop();
    if (window.__openNotice) window.__openNotice(row.dataset.id);
  });
  document.body.appendChild(pop);
  const r = stack.getBoundingClientRect();
  const w = pop.offsetWidth;
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  pop.style.left = `${left}px`;
  pop.style.top = `${r.bottom + 10}px`;
  const arrow = Math.max(14, Math.min(w - 14, r.left + r.width / 2 - left));
  pop.style.setProperty('--arrow-x', `${arrow}px`);
  _dayPop = pop;
  document.addEventListener('pointerdown', onPopOutside, true);
  document.addEventListener('keydown', onPopKey, true);
}

export function renderWeekStrip() {
  const container = document.getElementById('focalStripContainer');
  if (!container) return;
  if (!container.dataset.popBound) {
    container.dataset.popBound = '1';
    // Capture phase: the icons open the popup instead of switching day / opening the calendar
    container.addEventListener('click', e => {
      const stack = e.target.closest && e.target.closest('.override-badge-stack');
      if (!stack) return;
      e.stopPropagation();
      e.preventDefault();
      openDayPop(stack);
    }, true);
  }

  const realToday = new Date();
  const realTodayIdx = realToday.getDay();

  const anchorDate = State.viewDate || realToday;
  const anchorDayIdx = anchorDate.getDay();

  // Academic week rolls over on Thursday (Thu=4, Fri=5, Sat=6, Sun=0, Mon=1, Tue=2, Wed=3)
  const academicDaysOrder = [4, 5, 6, 0, 1, 2, 3];
  const thuOffset = (anchorDayIdx - 4 + 7) % 7;
  const weekStartThu = new Date(anchorDate);
  weekStartThu.setDate(anchorDate.getDate() - thuOffset);

  const short3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const overridesMap = getOverridesByDateMap();

  let html = '';
  academicDaysOrder.forEach((dow, index) => {
    const d = new Date(weekStartThu);
    d.setDate(weekStartThu.getDate() + index);

    const isSelected = (dow === State.currentViewDayIdx);
    const isToday = (dow === realTodayIdx && d.getFullYear() === realToday.getFullYear() && d.getMonth() === realToday.getMonth() && d.getDate() === realToday.getDate());
    const isOffDay = offDays().includes(dow);

    const dateStr = normalizeDate(d);
    const override = overridesMap.get(dateStr);
    // University off days with nothing on are hidden (Settings → Your class); the others widen
    if (shouldHideDay(d, { isToday, isSelected, overridesMap })) return;
    const isHoliday = override && override.type === 'holiday';
    const isOnlineClass = override && override.type === 'online_class';

    // Classes that actually happen on this date (same rule as the timeline header count)
    const classCount = countHeldClasses(dow, d);

    // Subtext label logic
    let subText = '';
    if (isHoliday) {
      subText = 'No classes'; // the date is struck through and the icon says why
    } else if (isOffDay) {
      if (isOnlineClass && classCount > 0) {
        subText = `${classCount} ${classCount === 1 ? 'class' : 'classes'}`; // Suppress 'Off Day' if online class exists
      } else {
        subText = 'Off Day';
      }
    } else {
      subText = classCount === 0 ? 'No classes' : `${classCount} ${classCount === 1 ? 'class' : 'classes'}`;
    }

    // First of a month: say which month it is (the strip can cross a month change)
    const monthTag = d.getDate() === 1 ? MONTH_SHORT[d.getMonth()] : '';
    const overrideClass = override ? `override-${override.type}` : '';
    const isEffectiveOffDay = isOffDay && !isOnlineClass;

    if (isSelected) {
      const focalBadge = renderOverrideBadges(override, 'focal');
      html += `
        <div class="focal-day-card ${overrideClass}" data-date="${dateStr}" onclick="if(window.openCalendarPicker) window.openCalendarPicker();" title="${DAY_NAMES[dow]} (Tap to change date)">
          ${focalBadge}
          <span class="focal-num-large">${d.getDate()}</span>
          <div class="focal-meta">
            <span class="focal-day-label">${DAY_NAMES[dow]}</span>
            ${(monthTag || subText) ? `<span class="focal-day-sub">${[monthTag, subText].filter(Boolean).join(' · ')}</span>` : ''}
          </div>
        </div>
      `;
    } else {
      const satelliteBadge = renderOverrideBadges(override, 'satellite');
      html += `
        <div class="satellite-pill ${overrideClass} ${isEffectiveOffDay ? 'off-day' : ''} ${isToday ? 'is-real-today' : ''}" data-date="${dateStr}" onclick="window.__switchTimelineDay(${dow}, ${d.getTime()})" title="${DAY_NAMES[dow]}${override ? ` (${override.type.replace('_', ' ')})` : ''}">
          ${satelliteBadge}
          ${monthTag ? `<span class="satellite-month">${monthTag}</span>` : ''}
          <span class="satellite-name">${short3[dow]}</span>
          <span class="satellite-num">${d.getDate()}</span>
          ${isToday ? '<span class="today-subtle-dot" title="Today"></span>' : ''}
        </div>
      `;
    }
  });

  // Remember every day cell width before replacing the strip, so the selected day can
  // expand from its pill width and the previous one collapse back (morphStripWidths)
  const before = snapshotStrip(container);
  container.innerHTML = html;
  morphStripWidths(container, before);
}

const sameDate = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** A gap shorter than this does not get a break strip: the classes join into one block. */
const BREAK_MIN = 15;
const fmtMins = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`; };

/** First class that is actually held after `fromDate`'s day (looks 8 days ahead). */
function nextHeldClassAfter(fromDate) {
  const base = fromDate || new Date();
  for (let i = 1; i <= 8; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const c = getEffectiveClassesForDay(d.getDay(), d).find(x => !x.isCancelled && !('rescheduledTo' in x));
    if (c) return { c, date: d };
  }
  return null;
}
function relDay(d) {
  const t = new Date();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return DAY_NAMES[d.getDay()];
  return `${SHORT_DAY[d.getDay()]} ${d.getDate()}`;
}
/** "Next class: DSA · Tomorrow, 9:45 AM" button that jumps to that day. */
function nextClassLinkHtml(fromDate, cls = 'off-day-next') {
  const n = nextHeldClassAfter(fromDate);
  if (!n) return '';
  return `<button type="button" class="${cls}" onclick="event.stopPropagation(); window.__switchTimelineDay(${n.date.getDay()}, ${n.date.getTime()})">Next class: <strong>${escapeHtml(n.c.title)}</strong> · ${escapeHtml(relDay(n.date))}, ${escapeHtml(format12h(n.c.start))}</button>`;
}

window.__switchTimelineDay = function(dayIdx, timestamp) {
  State.currentViewDayIdx = dayIdx;
  if (timestamp) {
    State.viewDate = new Date(timestamp);
  }
  renderTimeline(true);
};

export function renderTimeline(force = false) {
  window.renderTimeline = renderTimeline;
  if (!DOM.timelineGrid) DOM.timelineGrid = document.getElementById('chG');
  if (!DOM.timelineTitle) DOM.timelineTitle = document.getElementById('timelineTitle');
  if (!DOM.timelineSubtitle) DOM.timelineSubtitle = document.getElementById('timelineSubtitle');

  renderWeekStrip();

  const classes = getClassesForDay(State.currentViewDayIdx);
  const currentMins = getCurrentMinutes();
  const realTodayIdx = new Date().getDay();
  // Same weekday is not enough: the calendar can show next week's Saturday
  const isToday = State.currentViewDayIdx === realTodayIdx && (!State.viewDate || sameDate(State.viewDate, new Date()));
  const isOffDay = (State.currentViewDayIdx === 4 || State.currentViewDayIdx === 5);

  // Skip redundant re-renders: same day + same minute = identical output
  const renderHash = `${State.currentViewDayIdx}:${isToday ? currentMins : -1}:${classes.length}`;
  if (!force && renderHash === _lastRenderHash) return;
  _lastRenderHash = renderHash;
  playDaySwap(State.currentViewDayIdx);

  // Update section titles
  const isTomorrow = State.currentViewDayIdx === (realTodayIdx + 1) % 7;
  const titleText = isToday ? `Today's Schedule` : (isTomorrow ? `Tomorrow's Schedule` : `${DAY_NAMES[State.currentViewDayIdx]} Schedule`);
  // Count held classes (not the raw routine), so it agrees with the week strip:
  // cancelled / rescheduled-away excluded, rescheduled-in and extra classes included
  const heldCount = countHeldClasses(State.currentViewDayIdx, State.viewDate);
  // Total time in class that day, next to the count ("3 classes, 3h 45m")
  const heldMins = getEffectiveClassesForDay(State.currentViewDayIdx, State.viewDate)
    .filter(c => !c.isCancelled && !('rescheduledTo' in c))
    .reduce((n, c) => { const d = toMinutes(c.end) - toMinutes(c.start); return n + (d > 0 ? d : 0); }, 0);
  const subText = isOffDay && heldCount === 0 ? 'OFF DAY' : `${heldCount} ${heldCount === 1 ? 'class' : 'classes'}${heldMins ? `, ${fmtMins(heldMins)}` : ''}`;
  
  if (DOM.timelineTitle) DOM.timelineTitle.textContent = titleText;
  if (DOM.timelineSubtitle) DOM.timelineSubtitle.textContent = subText;
  if (window.__updateFabAway) window.__updateFabAway();
  if (window.__updateNfBell) window.__updateNfBell();

  // Check holiday override for the day
  const holidayOverride = getOverrideFor(State.currentViewDayIdx);
  let holidayBanner = '';
  if (holidayOverride && holidayOverride.type === 'holiday') {
    const hasOnlineClasses = classes.some(c => {
      const ov = getOverrideFor(State.currentViewDayIdx, c.title);
      return ov && ov.type === 'online_class';
    });

    // A holiday that falls on a day with routine classes still lists them (marked cancelled)
    // under a banner; the full "Day Off" card is only for days with nothing in the routine.
    if (!hasOnlineClasses && classes.length) {
      holidayBanner = `
        <div class="campus-closed">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Campus closed</span>
        </div>`;
    } else if (!hasOnlineClasses) {
      if (DOM.timelineGrid) {
        DOM.timelineGrid.innerHTML = `
          <div class="off-day-card">
            <span class="off-day-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
            <div class="off-day-title">Campus closed</div>
            ${nextClassLinkHtml(State.viewDate)}
          </div>
        `;
      }
      return;
    }
  }

  // Process extra classes, rescheduled classes, and deadlines for the current view day
  const extraClassesList = getExtraClassesForDate(State.currentViewDayIdx);
  const rescheduledIncoming = getRescheduledClassesForDate(State.currentViewDayIdx);
  const deadlinesList = getDeadlinesForDate(State.currentViewDayIdx);

  // Clone classes array to avoid mutating global schedule
  let allScheduleClasses = classes.map(c => ({ ...c }));

function findInstructorForSubject(subj) {
  if (!subj) return '';
  const cleanSubj = subj.toUpperCase().trim();
  if (State.schedule) {
    for (const day in State.schedule) {
      const list = State.schedule[day] || [];
      const match = list.find(c => (c.title || c.subject || '').toUpperCase().trim() === cleanSubj);
      if (match && (match.instructor || match.teacher)) {
        return (match.instructor || match.teacher).trim();
      }
    }
  }
  return '';
}

  // Inject net-new extra classes
  extraClassesList.forEach(item => {
    let parsed = {};
    try { parsed = JSON.parse(item.announcement); } catch (e) {}
    const subj = item.subject_override || item.subject || 'Extra Class';
    const startStr = parsed.start_time || '09:45 AM';
    const startM = toMinutes(startStr);
    const endM = startM >= 0 ? startM + 75 : -1;
    const isOnline = (parsed.is_online === false || /extra class/i.test(item.title || '')) 
      ? false 
      : (parsed.is_online !== undefined ? Boolean(parsed.is_online) : true);
    const room = parsed.room || (isOnline ? 'Online' : 'TBA');
    const teacher = (parsed.teacher || '').trim() || findInstructorForSubject(subj);
    allScheduleClasses.push({
      start: startStr,
      end: '',
      startM: startM,
      endM: endM,
      hasExplicitEndTime: false,
      subject: subj,
      title: subj,
      room: room,
      teacher: teacher,
      instructor: teacher,
      type: 'Theory',
      isExtraClass: true,
      isOnline: isOnline,
      platform: parsed.platform || ''
    });
  });

  // Inject incoming rescheduled classes on destination date
  rescheduledIncoming.forEach(item => {
    let parsed = {};
    if (typeof item.announcement === 'string') {
      try { parsed = JSON.parse(item.announcement); } catch (e) {}
    } else if (typeof item.announcement === 'object' && item.announcement !== null) {
      parsed = item.announcement;
    }
    const subj = parsed.target_subject || item.subject_override || item.subject || 'Rescheduled Class';
    const startStr = format12h(parsed.new_start_time || '03:00 PM');
    const startM = toMinutes(startStr);
    const endM = startM >= 0 ? startM + 75 : -1;
    const room = parsed.new_room || parsed.original_room || 'TBA';
    const teacher = (parsed.teacher || '').trim() || findInstructorForSubject(subj);
    allScheduleClasses.push({
      start: startStr,
      end: '',
      startM: startM,
      endM: endM,
      hasExplicitEndTime: false,
      subject: subj,
      title: subj,
      room: room,
      teacher: teacher,
      instructor: teacher,
      type: 'Theory',
      isRescheduled: true,
      rescheduledReason: parsed.reason || '',
      origDate: parsed.original_date || item.date_override || '',
      origStart: parsed.original_start_time ? format12h(parsed.original_start_time) : ''
    });
  });

  // Process rescheduled classes & create ghost strips for original time slots (on original date)
  const ghostStrips = [];
  if (State.announcementsList && State.announcementsList.length > 0) {
    const targetDateStr = getDateForDayIndex(State.currentViewDayIdx);
    State.announcementsList.forEach(item => {
      if (item.type !== 'rescheduled') return;
      let parsed = {};
      if (typeof item.announcement === 'string') {
        try { parsed = JSON.parse(item.announcement); } catch (e) {}
      } else if (typeof item.announcement === 'object' && item.announcement !== null) {
        parsed = item.announcement;
      }
      const origDateStr = normalizeDate(parsed.original_date || item.date_override);
      if (origDateStr !== targetDateStr) return;

      const targetSubj = (parsed.target_subject || item.subject_override || item.subject || '').toUpperCase().trim();
      const targetClassIdx = allScheduleClasses.findIndex(c => (c.title || c.subject || '').toUpperCase().trim() === targetSubj && !c.isRescheduled);
      const targetClass = targetClassIdx >= 0 ? allScheduleClasses[targetClassIdx] : null;

      // Remove original routine class from this day
      if (targetClassIdx >= 0) {
        allScheduleClasses.splice(targetClassIdx, 1);
      }

      const rawOrigStart = parsed.original_start_time || targetClass?.start || '09:45 AM';
      const origStart = format12h(rawOrigStart);
      const newStart = format12h(parsed.new_start_time || '03:00 PM');
      const newDateStr = parsed.new_date || '';
      let formattedNewDate = newDateStr;
      if (newDateStr) {
        const [ny, nm, nd] = newDateStr.split('-').map(Number);
        if (ny && nm && nd) {
          const dObj = new Date(ny, nm - 1, nd);
          const dNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          formattedNewDate = `${dNames[dObj.getDay()]}, ${mNames[dObj.getMonth()]} ${nd}`;
        }
      }

      ghostStrips.push({
        type: 'ghost_strip',
        subject: parsed.target_subject || item.subject_override || item.subject || 'Class',
        origStart: origStart,
        sortM: toMinutes(origStart),
        newDate: newDateStr,
        formattedNewDate: formattedNewDate,
        newStart: newStart
      });
    });
  }

  // Classes actually held today (not cancelled / holiday-cancelled), in time order
  const heldList = allScheduleClasses.filter(c => {
    const ov = getOverrideFor(State.currentViewDayIdx, c.title);
    const onl = c.isExtraClass ? Boolean(c.isOnline) : (Boolean(c.isOnline) || (ov && ov.type === 'online_class'));
    const cancelled = (ov && ov.type === 'cancellation') || (!onl && holidayOverride && holidayOverride.type === 'holiday');
    return !cancelled && toMinutes(c.start) >= 0;
  }).map(c => {
    const s = toMinutes(c.start);
    const e = (c.end && !c.isExtraClass) || c.hasExplicitEndTime ? toMinutes(c.end) : s + 75;
    return { title: c.title, startM: s, endM: e > s ? e : s + 75, room: c.room };
  }).sort((a, b) => a.startM - b.startM);
  const upcomingStarts = isToday ? heldList.filter(h => h.startM > currentMins).map(h => h.startM) : [];
  const nextStartM = upcomingStarts.length ? Math.min(...upcomingStarts) : Infinity;
  const heldDayEnd = heldList.length ? Math.max(...heldList.map(h => h.endM)) : -1;

  // Build items array to render chronologically
  const renderItems = [];

  allScheduleClasses.forEach(c => {
    renderItems.push({
      kind: 'class',
      sortM: toMinutes(c.start),
      data: c
    });
  });

  ghostStrips.forEach(g => {
    renderItems.push({
      kind: 'ghost_strip',
      sortM: g.sortM,
      data: g
    });
  });

  deadlinesList.forEach(d => {
    let parsed = {};
    try { parsed = JSON.parse(d.announcement); } catch (e) {}
    renderItems.push({
      kind: 'deadline',
      sortM: toMinutes(parsed.due_time || '23:59'),
      data: {
        id: d.id,
        subject: d.subject_override || d.subject || parsed.subject || 'Assignment',
        taskTitle: parsed.task_title || 'Assignment',
        dueTime: parsed.due_time || '11:59 PM',
        description: parsed.description || d.announcement || ''
      }
    });
  });

  // Sort all items chronologically
  renderItems.sort((a, b) => a.sortM - b.sortM);

  if (!renderItems.length) {
    if (DOM.timelineGrid) {
      DOM.timelineGrid.innerHTML = `
        <div class="off-day-card">
          <span class="off-day-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
          <div class="off-day-title">No Classes Scheduled</div>
          <div class="off-day-desc">Enjoy your restful break! Recharge and prepare for your upcoming sessions.</div>
          ${nextClassLinkHtml(State.viewDate)}
        </div>
      `;
    }
    return;
  }

  let html = '';
  let lastEndMins = null;
  let lastWasClass = false; // the card just before this one is a class (so back-to-back classes can join)

  renderItems.forEach((item) => {
    if (item.kind === 'ghost_strip') {
      lastWasClass = false;
      const g = item.data;
      const destinationText = g.newDate && g.formattedNewDate ? `moved to ${escapeHtml(g.formattedNewDate)}` : 'moved to new slot';
      html += `
        <div class="timeline-ghost-strip ${g.newDate ? 'tappable' : ''}" ${g.newDate ? `onclick="if(window.navigateToDate) window.navigateToDate('${escapeHtml(g.newDate)}');"` : ''} title="${g.newDate ? `Tap to jump to ${escapeHtml(g.formattedNewDate)}` : ''}">
          <div class="timeline-ghost-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${escapeHtml(g.subject)} ${destinationText}</span>
          </div>
          <span class="timeline-ghost-badge">
            <span>${escapeHtml(g.newStart)}</span>
            ${g.newDate ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>' : ''}
          </span>
        </div>
      `;
      return;
    }

    if (item.kind === 'deadline') {
      lastWasClass = false;
      const d = item.data;
      html += `
        <div class="timeline-deadline-banner${d.id ? ' tappable' : ''}"${d.id ? ` onclick="window.__openNotice && window.__openNotice('${escapeHtml(String(d.id))}')"` : ''}>
          <div class="timeline-deadline-left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            <span>${escapeHtml(d.taskTitle)}: ${escapeHtml(d.subject)}</span>
          </div>
          <span class="timeline-deadline-time">Due ${escapeHtml(d.dueTime)}</span>
        </div>
      `;
      return;
    }

    const c = item.data;
    const hasExplicitEndTime = Boolean(c.hasExplicitEndTime) || (Boolean(c.end) && !c.isExtraClass);
    const startMins = toMinutes(c.start);
    const endMins = hasExplicitEndTime ? toMinutes(c.end) : (startMins >= 0 ? startMins + 75 : -1);
    const durationMins = hasExplicitEndTime ? Math.max(0, endMins - startMins) : 0;
    const durHours = Math.floor(durationMins / 60);
    const durMinsRemainder = durationMins % 60;
    const durationLabel = hasExplicitEndTime ? (durHours > 0 ? (durMinsRemainder > 0 ? `${durHours}h ${durMinsRemainder}m` : `${durHours}h`) : `${durMinsRemainder}m`) : '';
    const fullTiming = hasExplicitEndTime ? `${format12h(c.start)} – ${format12h(c.end)}` : `Starts at ${format12h(c.start)}`;
    const isLab = (c.type || '').toLowerCase() === 'lab';

    // A gap of 15 minutes or more gets a break strip; a shorter one (or none) joins the classes into one block
    const isOverlap = lastEndMins !== null && startMins < lastEndMins;
    const joinsPrev = lastWasClass && lastEndMins !== null && startMins - lastEndMins < BREAK_MIN;
    lastWasClass = true;
    if (lastEndMins !== null && startMins - lastEndMins >= BREAK_MIN) {
      const breakDuration = startMins - lastEndMins;
      const breakTiming = `${format12h(toTimeString(lastEndMins))} – ${format12h(toTimeString(startMins))}`;
      const isNowBreak = isToday && currentMins >= lastEndMins && currentMins < startMins;
      html += `
        <div class="break-transition-strip${isNowBreak ? ' is-now' : ''}">
          <div class="break-left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
            <span>${isNowBreak ? `Free now, ${fmtMins(startMins - currentMins)} left` : `${fmtMins(breakDuration)} break`}</span>
          </div>
          <span class="break-time-badge">${breakTiming}</span>
        </div>
      `;
    }
    if (lastEndMins === null || endMins > lastEndMins) {
      lastEndMins = endMins;
    }

    // Check cancellation & active states
    const cancelOverride = getOverrideFor(State.currentViewDayIdx, c.title);
    const isCancelled = cancelOverride && cancelOverride.type === 'cancellation';
    const isOnline = c.isExtraClass
      ? Boolean(c.isOnline)
      : (Boolean(c.isOnline) || (cancelOverride && cancelOverride.type === 'online_class'));
    const isClassTest = Boolean(c.isExam) || (cancelOverride && cancelOverride.type === 'class_test');
    const isHolidayCancelled = !isOnline && !isCancelled && holidayOverride && holidayOverride.type === 'holiday';
    const effectiveCancelled = isCancelled || isHolidayCancelled;

    let examName = 'Exam';
    let examTopics = '';
    let onlinePlatform = c.platform || '';
    let cancelReason = '';

    if (cancelOverride && cancelOverride.announcement) {
      const ann = cancelOverride.announcement;
      if (isClassTest) {
        try {
          const parsed = JSON.parse(ann.announcement);
          examName = parsed.exam_name || 'Class Test';
          examTopics = parsed.topics || '';
        } catch (e) {
          examName = ann.title ? ann.title.split(':')[0] : 'Class Test';
          examTopics = ann.announcement || '';
        }
      } else if (isOnline) {
        try {
          const parsed = JSON.parse(ann.announcement);
          onlinePlatform = parsed.platform || onlinePlatform;
        } catch (e) {
          onlinePlatform = ann.announcement || onlinePlatform;
        }
      } else if (isCancelled) {
        cancelReason = ann.announcement || 'Class cancelled for this date';
      }
    }

    const isActive = isToday && currentMins >= startMins && currentMins < endMins && !effectiveCancelled;
    const isPast = isToday && endMins <= currentMins;

    const teacherCode = (c.teacher || c.instructor || '').trim() || findInstructorForSubject(c.title);
    const teacherFullName = getFullName(teacherCode) || teacherCode || 'TBA';
    // Settings → Class cards → Teacher name: full name or the short code on the card
    const teacherShown = getPref('teacherName') === 'code' ? (teacherCode || 'TBA') : teacherFullName;
    const cleanRoom = isOnline ? 'Online' : formatRoom(c.room);

    const detailsData = {
      title: c.title,
      code: c.title,
      name: FULL_COURSE_NAMES[c.title] || c.title,
      start: format12h(c.start),
      end: hasExplicitEndTime ? format12h(c.end) : '',
      hasExplicitEndTime: hasExplicitEndTime,
      timing: fullTiming,
      duration: durationLabel,
      type: isLab ? 'Lab' : 'Theory',
      room: cleanRoom || 'TBA',
      instructor: teacherCode || 'TBA',
      teacher: teacherCode || 'TBA',
      instructorName: teacherFullName,
      isExam: isClassTest,
      examName: examName,
      examTopics: examTopics,
      isOnline: isOnline,
      onlinePlatform: onlinePlatform,
      isCancelled: effectiveCancelled,
      cancelReason: cancelReason,
      isRescheduled: !!c.isRescheduled,
      rescheduledReason: c.rescheduledReason || '',
      origDate: c.origDate || '',
      origStart: c.origStart || '',
      isLive: isActive,
      isPast: isPast,
      dayName: DAY_NAMES[State.currentViewDayIdx],
      dayIdx: State.currentViewDayIdx,
      semSec: c.semSec || '',
      semester: c.semester || Storage.getSemester(),
      section: (c.section || Storage.getSection() || '').toUpperCase(),
      isFromTimeline: true
    };

    const detailsJson = escapeHtml(JSON.stringify(detailsData));

    // Dynamic Card Styling Classes & Badges
    let cardModifierClass = '';
    let titleHtml = escapeHtml(c.title);
    let tagHtml = `<span class="resting-tag ${isLab ? 'lab' : 'theory'}">${isLab ? LAB_LABEL_HTML : 'THEORY'}</span>`;
    let subMetaHtml = '';

    if (c.isRescheduled) {
      cardModifierClass = 'is-rescheduled-override';
      tagHtml = `<span class="resting-tag rescheduled">RESCHEDULED</span>`;
      if (c.rescheduledReason) {
        subMetaHtml = `
          <div class="meta-line-item rescheduled-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${escapeHtml(c.rescheduledReason)}</span>
          </div>
        `;
      }
    } else if (c.isExtraClass) {
      if (isOnline) {
        cardModifierClass = 'is-online-override';
        tagHtml = `<span class="resting-tag online">ONLINE</span>`;
      } else {
        cardModifierClass = 'is-extra-override';
        tagHtml = `<span class="resting-tag extra">EXTRA CLASS</span>`;
      }
    } else if (isClassTest) {
      cardModifierClass = 'is-exam-override';
      titleHtml = `${escapeHtml(c.title)} <span class="override-indicator exam">(EXAM)</span>`;
      tagHtml = `<span class="resting-tag exam">${escapeHtml(examName.toUpperCase())}</span>`;
      if (examTopics) {
        subMetaHtml = `
          <div class="meta-line-item exam-topics">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>${escapeHtml(examTopics)}</span>
          </div>
        `;
      }
    } else if (isOnline) {
      cardModifierClass = 'is-online-override';
      tagHtml = `<span class="resting-tag online">ONLINE</span>`;
    } else if (effectiveCancelled) {
      cardModifierClass = isHolidayCancelled ? 'is-cancelled-override is-campus-closed' : 'is-cancelled-override';
      const reason = isHolidayCancelled ? '' : isCancelled
        ? (cancelOverride.announcement && cancelOverride.announcement.announcement) || ''
        : (holidayOverride && holidayOverride.announcement && holidayOverride.announcement.title) || '';
      if (reason) {
        subMetaHtml = `
          <div class="meta-line-item cancel-reason">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>${escapeHtml(reason)}</span>
          </div>
        `;
      }
    }

    // Back-to-back with the class above: drawn as one block (settings/prefs.css, "Group back-to-back classes")
    if (joinsPrev) cardModifierClass += ' joins-prev';

    // A community suggestion applied to the routine: say it is not confirmed yet
    const ovAnn = cancelOverride && cancelOverride.announcement;
    const isUnconfirmed = !!(c.isUnconfirmed || (ovAnn && ovAnn.is_unconfirmed) || (isHolidayCancelled && holidayOverride && holidayOverride.announcement && holidayOverride.announcement.is_unconfirmed));
    if (isUnconfirmed) titleHtml += ' <span class="override-indicator unconfirmed">(NOT CONFIRMED)</span>';

    // 1. Live Hero Card
    if (isActive) {
      const elapsed = currentMins - startMins;
      const remaining = Math.max(0, durationMins - elapsed);
      html += `
        <div class="resting-class-row is-live-card ${cardModifierClass}" onclick='window.openClassDetailSheet(${detailsJson})' style="border-color: var(--accent); background: var(--card-bg);">
          <div class="resting-left">
            <div class="resting-time-col ${hasExplicitEndTime ? '' : 'single-time'}">
              ${hasExplicitEndTime ? `
                <div class="time-connector-track">
                  <span class="time-node-dot start"></span>
                  <span class="time-connector-line"></span>
                  <span class="time-node-dot"></span>
                </div>
              ` : ''}
              <span class="resting-time-start" style="color: var(--accent);">${format12h(c.start)}</span>
              ${hasExplicitEndTime ? `<span class="resting-time-end">${format12h(c.end)}</span>` : ''}
            </div>
            <div class="resting-info-col">
              <div class="resting-title-row">
                <span class="resting-code">${titleHtml}</span>
                ${tagHtml}
              </div>
              <div class="card-meta-stacked">
                <div class="meta-line-item room">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>Room ${cleanRoom || 'TBA'}</span>
                </div>
                <div class="meta-line-item instructor">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>${escapeHtml(teacherShown)}</span>
                </div>
                ${subMetaHtml}
              </div>
            </div>
          </div>
          <div class="resting-right-meta">
            ${hasExplicitEndTime ? `
              <span class="finished-check-badge" style="background: var(--accent-subtle); color: var(--accent); border-color: var(--accent-border);">
                ${remaining}m left
              </span>
            ` : ''}
          </div>
          ${hasExplicitEndTime && durationMins > 0 ? `
            <span class="live-fill" role="progressbar" aria-label="Class progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(100, Math.max(0, (elapsed / durationMins) * 100)))}" style="--fill: ${(Math.min(100, Math.max(0, (elapsed / durationMins) * 100)) / 100).toFixed(4)}"><span class="live-fill-edge"></span></span>` : ''}
        </div>
      `;
    } else {
      // 2. Resting Class Row
      html += `
        <div class="resting-class-row ${cardModifierClass} ${effectiveCancelled ? 'cancelled' : ''}" onclick='window.openClassDetailSheet(${detailsJson})'>
          <div class="resting-left">
            <div class="resting-time-col ${hasExplicitEndTime ? '' : 'single-time'}">
              ${hasExplicitEndTime ? `
                <div class="time-connector-track">
                  <span class="time-node-dot start"></span>
                  <span class="time-connector-line"></span>
                  <span class="time-node-dot"></span>
                </div>
              ` : ''}
              <span class="resting-time-start">${format12h(c.start)}</span>
              ${hasExplicitEndTime ? `<span class="resting-time-end">${format12h(c.end)}</span>` : ''}
            </div>
            <div class="resting-info-col">
              <div class="resting-title-row">
                <span class="resting-code">${titleHtml}</span>
                ${tagHtml}
              </div>
              <div class="card-meta-stacked">
                <div class="meta-line-item room">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>Room ${cleanRoom || 'TBA'}</span>
                </div>
                <div class="meta-line-item instructor">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>${escapeHtml(teacherShown)}</span>
                </div>
                ${subMetaHtml}
              </div>
            </div>
          </div>
          <div class="resting-right-meta">
            ${!effectiveCancelled && isToday && startMins === nextStartM ? `
              <span class="finished-check-badge is-next">in ${fmtMins(startMins - currentMins)}</span>
            ` : effectiveCancelled ? `
              <span class="finished-check-badge cancelled">
                CANCELLED
              </span>
            ` : isPast ? `
              <span class="finished-check-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                DONE
              </span>
            ` : durationLabel ? `
              <span class="duration-chip">${durationLabel}</span>
            ` : ''}
          </div>
        </div>
      `;
    }
  });

  // All of today's classes are over: say so and point at the next class
  if (isToday && heldList.length && currentMins >= heldDayEnd) {
    const n = nextHeldClassAfter(new Date());
    html += `
      <div class="break-transition-strip day-done-strip${n ? ' tappable' : ''}"${n ? ` onclick="window.__switchTimelineDay(${n.date.getDay()}, ${n.date.getTime()})"` : ''}>
        <div class="break-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>
          <span>All done for today</span>
        </div>
        <span class="break-time-badge">${n ? `Next: ${escapeHtml(n.c.title)} · ${escapeHtml(relDay(n.date))} ${escapeHtml(format12h(n.c.start))}` : 'No classes this week'}</span>
      </div>
    `;
  }

  if (DOM.timelineGrid) {
    DOM.timelineGrid.innerHTML = holidayBanner + html;
    // The class above a joined card needs its bottom corners squared too
    DOM.timelineGrid.querySelectorAll('.resting-class-row.joins-prev').forEach(r => {
      const p = r.previousElementSibling;
      if (p && p.classList.contains('resting-class-row')) p.classList.add('joins-next');
      else r.classList.remove('joins-prev');
    });
  }
}

