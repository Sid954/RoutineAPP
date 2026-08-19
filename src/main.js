/**
 * main.js — Application Entry Point
 *
 * Imports all feature modules and wires up the app.
 * To disable a feature: set it to false in src/features.js
 */

import { FEATURES } from './features.js';
import { DOM } from './core/dom.js';
import { State } from './core/state.js';
import { CONFIG, FULL_COURSE_NAMES } from './core/config.js';
import { escapeHtml, toMinutes, parseTo24h, formatRoom } from './core/utils.js';
import { openModal, closeModal, setParticlesRef } from './modals/modal.js';
import { Particles } from './particles/particles.js';
import { Notifications } from './notifications/notifications.js';
import { renderWeeklyMatrix } from './weekly-matrix/matrix.js';
import { renderTimeline } from './timeline/timeline.js';
import { initKeyboard } from './events/keyboard.js';
import { initVisibility } from './events/visibility.js';
import { initServiceWorker } from './events/service-worker.js';
import { initializeApp } from './events/init.js';

// Self-registering modules (run on import)
import './toast/toast.js';           // registers undo button listener
import './notifications/native-push.js'; // calls setNativePush()
import './timeline/day-switcher.js'; // registers prev/next day buttons

// Connect Particles to modal system (avoids circular import)
setParticlesRef(Particles);

/* ── View Weekly Matrix modal ─────────────────────────────────── */
document.getElementById('vrB').addEventListener('click', () => openModal(DOM.viewModal, renderWeeklyMatrix));
document.getElementById('vcC').addEventListener('click', () => closeModal(DOM.viewModal));

const dockRoutineBtn = document.getElementById('dockRoutineBtn');
if (dockRoutineBtn) {
  dockRoutineBtn.addEventListener('click', () => openModal(DOM.viewModal, renderWeeklyMatrix));
}

const dockCenterFab = document.getElementById('dockCenterFab');
if (dockCenterFab) {
  dockCenterFab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const today = new Date();
    State.viewDate = today;
    State.currentViewDayIdx = today.getDay();
    State.lastRenderedMinute = -1;
    renderTimeline(true);
    const chg = document.getElementById('chG');
    if (chg) {
      chg.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

const dockNoticesBtn = document.getElementById('dockNoticesBtn');
if (dockNoticesBtn) {
  dockNoticesBtn.addEventListener('click', () => {
    const announceBtn = document.getElementById('announcementsBtn');
    if (announceBtn) announceBtn.click();
  });
}

/* ── Campus Apps Hub modal ────────────────────────────────────── */
const appsModal = document.getElementById('appsModal');
const dockAppsBtn = document.getElementById('dockAppsBtn');
const appsModalClose = document.getElementById('appsModalClose');

if (dockAppsBtn && appsModal) {
  dockAppsBtn.addEventListener('click', () => openModal(appsModal));
}
if (appsModalClose && appsModal) {
  appsModalClose.addEventListener('click', () => closeModal(appsModal));
}

const appHubFreeRooms = document.getElementById('appHubFreeRooms');
if (appHubFreeRooms) {
  appHubFreeRooms.addEventListener('click', () => {
    if (appsModal) closeModal(appsModal);
    const freeRoomsModal = document.getElementById('freeRoomsModal');
    if (freeRoomsModal) openModal(freeRoomsModal);
  });
}

const appHubFaculty = document.getElementById('appHubFaculty');
if (appHubFaculty) {
  appHubFaculty.addEventListener('click', () => {
    if (appsModal) closeModal(appsModal);
    const teacherFinderModal = document.getElementById('teacherFinderModal');
    if (teacherFinderModal) openModal(teacherFinderModal);
  });
}

const appHubRoutineMatrix = document.getElementById('appHubRoutineMatrix');
if (appHubRoutineMatrix) {
  appHubRoutineMatrix.addEventListener('click', () => {
    if (appsModal) closeModal(appsModal);
    openModal(DOM.viewModal, renderWeeklyMatrix);
  });
}

const appHubSettings = document.getElementById('appHubSettings');
if (appHubSettings) {
  appHubSettings.addEventListener('click', () => {
    if (appsModal) closeModal(appsModal);
    const editBtn = document.getElementById('editBtn');
    if (editBtn) editBtn.click();
  });
}

// Mobile landscape rotate FAB
const rotateFab = document.getElementById('mobileRotateFab');
if (rotateFab) {
  rotateFab.addEventListener('click', () => DOM.viewModal.classList.toggle('rotated-mode'));
}

/* ── Notification Settings modal ──────────────────────────────── */
const notifSettingsBtn = document.getElementById('notifSettingsBtn');
if (notifSettingsBtn) {
  notifSettingsBtn.addEventListener('click', () => {
    openModal(DOM.notifModal, () => Notifications.updatePermissionUI());
  });
}
const notifModalClose = document.getElementById('notifModalClose');
if (notifModalClose) {
  notifModalClose.addEventListener('click', () => closeModal(DOM.notifModal));
}


/* ── Dynamic feature imports (parallel for faster boot) ───────── */
await Promise.all([
  FEATURES.editSchedule ? import('./edit-schedule/editor.js').then(({ populateDaySelect, renderEditColumns, initEditorEvents, updateEditModalCacheInfo }) => {
    initEditorEvents();
    document.getElementById('editBtn').addEventListener('click', () => {
      openModal(DOM.editModal, () => {
        State.selectedDay = CONFIG.activeDays.includes(new Date().getDay()) ? new Date().getDay() : CONFIG.activeDays[0];
        populateDaySelect();
        renderEditColumns();
        updateEditModalCacheInfo();
        const addForm = document.getElementById('addClassForm');
        const addBtn = document.getElementById('toggleAddClassBtn');
        if (addForm && addBtn) {
          addForm.style.display = 'none';
          addBtn.textContent = '+ Add Class';
          addBtn.style.borderColor = '';
          addBtn.style.color = '';
        }
      });
    });
    document.getElementById('ecC').addEventListener('click', () => closeModal(DOM.editModal));
  }) : null,

  FEATURES.announcements ? Promise.all([
    import('./announcements/announcements.js'),
    import('./announcements/post-form.js')
  ]).then(([{ initAnnouncementEvents }, { initPostForm }]) => {
    initAnnouncementEvents();
    initPostForm();
  }) : null,

  FEATURES.notifBanner ? import('./banners/notif-banner.js').then(({ initNotifBanner }) => initNotifBanner()) : null,
  FEATURES.installBanner ? import('./banners/install-banner.js').then(({ initInstallBanner }) => initInstallBanner()) : null,
  FEATURES.particles ? import('./events/resize.js').then(({ initResize }) => initResize()) : null,
].filter(Boolean));

/* ── Close modals on backdrop click ──────────────────────────── */
[DOM.viewModal, DOM.editModal, DOM.notifModal, DOM.announceModal, DOM.postAnnounceModal, DOM.notifHistoryModal, DOM.classDetailModal, DOM.confirmModal]
  .filter(Boolean)
  .forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
  });

if (DOM.classDetailClose) {
  DOM.classDetailClose.addEventListener('click', () => closeModal(DOM.classDetailModal));
}

/* ── Render & Show Class details popover modal on click ─────────────── */
import { initClassDetailEvents, showClassDetails } from './timeline/class-detail.js';

initClassDetailEvents();

document.addEventListener('click', e => {
  const card = e.target.closest('.t-card, .m-matrix-card, .ch, .resting-class-row');
  if (card && card.dataset.detail) {
    if (e.target.closest('button, a, select, input')) return;
    try {
      const data = JSON.parse(card.dataset.detail);
      showClassDetails(data);
    } catch (err) {
      console.error('Failed to parse card details:', err);
    }
  }
});

/* ── Global handlers ──────────────────────────────────────────── */
initKeyboard();
initVisibility();
initServiceWorker();

import { initPullToRefresh } from './events/pull-to-refresh.js';
import { checkFirstTimeOnboarding } from './events/onboarding.js';
import { initAndroidPrompt } from './banners/android-prompt.js';
import { initWidgetPinningUI } from './widget/widget.js';
import { initRoomFinderUI } from './rooms/room-modal.js';
import { initTeacherFinderUI } from './teachers/teacher-modal.js';
import { initCalendarPicker } from './timeline/calendar-picker.js';

/* ── Boot ─────────────────────────────────────────────────────── */
initPullToRefresh();
initializeApp();
checkFirstTimeOnboarding();
initAndroidPrompt();
initWidgetPinningUI();
initRoomFinderUI();
initTeacherFinderUI();
initCalendarPicker();
