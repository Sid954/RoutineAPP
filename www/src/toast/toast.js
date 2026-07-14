import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';

export function showToast(message, type = 'info', undoCb = null) {
  DOM.toast.querySelector('.msg').textContent = message;

  // Clear previous type classes
  DOM.toast.className = 'toast';
  if (type) DOM.toast.classList.add(`toast-${type}`);

  if (undoCb) {
    DOM.undoBtn.textContent = 'UNDO';
    DOM.undoBtn.style.display = 'inline-block';
    State.undoCallback = undoCb;
  } else {
    DOM.undoBtn.style.display = 'none';
    State.undoCallback = null;
  }

  DOM.toast.classList.add('show');
  clearTimeout(State.toastTimer);
  State.toastTimer = setTimeout(() => { DOM.toast.classList.remove('show'); State.undoCallback = null; }, 5000);
}

// Register undo button listener (call once at module load)
DOM.undoBtn.addEventListener('click', () => {
  if (State.undoCallback) { State.undoCallback(); State.undoCallback = null; DOM.toast.classList.remove('show'); }
});
