import { DOM } from '../core/dom.js';
import { CONFIG } from '../core/config.js';
import { showToast } from '../toast/toast.js';

export async function checkLiveUpdates() {
  // Only run if on a native platform where CapacitorUpdater is registered
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;

  const Updater = window.Capacitor.Plugins.CapacitorUpdater;
  if (!Updater) return;

  try {
    // 1. Get the currently active OTA version details
    const current = await Updater.current();
    
    // If an OTA update is running, current.version is the running OTA version string.
    // Otherwise, it falls back to the static CONFIG.version compiled inside the asset folder.
    const runningVersion = (current && current.version && current.version !== 'builtin') 
      ? current.version 
      : (CONFIG.version || '1.0.0');

    // 2. Fetch the latest release version metadata from remote hosting
    const response = await fetch('https://sid954.github.io/RoutineAPP/version.json?t=' + Date.now());
    if (!response.ok) return;
    const remote = await response.json();

    // 3. Compare local running version against remote target version
    if (remote.version !== runningVersion) {
      showToast('Downloading new app version...', 'info');

      // 4. Download the compiled web assets zip package
      const downloadResult = await Updater.download({
        url: remote.url,
        version: remote.version,
      });

      // 5. Success! Notify the user and show a RELOAD button on the toast
      showToast('Update ready! Tap to reload', 'success', async () => {
        try {
          await Updater.set({ id: downloadResult.version });
        } catch (err) {
          console.error('Failed to set updater version:', err);
          showToast('Failed to apply update', 'error');
        }
      });
      DOM.undoBtn.textContent = 'RELOAD';
    }
  } catch (e) {
    console.warn('Live Update check failed (offline or connection issue):', e);
  }
}
