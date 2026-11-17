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
import { openCalendarPicker } from './timeline/calendar-picker.js';
import { renderWeeklyMatrix } from './weekly-matrix/matrix.js';
import { renderTimeline } from './timeline/timeline.js';
import { initKeyboard } from './events/keyboard.js';
import { initVisibility } from './events/visibility.js';
import { initServiceWorker } from './events/service-worker.js';
import { initializeApp } from './events/init.js';

// Self-registering modules (run on import)
import './toast/toast.js';           // registers undo button listener
import { NativePush } from './notifications/native-push.js'; // also calls setNativePush()
import './timeline/day-switcher.js'; // registers prev/next day buttons

// Connect Particles to modal system (avoids circular import)
setParticlesRef(Particles);

/* ── View Weekly Matrix modal ─────────────────────────────────── */
document.getElementById('vrB').addEventListener('click', () => openModal(DOM.viewModal, renderWeeklyMatrix));
document.getElementById('vcC').addEventListener('click', () => closeModal(DOM.viewModal));

/* ── Pages that sit under the dock ───────────────────────────
   These .mo pages leave the dock tappable, so any navigation must close them first or the new
   view opens underneath. (Sheets and dialogs above z-index 1000 cover the dock and are closed by
   their own controls.) Returns true if anything was open. */
const DOCK_REACHABLE_PAGES = ['viewModal', 'editModal', 'notifModal', 'androidAppModal'];
export function closeDockReachablePages({ except } = {}) {
  let closedAny = false;
  for (const id of DOCK_REACHABLE_PAGES) {
    if (id === except) continue;
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === 'androidAppModal') {
      // Shown via inline display (not .open); its own close handler records the dismissal
      if (el.style.display !== 'flex') continue;
      closedAny = true;
      const btn = document.getElementById('androidAppModalClose');
      if (btn) btn.click(); else el.style.display = 'none';
      continue;
    }
    if (!el.classList.contains('open')) continue;
    closedAny = true;
    closeModal(el);
  }
  return closedAny;
}

const DOCK_BTN_FOR_VIEW = {
  home: 'dockHomeBtn', apps: 'dockAppsBtn', faculty: 'dockAppsBtn', free_rooms: 'dockAppsBtn',
  announcements: 'dockNoticesBtn', post_announcement: 'dockNoticesBtn'
};

/* ── Main View Switching & Dock State Manager ───────────────── */
export function switchAppView(viewId, payload) {
  closeDockReachablePages();

  const dashboardView = document.getElementById('dashboardView');
  const appsHubView = document.getElementById('appsHubView');
  const facultyAppView = document.getElementById('facultyAppView');
  const announcementsAppView = document.getElementById('announcementsAppView');
  const postAnnounceAppView = document.getElementById('postAnnounceAppView');
  const freeRoomsAppView = document.getElementById('freeRoomsAppView');

  const dockHomeBtn = document.getElementById('dockHomeBtn');
  const dockAppsBtn = document.getElementById('dockAppsBtn');
  const dockNoticesBtn = document.getElementById('dockNoticesBtn');

  const previousViewId = window.__currentAppViewId;
  window.__currentAppViewId = viewId;
  if (window.__updateAmbient) window.__updateAmbient(true);

  // Pages open at the top. Reset the outgoing page now, while its layout is still clean;
  // scrolling the incoming page right after showing it forced a full synchronous layout.
  // (Chrome keeps a hidden element's scroll position, so the reset carries over.)
  const outgoing = previousViewId && previousViewId !== viewId && previousViewId !== 'home'
    ? document.getElementById(VIEW_ELEMENT_IDS[previousViewId]) : null;
  if (outgoing && outgoing.scrollTop) outgoing.scrollTop = 0;

  // Hide all view panels
  if (dashboardView) dashboardView.style.display = 'none';
  if (appsHubView) appsHubView.style.display = 'none';
  if (facultyAppView) facultyAppView.style.display = 'none';
  if (announcementsAppView) announcementsAppView.style.display = 'none';
  if (postAnnounceAppView) postAnnounceAppView.style.display = 'none';
  if (freeRoomsAppView) freeRoomsAppView.style.display = 'none';

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
    }
    if (dockAppsBtn) dockAppsBtn.classList.add('active');
  } else if (viewId === 'faculty') {
    if (facultyAppView) {
      facultyAppView.style.display = 'flex';
    }
    if (dockAppsBtn) dockAppsBtn.classList.add('active');
    if (window.__renderFacultyDirectory) {
      window.__renderFacultyDirectory();
    }
  } else if (viewId === 'announcements') {
    if (announcementsAppView) {
      announcementsAppView.style.display = 'flex';
    }
    if (dockNoticesBtn) dockNoticesBtn.classList.add('active');
    if (window.__fetchAndRenderAnnouncements) {
      window.__fetchAndRenderAnnouncements();
    }
  } else if (viewId === 'post_announcement') {
    if (postAnnounceAppView) {
      postAnnounceAppView.style.display = 'flex';
    }
    if (dockNoticesBtn) dockNoticesBtn.classList.add('active');
    if (window.__openPostAnnounceForm) {
      window.__openPostAnnounceForm(payload);
    }
  } else if (viewId === 'free_rooms') {
    if (freeRoomsAppView) {
      freeRoomsAppView.style.display = 'flex';
    }
    if (dockAppsBtn) dockAppsBtn.classList.add('active');
    if (window.__renderFreeRooms) {
      window.__renderFreeRooms();
    }
  }

  animateViewEnter(viewId, previousViewId);
}

/* Page transition: the new page cross-fades in (calm motion: no slide or rise).
   Web Animations API: no forced layout to restart a CSS animation (the old `void offsetWidth`
   laid out the whole freshly shown page synchronously, e.g. 92 Faculty rows, on every switch). */
const VIEW_ELEMENT_IDS = {
  home: 'dashboardView', apps: 'appsHubView', faculty: 'facultyAppView',
  announcements: 'announcementsAppView', post_announcement: 'postAnnounceAppView', free_rooms: 'freeRoomsAppView'
};
const VIEW_DEPTH = { home: 0, apps: 1, announcements: 1, faculty: 2, free_rooms: 2, post_announcement: 2 };
function animateViewEnter(viewId, previousViewId) {
  if (!previousViewId || previousViewId === viewId) return;
  const el = document.getElementById(VIEW_ELEMENT_IDS[viewId]);
  if (!el) return;
  const from = VIEW_DEPTH[previousViewId] ?? 0;
  const to = VIEW_DEPTH[viewId] ?? 0;
  el.dataset.dir = to > from ? 'forward' : (to < from ? 'back' : 'same');
  const tier = document.documentElement.dataset.motion;
  if (tier === 'off' || !el.animate) return;
  if (el._viewAnim) el._viewAnim.cancel();
  el._viewAnim = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: tier === 'lite' ? 140 : 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  el._viewAnim.onfinish = () => { el._viewAnim = null; };
}
window.__currentAppViewId = 'home';
window.switchAppView = switchAppView;

/* Dock reflects the Weekly Routine page while it is open (it's a .mo-page, not an app view).
   On close it highlights the tab for the current view, which may have changed if the page was
   closed by navigating (observer callbacks run after switchAppView has already updated it). */
(function syncDockWithRoutinePage() {
  const routinePage = DOM.viewModal;
  if (!routinePage) return;
  const ids = ['dockHomeBtn', 'dockRoutineBtn', 'dockNoticesBtn', 'dockAppsBtn'];
  let wasOpen = false;
  new MutationObserver(() => {
    const isOpen = routinePage.classList.contains('open');
    if (isOpen === wasOpen) return;
    wasOpen = isOpen;
    const btns = ids.map(id => document.getElementById(id)).filter(Boolean);
    const activeId = isOpen ? 'dockRoutineBtn' : DOCK_BTN_FOR_VIEW[window.__currentAppViewId || 'home'];
    btns.forEach(b => b.classList.toggle('active', b.id === activeId));
  }).observe(routinePage, { attributes: true, attributeFilter: ['class'] });
})();

// Set default active tab
const dockHomeBtn = document.getElementById('dockHomeBtn');
if (dockHomeBtn) {
  dockHomeBtn.classList.add('active');
  dockHomeBtn.addEventListener('click', () => switchAppView('home'));
}

const dockRoutineBtn = document.getElementById('dockRoutineBtn');
if (dockRoutineBtn) {
  dockRoutineBtn.addEventListener('click', () => {
    closeDockReachablePages({ except: 'viewModal' });
    openModal(DOM.viewModal, renderWeeklyMatrix);
  });
}

const dockCenterFab = document.getElementById('dockCenterFab');
if (dockCenterFab) {
  // Tap: go Home; on Home jump to today, or refresh if already on today. Hold: open the calendar.
  let holdTimer = null;
  let held = false;
  const HOLD_MS = 450;
  dockCenterFab.addEventListener('pointerdown', () => {
    held = false;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      held = true;
      if (window.__motion) window.__motion.haptic('heavy');
      closeDockReachablePages();
      if ((window.__currentAppViewId || 'home') !== 'home') switchAppView('home');
      openCalendarPicker();
    }, HOLD_MS);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => dockCenterFab.addEventListener(t, () => clearTimeout(holdTimer)));
  dockCenterFab.addEventListener('contextmenu', e => e.preventDefault());

  dockCenterFab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (held) { held = false; return; }

    const currentView = window.__currentAppViewId || 'home';
    if (closeDockReachablePages() || currentView !== 'home') {
      switchAppView('home');
      return;
    }

    const now = new Date();
    const viewing = State.viewDate || now;
    const onToday = viewing.toDateString() === now.toDateString();
    if (!onToday && window.__pickCalendarDate) {
      window.__pickCalendarDate(now.getFullYear(), now.getMonth(), now.getDate());
      return;
    }
    // Already on today: refresh in place (same as pull-to-refresh) with a spin of the icon
    dockCenterFab.classList.remove('is-refreshing');
    void dockCenterFab.offsetWidth;
    dockCenterFab.classList.add('is-refreshing');
    setTimeout(() => dockCenterFab.classList.remove('is-refreshing'), 800);
    if (window.__refreshHome) window.__refreshHome();
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
const appsHubPageBackBtn = document.getElementById('appsHubPageBackBtn');
if (appsHubPageBackBtn) {
  appsHubPageBackBtn.addEventListener('click', () => switchAppView('home'));
}

const appHubFaculty = document.getElementById('appHubFaculty');
if (appHubFaculty) {
  appHubFaculty.addEventListener('click', () => switchAppView('faculty'));
}

const appHubFreeRooms = document.getElementById('appHubFreeRooms');
if (appHubFreeRooms) {
  appHubFreeRooms.addEventListener('click', () => switchAppView('free_rooms'));
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

/* ── Notifications page (Settings → Notifications) ────────────── */
const notifSettingsBtn = document.getElementById('notifSettingsBtn');
if (notifSettingsBtn) {
  notifSettingsBtn.addEventListener('click', () => {
    openModal(DOM.notifModal, () => {
      refreshHealthUI();
      import('./notifications/notif-center.js').then(m => { m.initNotifCenter(); m.renderNotifCenter(); });
      const md = DOM.notifModal && DOM.notifModal.querySelector('.md');
      if (md) md.scrollTop = 0;
    });
  });
}
const notifModalClose = document.getElementById('notifModalClose');
if (notifModalClose) {
  notifModalClose.addEventListener('click', () => closeModal(DOM.notifModal));
}


/* ── Dynamic feature imports (parallel for faster boot) ───────── */
await Promise.all([
  FEATURES.editSchedule ? Promise.all([
    import('./edit-schedule/editor.js'),
    import('./settings/settings-page.js')
  ]).then(([{ populateDaySelect, renderEditColumns, initEditorEvents, updateEditModalCacheInfo, resetEditorUI }, { initSettingsPage, onSettingsOpen }]) => {
    initEditorEvents();
    initSettingsPage();
    document.getElementById('editBtn').addEventListener('click', () => {
      openModal(DOM.editModal, () => {
        State.selectedDay = CONFIG.activeDays.includes(new Date().getDay()) ? new Date().getDay() : CONFIG.activeDays[0];
        populateDaySelect();
        renderEditColumns();
        updateEditModalCacheInfo();
        resetEditorUI();
        onSettingsOpen();
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

import { initMotion } from './core/motion-engine.js';
import { initBackButton } from './events/back-button.js';
import { initNotificationHealth, refreshHealthUI } from './notifications/health.js';
import { initAmbient } from './core/ambient.js';
import { initTips } from './core/tips.js';
import { initTestTime } from './settings/test-time.js';
import { checkFirstTimeOnboarding } from './events/onboarding.js';
import { initAndroidPrompt } from './banners/android-prompt.js';
import { initWidgetPinningUI } from './widget/widget.js';
import { initFreeRoomsUI } from './rooms/rooms-view.js';
import { initTeacherFinderUI } from './teachers/teacher-modal.js';
import { initCalendarPicker } from './timeline/calendar-picker.js';

/* ── Boot ─────────────────────────────────────────────────────── */
// Motion v2: ripples, haptics, staggers, sheet drag, pull-to-refresh (soft refresh, no reload).
// Replaces events/pull-to-refresh.js, which reloaded the whole app on any downward swipe.
initMotion();
initBackButton();
initNotificationHealth();
initAmbient();
initTips();
initTestTime();
// App-launch entrance: the one orchestrated, non-triggered animation (see motion.css §5).
document.body.classList.add('boot-enter');
setTimeout(() => document.body.classList.remove('boot-enter'), 1100);
initializeApp();
// Silently (re-)register for announcement pushes when permission was already granted.
// Runs every launch, so the server's semester/section targeting stays current after a section change.
if (FEATURES.notifications) NativePush.init({ prompt: false });
checkFirstTimeOnboarding();
initAndroidPrompt();
initWidgetPinningUI();
initFreeRoomsUI();
initTeacherFinderUI();
initCalendarPicker();
