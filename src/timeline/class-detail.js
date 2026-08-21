import { State } from '../core/state.js';
import { FULL_COURSE_NAMES, DAY_NAMES } from '../core/config.js';
import { format12h, formatRoom, escapeHtml } from '../core/utils.js';
import { getTeacherInfo } from '../teachers/teacher-names.js';
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
  const listEl = document.getElementById('modalRecurrenceList');
  const avatarEl = document.getElementById('modalInstructorAvatar');
  const desigEl = document.getElementById('modalInstructorDesig');

  if (iconEl) iconEl.innerHTML = iconSvg;
  if (codeEl) codeEl.textContent = code;
  if (titleEl) titleEl.textContent = fullTitle;
  if (timingEl) {
    timingEl.textContent = data.timing || (data.hasExplicitEndTime && data.end ? `${data.start} – ${data.end}` : `Starts at ${data.start}`);
  }
  if (durationEl) {
    if (data.duration && data.hasExplicitEndTime !== false) {
      durationEl.style.display = 'block';
      durationEl.textContent = `${data.duration} session`;
    } else {
      durationEl.style.display = 'none';
    }
  }
  if (roomEl) roomEl.textContent = `Room ${cleanRoom}`;
  if (teacherEl) teacherEl.textContent = teacherName;
  if (formatEl) {
    if (data.isExtraClass) {
      formatEl.textContent = data.isOnline ? 'Extra Online Class' : 'Extra In-Person Class';
    } else {
      formatEl.textContent = isLab ? 'Laboratory Session' : 'Theory Lecture';
    }
  }

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

  // Handle Override Context (Exam Topics / Online Link / Cancellation)
  const overrideBox = document.getElementById('modalOverrideDetails');
  if (overrideBox) {
    if (data.isExam) {
      overrideBox.style.display = 'block';
      overrideBox.innerHTML = `
        <div class="class-detail-override-card exam">
          <div class="cd-override-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span>${escapeHtml(data.examName || 'Class Test / Exam')}</span>
          </div>
          <div class="cd-override-body">
            <div class="cd-override-topics-label">Syllabus / Topics:</div>
            <div class="cd-override-topics-text">${escapeHtml(data.examTopics || 'Topics not specified.')}</div>
          </div>
        </div>
      `;
    } else if (data.isOnline) {
      overrideBox.style.display = 'block';
      overrideBox.innerHTML = `
        <div class="class-detail-override-card online">
          <div class="cd-override-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>
            <span>Virtual Online Session</span>
          </div>
          <div class="cd-override-body">
            <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 4px;">This class will be conducted online for this date.</div>
            ${(() => {
              const platformStr = (data.onlinePlatform || '').trim();
              const isUrl = /^https?:\/\//i.test(platformStr);
              if (isUrl) {
                return `
                  <a href="${escapeHtml(platformStr)}" target="_blank" rel="noopener noreferrer" class="announce-join-btn" style="margin-top: 6px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <span>Join Online Session</span>
                  </a>
                `;
              }
              if (platformStr) {
                return `
                  <div style="font-size: 12px; font-weight: 600; color: var(--text); margin-top: 5px;">
                    Platform / Info: <span style="font-weight: 400;">${escapeHtml(platformStr)}</span>
                  </div>
                `;
              }
              return '';
            })()}
          </div>
        </div>
      `;
    } else if (data.isCancelled) {
      overrideBox.style.display = 'block';
      overrideBox.innerHTML = `
        <div class="class-detail-override-card cancellation">
          <div class="cd-override-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            <span>Class Cancelled</span>
          </div>
          <div class="cd-override-body">
            <span>This lecture is officially cancelled by the faculty for this scheduled date.</span>
            ${data.cancelReason ? `<div style="margin-top: 4px; font-size: 11.5px; color: var(--text-muted);">${escapeHtml(data.cancelReason)}</div>` : ''}
          </div>
        </div>
      `;
    } else if (data.isExtraClass && !data.isOnline) {
      overrideBox.style.display = 'block';
      overrideBox.innerHTML = `
        <div class="class-detail-override-card extra">
          <div class="cd-override-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg>
            <span>In-Person Extra Class</span>
          </div>
          <div class="cd-override-body">
            <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 4px;">This is an additional in-person class scheduled for this date.</div>
            ${cleanRoom && cleanRoom !== 'TBA' ? `
              <div style="font-size: 12px; font-weight: 600; color: var(--text); margin-top: 4px;">
                Room: <span style="font-weight: 400;">${escapeHtml(cleanRoom)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      overrideBox.style.display = 'none';
      overrideBox.innerHTML = '';
    }
  }

  if (badgeEl) {
    if (data.isExam) {
      badgeEl.textContent = (data.examName || 'EXAM').toUpperCase();
      badgeEl.className = 'resting-tag exam';
    } else if (data.isOnline) {
      badgeEl.textContent = 'ONLINE';
      badgeEl.className = 'resting-tag online';
    } else if (data.isCancelled) {
      badgeEl.textContent = 'CANCELLED';
      badgeEl.className = 'resting-tag cancelled';
    } else if (data.isExtraClass) {
      badgeEl.textContent = 'EXTRA CLASS';
      badgeEl.className = 'resting-tag extra';
    } else {
      badgeEl.textContent = isLab ? '★ LAB' : 'THEORY';
      badgeEl.className = `resting-tag ${isLab ? 'lab' : 'theory'}`;
    }
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
