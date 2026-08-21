import { State } from '../core/state.js';
import { DOM } from '../core/dom.js';
import { showToast } from '../toast/toast.js';

// Particles is imported lazily to avoid circular deps with modal importing particles
// and particles importing State. We store a reference set externally.
let _particles = null;
export function setParticlesRef(p) { _particles = p; }

export function openModal(modalEl, onOpen) {
  if (!modalEl) return;
  State.isModalOpen = true;
  if (_particles) _particles.stop();
  document.body.style.overflow = 'hidden';
  document.body.classList.add('modal-open');

  modalEl.classList.add('open');
  if (onOpen) onOpen();
}

export function closeModal(modalEl, onClose) {
  if (!modalEl) return;
  modalEl.classList.remove('open');
  if (modalEl === DOM.viewModal) modalEl.classList.remove('rotated-mode');

  const remainingOpenModals = document.querySelectorAll('.mo.open, .class-sheet-modal-overlay.open');
  if (remainingOpenModals.length === 0) {
    State.isModalOpen = false;
    if (_particles) _particles.start();
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
  }
  if (onClose) onClose();
}

export function showLoadingScreen(title = 'Loading Routine...', sub = 'Updating timetable schedule & section announcements') {
  const overlay = document.getElementById('globalLoadingOverlay');
  const titleEl = document.getElementById('globalLoadingTitle');
  const subEl = document.getElementById('globalLoadingSub');
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;
  if (overlay) overlay.classList.add('active');
}

export function hideLoadingScreen() {
  const overlay = document.getElementById('globalLoadingOverlay');
  if (overlay) overlay.classList.remove('active');
}

export function showConfirm(title, message, onOk, showPasswordInput = false, variant = 'danger') {
  const modal = DOM.confirmModal;
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  const okBtn = document.getElementById('confirmOkBtn');
  const pwdContainer = document.getElementById('confirmPasswordContainer');
  const pwdInput = document.getElementById('confirmPassword');
  const iconWrap = document.getElementById('confirmIconWrap');
  const iconSvg = document.getElementById('confirmIconSvg');

  if (!modal || !titleEl || !msgEl || !cancelBtn || !okBtn) return;

  titleEl.textContent = title;
  msgEl.textContent = message;

  // Variant-aware styling
  const isUnlock = variant === 'unlock';
  if (iconWrap) {
    iconWrap.classList.toggle('unlock', isUnlock);
  }
  if (okBtn) {
    okBtn.classList.toggle('unlock', isUnlock);
    okBtn.textContent = isUnlock ? 'Unlock' : 'Delete';
  }
  if (iconSvg) {
    iconSvg.innerHTML = isUnlock
      ? '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
      : '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
  }

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
