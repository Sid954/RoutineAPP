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
 * Respects session dismissal so user is not nagged repeatedly in a single session.
 */
function showApkUpdatePermissionModal(apkVersionData) {
  const remoteVerCode = apkVersionData.versionCode || 1;
  const dismissKey = `apk_update_dismissed_v${remoteVerCode}`;

  // If user tapped 'Later' in this session, don't nag again until next session
  if (sessionStorage.getItem(dismissKey) === 'true') {
    return;
  }

  let modal = document.getElementById('apkUpdatePermissionModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'apkUpdatePermissionModal';
    modal.className = 'mo';
    modal.style.zIndex = '9999';
    document.body.appendChild(modal);
  }

  const targetUrl = apkVersionData.apkUrl || apkVersionData.downloadUrl || 'https://github.com/sid954/RoutineAPP/releases';
  const currentVerClean = CONFIG.appVersionName || (CONFIG.appVersionCode ? `${CONFIG.appVersionCode}` : '1.0.0');
  const remoteVerClean = apkVersionData.versionName || (apkVersionData.versionCode ? `${apkVersionData.versionCode}` : '1.1.2');

  modal.innerHTML = `
    <div class="md" style="max-width: 360px; padding: 26px 20px; text-align: center; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(16px); border: 1.5px solid rgba(56, 189, 248, 0.4); box-shadow: 0 20px 50px rgba(0,0,0,0.9), 0 0 30px rgba(56,189,248,0.15); border-radius: 20px;">
      <div style="font-size: 40px; margin-bottom: 4px; filter: drop-shadow(0 0 10px rgba(56,189,248,0.5));">🚀</div>
      <h2 style="font-size: 20px; font-weight: 900; color: #fff; margin-bottom: 4px; letter-spacing: -0.3px;">New Version Available!</h2>
      
      <div style="font-size: 19px; font-weight: 900; color: var(--accent2); margin-bottom: 6px; letter-spacing: 0.5px; font-family: var(--f); text-shadow: 0 0 12px rgba(56,189,248,0.4);">
        v${escapeHtml(remoteVerClean)}
      </div>
      
      <div style="font-size: 11.5px; color: var(--dim); margin-bottom: 22px; font-family: var(--m);">
        Installed on device: <span style="color: var(--text); font-weight: 700;">v${escapeHtml(currentVerClean)}</span>
      </div>
      
      <div style="display: flex; gap: 10px;">
        <button id="apkModalLaterBtn" style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid var(--border); background: rgba(255,255,255,0.04); color: var(--dim); font-weight: 700; font-size: 12px; cursor: pointer; transition: all 0.2s;">Later</button>
        <button id="apkModalInstallBtn" style="flex: 1.5; padding: 12px; border-radius: 12px; border: none; background: linear-gradient(135deg, var(--accent), var(--pink)); color: #fff; font-weight: 800; font-size: 12px; cursor: pointer; box-shadow: 0 4px 16px rgba(56,189,248,0.4); transition: transform 0.15s active;">📦 Install APK</button>
      </div>
    </div>
  `;

  modal.classList.add('open');

  document.getElementById('apkModalLaterBtn').addEventListener('click', () => {
    modal.classList.remove('open');
    sessionStorage.setItem(dismissKey, 'true');
  });

  document.getElementById('apkModalInstallBtn').addEventListener('click', () => {
    modal.classList.remove('open');
    showToast('Downloading APK in browser... Tap to install once downloaded!', 'info', null, 5000);
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
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); animation: pulse 1.5s infinite;"></span>
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
      const currentVerClean = CONFIG.appVersionName || (CONFIG.appVersionCode ? `${CONFIG.appVersionCode}` : '1.0.0');
      const remoteVerClean = apkVersionData.versionName || (apkVersionData.versionCode ? `${apkVersionData.versionCode}` : '1.1.2');

      // On Manual Check in Edit Schedule modal: Show ONLY the APK update card
      if (containerEl) {
        containerEl.innerHTML = `
          <div style="background: rgba(56, 189, 248, 0.1); border: 1.5px solid var(--accent); border-radius: var(--rx); padding: 14px; box-shadow: 0 0 20px rgba(56,189,248,0.15);">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div>
                <div style="font-weight: 800; color: #fff; font-size: 14px;">🚀 New Version Available!</div>
                <div style="font-size: 15px; font-weight: 900; color: var(--accent2); margin-top: 2px;">v${escapeHtml(remoteVerClean)}</div>
                <div style="font-size: 11px; color: var(--dim); margin-top: 2px;">Installed on device: v${escapeHtml(currentVerClean)}</div>
              </div>
            </div>
            <div style="margin-top: 12px;">
              <button id="downloadApkBtn" style="width: 100%; background: linear-gradient(135deg, var(--accent), var(--pink)); color: #fff; border: none; padding: 10px 14px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; font-family: var(--f); box-shadow: 0 4px 14px rgba(56,189,248,0.35);">
                📦 Install APK (v${escapeHtml(remoteVerClean)})
              </button>
            </div>
          </div>
        `;

        document.getElementById('downloadApkBtn').addEventListener('click', () => {
          showToast('Downloading APK in browser... Tap to install once downloaded!', 'info', null, 5000);
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
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px dashed var(--lime); border-radius: var(--rx); padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div>
                <div style="font-weight: 800; color: #fff; font-size: 12.5px;">⚡ Schedule & Asset Update Available</div>
                <div style="font-size: 11px; color: var(--dim); margin-top: 2px;">Version: <span style="color: var(--lime); font-weight: 700; font-family: var(--m);">${remoteCacheVersion}</span></div>
              </div>
              <button id="applyUpdateNowBtn" style="background: linear-gradient(135deg, var(--lime), #059669); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 800; font-size: 11.5px; cursor: pointer; font-family: var(--f);">
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
