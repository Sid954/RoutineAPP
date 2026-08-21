import { FEATURES } from '../features.js';
import { CONFIG, FULL_COURSE_NAMES, SUBJECT_PALETTES, LAB_THEME } from '../core/config.js';
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { normalizeSchedule } from '../schedule/normalizer.js';
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

export function fetchAnnouncementsAndNotify() {
  return Announcements.fetchAll().then(fetched => {
    if (fetched) {
      State.lastRenderedMinute = -1;
      updateDashboard();
      if (FEATURES.notifications) {
        Notifications.scheduleForToday();
      }
    }
  }).catch(() => { /* Silent fallback: offline */ });
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
  fetch(`./src/data/sem-${currentSem}/${currentSec}/routine.json?t=${Date.now()}`)
    .then(res => { if (!res.ok) throw new Error(); return res.json(); })
    .then(data => {
      const freshSchedule = normalizeSchedule(data);
      if (JSON.stringify(State.schedule) !== JSON.stringify(freshSchedule)) {
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
    setInterval(() => fetchAnnouncementsAndNotify(), 30 * 1000);
  }

  // ── STEP 5: Initialize Routine Selection Dropdowns & Unified Save
  initRoutineSelector();

  // ── STEP 6: Check for App & Schedule updates in background (non-blocking)
  setTimeout(() => {
    performUnifiedUpdateCheck(null, false);
  }, 4000);
}

const ROUTINE_STRUCTURE = {
  '1': ['a', 'b', 'c', 'd', 'e', 'f'],
  '2': ['a', 'b', 'c', 'd', 'e', 'f'],
  '3': ['a', 'b', 'c', 'd', 'e', 'f'],
  '4': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '5': ['a', 'b', 'c'],
  '6': ['a', 'b', 'c', 'd', 'e', 'f'],
  '7': ['a', 'b'],
  '8': ['a', 'b', 'c', 'd', 'e']
};

export async function saveAllSettings() {
  const semSelect = DOM.routineSemesterSelect || document.getElementById('routineSemesterSelect');
  const secSelect = DOM.routineSectionSelect || document.getElementById('routineSectionSelect');
  const sem = semSelect ? semSelect.value : Storage.getSemester();
  const sec = secSelect ? secSelect.value : Storage.getSection();

  import('../modals/modal.js').then(async ({ showLoadingScreen, hideLoadingScreen }) => {
    showLoadingScreen(
      `Saving Settings (Semester ${sem} - Section ${sec.toUpperCase()})...`,
      'Step 1/2: Saving preferences & downloading schedule...'
    );

    let isFinished = false;
    let saveTimeout = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        hideLoadingScreen();
        import('../toast/toast.js').then(({ showToast }) => {
          showToast('Saving taking longer than expected. Using cached settings.', 'warning');
        });
      }
    }, 7000);

    try {
      Storage.saveSemester(sem);
      Storage.saveSection(sec);

      // Save notification settings if elements exist
      if (DOM.notifToggle) {
        const notifSettings = Storage.getNotifSettings();
        notifSettings.enabled = DOM.notifToggle.checked;
        if (DOM.notifLeadTime) notifSettings.leadTime = parseInt(DOM.notifLeadTime.value, 10) || 15;
        Storage.saveNotifSettings(notifSettings);
      }

      // Fetch routine JSON for targeted semester & section
      const path = `./src/data/sem-${sem}/${sec}/routine.json`;
      const res = await fetch(`${path}?t=${Date.now()}`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        State.schedule = normalizeSchedule(data);
        Storage.saveSchedule();
      }

      // Step 2: Fetch section-specific announcements
      showLoadingScreen(
        `Semester ${sem} - Section ${sec.toUpperCase()} Saved!`,
        'Step 2/2: Syncing section announcements & schedule overrides...'
      );

      if (FEATURES.announcements) {
        await fetchAnnouncementsAndNotify().catch(() => {});
      }

      if (isFinished) return;
      clearTimeout(saveTimeout);
      isFinished = true;

      showLoadingScreen(
        'Settings Applied!',
        'Finalizing dashboard reload...'
      );

      import('../toast/toast.js').then(({ showToast }) => {
        showToast('Settings saved & applied successfully!', 'success');
      });

      // Smooth auto reload
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (err) {
      if (isFinished) return;
      clearTimeout(saveTimeout);
      isFinished = true;
      hideLoadingScreen();
      console.error('Error saving settings:', err);
      import('../toast/toast.js').then(({ showToast }) => {
        showToast('Error saving settings: ' + err.message, 'error');
      });
    }
  });
}

function initRoutineSelector() {
  const semSelect = DOM.routineSemesterSelect;
  const secSelect = DOM.routineSectionSelect;
  if (!semSelect || !secSelect) return;

  const currentSem = Storage.getSemester();
  const currentSec = Storage.getSection();

  semSelect.innerHTML = Object.keys(ROUTINE_STRUCTURE)
    .map(sem => `<option value="${sem}"${sem === currentSem ? ' selected' : ''}>Semester ${sem}</option>`)
    .join('');

  function populateSections(sem, selectedSec) {
    const sections = ROUTINE_STRUCTURE[sem] || [];
    secSelect.innerHTML = sections
      .map(sec => `<option value="${sec}"${sec === selectedSec ? ' selected' : ''}>Section ${sec.toUpperCase()}</option>`)
      .join('');
  }

  populateSections(currentSem, currentSec);

  semSelect.addEventListener('change', () => {
    const sem = semSelect.value;
    const availableSections = ROUTINE_STRUCTURE[sem] || [];
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
