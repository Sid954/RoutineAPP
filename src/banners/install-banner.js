import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { showToast } from '../toast/toast.js';
import { Notifications } from '../notifications/notifications.js';

export function initInstallBanner() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    State.deferredInstallPrompt = e;
    if (!Storage.isBannerDismissed(Storage.INSTALL_DISMISS_KEY)) {
      DOM.installBanner.classList.add('show');
    }
  });

  document.getElementById('installBtn').addEventListener('click', async () => {
    if (!State.deferredInstallPrompt) return;
    State.deferredInstallPrompt.prompt();
    const { outcome } = await State.deferredInstallPrompt.userChoice;
    State.deferredInstallPrompt = null;
    DOM.installBanner.classList.remove('show');
    if (outcome === 'accepted') showToast('App installed!', 'success');
  });

  document.getElementById('installDismiss').addEventListener('click', () => {
    DOM.installBanner.classList.remove('show');
    Storage.dismissBanner(Storage.INSTALL_DISMISS_KEY);
  });
}
