import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { FULL_COURSE_NAMES, DAY_NAMES } from '../core/config.js';
import { format12h, formatRoom, escapeHtml } from '../core/utils.js';
import { getFullName, getTeacherInfo } from '../teachers/teacher-names.js';
import { openModal, closeModal } from '../modals/modal.js';

let _activeModalTeacherCode = 'MHE';

export function getWeeklyRecurrences(courseCode) {
  const cleanCode = (courseCode || '').toUpperCase().trim();
  const recurrences = [];
  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'];
  const dayIndexMap = { Saturday: 6, Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3 };

  days.forEach(dayName => {
    const dayIdx = dayIndexMap[dayName];
    const list = State.schedule[dayIdx] || State.schedule[dayName] || [];
    list.forEach(item => {
      const itemCode = (item.subject || item.title || '').toUpperCase().trim();
      if (itemCode === cleanCode) {
        recurrences.push({
          day: dayName,
          dayShort: dayName.substring(0, 3).toUpperCase(),
          time: `${format12h(item.start)} – ${format12h(item.end)}`,
          room: formatRoom(item.room) || 'TBA',
          instructor: item.instructor || '',
          type: item.type
        });
      }
    });
  });

  return recurrences;
}

export function showClassDetails(data) {
  const modal = document.getElementById('classDetailModal');
  if (!modal || !data) return;

  const code = (data.code || data.title || '').toUpperCase().trim();
  const fullTitle = FULL_COURSE_NAMES[code] || data.name || code;
  const isLab = (data.type || '').toLowerCase() === 'lab';
  const cleanRoom = formatRoom(data.room) || 'TBA';
  const teacherCode = (data.instructor || data.teacher || '').trim();
  const info = getTeacherInfo(teacherCode);
  const teacherName = data.instructorName || info.name || teacherCode || 'Not Assigned';
  const desigText = info.designation || 'Assistant Professor';
  const initials = (teacherName || teacherCode).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  _activeModalTeacherCode = teacherCode;

  const currentDayName = DAY_NAMES[new Date().getDay()];
  const recurrences = getWeeklyRecurrences(code);

  // Contextual Icon for Subject
  let iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>';
  if (code === 'DSL' || code === 'DS') {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
  } else if (code === 'ICMP' || code === 'PHYL') {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 21a9 9 0 0 0 9-9 9 9 0 0 0-9-9 9 9 0 0 0-9 9 9 9 0 0 0 9 9z"/><path d="M3.6 9h16.8"/><path d="M3.6 15h16.8"/></svg>';
  } else if (code === 'EE' || code === 'IEE' || code === 'IEEL') {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
  } else if (code === 'DMNT' || code === 'DM') {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg>';
  }

  const iconEl = document.getElementById('modalSquircleIcon');
  const codeEl = document.getElementById('modalCourseCode');
  const titleEl = document.getElementById('modalFullTitle');
  const timingEl = document.getElementById('modalTiming');
  const durationEl = document.getElementById('modalDuration');
  const roomEl = document.getElementById('modalRoom');
  const teacherEl = document.getElementById('modalInstructor');
  const formatEl = document.getElementById('modalFormat');
  const badgeEl = document.getElementById('modalTypeBadge');
  const countEl = document.getElementById('modalRecurrenceCount');
  const listEl = document.getElementById('modalRecurrenceList');
  const avatarEl = document.getElementById('modalInstructorAvatar');
  const desigEl = document.getElementById('modalInstructorDesig');

  if (iconEl) iconEl.innerHTML = iconSvg;
  if (codeEl) codeEl.textContent = code;
  if (titleEl) titleEl.textContent = fullTitle;
  if (timingEl) timingEl.textContent = data.timing || `${data.start} – ${data.end}`;
  if (durationEl) durationEl.textContent = `${data.duration || '1h 15m'} session`;
  if (roomEl) roomEl.textContent = `Room ${cleanRoom}`;
  if (teacherEl) teacherEl.textContent = teacherName;
  if (formatEl) formatEl.textContent = isLab ? 'Laboratory Session' : 'Theory Lecture';

  if (avatarEl) {
    if (info.photo) {
      avatarEl.innerHTML = `<span class="faculty-avatar-initials">${escapeHtml(initials)}</span><img src="${escapeHtml(info.photo)}" alt="${escapeHtml(teacherCode)}" loading="lazy" decoding="async" onload="this.classList.add('loaded');" onerror="this.remove();" />`;
    } else {
      avatarEl.innerHTML = `<span class="faculty-avatar-initials">${escapeHtml(initials)}</span>`;
    }
  }

  if (desigEl) {
    desigEl.textContent = desigText;
  }

  if (badgeEl) {
    badgeEl.textContent = isLab ? '★ LAB' : 'THEORY';
    badgeEl.className = `resting-tag ${isLab ? 'lab' : 'theory'}`;
  }

  if (countEl) {
    const totalCount = recurrences.length || 1;
    countEl.textContent = `${totalCount} ${totalCount === 1 ? 'SESSION' : 'SESSIONS'} / WEEK`;
  }

  if (listEl) {
    let recHtml = '';
    const displayList = recurrences.length ? recurrences : [{
      day: currentDayName,
      dayShort: currentDayName.substring(0, 3).toUpperCase(),
      time: data.timing || `${data.start} – ${data.end}`,
      room: cleanRoom
    }];

    displayList.forEach(r => {
      const isCurrent = (r.day === currentDayName);
      recHtml += `
        <div class="recurrence-card-row ${isCurrent ? 'is-active-session' : ''}">
          <div class="recurrence-row-left">
            <span class="recurrence-day-chip">${r.dayShort}</span>
            <span class="recurrence-row-time">${r.time}</span>
          </div>
          <div class="recurrence-row-right">
            <span class="recurrence-room-label">Room ${r.room}</span>
            ${isCurrent ? '<span class="recurrence-active-badge">ACTIVE</span>' : ''}
          </div>
        </div>
      `;
    });
    listEl.innerHTML = recHtml;
  }

  openModal(modal);
}

export function closeClassDetails() {
  const modal = document.getElementById('classDetailModal');
  if (modal) closeModal(modal);
}

export function initClassDetailEvents() {
  const modal = document.getElementById('classDetailModal');
  const closeBtn = document.getElementById('classDetailClose');
  const instructorTile = document.getElementById('modalInstructorTile');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeClassDetails);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeClassDetails();
    });
  }

  if (instructorTile) {
    instructorTile.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const code = _activeModalTeacherCode;
      if (!code || code === 'TBA' || code === '—' || code === 'Not Assigned') return;
      if (typeof window.openTeacherDetailByCode === 'function') {
        window.openTeacherDetailByCode(code);
      } else if (typeof window.__openTeacherProfileByCode === 'function') {
        window.__openTeacherProfileByCode(code);
      }
    });
  }

  window.openClassDetailSheet = showClassDetails;
  window.closeClassDetailSheet = closeClassDetails;
}
