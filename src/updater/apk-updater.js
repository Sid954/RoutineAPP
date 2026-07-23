import { CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { escapeHtml } from '../core/utils.js';
import { showToast } from '../toast/toast.js';
import { forceUpdate } from '../dashboard/update.js';
import { normalizeSchedule } from '../schedule/normalizer.js';
import { Notifications } from '../notifications/notifications.js';

export function getRemoteBaseUrl() {
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    return CONFIG.remoteAppUrl || 'https://sid954.github.io/RoutineAPP';
  }
  return '.';
}

export async function getActiveCacheVersion() {
  const syncedVersion = localStorage.getItem('active_app_cache_version');
  if (syncedVersion) return syncedVersion;

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      const routineKey = keys.find(k => k.startsWith('routine-cache-'));
      if (routineKey) return routineKey;
    }
  } catch (e) {}
  return 'routine-cache-active';
}

/**
 * Unified Update Checker — inspects both Native APK Releases and Web/Schedule OTA Cache updates.
 */
export async function performUnifiedUpdateCheck(containerEl = null, isManual = false) {
  const remoteBase = getRemoteBaseUrl();
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

  if (containerEl) {
    containerEl.style.display = 'block';
    containerEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--accent2);">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent);"></span>
        <span>Checking for updates...</span>
      </div>
      <div style="margin-top: 6px; font-family: var(--m); font-size: 11px; color: var(--dim); display: flex; flex-direction: column; gap: 3px;">
        <div>• Checking native APK version manifest (version.json)...</div>
        <div>• Inspecting web build cache version (sw.js)...</div>
        <div>• Validating remote schedule & config assets...</div>
      </div>
    `;
  }

  if (isManual) showToast('Checking for updates...', 'info');

  const currentCacheVersion = await getActiveCacheVersion();
  const localVersionCode = CONFIG.appVersionCode || 1;

  if (!navigator.onLine) {
    if (containerEl) {
      containerEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; color: var(--amber); font-weight: 800; margin-bottom: 6px;">
          <span>⚠️ Offline Mode</span>
        </div>
        <div style="font-family: var(--m); font-size: 11px; color: var(--dim); display: flex; flex-direction: column; gap: 4px;">
          <div>• App Version: <span style="color: var(--text);">v${CONFIG.appVersionName || '1.0.0'} (Code ${localVersionCode})</span></div>
          <div>• Cache Version: <span style="color: var(--text);">${currentCacheVersion}</span></div>
          <div>• Connection: <span style="color: var(--amber);">No internet connection</span></div>
        </div>
      `;
    }
    if (isManual) showToast('Offline — cannot check remote server.', 'warning');
    return null;
  }

  try {
    // 1. Check Service Worker waiting worker
    let swWaitingWorker = null;
    if ('serviceWorker' in navigator) {
      try {
        const reg = await Promise.race([
          navigator.serviceWorker.getRegistration(),
          new Promise(resolve => setTimeout(() => resolve(null), 1500))
        ]);
        if (reg) {
          const updatedReg = await reg.update().catch(() => null);
          const activeReg = updatedReg || reg;
          if (activeReg && (activeReg.waiting || activeReg.installing)) {
            swWaitingWorker = activeReg.waiting || activeReg.installing;
          }
        }
      } catch (swErr) {}
    }

    // 2. Fetch version.json for APK updates
    let apkUpdateAvailable = false;
    let apkVersionData = null;
    try {
      const verRes = await fetch(`${remoteBase}/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (verRes.ok) {
        apkVersionData = await verRes.json();
        if (apkVersionData.versionCode && apkVersionData.versionCode > localVersionCode) {
          apkUpdateAvailable = true;
        }
      }
    } catch (verErr) {
      console.warn('version.json fetch warning:', verErr);
    }

    // 3. Fetch sw.js for Web/Cache updates
    let remoteCacheVersion = currentCacheVersion;
    try {
      const swRes = await fetch(`${remoteBase}/sw.js?t=${Date.now()}`, { cache: 'no-store' });
      if (swRes.ok) {
        const swText = await swRes.text();
        const match = swText.match(/const CACHE_VERSION = '([^']+)'/);
        if (match && match[1]) {
          remoteCacheVersion = match[1];
        }
      }
    } catch (swFetchErr) {}

    // 4. Fetch schedule.json validation
    const schedRes = await fetch(`${remoteBase}/schedule.json?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
    const isSchedOk = schedRes && schedRes.ok;

    const cacheUpdateAvailable = (remoteCacheVersion !== currentCacheVersion) || !!swWaitingWorker;

    // Render Results in Container if present
    if (containerEl) {
      if (apkUpdateAvailable || cacheUpdateAvailable) {
        let html = `
          <div style="border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 6px; color: var(--lime); font-weight: 800; font-size: 13px;">
              <span>🎉 Update Found!</span>
            </div>
          </div>
        `;

        if (apkUpdateAvailable) {
          const downloadTargetUrl = apkVersionData.apkUrl || apkVersionData.downloadUrl || 'https://github.com/sid954/RoutineAPP/releases';
          html += `
            <div style="background: rgba(56, 189, 248, 0.08); border: 1px dashed var(--accent); border-radius: var(--rx); padding: 10px 12px; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                <div>
                  <div style="font-weight: 800; color: #fff; font-size: 12px;">📱 New Android APK v${escapeHtml(apkVersionData.versionName || '1.1.0')}</div>
                  <div style="font-size: 10.5px; color: var(--dim); margin-top: 2px;">${escapeHtml(apkVersionData.releaseNotes || 'New native features & updates')}</div>
                </div>
                <button id="downloadApkBtn" style="background: linear-gradient(135deg, var(--accent), var(--pink)); color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 11.5px; cursor: pointer; font-family: var(--f); white-space: nowrap;">
                  📥 Download APK
                </button>
              </div>
            </div>
          `;
        }

        if (cacheUpdateAvailable) {
          html += `
            <div style="background: rgba(16, 185, 129, 0.08); border: 1px dashed var(--lime); border-radius: var(--rx); padding: 10px 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                <div>
                  <div style="font-weight: 800; color: #fff; font-size: 12px;">⚡ Schedule & Web Asset Update</div>
                  <div style="font-size: 10.5px; color: var(--dim); margin-top: 2px;">New Version: <span style="color: var(--lime); font-family: var(--m); font-weight: 700;">${remoteCacheVersion}</span></div>
                </div>
                <button id="applyUpdateNowBtn" style="background: linear-gradient(135deg, var(--lime), #059669); color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 11.5px; cursor: pointer; font-family: var(--f); white-space: nowrap;">
                  ⚡ Sync & Reload
                </button>
              </div>
            </div>
          `;
        }

        containerEl.innerHTML = html;

        // Bind APK Download Button
        const downloadApkBtn = document.getElementById('downloadApkBtn');
        if (downloadApkBtn && apkVersionData) {
          const downloadTargetUrl = apkVersionData.apkUrl || apkVersionData.downloadUrl || 'https://github.com/sid954/RoutineAPP/releases';
          downloadApkBtn.addEventListener('click', () => {
            showToast('Opening APK download...', 'info');
            window.open(downloadTargetUrl, '_system') || window.open(downloadTargetUrl, '_blank');
          });
        }

        // Bind Cache Sync Button
        const applyBtn = document.getElementById('applyUpdateNowBtn');
        if (applyBtn) {
          applyBtn.addEventListener('click', async () => {
            try {
              showToast('Syncing latest schedule & assets...', 'info');

              if (isSchedOk) {
                try {
                  const freshSched = await schedRes.json();
                  State.schedule = normalizeSchedule(freshSched);
                  Storage.saveSchedule();
                } catch (e) {}
              }

              localStorage.setItem('active_app_cache_version', remoteCacheVersion);

              if ('caches' in window) {
                try {
                  const keys = await caches.keys();
                  await Promise.all(keys.map(k => caches.delete(k)));
                } catch (e) {}
              }

              forceUpdate();
              Notifications.scheduleForToday();

              if (swWaitingWorker) {
                swWaitingWorker.postMessage({ action: 'skipWaiting' });
              }

              showToast(`Updated to ${remoteCacheVersion}!`, 'success');
              setTimeout(() => window.location.reload(), 400);
            } catch (err) {
              showToast('Failed to apply update: ' + err.message, 'error');
            }
          });
        }

      } else {
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        containerEl.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px; color: var(--lime); font-weight: 800; margin-bottom: 6px;">
            <span>✅ App & Schedule are fully up to date!</span>
          </div>
          <div style="font-family: var(--m); font-size: 11px; color: var(--dim); display: flex; flex-direction: column; gap: 4px;">
            <div>• Native APK: <span style="color: var(--text);">v${CONFIG.appVersionName || '1.0.0'} (Code ${localVersionCode}) — Latest</span></div>
            <div>• Web Cache: <span style="color: var(--text);">${currentCacheVersion} — Matches Server</span></div>
            <div>• Last Checked: <span style="color: var(--text);">${nowStr}</span></div>
          </div>
        `;
      }
    }

    if (apkUpdateAvailable || cacheUpdateAvailable) {
      if (isManual) showToast('Update found!', 'info');
      return { apkUpdateAvailable, cacheUpdateAvailable, apkVersionData, remoteCacheVersion };
    } else {
      if (isManual) showToast('App is already up to date!', 'success');
      return { apkUpdateAvailable: false, cacheUpdateAvailable: false };
    }

  } catch (err) {
    console.error('Unified update check error:', err);
    if (containerEl) {
      containerEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; color: var(--pink); font-weight: 800; margin-bottom: 6px;">
          <span>❌ Update Check Failed</span>
        </div>
        <div style="font-family: var(--m); font-size: 11px; color: var(--dim);">
          ${escapeHtml(err.message || 'Error checking for updates.')}
        </div>
      `;
    }
    if (isManual) showToast('Update check failed.', 'error');
    return null;
  }
}
