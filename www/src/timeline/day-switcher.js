import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { renderTimeline } from './timeline.js';

export function smoothSwitchDay(direction) {
  const container = DOM.timelineGrid;
  if (!container) return;

  const idx = CONFIG.activeDays.indexOf(State.currentViewDayIdx);
  const nextIdx = direction === 'prev'
    ? CONFIG.activeDays[(idx - 1 + CONFIG.activeDays.length) % CONFIG.activeDays.length]
    : CONFIG.activeDays[(idx + 1) % CONFIG.activeDays.length];

  // direction 'next' = going forward (swiping left): exit left (-350px), enter from right (350px -> 0)
  // direction 'prev' = going back (swiping right): exit right (350px), enter from left (-350px -> 0)
  const isNext = direction === 'next';
  const exitX = isNext ? -350 : 350;
  const entryX = isNext ? 350 : -350;

  container.classList.add('swipe-transition');
  container.style.transform = `translateX(${exitX}px)`;
  container.style.opacity = '0';

  setTimeout(() => {
    State.currentViewDayIdx = nextIdx;
    renderTimeline();

    container.classList.remove('swipe-transition');
    container.style.transform = `translateX(${entryX}px)`;
    container.style.opacity = '0';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.classList.add('swipe-transition');
        container.style.transform = 'translateX(0)';
        container.style.opacity = '1';
        setTimeout(() => {
          container.classList.remove('swipe-transition');
        }, 240);
      });
    });
  }, 160);
}

// Register day nav button listeners at module load
const prevBtn = document.getElementById('prevDayBtn');
const nextBtn = document.getElementById('nextDayBtn');
if (prevBtn) prevBtn.addEventListener('click', () => smoothSwitchDay('prev'));
if (nextBtn) nextBtn.addEventListener('click', () => smoothSwitchDay('next'));

// Register real-time interactive touch swipe gestures with nav button feedback
let touchStartX = 0;
let touchStartY = 0;
let isDragging = false;
let dragTargetDayIdx = -1;

if (DOM.timelineGrid) {
  const container = DOM.timelineGrid;

  container.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDragging = false;
    dragTargetDayIdx = -1;
  }, { passive: true });

  container.addEventListener('touchmove', e => {
    if (e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX;
    const deltaY = currentY - touchStartY;

    if (!isDragging) {
      if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) {
        isDragging = true;
        container.classList.add('swiping');
      }
    }

    if (isDragging) {
      const resistance = 0.75;
      const draggedX = deltaX * resistance;
      const opacity = Math.max(0.3, 1 - Math.abs(draggedX) / 320);

      container.style.transform = `translateX(${draggedX}px)`;
      container.style.opacity = opacity.toFixed(2);

      const activeIdx = CONFIG.activeDays.indexOf(State.currentViewDayIdx);
      const pBtn = document.getElementById('prevDayBtn');
      const nBtn = document.getElementById('nextDayBtn');

      if (deltaX < 0) {
        // Swiping Right-to-Left (Finger moves left) -> Target is Next Day
        dragTargetDayIdx = CONFIG.activeDays[(activeIdx + 1) % CONFIG.activeDays.length];
        if (nBtn) nBtn.classList.add('swipe-active');
        if (pBtn) pBtn.classList.remove('swipe-active');
      } else if (deltaX > 0) {
        // Swiping Left-to-Right (Finger moves right) -> Target is Previous Day
        dragTargetDayIdx = CONFIG.activeDays[(activeIdx - 1 + CONFIG.activeDays.length) % CONFIG.activeDays.length];
        if (pBtn) pBtn.classList.add('swipe-active');
        if (nBtn) nBtn.classList.remove('swipe-active');
      }
    }
  }, { passive: true });

  container.addEventListener('touchend', e => {
    const pBtn = document.getElementById('prevDayBtn');
    const nBtn = document.getElementById('nextDayBtn');
    if (pBtn) pBtn.classList.remove('swipe-active');
    if (nBtn) nBtn.classList.remove('swipe-active');

    if (!isDragging) return;
    isDragging = false;

    const endX = e.changedTouches[0].clientX;
    const deltaX = endX - touchStartX;
    container.classList.remove('swiping');

    if (Math.abs(deltaX) > 60 && dragTargetDayIdx !== -1) {
      const isSwipingLeft = deltaX < 0; // Finger moved Right to Left
      container.classList.add('swipe-transition');

      // Exit direction: if swiping left, exit to LEFT (-350px); if swiping right, exit to RIGHT (350px)
      const exitX = isSwipingLeft ? -350 : 350;
      container.style.transform = `translateX(${exitX}px)`;
      container.style.opacity = '0';

      setTimeout(() => {
        State.currentViewDayIdx = dragTargetDayIdx;
        renderTimeline();

        // Entry direction: if swiped left, enter FROM THE RIGHT (350px) and slide left to 0
        // If swiped right, enter FROM THE LEFT (-350px) and slide right to 0
        const entryX = isSwipingLeft ? 350 : -350;
        container.classList.remove('swipe-transition');
        container.style.transform = `translateX(${entryX}px)`;
        container.style.opacity = '0';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            container.classList.add('swipe-transition');
            container.style.transform = 'translateX(0)';
            container.style.opacity = '1';

            setTimeout(() => {
              container.classList.remove('swipe-transition');
            }, 240);
          });
        });
      }, 160);
    } else {
      // Snap back smoothly to center if drag threshold not met
      container.classList.add('swipe-transition');
      container.style.transform = 'translateX(0)';
      container.style.opacity = '1';
      setTimeout(() => {
        container.classList.remove('swipe-transition');
      }, 220);
    }
  });
}
