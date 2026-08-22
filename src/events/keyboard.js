import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { closeModal } from '../modals/modal.js';

export function initKeyboard() {
  document.addEventListener('keydown', e => {
    // Don't trigger if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape') {
      if (DOM.notifModal && DOM.notifModal.classList.contains('open')) closeModal(DOM.notifModal);
      else if (DOM.editModal && DOM.editModal.classList.contains('open')) closeModal(DOM.editModal);
      else if (DOM.viewModal && DOM.viewModal.classList.contains('open')) closeModal(DOM.viewModal);
      else if (DOM.classDetailModal && DOM.classDetailModal.classList.contains('open')) closeModal(DOM.classDetailModal);
      else if (DOM.confirmModal && DOM.confirmModal.classList.contains('open')) closeModal(DOM.confirmModal);
      else if (window.__currentAppViewId && window.__currentAppViewId !== 'home') {
        if (window.__currentAppViewId === 'post_announcement') {
          if (window.switchAppView) window.switchAppView('announcements');
        } else {
          if (window.switchAppView) window.switchAppView('home');
        }
      }
    }
    if (e.key === 'e' || e.key === 'E') {
      if (!State.isModalOpen) document.getElementById('editBtn').click();
    }
    if (e.key === 'v' || e.key === 'V') {
      if (!State.isModalOpen) document.getElementById('vrB').click();
    }
  });
}
