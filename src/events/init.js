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
import { updateStats } from '../dashboard/stats.js';
import { updateDashboard, forceUpdate } from '../dashboard/update.js';

export function initializeApp() {
  if (FEATURES.streak) Streak.update();

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
  updateStats();
  forceUpdate();

  // Start intervals immediately
  State.clockIntervalId = setInterval(updateClock, CONFIG.updateIntervalMs);
  State.dashboardIntervalId = setInterval(updateDashboard, CONFIG.updateIntervalMs);

  if (FEATURES.particles) {
    Particles.init();
    Particles.start();
  }

  if (FEATURES.notifications) {
    Notifications.init();
  }

  // ── STEP 4: Asynchronously fetch latest config, schedule & announcements (non-blocking)
  // This executes in the background and will not slow down the app startup or require an internet connection to display the routine.
  
  // A. Config fetch
  fetch('config.json?t=' + Date.now())
    .then(res => { if (!res.ok) throw new Error(); return res.json(); })
    .then(configData => {
      let needsRefresh = false;
      if (configData.activeDays) {
        CONFIG.activeDays = configData.activeDays;
        if (!CONFIG.activeDays.includes(State.currentViewDayIdx)) { State.currentViewDayIdx = CONFIG.activeDays[0]; needsRefresh = true; }
        if (!CONFIG.activeDays.includes(State.selectedDay)) { State.selectedDay = CONFIG.activeDays[0]; needsRefresh = true; }
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
    })
    .catch(() => { /* Silent fallback: offline or config unchanged */ });

  // B. Schedule fetch
  fetch('schedule.json?t=' + Date.now())
    .then(res => { if (!res.ok) throw new Error(); return res.json(); })
    .then(data => {
      const freshSchedule = normalizeSchedule(data);
      // Compare if it actually changed to avoid unnecessary renders
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

  // C. Announcements fetch
  if (FEATURES.announcements) {
    Announcements.fetchAll().then(fetched => {
      if (fetched) {
        State.lastRenderedMinute = -1; // Bypass throttle to apply overrides immediately
        updateDashboard();
      }
    }).catch(() => { /* Silent fallback: offline */ });
  }
}
