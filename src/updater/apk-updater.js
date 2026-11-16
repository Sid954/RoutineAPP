import { CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { escapeHtml } from '../core/utils.js';
import { showToast } from '../toast/toast.js';
import { forceUpdate } from '../dashboard/update.js';
import { Notifications } from '../notifications/notifications.js';
import { checkAppUpdate, openUpdateSheet, fmtMB } from './app-update.js';

export function getRemoteBaseUrl() {
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    // Vercel serves www/ (sw.js, version.json). GitHub Pages stops working once the repo is private.
    return CONFIG.apiBase || CONFIG.remoteAppUrl;
  }
  return '.';
}

/**
 * Directly queries Android OS PackageManager (via Capacitor.Plugins.App.getInfo())
 * for the true native installed APK versionCode & versionName.
 * On Web, queries compiled CONFIG directly. NO localStorage or cache used!
 */
export async function getActiveVersionInfo() {
  if (window.Capacitor && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try {
      const info = await window.Capacitor.Plugins.App.getInfo();
      if (info && info.build) {
        const nativeCode = parseInt(info.build, 10);
        const nativeName = info.version || CONFIG.appVersionName || '1.0.0';
        if (!isNaN(nativeCode) && nativeCode > 0) {
          return { code: nativeCode, name: nativeName };
        }
      }
    } catch (err) {
      console.warn('Native App.getInfo() warning:', err);
    }
  }

  // Pure direct read from compiled app CONFIG (no localstorage, no cache, no bare imports)
  return {
    code: CONFIG.appVersionCode || 1,
    name: CONFIG.appVersionName || '1.0.0'
  };
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
 * Re-fetch the user's OWN section routine (Supabase API → bundled JSON fallback).
 * Never use the legacy root schedule.json here: it is a single hardcoded section
 * and would overwrite every user's routine on each OTA update.
 * Dynamic import avoids a load-time cycle (init.js imports this module).
 */
async function refreshOwnSectionSchedule() {
  try {
    const { fetchSectionSchedule } = await import('../events/init.js');
    const fresh = await fetchSectionSchedule(Storage.getSemester(), Storage.getSection());
    if (fresh) {
      State.schedule = fresh;
      Storage.saveSchedule();
    }
  } catch (e) {
    console.warn('Section schedule refresh skipped:', e);
  }
}

/** Drop stale app-shell caches only; keep the faculty image cache for offline use. */
async function clearAppShellCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('routine-cache-')).map(k => caches.delete(k)));
}

/**
 * Unified Update Checker:
 * 1. Directly queries Native Android App info & GitHub version.json.
 * 2. If APK update found (remote versionCode > native Android versionCode):
 *    - Shows ONLY APK update prompt (asks permission).
 * 3. If normal schedule/web update found:
 *    - On startup: Updates AUTOMATICALLY without asking!
 *    - On manual check: Offers 1-tap sync button.
 */
export async function performUnifiedUpdateCheck(containerEl = null, isManual = false) {
  const remoteBase = getRemoteBaseUrl();
  const currentCacheVersion = await getActiveCacheVersion();
  const activeVer = await getActiveVersionInfo();
  const localVersionCode = activeVer.code;
  const currentVerClean = activeVer.name;

  if (containerEl) {
    containerEl.style.display = 'block';
    containerEl.innerHTML = `
      <div class="st-upd is-busy"><span class="st-upd-spin" aria-hidden="true"></span><strong>Checking for updates…</strong></div>
    `;
  }

  if (isManual) showToast('Checking for updates...', 'info');

  if (!navigator.onLine) {
    if (containerEl) {
      containerEl.innerHTML = `
          <div class="st-upd is-warn">
            <strong>You're offline</strong>
            <span>Connect to the internet to check for updates.</span>
            <dl class="st-upd-facts"><dt>App</dt><dd>v${escapeHtml(currentVerClean)}</dd></dl>
          </div>
        `;
    }
    if (isManual) showToast('Offline — cannot check server.', 'warning');
    return null;
  }

  try {
    // ── PRIORITY 1: NATIVE APK UPDATE (in-app download + install, see app-update.js) ──
    const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (isNativeApp) {
      // Auto check: app-update.js opens its sheet itself (respects "Skip this version")
      const apk = await checkAppUpdate({ manual: isManual, silent: !!containerEl });
      if (apk.available) {
        if (containerEl) {
          const v = apk.info;
          containerEl.innerHTML = `
            <div class="st-upd is-new">
              <strong>${apk.forced ? 'Required update' : 'New version'} v${escapeHtml(v.versionName)}</strong>
              <span>You have v${escapeHtml(currentVerClean)}.${v.size ? ` Download size ${fmtMB(v.size)}.` : ''} It downloads and installs right here in the app.</span>
              <button type="button" id="downloadApkBtn" class="st-btn st-btn-primary st-btn-block">Update now</button>
            </div>
          `;
          document.getElementById('downloadApkBtn').addEventListener('click', () => openUpdateSheet(v, { forced: apk.forced }));
        }
        if (isManual) showToast(`Version ${apk.info.versionName} is available`, 'info');
        return { apkUpdateAvailable: true, apkVersionData: apk.info };
      }
      if (apk.error && isManual && containerEl) {
        // Keep going with the routine/app-files check, but say why the app check failed
        console.warn('App update check failed:', apk.error);
      }
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

    const cacheUpdateAvailable = (remoteCacheVersion !== currentCacheVersion) || !!swWaitingWorker;

    if (cacheUpdateAvailable) {
      // RULE: Automatically update normal updates on startup without asking permission!
      if (!isManual && !containerEl) {
        try {
          await refreshOwnSectionSchedule();

          localStorage.setItem('active_app_cache_version', remoteCacheVersion);

          await clearAppShellCaches();

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
          <div class="st-upd is-new">
            <strong>Routine and app data update</strong>
            <span>A newer routine or app files are ready. Syncing takes a few seconds and reloads the app.</span>
            <button type="button" id="applyUpdateNowBtn" class="st-btn st-btn-primary st-btn-block">Sync and reload</button>
          </div>
        `;

        document.getElementById('applyUpdateNowBtn').addEventListener('click', async () => {
          try {
            showToast('Syncing latest schedule...', 'info');

            await refreshOwnSectionSchedule();

            localStorage.setItem('active_app_cache_version', remoteCacheVersion);

            await clearAppShellCaches();

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
      const nowStr = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      containerEl.innerHTML = `
        <div class="st-upd is-ok">
          <strong>You're up to date</strong>
          <dl class="st-upd-facts">
            <dt>App</dt><dd>v${escapeHtml(currentVerClean)}</dd>
            <dt>Checked</dt><dd>${nowStr}</dd>
          </dl>
        </div>
      `;
    }

    if (isManual) showToast('App is already up to date!', 'success');
    return { apkUpdateAvailable: false, cacheUpdateAvailable: false };

  } catch (err) {
    console.error('Unified update check error:', err);
    if (containerEl) {
      containerEl.innerHTML = `
        <div class="st-upd is-err">
          <strong>Couldn't check for updates</strong>
          <span>${escapeHtml(err.message || 'Something went wrong. Try again.')}</span>
        </div>
      `;
    }
    if (isManual) showToast('Update check failed.', 'error');
    return null;
  }
}
