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
 * Show a permission modal for APK updates on automatic launch.
 */
function showApkUpdatePermissionModal(apkVersionData) {
  let modal = document.getElementById('apkUpdatePermissionModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'apkUpdatePermissionModal';
    modal.className = 'mo';
    modal.style.zIndex = '9999';
    document.body.appendChild(modal);
  }

  const targetUrl = apkVersionData.apkUrl || apkVersionData.downloadUrl || 'https://github.com/sid954/RoutineAPP/releases';

  modal.innerHTML = `
    <div class="md" style="max-width: 380px; padding: 22px; text-align: center; background: #0f172a; border: 1.5px solid var(--accent); box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
      <div style="font-size: 36px; margin-bottom: 6px;">🚀</div>
      <h2 style="font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 4px;">New RoutineAPP Version!</h2>
      <div style="font-size: 12px; color: var(--accent); font-weight: 700; margin-bottom: 12px;">v${escapeHtml(apkVersionData.versionName || '1.1.0')}</div>
      
      <div style="font-size: 11.5px; color: var(--text); line-height: 1.5; background: rgba(0,0,0,0.3); padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); margin-bottom: 18px; text-align: left;">
        ${escapeHtml(apkVersionData.releaseNotes || 'Includes new features and performance updates.')}
      </div>
      
      <div style="display: flex; gap: 10px;">
        <button id="apkModalLaterBtn" style="flex: 1; padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: transparent; color: var(--dim); font-weight: 700; font-size: 12px; cursor: pointer;">Later</button>
        <button id="apkModalInstallBtn" style="flex: 1.5; padding: 10px; border-radius: 10px; border: none; background: linear-gradient(135deg, var(--accent), var(--pink)); color: #fff; font-weight: 800; font-size: 12px; cursor: pointer; box-shadow: 0 0 12px rgba(56,189,248,0.3);">📥 Install APK</button>
      </div>
    </div>
  `;

  modal.classList.add('open');

  document.getElementById('apkModalLaterBtn').addEventListener('click', () => {
    modal.classList.remove('open');
  });

  document.getElementById('apkModalInstallBtn').addEventListener('click', () => {
    modal.classList.remove('open');
    showToast('Opening APK download link...', 'info');
    window.open(targetUrl, '_system') || window.open(targetUrl, '_blank');
  });
}

/**
 * Unified Update Checker:
 * 1. If APK update found: Shows ONLY APK update prompt (asks permission).
 * 2. If normal schedule/web update found:
 *    - On startup: Updates AUTOMATICALLY without asking!
 *    - On manual check: Offers 1-tap sync button.
 */
export async function performUnifiedUpdateCheck(containerEl = null, isManual = false) {
  const remoteBase = getRemoteBaseUrl();
  const currentCacheVersion = await getActiveCacheVersion();
  const localVersionCode = CONFIG.appVersionCode || 1;

  if (containerEl) {
    containerEl.style.display = 'block';
    containerEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--accent2);">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent);"></span>
        <span>Checking for updates...</span>
      </div>
    `;
  }

  if (isManual) showToast('Checking for updates...', 'info');

  if (!navigator.onLine) {
    if (containerEl) {
      containerEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; color: var(--amber); font-weight: 800; margin-bottom: 6px;">
          <span>⚠️ Offline Mode</span>
        </div>
        <div style="font-family: var(--m); font-size: 11px; color: var(--dim); display: flex; flex-direction: column; gap: 4px;">
          <div>• App Version: <span style="color: var(--text);">v${CONFIG.appVersionName || '1.0.0'} (Code ${localVersionCode})</span></div>
          <div>• Cache Version: <span style="color: var(--text);">${currentCacheVersion}</span></div>
        </div>
      `;
    }
    if (isManual) showToast('Offline — cannot check server.', 'warning');
    return null;
  }

  try {
    // 1. Fetch version.json to check for Native APK Release Update
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
    } catch (verErr) {}

    // ── PRIORITY 1: NATIVE APK UPDATE FOUND ──
    if (apkUpdateAvailable) {
      const targetUrl = apkVersionData.apkUrl || apkVersionData.downloadUrl || 'https://github.com/sid954/RoutineAPP/releases';

      // On Manual Check in Edit Schedule modal: Show ONLY the APK update card
      if (containerEl) {
        containerEl.innerHTML = `
          <div style="background: rgba(56, 189, 248, 0.1); border: 1.5px solid var(--accent); border-radius: var(--rx); padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
              <div style="flex: 1;">
                <div style="font-weight: 800; color: #fff; font-size: 13px;">🚀 New Native APK v${escapeHtml(apkVersionData.versionName || '1.1.0')} Available!</div>
                <div style="font-size: 11px; color: var(--text); margin-top: 4px; line-height: 1.4;">${escapeHtml(apkVersionData.releaseNotes || 'New native features and updates.')}</div>
                <div style="font-size: 10px; color: var(--dim); margin-top: 4px;">Installed: v${CONFIG.appVersionName || '1.0.0'} (Code ${localVersionCode}) → New: Code ${apkVersionData.versionCode}</div>
              </div>
            </div>
            <div style="margin-top: 10px;">
              <button id="downloadApkBtn" style="width: 100%; background: linear-gradient(135deg, var(--accent), var(--pink)); color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; font-family: var(--f); box-shadow: 0 0 12px rgba(56,189,248,0.3);">
                📥 Download & Install APK
              </button>
            </div>
          </div>
        `;

        document.getElementById('downloadApkBtn').addEventListener('click', () => {
          showToast('Opening APK download link...', 'info');
          window.open(targetUrl, '_system') || window.open(targetUrl, '_blank');
        });
      } else if (!isManual) {
        // Automatic startup: Ask permission via permission modal
        showApkUpdatePermissionModal(apkVersionData);
      }

      if (isManual) showToast('New APK update found!', 'info');
      return { apkUpdateAvailable: true, apkVersionData };
    }

    // ── PRIORITY 2: NORMAL SCHEDULE & WEB ASSET OTA UPDATE ──
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
    } catch (e) {}

    const schedRes = await fetch(`${remoteBase}/schedule.json?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
    const isSchedOk = schedRes && schedRes.ok;

    const cacheUpdateAvailable = (remoteCacheVersion !== currentCacheVersion) || !!swWaitingWorker;

    if (cacheUpdateAvailable) {
      // RULE: Automatically update normal updates on startup without asking permission!
      if (!isManual && !containerEl) {
        try {
          if (isSchedOk) {
            const freshSched = await schedRes.json();
            State.schedule = normalizeSchedule(freshSched);
            Storage.saveSchedule();
          }

          localStorage.setItem('active_app_cache_version', remoteCacheVersion);

          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }

          forceUpdate();
          Notifications.scheduleForToday();

          if (swWaitingWorker) {
            swWaitingWorker.postMessage({ action: 'skipWaiting' });
          }

          showToast('Schedule & app updated automatically!', 'success');
        } catch (autoErr) {
          console.warn('Auto update error:', autoErr);
        }
      } else if (containerEl) {
        // Manual check UI card
        containerEl.innerHTML = `
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px dashed var(--lime); border-radius: var(--rx); padding: 10px 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div>
                <div style="font-weight: 800; color: #fff; font-size: 12px;">⚡ Schedule & Asset Update Available</div>
                <div style="font-size: 10.5px; color: var(--dim); margin-top: 2px;">Version: <span style="color: var(--lime); font-weight: 700;">${remoteCacheVersion}</span></div>
              </div>
              <button id="applyUpdateNowBtn" style="background: linear-gradient(135deg, var(--lime), #059669); color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 11.5px; cursor: pointer; font-family: var(--f);">
                ⚡ Sync & Reload
              </button>
            </div>
          </div>
        `;

        document.getElementById('applyUpdateNowBtn').addEventListener('click', async () => {
          try {
            showToast('Syncing latest schedule...', 'info');

            if (isSchedOk) {
              const freshSched = await schedRes.json();
              State.schedule = normalizeSchedule(freshSched);
              Storage.saveSchedule();
            }

            localStorage.setItem('active_app_cache_version', remoteCacheVersion);

            if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
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

      if (isManual) showToast('Schedule update available!', 'info');
      return { cacheUpdateAvailable: true, remoteCacheVersion };
    }

    // ── ALL UP TO DATE ──
    if (containerEl) {
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

    if (isManual) showToast('App is already up to date!', 'success');
    return { apkUpdateAvailable: false, cacheUpdateAvailable: false };

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
