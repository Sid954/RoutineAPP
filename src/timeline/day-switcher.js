import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { renderTimeline } from './timeline.js';

// Active Academic Days (Sat=6, Sun=0, Mon=1, Tue=2, Wed=3) — Skips Thursday & Friday
function getNextActiveDay(currentDay) {
  const activeDays = CONFIG.activeDays;
  if (currentDay === 4 || currentDay === 5) return 6; // From off-day -> Saturday
  const idx = activeDays.indexOf(currentDay);
  if (idx === -1) return 6;
  return activeDays[(idx + 1) % activeDays.length];
}

function getPrevActiveDay(currentDay) {
  const activeDays = CONFIG.activeDays;
  if (currentDay === 4 || currentDay === 5) return 3; // From off-day -> Wednesday
  const idx = activeDays.indexOf(currentDay);
  if (idx === -1) return 3;
  return activeDays[(idx - 1 + activeDays.length) % activeDays.length];
}

function calculateTargetDate(targetDayIdx) {
  const anchorDate = State.viewDate || new Date();
  const anchorDayIdx = anchorDate.getDay();
  const satOffset = (anchorDayIdx === 6) ? 0 : (anchorDayIdx + 1);
  const weekStartSat = new Date(anchorDate);
  weekStartSat.setDate(anchorDate.getDate() - satOffset);

  const dayOffset = (targetDayIdx === 6) ? 0 : (targetDayIdx + 1);
  const targetDate = new Date(weekStartSat);
  targetDate.setDate(weekStartSat.getDate() + dayOffset);
  return targetDate;
}

export function smoothSwitchDay(direction) {
  const container = DOM.timelineGrid;
  if (!container) return;

  const nextIdx = direction === 'prev'
    ? getPrevActiveDay(State.currentViewDayIdx)
    : getNextActiveDay(State.currentViewDayIdx);

  const isNext = direction === 'next';
  const exitX = isNext ? -180 : 180;
  const entryX = isNext ? 180 : -180;

  container.classList.remove('swiping', 'swipe-snap-back');
  container.classList.add('swipe-transition');
  container.style.transform = `translateX(${exitX}px) scale(0.97)`;
  container.style.opacity = '0';

  setTimeout(() => {
    State.currentViewDayIdx = nextIdx;
    State.viewDate = calculateTargetDate(nextIdx);
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

// Android Native-Physics Touch Swipe Gesture System
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isDragging = false;
let dragTargetDayIdx = -1;

const container = DOM.timelineGrid;
if (container) {
  // Touch Start
  container.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = performance.now();
    isDragging = false;
    dragTargetDayIdx = -1;
  }, { passive: true });

  // Touch Move (Real-time finger tracking with dynamic dampening)
  container.addEventListener('touchmove', e => {
    if (e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX;
    const deltaY = currentY - touchStartY;

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

      if (deltaX < 0) {
        // Finger moved Left -> Target is Next Active Day (skipping Thu & Fri)
        dragTargetDayIdx = getNextActiveDay(State.currentViewDayIdx);
      } else if (deltaX > 0) {
        // Finger moved Right -> Target is Previous Active Day (skipping Thu & Fri)
        dragTargetDayIdx = getPrevActiveDay(State.currentViewDayIdx);
      }
    }
  }, { passive: true });

  // Touch End (Fling velocity or threshold release)
  container.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    container.classList.remove('swiping');

    const endX = e.changedTouches[0].clientX;
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
        State.viewDate = calculateTargetDate(dragTargetDayIdx);
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
      // Elastic snap-back to origin with spring curve
      container.classList.add('swipe-snap-back');
      container.style.transform = 'translateX(0) scale(1)';
      container.style.opacity = '1';
      setTimeout(() => {
        container.classList.remove('swipe-snap-back');
        container.style.transform = '';
        container.style.opacity = '';
      }, 280);
    }
  });

  // Touch Cancel (Snap back if interrupted)
  container.addEventListener('touchcancel', () => {
    if (!isDragging) return;
    isDragging = false;
    container.classList.remove('swiping');
    container.classList.add('swipe-snap-back');
    container.style.transform = 'translateX(0) scale(1)';
    container.style.opacity = '1';
    setTimeout(() => {
      container.classList.remove('swipe-snap-back');
      container.style.transform = '';
      container.style.opacity = '';
    }, 280);
  });
}
