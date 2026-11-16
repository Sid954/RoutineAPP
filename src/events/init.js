import { FEATURES } from '../features.js';
import { CONFIG, FULL_COURSE_NAMES, SUBJECT_PALETTES, LAB_THEME } from '../core/config.js';
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { normalizeSchedule } from '../schedule/normalizer.js';
import { getDefaultViewDate } from '../schedule/queries.js';
import { Announcements } from '../announcements/announcements.js';
import { Streak } from '../streak/streak.js';
import { Particles } from '../particles/particles.js';
import { Notifications } from '../notifications/notifications.js';
import { updateClock } from '../clock/clock.js';
import { updateGreeting } from '../dashboard/greeting.js';
import { updateDashboard, forceUpdate } from '../dashboard/update.js';
import { DOM } from '../core/dom.js';
import { performUnifiedUpdateCheck } from '../updater/apk-updater.js';
import { initThemeEngine } from '../core/theme.js';
import { initTeacherNames } from '../teachers/teacher-names.js';
import { loadMasterTeacherData } from '../teachers/teacher-finder.js';
import { preloadScheduleImages } from '../core/image-cache.js';
import { fetchWithTimeout } from '../core/utils.js';

export function fetchAnnouncementsAndNotify() {
  return Announcements.fetchAll().then(fetched => {
    if (fetched) {
      State.lastRenderedMinute = -1;
      updateDashboard();
      if (FEATURES.notifications) {
        Notifications.scheduleForToday();
      }
      if (typeof window.refreshFreeRoomsIfVisible === 'function') {
        window.refreshFreeRoomsIfVisible();
      }
    }
  }).catch(() => { /* Silent fallback: offline */ });
}

export async function fetchSectionSchedule(sem, sec) {
  const apiEndpoint = `${CONFIG.apiBase}/api/schedule?action=section&semester=${sem}&section=${sec}&v=${CONFIG.appVersionCode || Date.now()}`;
  let res = await fetchWithTimeout(apiEndpoint).catch(() => null);

  // Fallback to bundled static JSON file if API fails (e.g. offline, local dev, or static hosting)
  if (!res || !res.ok) {
    const fallbackPath = `./src/data/sem-${sem}/${sec}/routine.json?t=${Date.now()}`;
    res = await fetch(fallbackPath).catch(() => null);
  }

  if (res && res.ok) {
    const data = await res.json();
    return normalizeSchedule(data);
  }
  return null;
}

/**
 * Points the timeline at today, or at tomorrow after the 6pm rollover (see shouldRollOver).
 * @param {{ onlyIfOnDefault?: boolean }} opts onlyIfOnDefault: on resume, change the view only if
 *   the user is still on real today, never overriding a day they navigated to themselves.
 * @returns {boolean} whether the view day changed
 */
export function applyDefaultViewDay({ onlyIfOnDefault = false } = {}) {
  const realTodayIdx = new Date().getDay();
  if (onlyIfOnDefault && State.currentViewDayIdx !== realTodayIdx) return false;
  const { date, dayIdx } = getDefaultViewDate();
  if (State.currentViewDayIdx === dayIdx && State.viewDate && State.viewDate.toDateString() === date.toDateString()) return false;
  State.currentViewDayIdx = dayIdx;
  State.viewDate = date;
  return true;
}

export function initializeApp() {
  initThemeEngine();
  initTeacherNames();
  loadMasterTeacherData();
  if (FEATURES.streak) Streak.update();

  // Always default to today's actual date on fresh app launch
  const realToday = new Date();
  const realTodayIdx = realToday.getDay();
  State.currentViewDayIdx = realTodayIdx;
  State.selectedDay = realTodayIdx;
  State.viewDate = realToday;
  State.matrixSelectedDayIdx = CONFIG.activeDays.includes(realTodayIdx) ? realTodayIdx : CONFIG.activeDays[0];

  // ── STEP 1: Load cached schedule instantly (offline-first)
  const savedSchedule = Storage.loadSchedule();
  if (savedSchedule) {
    State.schedule = savedSchedule;
  } else {
    State.schedule = JSON.parse(JSON.stringify(normalizeSchedule(CONFIG.defaultRoutine)));
    Storage.saveSchedule();
  }

  // ── STEP 2: Load cached announcements/overrides instantly
  if (FEATURES.announcements) {
    Announcements.loadCached();
  }

  // After 6pm with today's classes done, open on tomorrow (needs schedule + overrides loaded)
  applyDefaultViewDay();

  // ── STEP 3: Initial render (instant offline bootstrap)
  updateClock();
  updateGreeting();
  forceUpdate();

  // Asynchronously warm image cache in idle time
  preloadScheduleImages(State.schedule);

  // Start intervals immediately
  State.clockIntervalId = setInterval(updateClock, CONFIG.updateIntervalMs);
  State.dashboardIntervalId = setInterval(updateDashboard, CONFIG.updateIntervalMs);

  if (FEATURES.particles) {
    Particles.init();
    Particles.start();
  }

  if (FEATURES.notifications) {
    Notifications.init();
    Notifications.initEvents();
  }

  // ── STEP 4: Asynchronously fetch latest config, schedule & announcements (non-blocking)
  fetch('config.json?t=' + Date.now())
    .then(res => { if (!res.ok) throw new Error(); return res.json(); })
    .then(configData => {
      let needsRefresh = false;
      if (configData.activeDays) {
        CONFIG.activeDays = configData.activeDays;
        if (!CONFIG.activeDays.includes(State.matrixSelectedDayIdx)) { State.matrixSelectedDayIdx = CONFIG.activeDays[0]; needsRefresh = true; }
      }
      if (configData.matrixIntervals) CONFIG.matrixIntervals = configData.matrixIntervals;
      if (configData.fullCourseNames) {
        Object.keys(FULL_COURSE_NAMES).forEach(k => delete FULL_COURSE_NAMES[k]);
        Object.assign(FULL_COURSE_NAMES, configData.fullCourseNames);
        needsRefresh = true;
      }
      if (configData.subjectPalettes) {
        SUBJECT_PALETTES.length = 0;
        SUBJECT_PALETTES.push(...configData.subjectPalettes);
        needsRefresh = true;
      }
      if (configData.labTheme) Object.assign(LAB_THEME, configData.labTheme);
      if (configData.apiBase) CONFIG.apiBase = configData.apiBase;

      if (needsRefresh) {
        forceUpdate();
      }

      if (FEATURES.announcements) {
        fetchAnnouncementsAndNotify();
      }
    })
    .catch(() => {
      if (FEATURES.announcements) {
        fetchAnnouncementsAndNotify();
      }
    });

  const currentSem = Storage.getSemester();
  const currentSec = Storage.getSection();
  fetchSectionSchedule(currentSem, currentSec)
    .then(freshSchedule => {
      if (freshSchedule && JSON.stringify(State.schedule) !== JSON.stringify(freshSchedule)) {
        State.schedule = freshSchedule;
        Storage.saveSchedule();
        forceUpdate();
        if (FEATURES.notifications) {
          Notifications.scheduleForToday();
        }
      }
    })
    .catch(() => { /* Silent fallback: offline or schedule unchanged */ });

  if (FEATURES.announcements) {
    // Skip polls while the app is backgrounded (saves data/battery); visibility.js refetches on resume
    setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchAnnouncementsAndNotify();
    }, 30 * 1000);
  }

  // ── STEP 5: Initialize Routine Selection Dropdowns & Unified Save
  initRoutineSelector();

  // ── STEP 6: Check for App & Schedule updates in background (non-blocking)
  setTimeout(() => {
    performUnifiedUpdateCheck(null, false);
  }, 4000);
}

// Bundled fallback only. The live list comes from api/schedule?action=semesters_sections
// (Supabase 'sections' table) so new sections appear without an app update.
const DEFAULT_ROUTINE_STRUCTURE = {
  '1': ['a', 'b', 'c', 'd', 'e', 'f'],
  '2': ['a', 'b', 'c', 'd', 'e', 'f'],
  '3': ['a', 'b', 'c', 'd', 'e', 'f'],
  '4': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '5': ['a', 'b', 'c'],
  '6': ['a', 'b', 'c', 'd', 'e', 'f'],
  '7': ['a', 'b'],
  '8': ['a', 'b', 'c', 'd', 'e']
};
const ROUTINE_STRUCTURE_CACHE_KEY = 'routine_structure_v1';

function isValidStructure(obj) {
  return !!obj && typeof obj === 'object' && Object.keys(obj).length > 0 &&
    Object.values(obj).every(v => Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'string'));
}

export function loadCachedStructure() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ROUTINE_STRUCTURE_CACHE_KEY) || 'null');
    if (isValidStructure(parsed)) return parsed;
  } catch (e) {}
  return DEFAULT_ROUTINE_STRUCTURE;
}

export async function fetchRoutineStructure() {
  try {
    const res = await fetchWithTimeout(`${CONFIG.apiBase}/api/schedule?action=semesters_sections`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!isValidStructure(data)) return null;
    try { localStorage.setItem(ROUTINE_STRUCTURE_CACHE_KEY, JSON.stringify(data)); } catch (e) {}
    return data;
  } catch (e) {
    return null;
  }
}

export async function saveAllSettings() {
  const semSelect = DOM.routineSemesterSelect || document.getElementById('routineSemesterSelect');
  const secSelect = DOM.routineSectionSelect || document.getElementById('routineSectionSelect');
  const sem = semSelect ? semSelect.value : Storage.getSemester();
  const sec = secSelect ? secSelect.value : Storage.getSection();

  // Preferences are written synchronously FIRST, so they are never lost even if the network
  // is slow or down. After that the flow always ends in a reload: the reload re-fetches the
  // routine and announcements itself, so nothing here needs to block on them.
  // (Previously a slow fetch re-opened the overlay after the timeout hid it, then returned
  // without hiding it or reloading, leaving the app stuck on "Step 2/2".)
  const nameInput = document.getElementById('displayNameInput');
  if (nameInput) Storage.saveDisplayName(nameInput.value);
  Storage.saveSemester(sem);
  Storage.saveSection(sec);
  if (DOM.notifToggle) {
    const notifSettings = Storage.getNotifSettings();
    notifSettings.enabled = DOM.notifToggle.checked;
    if (DOM.notifLeadTime) notifSettings.leadTime = parseInt(DOM.notifLeadTime.value, 10) || 15;
    Storage.saveNotifSettings(notifSettings);
  }

  const [{ showLoadingScreen }, { showToast }] = await Promise.all([
    import('../modals/modal.js'),
    import('../toast/toast.js')
  ]);

  showLoadingScreen(
    `Saving Settings (Semester ${sem} - Section ${sec.toUpperCase()})...`,
    'Downloading your routine...'
  );

  // fetchSectionSchedule has its own 8s API timeout + bundled-file fallback; this outer cap
  // guarantees we move on even if both are slow.
  const SAVE_CAP_MS = 10000;
  let timedOut = false;
  try {
    const freshSchedule = await Promise.race([
      fetchSectionSchedule(sem, sec),
      new Promise(resolve => setTimeout(() => { timedOut = true; resolve(null); }, SAVE_CAP_MS))
    ]);
    if (freshSchedule) {
      State.schedule = freshSchedule;
      Storage.saveSchedule();
    }
  } catch (err) {
    console.warn('Routine download during save failed:', err);
  }

  showLoadingScreen('Settings Saved!', timedOut ? 'Server is slow — reloading with your saved settings...' : 'Reloading dashboard...');
  showToast(timedOut ? 'Settings saved. Routine will refresh when the server responds.' : 'Settings saved & applied!', timedOut ? 'warning' : 'success');
  setTimeout(() => window.location.reload(), 600);
}

function initRoutineSelector() {
  const semSelect = DOM.routineSemesterSelect;
  const secSelect = DOM.routineSectionSelect;
  if (!semSelect || !secSelect) return;

  const nameInput = document.getElementById('displayNameInput');
  if (nameInput) nameInput.value = Storage.getDisplayName();

  let structure = loadCachedStructure();

  function populateSemesters(selectedSem) {
    semSelect.innerHTML = Object.keys(structure)
      .sort((a, b) => Number(a) - Number(b))
      .map(sem => `<option value="${sem}"${sem === selectedSem ? ' selected' : ''}>Semester ${sem}</option>`)
      .join('');
  }

  function populateSections(sem, selectedSec) {
    const sections = structure[sem] || [];
    secSelect.innerHTML = sections
      .map(sec => `<option value="${sec}"${sec === selectedSec ? ' selected' : ''}>Section ${sec.toUpperCase()}</option>`)
      .join('');
  }

  populateSemesters(Storage.getSemester());
  populateSections(Storage.getSemester(), Storage.getSection());

  // Refresh from Supabase in the background; keep the user's in-progress choice if still valid
  fetchRoutineStructure().then(fresh => {
    if (!fresh || JSON.stringify(fresh) === JSON.stringify(structure)) return;
    structure = fresh;
    const sem = structure[semSelect.value] ? semSelect.value : Storage.getSemester();
    const sec = (structure[sem] || []).includes(secSelect.value) ? secSelect.value : Storage.getSection();
    populateSemesters(sem);
    populateSections(sem, sec);
  });

  semSelect.addEventListener('change', () => {
    const sem = semSelect.value;
    const availableSections = structure[sem] || [];
    let sec = secSelect.value;
    if (!availableSections.includes(sec)) {
      sec = availableSections[0] || 'a';
    }
    populateSections(sem, sec);
  });

  const saveAllBtn = DOM.saveAllSettingsBtn || document.getElementById('saveAllSettingsBtn');
  if (saveAllBtn) {
    saveAllBtn.addEventListener('click', saveAllSettings);
  }

  const saveNotifBtn = DOM.saveNotifSettingsBtn || document.getElementById('saveNotifSettingsBtn');
  if (saveNotifBtn) {
    saveNotifBtn.addEventListener('click', saveAllSettings);
  }
}
