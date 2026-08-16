import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { closeModal } from '../modals/modal.js';

export function initKeyboard() {
  document.addEventListener('keydown', e => {
    // Don't trigger if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape') {
      // Close the topmost open modal
      if (DOM.announceModal && DOM.announceModal.classList.contains('open')) {
        closeModal(DOM.announceModal);
        if (window.Announcements && window.Announcements.markAsRead) window.Announcements.markAsRead();
      } else if (DOM.notifModal.classList.contains('open')) closeModal(DOM.notifModal);
      else if (DOM.editModal.classList.contains('open')) closeModal(DOM.editModal);
      else if (DOM.viewModal.classList.contains('open')) closeModal(DOM.viewModal);
    }
    if (e.key === 'e' || e.key === 'E') {
      if (!State.isModalOpen) document.getElementById('editBtn').click();
    }
    if (e.key === 'v' || e.key === 'V') {
      if (!State.isModalOpen) document.getElementById('vrB').click();
    }
  });
}
