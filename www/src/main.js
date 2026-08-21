/**
 * main.js — Application Entry Point
 *
 * Imports all feature modules and wires up the app.
 * To disable a feature: set it to false in src/features.js
 */

import { FEATURES } from './features.js';
import { DOM } from './core/dom.js';
import { State } from './core/state.js';
import { CONFIG } from './core/config.js';
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

/* ── Main View Switching & Dock State Manager ───────────────── */
export function switchAppView(viewId, payload) {
  const dashboardView = document.getElementById('dashboardView');
  const appsHubView = document.getElementById('appsHubView');
  const facultyAppView = document.getElementById('facultyAppView');
  const announcementsAppView = document.getElementById('announcementsAppView');
  const postAnnounceAppView = document.getElementById('postAnnounceAppView');

  const dockHomeBtn = document.getElementById('dockHomeBtn');
  const dockAppsBtn = document.getElementById('dockAppsBtn');
  const dockNoticesBtn = document.getElementById('dockNoticesBtn');

  const prevViewId = window.__currentAppViewId || 'home';
  if (prevViewId === 'announcements' && viewId !== 'announcements' && viewId !== 'post_announcement') {
    if (window.__markAnnouncementsAsRead) {
      window.__markAnnouncementsAsRead();
    }
  }
  window.__currentAppViewId = viewId;

  // Hide all view panels
  if (dashboardView) dashboardView.style.display = 'none';
  if (appsHubView) appsHubView.style.display = 'none';
  if (facultyAppView) facultyAppView.style.display = 'none';
  if (announcementsAppView) announcementsAppView.style.display = 'none';
  if (postAnnounceAppView) postAnnounceAppView.style.display = 'none';

  // Clear dock active classes
  if (dockHomeBtn) dockHomeBtn.classList.remove('active');
  if (dockAppsBtn) dockAppsBtn.classList.remove('active');
  if (dockNoticesBtn) dockNoticesBtn.classList.remove('active');

  if (viewId === 'home') {
    if (dashboardView) dashboardView.style.display = 'flex';
    if (dockHomeBtn) dockHomeBtn.classList.add('active');
  } else if (viewId === 'apps') {
    if (appsHubView) {
      appsHubView.style.display = 'flex';
      appsHubView.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (dockAppsBtn) dockAppsBtn.classList.add('active');
  } else if (viewId === 'faculty') {
    if (facultyAppView) {
      facultyAppView.style.display = 'flex';
      facultyAppView.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (dockAppsBtn) dockAppsBtn.classList.add('active');
    if (window.__renderFacultyDirectory) {
      window.__renderFacultyDirectory();
    }
  } else if (viewId === 'announcements') {
    if (announcementsAppView) {
      announcementsAppView.style.display = 'flex';
      announcementsAppView.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (dockNoticesBtn) dockNoticesBtn.classList.add('active');
    if (window.__fetchAndRenderAnnouncements) {
      window.__fetchAndRenderAnnouncements();
    }
  } else if (viewId === 'post_announcement') {
    if (postAnnounceAppView) {
      postAnnounceAppView.style.display = 'flex';
      postAnnounceAppView.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (dockNoticesBtn) dockNoticesBtn.classList.add('active');
    if (window.__openPostAnnounceForm) {
      window.__openPostAnnounceForm(payload);
    }
  }
}
window.switchAppView = switchAppView;

// Set default active tab
const dockHomeBtn = document.getElementById('dockHomeBtn');
if (dockHomeBtn) {
  dockHomeBtn.classList.add('active');
  dockHomeBtn.addEventListener('click', () => switchAppView('home'));
}

const dockRoutineBtn = document.getElementById('dockRoutineBtn');
if (dockRoutineBtn) {
  dockRoutineBtn.addEventListener('click', () => openModal(DOM.viewModal, renderWeeklyMatrix));
}

const dockCenterFab = document.getElementById('dockCenterFab');
if (dockCenterFab) {
  dockCenterFab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    switchAppView('home');
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
  dockNoticesBtn.addEventListener('click', () => switchAppView('announcements'));
}

const dockAppsBtn = document.getElementById('dockAppsBtn');
if (dockAppsBtn) {
  dockAppsBtn.addEventListener('click', () => switchAppView('apps'));
}

/* ── Campus Apps Hub Actions ─────────────────────────────────── */
const appHubFaculty = document.getElementById('appHubFaculty');
if (appHubFaculty) {
  appHubFaculty.addEventListener('click', () => switchAppView('faculty'));
}

const appHubFreeRooms = document.getElementById('appHubFreeRooms');
if (appHubFreeRooms) {
  appHubFreeRooms.addEventListener('click', async () => {
    const freeRoomsModal = document.getElementById('freeRoomsModal');
    if (freeRoomsModal) {
      const { loadMasterRoomData, renderFreeRoomsModal } = await import('./rooms/room-modal.js');
      openModal(freeRoomsModal);
      await loadMasterRoomData(true);
      renderFreeRoomsModal();
    }
  });
}

const appHubRoutineMatrix = document.getElementById('appHubRoutineMatrix');
if (appHubRoutineMatrix) {
  appHubRoutineMatrix.addEventListener('click', () => {
    openModal(DOM.viewModal, renderWeeklyMatrix);
  });
}

const appHubSettings = document.getElementById('appHubSettings');
if (appHubSettings) {
  appHubSettings.addEventListener('click', () => {
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
[DOM.viewModal, DOM.editModal, DOM.notifModal, DOM.classDetailModal, DOM.confirmModal]
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
