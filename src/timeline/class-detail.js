import { State } from '../core/state.js';
import { FULL_COURSE_NAMES, DAY_NAMES } from '../core/config.js';
import { format12h, formatRoom, escapeHtml } from '../core/utils.js';
import { getTeacherInfo } from '../teachers/teacher-names.js';
import { openModal, closeModal } from '../modals/modal.js';
import { Storage } from '../storage/storage.js';

let _activeModalTeacherCode = 'MHE';
let _activeModalRoom = '';
let _activeModalDayIdx = new Date().getDay();

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatClassSemSec(data) {
  let sem = data.semester || '';
  let sec = data.section || '';

  if (!sem && data.semSec) {
    const match = String(data.semSec).match(/Sem\s*(\d+)(?:-([A-Za-z0-9]+))?/i);
    if (match) {
      sem = match[1];
      sec = match[2] || '';
    }
  }

  // Fallback to active student routine preference ONLY for Timeline / student routine classes
  // (Prevents mislabeling department-wide room view classes if they ever lack semSec)
  if (!sem && (data.isFromTimeline || !data.isFromRoom)) {
    sem = Storage.getSemester();
    if (!sec) {
      sec = Storage.getSection();
    }
  }

  if (!sem) return '';

  const ord = getOrdinal(parseInt(sem, 10));
  if (sec) {
    return `${ord} Semester – Section ${sec.toUpperCase()}`;
  }
  return `${ord} Semester`;
}

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
          dayIdx: dayIdx,
          dayShort: dayName.substring(0, 3).toUpperCase(),
          time: `${format12h(item.start)} – ${format12h(item.end)}`,
          start: item.start,
          end: item.end,
          room: formatRoom(item.room) || 'TBA',
          instructor: item.instructor || item.teacher || '',
          type: item.type || '',
          semSec: item.semSec || '',
          semester: item.semester || '',
          section: item.section || ''
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
  _activeModalRoom = cleanRoom;

  let classDayIdx = (data.dayIdx !== undefined && data.dayIdx !== null) ? data.dayIdx : undefined;
  if (classDayIdx === undefined) {
    if (data.dayName && DAY_NAMES.includes(data.dayName)) {
      classDayIdx = DAY_NAMES.indexOf(data.dayName);
    } else if (data.day && DAY_NAMES.includes(data.day)) {
      classDayIdx = DAY_NAMES.indexOf(data.day);
    }
  }
  if (classDayIdx === undefined || classDayIdx === -1) {
    classDayIdx = (State.currentViewDayIdx !== undefined && State.currentViewDayIdx !== -1)
      ? State.currentViewDayIdx
      : new Date().getDay();
  }
  _activeModalDayIdx = classDayIdx;

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
  const semSecEl = document.getElementById('modalSemSec');
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

  // Semester & Section subtitle directly under course title
  const semSecText = formatClassSemSec(data);
  if (semSecEl) {
    if (semSecText) {
      semSecEl.textContent = semSecText;
      semSecEl.style.display = 'block';
    } else {
      semSecEl.textContent = '';
      semSecEl.style.display = 'none';
    }
  }

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
    if (data.isRescheduled) {
      formatEl.textContent = 'Rescheduled Class';
    } else if (data.isExtraClass) {
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

  // Active / Override banner inside modal
  const overrideBox = document.getElementById('modalOverrideDetails');
  if (overrideBox) {
    if (data.isExam) {
      overrideBox.style.display = 'block';
      overrideBox.innerHTML = `
        <div class="class-detail-override-card exam">
          <div class="cd-override-header">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            <span>Class Cancelled</span>
          </div>
          <div class="cd-override-body">
            <span>This lecture is officially cancelled by the faculty for this scheduled date.</span>
            ${data.cancelReason ? `<div style="margin-top: 4px; font-size: 11.5px; color: var(--text-muted);">${escapeHtml(data.cancelReason)}</div>` : ''}
          </div>
        </div>
      `;
    } else if (data.isRescheduled) {
      overrideBox.style.display = 'block';
      let origSlotText = '';
      if (data.origDate) {
        const [oy, om, od] = data.origDate.split('-').map(Number);
        if (oy && om && od) {
          const dObj = new Date(oy, om - 1, od);
          const dNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          origSlotText = `${dNames[dObj.getDay()]}, ${mNames[dObj.getMonth()]} ${od}${data.origStart ? ` at ${format12h(data.origStart)}` : ''}`;
        }
      }
      overrideBox.innerHTML = `
        <div class="class-detail-override-card rescheduled">
          <div class="cd-override-header">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Rescheduled Session</span>
          </div>
          <div class="cd-override-body">
            <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 4px;">This class was moved to this date & time slot.</div>
            ${origSlotText ? `
              <div style="font-size: 12px; font-weight: 600; color: var(--text); margin-top: 4px;">
                Original Slot: <span style="font-weight: 400;">${escapeHtml(origSlotText)}</span>
              </div>
            ` : ''}
            ${data.rescheduledReason ? `
              <div style="font-size: 12px; font-weight: 600; color: var(--text); margin-top: 4px;">
                Reason / Note: <span style="font-weight: 400;">${escapeHtml(data.rescheduledReason)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (data.isExtraClass && !data.isOnline) {
      overrideBox.style.display = 'block';
      overrideBox.innerHTML = `
        <div class="class-detail-override-card extra">
          <div class="cd-override-header">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg>
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
    } else if (data.isRescheduled) {
      badgeEl.textContent = 'RESCHEDULED';
      badgeEl.className = 'resting-tag rescheduled';
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
      day: data.dayName || currentDayName,
      dayIdx: data.dayIdx !== undefined ? data.dayIdx : new Date().getDay(),
      dayShort: (data.dayName || currentDayName).substring(0, 3).toUpperCase(),
      time: data.timing || (data.start && data.end ? `${data.start} – ${data.end}` : 'Scheduled'),
      start: data.start,
      end: data.end,
      room: cleanRoom,
      instructor: teacherCode,
      type: data.type,
      semSec: data.semSec || '',
      semester: data.semester || '',
      section: data.section || ''
    }];

    const activeDay = data.dayName || currentDayName;
    const activeTime = data.timing || (data.start && data.end ? `${data.start} – ${data.end}` : '');

    displayList.forEach((r, idx) => {
      const isCurrentSession = (r.day === activeDay && (!activeTime || r.time === activeTime || displayList.length === 1));

      recHtml += `
        <div class="recurrence-card-row is-clickable ${isCurrentSession ? 'is-active-session' : ''}" data-rec-idx="${idx}" title="Switch view to ${escapeHtml(r.dayShort)} session">
          <div class="recurrence-row-left">
            <span class="recurrence-day-chip">${escapeHtml(r.dayShort)}</span>
            <span class="recurrence-row-time">${escapeHtml(r.time)}</span>
          </div>
          <div class="recurrence-row-right">
            <span class="recurrence-room-label">Room ${escapeHtml(r.room)}</span>
            ${isCurrentSession ? '<span class="recurrence-active-badge">CURRENT</span>' : ''}
            <svg class="recurrence-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      `;
    });
    listEl.innerHTML = recHtml;

    // Attach in-place refresh click handler to each recurrence row
    listEl.querySelectorAll('.recurrence-card-row.is-clickable').forEach(row => {
      row.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(row.dataset.recIdx, 10);
        const r = displayList[idx];
        if (!r) return;

        const newSessionData = {
          ...data,
          code: code,
          title: code,
          name: fullTitle,
          start: r.start ? (typeof r.start === 'number' ? format12h(r.start) : r.start) : data.start,
          end: r.end ? (typeof r.end === 'number' ? format12h(r.end) : r.end) : data.end,
          timing: r.time || (r.start && r.end ? `${typeof r.start === 'number' ? format12h(r.start) : r.start} – ${typeof r.end === 'number' ? format12h(r.end) : r.end}` : data.timing),
          room: r.room || 'TBA',
          instructor: r.instructor || data.instructor,
          teacher: r.instructor || data.teacher,
          type: r.type || data.type,
          dayName: r.day,
          dayIdx: r.dayIdx,
          hasExplicitEndTime: true,
          semSec: r.semSec || data.semSec,
          semester: r.semester || data.semester,
          section: r.section || data.section
        };

        // In-place refresh
        showClassDetails(newSessionData);
      });
    });
  }

  openModal(modal);
}

export function closeClassDetails() {
  const modal = document.getElementById('classDetailModal');
  if (modal) {
    closeModal(modal);
    modal.style.zIndex = '';
  }
}

export function initClassDetailEvents() {
  const modal = document.getElementById('classDetailModal');
  const closeBtn = document.getElementById('classDetailClose');
  const instructorTile = document.getElementById('modalInstructorTile');
  const roomTile = document.getElementById('modalRoomTile');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeClassDetails);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeClassDetails();
    });
  }

  if (roomTile) {
    roomTile.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.openRoomInFreeRooms === 'function') {
        window.openRoomInFreeRooms(_activeModalRoom, _activeModalDayIdx);
      }
    });
  }

  if (instructorTile) {
    instructorTile.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const code = _activeModalTeacherCode;
      if (!code || code === 'TBA' || code === '—' || code === 'Not Assigned') return;

      const teacherModal = document.getElementById('teacherDetailModal');
      const isTeacherModalOpen = teacherModal && teacherModal.classList.contains('open');

      if (isTeacherModalOpen) {
        // Teacher modal is already open behind class detail; closing class detail cleanly reveals it
        closeClassDetails();
      } else {
        if (typeof window.openTeacherDetailByCode === 'function') {
          window.openTeacherDetailByCode(code);
        } else if (typeof window.__openTeacherProfileByCode === 'function') {
          window.__openTeacherProfileByCode(code);
        }
      }
    });
  }

  window.openClassDetailSheet = showClassDetails;
  window.closeClassDetailSheet = closeClassDetails;
}
