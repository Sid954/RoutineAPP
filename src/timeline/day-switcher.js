import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { renderTimeline } from './timeline.js';
import { bindMouseDrag, bindWheelSwipe } from '../core/desktop-input.js';
import { shouldHideDay } from '../core/off-days.js';
import { getPref } from '../settings/prefs.js';
import { getOverridesByDateMap } from '../announcements/overrides.js';

/**
 * The date a swipe lands on: step one day at a time from the viewed date, skipping exactly the
 * days the week strip hides (off days with nothing on). So Friday 20th shows up in the swipe order
 * when it has a class or an announcement, and is skipped when it is a plain day off.
 */
function nextShownDate(direction) {
  const anchor = State.viewDate || new Date();
  const today = new Date();
  const overridesMap = getOverridesByDateMap();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + (direction === 'prev' ? -i : i));
    const isToday = d.toDateString() === today.toDateString();
    if (!shouldHideDay(d, { isToday, overridesMap })) return d;
  }
  return new Date(anchor);
}

export function smoothSwitchDay(direction) {
  const container = DOM.timelineGrid;
  if (!container) return;

  const nextDate = nextShownDate(direction);
  const nextIdx = nextDate.getDay();

  const isNext = direction === 'next';
  const exitX = isNext ? -180 : 180;
  const entryX = isNext ? 180 : -180;

  container.classList.remove('swiping', 'swipe-snap-back');
  container.classList.add('swipe-transition');
  container.style.transform = `translateX(${exitX}px) scale(0.97)`;
  container.style.opacity = '0';

  setTimeout(() => {
    State.currentViewDayIdx = nextIdx;
    State.viewDate = nextDate;
    renderTimeline(true);

    container.classList.remove('swipe-transition');
    container.style.transform = `translateX(${entryX}px) scale(0.97)`;
    container.style.opacity = '0';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.classList.add('swipe-transition');
        container.style.transform = 'translateX(0) scale(1)';
        container.style.opacity = '1';
        setTimeout(() => {
          container.classList.remove('swipe-transition');
          container.style.transform = '';
          container.style.opacity = '';
        }, 250);
      });
    });
  }, 140);
}

// Register day nav button listeners
const prevBtn = document.getElementById('prevDayBtn');
const nextBtn = document.getElementById('nextDayBtn');
if (prevBtn) prevBtn.addEventListener('click', () => smoothSwitchDay('prev'));
if (nextBtn) nextBtn.addEventListener('click', () => smoothSwitchDay('next'));

// Day swipe on the Home timeline: touch, mouse drag (desktop-input.js) and trackpad swipes share one core.
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isDragging = false;
let dragTargetDayIdx = -1;
let dragTargetDate = null;
let dragDir = 0; // -1 next, 1 prev: the target day is looked up once per direction, not on every touchmove
let swipeAllowed = true;

const container = DOM.timelineGrid;

function swipeStart(x, y) {
  swipeAllowed = getPref('swipe') !== 'off'; // Settings → Gestures → Swipe between days
  touchStartX = x;
  touchStartY = y;
  touchStartTime = performance.now();
  isDragging = false;
  dragTargetDayIdx = -1;
  dragTargetDate = null;
  dragDir = 0;
}

function swipeMove(x, y) {
  if (!swipeAllowed) return;
  const deltaX = x - touchStartX;
  const deltaY = y - touchStartY;

  if (!isDragging) {
    // Prioritize horizontal swipe over vertical scroll once past 8px deadband
    if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      isDragging = true;
      container.classList.remove('swipe-transition', 'swipe-snap-back');
      container.classList.add('swiping');
    }
  }

  if (isDragging) {
    // Elastic rubber-band resistance curve
    const resistance = 0.72;
    const draggedX = deltaX * resistance;
    const progress = Math.min(1, Math.abs(draggedX) / 220);
    const opacity = Math.max(0.35, 1 - progress * 0.65);
    const scale = Math.max(0.965, 1 - progress * 0.035);

    container.style.transform = `translateX(${draggedX}px) scale(${scale})`;
    container.style.opacity = opacity.toFixed(2);

    // nextShownDate() rebuilds the overrides map and walks up to 14 dates: only when the direction changes
    const dir = deltaX < 0 ? -1 : (deltaX > 0 ? 1 : 0);
    if (dir && dir !== dragDir) {
      dragDir = dir;
      dragTargetDate = nextShownDate(dir < 0 ? 'next' : 'prev'); // left -> next shown day, right -> previous
      dragTargetDayIdx = dragTargetDate.getDay();
    }
  }
}

function snapBack() {
  container.classList.add('swipe-snap-back');
  container.style.transform = 'translateX(0) scale(1)';
  container.style.opacity = '1';
  setTimeout(() => {
    container.classList.remove('swipe-snap-back');
    container.style.transform = '';
    container.style.opacity = '';
  }, 280);
}

function swipeEnd(endX) {
  if (!isDragging) return;
  isDragging = false;
  container.classList.remove('swiping');

  const deltaX = endX - touchStartX;
  const deltaTime = Math.max(1, performance.now() - touchStartTime);
  const velocity = Math.abs(deltaX) / deltaTime; // px/ms

  // Trigger switch if dragged > 45px or swiped with high flick velocity (> 0.35 px/ms)
  const shouldSwitch = (Math.abs(deltaX) > 45 || velocity > 0.35) && dragTargetDayIdx !== -1;

  if (shouldSwitch) {
    const isSwipingLeft = deltaX < 0;
    const exitX = isSwipingLeft ? -220 : 220;
    const entryX = isSwipingLeft ? 220 : -220;

    container.classList.add('swipe-transition');
    container.style.transform = `translateX(${exitX}px) scale(0.96)`;
    container.style.opacity = '0';

    setTimeout(() => {
      State.currentViewDayIdx = dragTargetDayIdx;
      State.viewDate = dragTargetDate;
      renderTimeline(true);

      container.classList.remove('swipe-transition');
      container.style.transform = `translateX(${entryX}px) scale(0.96)`;
      container.style.opacity = '0';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.classList.add('swipe-transition');
          container.style.transform = 'translateX(0) scale(1)';
          container.style.opacity = '1';

          setTimeout(() => {
            container.classList.remove('swipe-transition');
            container.style.transform = '';
            container.style.opacity = '';
          }, 250);
        });
      });
    }, 130);
  } else {
    snapBack();
  }
}

function swipeCancel() {
  if (!isDragging) return;
  isDragging = false;
  container.classList.remove('swiping');
  snapBack();
}

if (container) {
  container.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    swipeStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  container.addEventListener('touchmove', e => {
    if (e.touches.length !== 1) return;
    swipeMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  container.addEventListener('touchend', e => swipeEnd(e.changedTouches[0].clientX));
  container.addEventListener('touchcancel', swipeCancel);

  // Desktop: drag with the mouse, or swipe sideways on a trackpad
  bindMouseDrag(container, {
    start: (x, y) => { swipeStart(x, y); },
    move: (x, y) => swipeMove(x, y),
    end: (x, y, ev) => (ev ? swipeEnd(x) : swipeCancel())
  });
  bindWheelSwipe(container, dir => { if (getPref('swipe') !== 'off') smoothSwitchDay(dir); });
}
