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
function showClassDetails(data) {
  const body = DOM.classDetailBody;
  const titleEl = document.getElementById('cdTitle');
  if (!body || !titleEl) return;

  const fullSubjectName = FULL_COURSE_NAMES[data.title.toUpperCase()] || 'Elective / Specialized Course';
  titleEl.textContent = 'Class Details';

  let accentColor = 'var(--accent)';
  let accentColorLight = 'var(--accent2)';
  let bgGradient = 'linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.8))';
  let badgeText = data.type || 'Theory';
  
  if (data.isExam) {
    accentColor = '#f97316';
    accentColorLight = '#fdba74';
    bgGradient = 'linear-gradient(135deg, rgba(124, 45, 18, 0.3), rgba(24, 24, 27, 0.8))';
    badgeText = `📝 ${data.examName || 'Exam'}`;
  } else if (data.isOnline) {
    accentColor = '#10b981';
    accentColorLight = '#6ee7b7';
    bgGradient = 'linear-gradient(135deg, rgba(6, 78, 59, 0.3), rgba(24, 24, 27, 0.8))';
    badgeText = '📡 ONLINE';
  } else if (data.isCancelled) {
    accentColor = '#f43f5e';
    accentColorLight = '#fca5a5';
    bgGradient = 'linear-gradient(135deg, rgba(136, 19, 55, 0.3), rgba(24, 24, 27, 0.8))';
    badgeText = data.cancellationType === 'holiday' ? '🎉 HOLIDAY' : '🚫 CANCELLED';
  } else if (data.type === 'Lab') {
    accentColor = '#8b5cf6';
    accentColorLight = '#c084fc';
    bgGradient = 'linear-gradient(135deg, rgba(88, 28, 135, 0.3), rgba(24, 24, 27, 0.8))';
    badgeText = '★ LAB';
  }

  // Calculate active progress bar
  let progressHtml = '';
  try {
    const currentMins = State.lastRenderedMinute !== -1 ? State.lastRenderedMinute : (new Date().getHours() * 60 + new Date().getMinutes());
    const startMins = toMinutes(parseTo24h(data.start));
    const endMins = toMinutes(parseTo24h(data.end));
    const isActive = currentMins >= startMins && currentMins < endMins && !data.isCancelled;
    if (isActive) {
      const elapsed = currentMins - startMins;
      const duration = endMins - startMins;
      const pct = Math.min(100, Math.max(0, (elapsed / duration) * 100));
      progressHtml = `
        <div style="margin-top: 14px; background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--rx); border: 1px solid rgba(255,255,255,0.03);">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: ${accentColorLight}; font-weight: 800; margin-bottom: 6px; letter-spacing: 0.5px;">
            <span>ACTIVE NOW</span>
            <span>${Math.round(pct)}% completed</span>
          </div>
          <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, ${accentColor}, ${accentColorLight}); box-shadow: 0 0 10px ${accentColor}; border-radius: 3px;"></div>
          </div>
        </div>
      `;
    }
  } catch (e) {
    console.warn(e);
  }

  let html = `
    <!-- Card Header Banner -->
    <div style="background: ${bgGradient}; border: 1.5px solid ${accentColor}; border-radius: var(--rx); padding: 16px; position: relative; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
      <div style="position: absolute; top: -20px; right: -20px; width: 80px; height: 80px; background: ${accentColor}; opacity: 0.08; border-radius: 50%; filter: blur(20px);"></div>
      
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
        <span style="font-family: var(--m); font-size: 26px; font-weight: 900; color: #fff; letter-spacing: -1px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${escapeHtml(data.title)}</span>
        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 12px; background: rgba(0,0,0,0.4); border: 1px solid ${accentColor}; color: ${accentColorLight}; letter-spacing: 1px; font-family: var(--m);">${badgeText}</span>
      </div>
      
      <div style="font-size: 13.5px; font-weight: 700; color: #e2e8f0; margin-top: 6px; line-height: 1.3;">
        ${escapeHtml(fullSubjectName)}
      </div>

      ${progressHtml}
    </div>

    <!-- Time Block Card -->
    <div style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.015); border: 1px solid var(--border); border-radius: var(--rx); padding: 12px 14px;">
      <span style="font-size: 20px; color: ${accentColorLight};">⏰</span>
      <div style="display: flex; flex-direction: column;">
        <span style="font-size: 10px; font-weight: 800; color: var(--dim); letter-spacing: 0.5px; text-transform: uppercase;">Class Timing</span>
        <span style="font-family: var(--m); font-size: 14.5px; font-weight: 800; color: #fff; margin-top: 1px;">${data.start} – ${data.end}</span>
      </div>
    </div>

    <!-- Details Grid -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <div style="background: rgba(255,255,255,0.015); border: 1px solid var(--border); border-radius: var(--rx); padding: 12px; display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 10px; font-weight: 800; color: var(--dim); letter-spacing: 0.5px; text-transform: uppercase;">📍 Location</span>
        <span style="font-size: 14px; font-weight: 800; color: ${data.isOnline ? 'var(--lime)' : '#fff'}; margin-top: 2px;">
          ${data.isOnline ? 'ONLINE' : (data.room ? `Room ${formatRoom(data.room)}` : 'TBA')}
        </span>
      </div>
      <div style="background: rgba(255,255,255,0.015); border: 1px solid var(--border); border-radius: var(--rx); padding: 12px; display: flex; flex-direction: column; gap: 4px; ${data.instructor && data.instructor !== 'Not Assigned' ? 'cursor: pointer;' : ''}" ${data.instructor && data.instructor !== 'Not Assigned' ? `class="teacher-clickable-badge" data-teacher-code="${escapeHtml(data.instructor)}" title="Click to view ${escapeHtml(data.instructor)}'s profile and routine"` : ''}>
        <span style="font-size: 10px; font-weight: 800; color: var(--dim); letter-spacing: 0.5px; text-transform: uppercase;">👤 Instructor</span>
        <span style="font-size: 14px; font-weight: 800; color: #fff; margin-top: 2px;">
          ${escapeHtml(data.instructor || 'Not Assigned')}
        </span>
      </div>
    </div>
  `;

  if (data.isExam && data.examTopics) {
    html += `
      <!-- Exam Topics Block -->
      <div style="background: rgba(249, 115, 22, 0.05); border: 1.5px dashed rgba(249, 115, 22, 0.4); border-radius: var(--rx); padding: 14px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 4px 16px rgba(249,115,22,0.08);">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 16px;">📝</span>
          <span style="font-weight: 800; color: #fdba74; font-size: 11.5px; letter-spacing: 1px; text-transform: uppercase; font-family: var(--m);">EXAM SYLLABUS / TOPICS</span>
        </div>
        <div style="color: #fff; font-weight: 600; line-height: 1.45; font-size: 13px; word-break: break-word; white-space: pre-wrap;">${escapeHtml(data.examTopics)}</div>
      </div>
    `;
  }

  if (data.isOnline && data.platform) {
    const isUrl = data.platform.startsWith('http://') || data.platform.startsWith('https://');
    html += `
      <!-- Online Meeting Link Card -->
      <div style="background: rgba(16, 185, 129, 0.04); border: 1.5px dashed rgba(16, 185, 129, 0.4); border-radius: var(--rx); padding: 14px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 16px;">📡</span>
          <span style="font-weight: 800; color: #6ee7b7; font-size: 11.5px; letter-spacing: 1px; text-transform: uppercase; font-family: var(--m);">ONLINE CLASS PLATFORM</span>
        </div>
        <div style="color: #fff; font-weight: 600; word-break: break-all; font-size: 12.5px;">${escapeHtml(data.platform)}</div>
        ${isUrl ? `
        <a href="${data.platform}" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 12px; border-radius: var(--rx); background: var(--lime); color: #000; font-weight: 900; text-decoration: none; font-size: 13.5px; text-align: center; margin-top: 4px; box-shadow: 0 4px 20px rgba(16,185,129,0.4); transition: transform 0.2s, filter 0.2s; letter-spacing: 0.5px;">
          Join Live Class 🚀
        </a>` : ''}
      </div>
    `;
  }

  if (data.isCancelled) {
    html += `
      <!-- Warning Banner -->
      <div style="background: rgba(244, 63, 94, 0.08); border: 1.5px dashed var(--pink); border-radius: var(--rx); padding: 14px; color: var(--pink2); font-weight: 800; text-align: center; text-transform: uppercase; font-size: 12.5px; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 16px rgba(244,63,94,0.1);">
        <span>⚠️</span> Class is Cancelled
      </div>
    `;
  }

  body.innerHTML = html;
  
  // Style modal border dynamically to match accent color!
  const modalWrapper = body.closest('.md');
  if (modalWrapper) {
    modalWrapper.style.borderColor = accentColor;
    modalWrapper.style.boxShadow = `0 24px 60px rgba(0,0,0,0.8), 0 0 30px ${accentColor}20`;
  }
  
  openModal(DOM.classDetailModal);
}

document.addEventListener('click', e => {
  const card = e.target.closest('.t-card, .m-matrix-card, .ch');
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

/* ── Boot ─────────────────────────────────────────────────────── */
initPullToRefresh();
initializeApp();
checkFirstTimeOnboarding();
initAndroidPrompt();
initWidgetPinningUI();
initRoomFinderUI();
initTeacherFinderUI();
