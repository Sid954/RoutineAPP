import { showToast } from '../toast/toast.js';
import { DOM } from '../core/dom.js';

export function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('New update available!', 'info', () => {
              newWorker.postMessage({ action: 'skipWaiting' });
              window.location.reload();
            });
            DOM.undoBtn.textContent = 'RELOAD';
          }
        });
      });
    }).catch(() => {});

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}
