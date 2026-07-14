import { State } from '../core/state.js';
import { DOM } from '../core/dom.js';

// Particles is imported lazily to avoid circular deps with modal importing particles
// and particles importing State. We store a reference set externally.
let _particles = null;
export function setParticlesRef(p) { _particles = p; }

export function openModal(modalEl, onOpen) {
  State.isModalOpen = true;
  if (_particles) _particles.stop();
  document.body.style.overflow = 'hidden';
  modalEl.classList.add('open');
  if (onOpen) onOpen();
}

export function closeModal(modalEl, onClose) {
  State.isModalOpen = false;
  if (_particles) _particles.start();
  document.body.style.overflow = '';
  modalEl.classList.remove('open');
  if (modalEl === DOM.viewModal) modalEl.classList.remove('rotated-mode');
  if (onClose) onClose();
}
