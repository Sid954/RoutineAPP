import { showLoadingScreen } from '../modals/modal.js';
import { State } from '../core/state.js';

export function initPullToRefresh() {
  const indicator = document.getElementById('ptrIndicator');
  const icon = document.getElementById('ptrIcon');

  if (!indicator || !icon) return;

  let startY = 0;
  let currentY = 0;
  let isPulling = false;
  const THRESHOLD = 70;

  function onStart(e) {
    if (window.scrollY > 5 || State.isModalOpen) return;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    isPulling = true;
  }

  function onMove(e) {
    if (!isPulling || State.isModalOpen) return;
    currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = currentY - startY;

    if (dy > 0 && window.scrollY === 0) {
      const pullDistance = Math.min(90, Math.pow(dy, 0.85));
      indicator.style.top = `${pullDistance - 45}px`;
      indicator.style.opacity = `${Math.min(1, pullDistance / 40)}`;

      // Dynamic rotation as pulled down (like Facebook/Instagram app)
      const rotation = Math.min(360, pullDistance * 5);
      icon.style.transform = `rotate(${rotation}deg)`;

      if (pullDistance >= THRESHOLD) {
        indicator.style.borderColor = 'var(--accent)';
      } else {
        indicator.style.borderColor = 'var(--border)';
      }
    }
  }

  function onEnd() {
    if (!isPulling) return;
    isPulling = false;

    const dy = currentY - startY;
    const pullDistance = Math.min(90, Math.pow(dy, 0.85));

    if (pullDistance >= THRESHOLD && window.scrollY === 0 && !State.isModalOpen) {
      indicator.style.top = '16px';
      indicator.style.opacity = '1';
      icon.classList.add('ptr-spin');

      showLoadingScreen('Refreshing Routine...', 'Updating timetable schedule & section announcements');

      setTimeout(() => {
        window.location.reload();
      }, 400);
    } else {
      indicator.style.top = '-50px';
      indicator.style.opacity = '0';
      icon.classList.remove('ptr-spin');
      icon.style.transform = 'rotate(0deg)';
    }

    startY = 0;
    currentY = 0;
  }

  // Touch Events for Mobile / Android App
  window.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onEnd);

  // Mouse Events for Desktop Testing
  window.addEventListener('mousedown', e => {
    if (e.target.closest('.mo, button, select, input, textarea, a')) return;
    onStart(e);
  });
  window.addEventListener('mousemove', e => {
    if (isPulling) onMove(e);
  });
  window.addEventListener('mouseup', onEnd);
}
