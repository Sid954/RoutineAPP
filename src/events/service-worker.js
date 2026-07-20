import { showToast } from '../toast/toast.js';
import { DOM } from '../core/dom.js';

function showUpdateNotification(worker) {
  showToast('New update available!', 'info', () => {
    worker.postMessage({ action: 'skipWaiting' });
    window.location.reload();
  });
  DOM.undoBtn.textContent = 'RELOAD';
}

export function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // Prompt immediately if an update is already downloaded and waiting
      if (reg.waiting) {
        showUpdateNotification(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateNotification(newWorker);
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
