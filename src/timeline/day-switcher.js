import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { renderTimeline } from './timeline.js';

export function smoothSwitchDay(direction) {
  DOM.timelineGrid.style.opacity = '0';
  DOM.timelineGrid.style.transform = 'translateY(10px)';

  setTimeout(() => {
    const idx = CONFIG.activeDays.indexOf(State.currentViewDayIdx);
    if (direction === 'prev') {
      State.currentViewDayIdx = CONFIG.activeDays[(idx - 1 + CONFIG.activeDays.length) % CONFIG.activeDays.length];
    } else {
      State.currentViewDayIdx = CONFIG.activeDays[(idx + 1) % CONFIG.activeDays.length];
    }
    renderTimeline();
    DOM.timelineGrid.style.opacity = '1';
    DOM.timelineGrid.style.transform = 'translateY(0)';
  }, 200);
}

// Register day nav button listeners at module load
document.getElementById('prevDayBtn').addEventListener('click', () => smoothSwitchDay('prev'));
document.getElementById('nextDayBtn').addEventListener('click', () => smoothSwitchDay('next'));

// Register mobile touch swipe gestures on daily timeline container
let touchStartX = 0;
let touchStartY = 0;
DOM.timelineGrid.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

DOM.timelineGrid.addEventListener('touchend', e => {
  const diffX = e.changedTouches[0].clientX - touchStartX;
  const diffY = e.changedTouches[0].clientY - touchStartY;
  
  // Swipe is triggered if horizontal distance is > 80px and vertical scroll deviation is < 50px
  if (Math.abs(diffX) > 80 && Math.abs(diffY) < 50) {
    if (diffX > 0) {
      smoothSwitchDay('prev');
    } else {
      smoothSwitchDay('next');
    }
  }
});
