import { State } from '../core/state.js';
import { Particles } from '../particles/particles.js';
import { DOM } from '../core/dom.js';
import { renderWeeklyMatrix } from '../weekly-matrix/matrix.js';

export function initResize() {
  window.addEventListener('resize', () => {
    clearTimeout(State.resizeTimer);
    State.resizeTimer = setTimeout(() => {
      Particles.init();
      if (DOM.viewModal.classList.contains('open')) renderWeeklyMatrix();
    }, 200);
  });
}
