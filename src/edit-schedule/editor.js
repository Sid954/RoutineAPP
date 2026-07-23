import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG, DAY_NAMES, DAY_SHORT } from '../core/config.js';
import { getClassesForDay } from '../schedule/queries.js';
import { getSubjectTheme } from '../schedule/themes.js';
import { toMinutes, format12h, getCurrentMinutes, formatRoom } from '../core/utils.js';
import { Storage } from '../storage/storage.js';
import { showToast } from '../toast/toast.js';
import { forceUpdate } from '../dashboard/update.js';
import { normalizeSchedule } from '../schedule/normalizer.js';
import { Notifications } from '../notifications/notifications.js';

export function populateDaySelect() {
  DOM.editDaySelect.innerHTML = '';
  for (const dayIdx of CONFIG.activeDays) {
    const opt = document.createElement('option');
    opt.value = dayIdx;
    opt.textContent = DAY_NAMES[dayIdx];
    if (dayIdx === State.selectedDay) opt.selected = true;
    DOM.editDaySelect.appendChild(opt);
  }
}

export function renderEditColumns() {
  const currentMins = getCurrentMinutes();
  const todayIdx = new Date().getDay();
  let html = '';

  CONFIG.activeDays.forEach((dayIdx, colIndex) => {
    const entries = getClassesForDay(dayIdx);
    const isToday = dayIdx === todayIdx;

    html += `<div class="dc${isToday ? ' tod' : ''}" style="animation-delay:${colIndex * 0.06}s">`;
    html += `<div class="dc-h"><span class="dn">${DAY_SHORT[dayIdx]}</span><span class="cnt">${entries.length}</span></div>`;
    html += `<div class="dc-b">`;

    if (entries.length) {
      entries.forEach(item => {
        const isLive = isToday && currentMins >= toMinutes(item.start) && currentMins < toMinutes(item.end);
        html += `
          <div class="dc-e${isLive ? ' ac' : ''}">
            <div class="et">${format12h(item.start)} – ${format12h(item.end)}</div>
            <div class="en" title="${item.title}">${item.title}</div>
            ${item.instructor ? `<div class="ei">${item.instructor}</div>` : ''}
            <div class="er">${formatRoom(item.room)} · ${item.type}</div>
            <button class="ed" data-day="${dayIdx}" data-ti="${encodeURIComponent(item.title)}" title="Delete">✕</button>
          </div>`;
      });
    } else {
      html += `<div class="dc-empty">No classes</div>`;
    }

    html += `</div></div>`;
  });

  DOM.editCols.innerHTML = html;

  // Delete buttons
  DOM.editCols.querySelectorAll('.ed').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetDay = parseInt(btn.dataset.day);
      const title = decodeURIComponent(btn.dataset.ti);
      const dayEntries = State.schedule[targetDay] || [];
      const removeIdx = dayEntries.findIndex(x => x.title === title);
      if (removeIdx === -1) return;

      const removed = dayEntries[removeIdx];
      const origIdx = removeIdx;
      State.schedule[targetDay].splice(removeIdx, 1);
      Storage.saveSchedule(); renderEditColumns(); forceUpdate();

      showToast(`Removed "${removed.title}"`, 'info', () => {
        State.schedule[targetDay].splice(origIdx, 0, removed);
        State.schedule[targetDay].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
        Storage.saveSchedule(); renderEditColumns(); forceUpdate();
        showToast(`Restored "${removed.title}"`, 'success');
      });
    });
  });

  // Click day column to select it
  DOM.editCols.querySelectorAll('.dc').forEach(col => {
    col.addEventListener('click', e => {
      if (e.target.closest('.ed')) return;
      const nameEl = col.querySelector('.dn');
      if (nameEl) {
        const match = Object.entries(DAY_SHORT).find(([, label]) => label === nameEl.textContent.trim());
        if (match) { State.selectedDay = parseInt(match[0]); populateDaySelect(); }
      }
    });
  });
}

export function initEditorEvents() {
  // Day select change
  DOM.editDaySelect.addEventListener('change', e => { State.selectedDay = parseInt(e.target.value); });

  // Add entry
  document.getElementById('addB').addEventListener('click', () => {
    const startTime = DOM.editStart.value;
    const endTime = DOM.editEnd.value;
    const title = DOM.editTitle.value.trim();
    const room = DOM.editRoom.value.trim();
    const instructor = DOM.editInstructor.value.trim();
    const classType = DOM.editType.value;
    const targetDay = parseInt(DOM.editDaySelect.value);

    if (!startTime || !endTime || !title) {
      showToast('Please fill out Start Time, End Time, and Title.', 'warning');
      return;
    }

    if (!State.schedule[targetDay]) State.schedule[targetDay] = [];
    State.schedule[targetDay].push({ start: startTime, end: endTime, title, room, instructor, type: classType });
    State.schedule[targetDay].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    Storage.saveSchedule(); renderEditColumns(); forceUpdate();
    Notifications.scheduleForToday();

    DOM.editTitle.value = ''; DOM.editRoom.value = ''; DOM.editInstructor.value = '';
    showToast(`Added "${title}" to ${DAY_NAMES[targetDay]}`, 'success');
  });

  // Clear day
  document.getElementById('clrB').addEventListener('click', () => {
    const targetDay = parseInt(DOM.editDaySelect.value);
    if (!State.schedule[targetDay] || !State.schedule[targetDay].length) {
      showToast(`${DAY_NAMES[targetDay]} is already empty.`, 'info');
      return;
    }
    const backup = JSON.parse(JSON.stringify(State.schedule[targetDay]));
    State.schedule[targetDay] = [];
    Storage.saveSchedule(); renderEditColumns(); forceUpdate();

    showToast(`Cleared all classes for ${DAY_NAMES[targetDay]}`, 'info', () => {
      State.schedule[targetDay] = backup;
      Storage.saveSchedule(); renderEditColumns(); forceUpdate();
      showToast(`Restored ${DAY_NAMES[targetDay]} schedule`, 'success');
    });
  });

  // Reset to default
  document.getElementById('rstB').addEventListener('click', () => {
    const backup = JSON.parse(JSON.stringify(State.schedule));
    State.schedule = JSON.parse(JSON.stringify(normalizeSchedule(CONFIG.defaultRoutine)));
    Storage.saveSchedule(); renderEditColumns(); forceUpdate();

    showToast('Reset to default schedule', 'info', () => {
      State.schedule = backup;
      Storage.saveSchedule(); renderEditColumns(); forceUpdate();
      showToast('Undo successful', 'success');
    });
  });

  // Toggle Add Class form
  const toggleAddClassBtn = document.getElementById('toggleAddClassBtn');
  const addClassForm = document.getElementById('addClassForm');
  if (toggleAddClassBtn && addClassForm) {
    toggleAddClassBtn.addEventListener('click', () => {
      const isHidden = addClassForm.style.display === 'none';
      addClassForm.style.display = isHidden ? 'block' : 'none';
      toggleAddClassBtn.textContent = isHidden ? '✕ Hide Form' : '+ Add Class';
      toggleAddClassBtn.style.borderColor = isHidden ? 'var(--pink)' : '';
      toggleAddClassBtn.style.color = isHidden ? 'var(--pink)' : '';
    });
  }

  // Initial cache version populate
  updateEditModalCacheInfo();

  // Helper: get base URL for update checks (remote server on native app, relative on web)
  function getRemoteBaseUrl() {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      return CONFIG.remoteAppUrl || 'https://sid954.github.io/RoutineAPP';
    }
    return '.';
  }

  // Manual Check for Updates — Detailed Inspection
  const checkUpdateBtn = document.getElementById('checkUpdateBtn');
  const updateDetailsPanel = document.getElementById('updateCheckDetails');

  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', async () => {
      if (!updateDetailsPanel) return;

      const remoteBase = getRemoteBaseUrl();
      const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

      updateDetailsPanel.style.display = 'block';
      updateDetailsPanel.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--accent2);">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent);"></span>
          <span>Checking ${isNative ? 'GitHub server' : 'server'} for updates...</span>
        </div>
        <div style="margin-top: 6px; font-family: var(--m); font-size: 11px; color: var(--dim); display: flex; flex-direction: column; gap: 3px;">
          <div>• Inspecting active build version...</div>
          <div>• Connecting to ${escapeHtml(remoteBase)}...</div>
          <div>• Validating remote sw.js & schedule assets...</div>
        </div>
      `;

      showToast('Checking for updates...', 'info');
      const currentVersion = await getActiveCacheVersion();

      if (!navigator.onLine) {
        updateDetailsPanel.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px; color: var(--amber); font-weight: 800; margin-bottom: 6px;">
            <span>⚠️ Offline Check Mode</span>
          </div>
          <div style="font-family: var(--m); font-size: 11px; color: var(--dim); display: flex; flex-direction: column; gap: 4px;">
            <div>• Active Build: <span style="color: var(--text);">${currentVersion}</span></div>
            <div>• Connection: <span style="color: var(--amber);">No internet connection</span></div>
            <div>• System: Running on local cached assets</div>
          </div>
        `;
        showToast('Offline — cannot check remote server.', 'warning');
        return;
      }

      try {
        let swWaitingWorker = null;
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const updatedReg = await reg.update().catch(() => null);
            const activeReg = updatedReg || reg;
            if (activeReg && (activeReg.waiting || activeReg.installing)) {
              swWaitingWorker = activeReg.waiting || activeReg.installing;
            }
          } catch (swErr) {
            console.warn('SW check warning:', swErr);
          }
        }

        const swRes = await fetch(`${remoteBase}/sw.js?t=${Date.now()}`, { cache: 'no-store' });
        let remoteVersion = currentVersion;
        if (swRes.ok) {
          const swText = await swRes.text();
          const match = swText.match(/const CACHE_VERSION = '([^']+)'/);
          if (match && match[1]) {
            remoteVersion = match[1];
          }
        }

        const schedRes = await fetch(`${remoteBase}/schedule.json?t=${Date.now()}`, { cache: 'no-store' });
        const isSchedOk = schedRes.ok;

        const isUpdateAvailable = (remoteVersion !== currentVersion) || !!swWaitingWorker;

        if (isUpdateAvailable) {
          updateDetailsPanel.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 6px; color: var(--lime); font-weight: 800;">
                <span>🎉 New Update Available!</span>
              </div>
              <button id="applyUpdateNowBtn" style="background: linear-gradient(135deg, var(--accent), var(--lime)); color: #000; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 900; font-size: 11.5px; cursor: pointer; font-family: var(--f); box-shadow: 0 0 12px var(--ag);">
                ⚡ Install Update & Sync
              </button>
            </div>
            <div style="font-family: var(--m); font-size: 11px; color: var(--dim); display: flex; flex-direction: column; gap: 4px;">
              <div>• Current Build: <span style="color: var(--text);">${currentVersion}</span></div>
              <div>• New Remote Build: <span style="color: var(--lime); font-weight: 700;">${remoteVersion}</span></div>
              <div>• Remote Schedule: <span style="color: ${isSchedOk ? 'var(--lime)' : 'var(--pink)'}">${isSchedOk ? 'Validated ✓' : 'Failed'}</span></div>
              <div>• Target Host: <span style="color: var(--text);">${escapeHtml(remoteBase)}</span></div>
            </div>
          `;

          showToast('New update available!', 'info');

          const applyBtn = document.getElementById('applyUpdateNowBtn');
          if (applyBtn) {
            applyBtn.addEventListener('click', async () => {
              try {
                showToast('Syncing latest schedule & assets...', 'info');

                // 1. Sync remote schedule if available
                if (isSchedOk) {
                  try {
                    const freshSched = await schedRes.json();
                    State.schedule = normalizeSchedule(freshSched);
                    Storage.saveSchedule();
                  } catch (e) {}
                }

                // 2. Save new version ID locally
                localStorage.setItem('active_app_cache_version', remoteVersion);

                // 3. Clear old caches
                if ('caches' in window) {
                  try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                  } catch (e) {}
                }

                // 4. Force UI update
                forceUpdate();
                renderEditColumns();
                updateEditModalCacheInfo();
                Notifications.scheduleForToday();

                // 5. Activate ServiceWorker if available
                if (swWaitingWorker) {
                  swWaitingWorker.postMessage({ action: 'skipWaiting' });
                }

                showToast(`Successfully updated to ${remoteVersion}!`, 'success');

                setTimeout(() => {
                  window.location.reload();
                }, 400);
              } catch (err) {
                showToast('Failed to apply update: ' + err.message, 'error');
              }
            });
          }
        } else {
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          updateDetailsPanel.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; color: var(--lime); font-weight: 800; margin-bottom: 6px;">
              <span>✅ App is fully up to date!</span>
            </div>
            <div style="font-family: var(--m); font-size: 11px; color: var(--dim); display: flex; flex-direction: column; gap: 4px;">
              <div>• Active Version: <span style="color: var(--text); font-weight: 700;">${currentVersion}</span></div>
              <div>• Remote Server: <span style="color: var(--lime);">${remoteVersion} (Matches)</span></div>
              <div>• Target Host: <span style="color: var(--text);">${escapeHtml(remoteBase)}</span></div>
              <div>• Last Checked: <span style="color: var(--text);">${nowStr}</span></div>
            </div>
          `;
          showToast('App is already up to date!', 'success');
        }
      } catch (err) {
        console.error('Update check failed:', err);
        updateDetailsPanel.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px; color: var(--pink); font-weight: 800; margin-bottom: 6px;">
            <span>❌ Update Check Failed</span>
          </div>
          <div style="font-family: var(--m); font-size: 11px; color: var(--dim);">
            ${escapeHtml(err.message || 'Error communicating with update server.')}
          </div>
        `;
        showToast('Update check failed.', 'error');
      }
    });
  }
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

export async function updateEditModalCacheInfo() {
  const versionEl = document.getElementById('editCacheVersion');
  const statusEl = document.getElementById('editCacheStatus');
  if (!versionEl) return;

  const currentVersion = await getActiveCacheVersion();
  let dateFormatted = '';

  const tsMatch = currentVersion.match(/routine-cache-(\d+)/);
  if (tsMatch) {
    const ts = parseInt(tsMatch[1]);
    if (!isNaN(ts)) {
      const d = new Date(ts);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      dateFormatted = ` (${dateStr}, ${timeStr})`;
    }
  }

  versionEl.textContent = `${currentVersion}${dateFormatted}`;
  if (statusEl) {
    statusEl.textContent = navigator.onLine ? 'Online • Active' : 'Offline • Cached';
    statusEl.style.color = navigator.onLine ? 'var(--lime)' : 'var(--amber)';
  }
}
