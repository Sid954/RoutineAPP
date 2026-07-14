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
import { NotificationLog } from './notifications/notification-log.js';
import { renderWeeklyMatrix } from './weekly-matrix/matrix.js';
import { initKeyboard } from './events/keyboard.js';
import { initVisibility } from './events/visibility.js';
import { initServiceWorker } from './events/service-worker.js';
import { initializeApp } from './events/init.js';
import { showToast } from './toast/toast.js';

// Self-registering modules (run on import)
import './toast/toast.js';           // registers undo button listener
import './notifications/native-push.js'; // calls setNativePush()
import './timeline/day-switcher.js'; // registers prev/next day buttons

// Connect Particles to modal system (avoids circular import)
setParticlesRef(Particles);

/* ── View Weekly Matrix modal ─────────────────────────────────── */
document.getElementById('vrB').addEventListener('click', () => openModal(DOM.viewModal, renderWeeklyMatrix));
document.getElementById('vcC').addEventListener('click', () => closeModal(DOM.viewModal));

// Mobile landscape rotate FAB
const rotateFab = document.getElementById('mobileRotateFab');
if (rotateFab) {
  rotateFab.addEventListener('click', () => DOM.viewModal.classList.toggle('rotated-mode'));
}

/* ── Notification Settings modal ──────────────────────────────── */
document.getElementById('notifSettingsBtn').addEventListener('click', () => {
  openModal(DOM.notifModal, () => Notifications.updatePermissionUI());
});
document.getElementById('notifModalClose').addEventListener('click', () => closeModal(DOM.notifModal));

/* ── Notification History ─────────────────────────────────────── */
if (FEATURES.notificationLog) {
  NotificationLog.initEvents();
}

/* ── Notification settings event listeners ────────────────────── */
if (FEATURES.notifications) {
  Notifications.initEvents();
}

/* ── Edit Schedule modal ──────────────────────────────────────── */
if (FEATURES.editSchedule) {
  const { populateDaySelect, renderEditColumns, initEditorEvents } = await import('./edit-schedule/editor.js');
  const { initImportExport } = await import('./edit-schedule/import-export.js');

  // initEditorEvents registers add/clear/reset/select listeners
  initEditorEvents();
  initImportExport();

  document.getElementById('editBtn').addEventListener('click', () => {
    openModal(DOM.editModal, () => {
      State.selectedDay = CONFIG.activeDays.includes(new Date().getDay()) ? new Date().getDay() : CONFIG.activeDays[0];
      populateDaySelect();
      renderEditColumns();
    });
  });
  document.getElementById('ecC').addEventListener('click', () => closeModal(DOM.editModal));
}

/* ── Announcements ────────────────────────────────────────────── */
if (FEATURES.announcements) {
  const { initAnnouncementEvents } = await import('./announcements/announcements.js');
  const { initPostForm } = await import('./announcements/post-form.js');
  initAnnouncementEvents();
  initPostForm();
}

/* ── Banners ──────────────────────────────────────────────────── */
if (FEATURES.notifBanner) {
  const { initNotifBanner } = await import('./banners/notif-banner.js');
  initNotifBanner();
}
if (FEATURES.installBanner) {
  const { initInstallBanner } = await import('./banners/install-banner.js');
  initInstallBanner();
}

/* ── Particles resize ─────────────────────────────────────────── */
if (FEATURES.particles) {
  const { initResize } = await import('./events/resize.js');
  initResize();
}

/* ── Close modals on backdrop click ──────────────────────────── */
[DOM.viewModal, DOM.editModal, DOM.notifModal, DOM.announceModal, DOM.postAnnounceModal, DOM.notifHistoryModal]
  .filter(Boolean)
  .forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
  });

/* ── Global handlers ──────────────────────────────────────────── */
initKeyboard();
initVisibility();
initServiceWorker();

/* ── Boot ─────────────────────────────────────────────────────── */
initializeApp();
