import { State } from '../core/state.js';
import { DOM } from '../core/dom.js';
import { showToast } from '../toast/toast.js';

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

export function showConfirm(title, message, onOk, showPasswordInput = false) {
  const modal = DOM.confirmModal;
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  const okBtn = document.getElementById('confirmOkBtn');
  const pwdContainer = document.getElementById('confirmPasswordContainer');
  const pwdInput = document.getElementById('confirmPassword');
  
  if (!modal || !titleEl || !msgEl || !cancelBtn || !okBtn) return;
  
  titleEl.textContent = title;
  msgEl.textContent = message;
  
  if (pwdContainer) {
    pwdContainer.style.display = showPasswordInput ? 'block' : 'none';
  }
  if (pwdInput) {
    pwdInput.value = '';
    if (showPasswordInput) {
      setTimeout(() => pwdInput.focus(), 150);
    }
  }
  
  const handleCancel = () => {
    closeModal(modal);
    cleanup();
  };
  
  const handleOk = () => {
    let pwdVal = '';
    if (showPasswordInput && pwdInput) {
      pwdVal = pwdInput.value.trim();
      if (!pwdVal) {
        showToast('Password is required.', 'warning');
        return;
      }
    }
    closeModal(modal);
    cleanup();
    if (onOk) onOk(pwdVal);
  };
  
  const cleanup = () => {
    cancelBtn.removeEventListener('click', handleCancel);
    okBtn.removeEventListener('click', handleOk);
  };
  
  cancelBtn.addEventListener('click', handleCancel);
  okBtn.addEventListener('click', handleOk);
  
  openModal(modal);
}
