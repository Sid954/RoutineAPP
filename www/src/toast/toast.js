import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';

const toastQueue = [];
let isToastShowing = false;

export function showToast(message, type = 'info', undoCb = null) {
  toastQueue.push({ message, type, undoCb });
  processQueue();
}

function processQueue() {
  if (isToastShowing || toastQueue.length === 0) return;

  isToastShowing = true;
  const current = toastQueue.shift();

  DOM.toast.querySelector('.msg').textContent = current.message;

  // Clear previous type classes
  DOM.toast.className = 'toast';
  if (current.type) DOM.toast.classList.add(`toast-${current.type}`);

  if (current.undoCb) {
    DOM.undoBtn.textContent = 'UNDO';
    DOM.undoBtn.style.display = 'inline-block';
    State.undoCallback = current.undoCb;
  } else {
    DOM.undoBtn.style.display = 'none';
    State.undoCallback = null;
  }

  DOM.toast.classList.add('show');
  clearTimeout(State.toastTimer);
  State.toastTimer = setTimeout(() => {
    DOM.toast.classList.remove('show');
    State.undoCallback = null;
    
    // Wait for fade-out transition to complete before showing next toast
    setTimeout(() => {
      isToastShowing = false;
      processQueue();
    }, 400);
  }, 4000);
}

// Register undo button listener (call once at module load)
DOM.undoBtn.addEventListener('click', () => {
  if (State.undoCallback) {
    State.undoCallback();
    State.undoCallback = null;
    DOM.toast.classList.remove('show');
    clearTimeout(State.toastTimer);
    setTimeout(() => {
      isToastShowing = false;
      processQueue();
    }, 400);
  }
});
