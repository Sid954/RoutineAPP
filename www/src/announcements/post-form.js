import { State } from '../core/state.js';
import { showToast } from '../toast/toast.js';
import { escapeHtml, format12h, parseTo24h, toMinutes } from '../core/utils.js';
import { Announcements } from './announcements.js';
import { getClassesForDay } from '../schedule/queries.js';
import {
  ANNOUNCEMENT_LIMITS,
  collapseNewlines,
  cleanString,
  validateField,
  validateAnnouncementPayload
} from './validation.js';

let counterUpdateCallbacks = [];
// Tracks the is_pinned state of the announcement being edited — preserved on update
let _editIsPinned = false;

function setupCharCounter(inputEl, counterEl, maxLimit) {
  if (!inputEl || !counterEl) return;
  const update = () => {
    const len = inputEl.value.trim().length;
    counterEl.textContent = `${len}/${maxLimit}`;
    if (len >= maxLimit) {
      counterEl.classList.add('limit');
      counterEl.classList.remove('warning');
    } else if (len >= maxLimit - 2 && len > 0) {
      counterEl.classList.add('warning');
      counterEl.classList.remove('limit');
    } else {
      counterEl.classList.remove('warning', 'limit');
    }
  };
  inputEl.addEventListener('input', update);
  inputEl.addEventListener('change', update);
  counterUpdateCallbacks.push(update);
}

function refreshAllCounters() {
  counterUpdateCallbacks.forEach(fn => fn());
}

const TYPE_THEMES = {
  general: {
    label: 'General',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    sectionTitle: 'Notice Details & Content'
  },
  cancellation: {
    label: 'Cancelled',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    sectionTitle: 'Class Cancellation Override'
  },
  holiday: {
    label: 'Holiday',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    sectionTitle: 'Holiday / Day Off Override'
  },
  online_class: {
    label: 'Add a Class',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>',
    sectionTitle: 'Add a Class Details'
  },
  class_test: {
    label: 'Class Test',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    sectionTitle: 'Class Test & Exam Parameters'
  },
  rescheduled: {
    label: 'Rescheduled',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    sectionTitle: 'Rescheduled Class Parameters'
  },
  assignment: {
    label: 'Assignment',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    sectionTitle: 'Assignment / Deadline Details'
  }
};

export function updateCancelSubjectsList(selectedVal = '') {
  const paCancelDate = document.getElementById('paCancelDate');
  const paCancelSubjectSelect = document.getElementById('paCancelSubjectSelect');
  if (!paCancelDate || !paCancelSubjectSelect) return;
  const dateVal = paCancelDate.value;
  if (!dateVal) {
    paCancelSubjectSelect.innerHTML = '<option value="">Select a date first</option>';
    return;
  }
  const [y, m, d] = dateVal.split('-').map(Number);
  const dayIdx = new Date(y, m - 1, d).getDay();
  const classes = getClassesForDay(dayIdx);
  const subjs = Array.from(new Set(classes.map(c => c.title).filter(Boolean)));

  if (subjs.length === 0) {
    paCancelSubjectSelect.innerHTML = '<option value="">No classes scheduled on this day</option>';
  } else {
    paCancelSubjectSelect.innerHTML = subjs
      .sort()
      .map(sub => `<option value="${escapeHtml(sub)}" ${sub === selectedVal ? 'selected' : ''}>${escapeHtml(sub)}</option>`)
      .join('');
  }
}

export function updateClassTestSubjectsList(selectedVal = '') {
  const paClassTestDate = document.getElementById('paClassTestDate');
  const paClassTestSubjectSelect = document.getElementById('paClassTestSubjectSelect');
  const paClassTestShowAllSubjects = document.getElementById('paClassTestShowAllSubjects');
  if (!paClassTestDate || !paClassTestSubjectSelect) return;
  const dateVal = paClassTestDate.value;
  if (!dateVal) {
    paClassTestSubjectSelect.innerHTML = '<option value="">Select a date first</option>';
    return;
  }
  const [y, m, d] = dateVal.split('-').map(Number);
  const dayIdx = new Date(y, m - 1, d).getDay();
  const showAll = paClassTestShowAllSubjects && paClassTestShowAllSubjects.checked;

  let subjs = [];
  if (showAll) {
    const allSubjs = new Set();
    Object.values(State.schedule).forEach(dayClasses => {
      dayClasses.forEach(c => { if (c.title) allSubjs.add(c.title); });
    });
    subjs = Array.from(allSubjs);
  } else {
    const classes = getClassesForDay(dayIdx);
    subjs = Array.from(new Set(classes.map(c => c.title).filter(Boolean)));
  }

  if (subjs.length === 0) {
    paClassTestSubjectSelect.innerHTML = `<option value="">No classes on this ${showAll ? 'schedule' : 'day'}</option>`;
  } else {
    paClassTestSubjectSelect.innerHTML = subjs
      .sort()
      .map(sub => `<option value="${escapeHtml(sub)}" ${sub === selectedVal ? 'selected' : ''}>${escapeHtml(sub)}</option>`)
      .join('');
  }
}

export function updateAssignmentSubjectsList(selectedVal = '') {
  const paAssignmentDueDate = document.getElementById('paAssignmentDueDate');
  const paAssignmentSubjectSelect = document.getElementById('paAssignmentSubjectSelect');
  const paAssignmentShowAllSubjects = document.getElementById('paAssignmentShowAllSubjects');
  if (!paAssignmentDueDate || !paAssignmentSubjectSelect) return;
  const dateVal = paAssignmentDueDate.value;
  if (!dateVal) {
    paAssignmentSubjectSelect.innerHTML = '<option value="">Select a date first</option>';
    return;
  }
  const [y, m, d] = dateVal.split('-').map(Number);
  const dayIdx = new Date(y, m - 1, d).getDay();
  const showAll = paAssignmentShowAllSubjects && paAssignmentShowAllSubjects.checked;

  let subjs = [];
  if (showAll) {
    const allSubjs = new Set();
    Object.values(State.schedule).forEach(dayClasses => {
      dayClasses.forEach(c => { if (c.title) allSubjs.add(c.title); });
    });
    subjs = Array.from(allSubjs);
  } else {
    const classes = getClassesForDay(dayIdx);
    subjs = Array.from(new Set(classes.map(c => c.title).filter(Boolean)));
  }

  if (subjs.length === 0) {
    paAssignmentSubjectSelect.innerHTML = `<option value="">No classes on this ${showAll ? 'schedule' : 'day'}</option>`;
  } else {
    paAssignmentSubjectSelect.innerHTML = subjs
      .sort()
      .map(sub => `<option value="${escapeHtml(sub)}" ${sub === selectedVal ? 'selected' : ''}>${escapeHtml(sub)}</option>`)
      .join('');
  }
}

export function updateRescheduleSubjectsList(selectedVal = '') {
  const paRescheduleOrigDate = document.getElementById('paRescheduleOrigDate');
  const paRescheduleSubjectSelect = document.getElementById('paRescheduleSubjectSelect');
  if (!paRescheduleOrigDate || !paRescheduleSubjectSelect) return;
  const dateVal = paRescheduleOrigDate.value;
  if (!dateVal) {
    paRescheduleSubjectSelect.innerHTML = '<option value="">Select an original date first</option>';
    return;
  }
  const [y, m, d] = dateVal.split('-').map(Number);
  const dayIdx = new Date(y, m - 1, d).getDay();
  const classes = getClassesForDay(dayIdx);

  if (classes.length === 0) {
    const isWeekend = (dayIdx === 4 || dayIdx === 5);
    paRescheduleSubjectSelect.innerHTML = `<option value="">No classes scheduled (${isWeekend ? 'Weekend' : 'Off-day'})</option>`;
  } else {
    paRescheduleSubjectSelect.innerHTML = classes
      .map(c => {
        const title = c.title || c.subject || 'Class';
        const start = c.start ? format12h(c.start) : '';
        const end = c.end ? format12h(c.end) : '';
        const room = c.room || '';
        const timeLabel = start && end ? `${start} – ${end}` : (start ? `Starts at ${start}` : '');
        const label = `${title} (${timeLabel}${room ? ` · Room ${room}` : ''})`;
        return `<option value="${escapeHtml(title)}" data-start="${escapeHtml(start)}" data-room="${escapeHtml(room)}" ${title === selectedVal ? 'selected' : ''}>${escapeHtml(label)}</option>`;
      })
      .join('');
  }
}

export function checkRescheduleOverlap() {
  const paRescheduleNewDate = document.getElementById('paRescheduleNewDate');
  const paRescheduleNewStart = document.getElementById('paRescheduleNewStart');
  const warningEl = document.getElementById('paRescheduleOverlapWarning');
  const warningTextEl = document.getElementById('paRescheduleOverlapWarningText');

  if (!paRescheduleNewDate || !paRescheduleNewStart || !warningEl || !warningTextEl) return;

  const dateVal = paRescheduleNewDate.value;
  const startVal = paRescheduleNewStart.value;

  if (!dateVal || !startVal) {
    warningEl.style.display = 'none';
    return;
  }

  const [y, m, d] = dateVal.split('-').map(Number);
  const dayIdx = new Date(y, m - 1, d).getDay();
  const startMins = toMinutes(format12h(startVal));
  const endMins = startMins + 75; // Standard 75 min class slot

  const existingClasses = getClassesForDay(dayIdx);
  const conflict = existingClasses.find(c => {
    const cStart = toMinutes(c.start);
    const cEnd = c.end ? toMinutes(c.end) : (cStart + 75);
    return startMins < cEnd && endMins > cStart;
  });

  if (conflict) {
    warningEl.style.display = 'flex';
    warningTextEl.textContent = `Note: ${format12h(startVal)} overlaps with scheduled class ${conflict.title || conflict.subject} (${conflict.start}${conflict.end ? ` – ${conflict.end}` : ''}) on the new date.`;
  } else {
    warningEl.style.display = 'none';
  }
}

export function setSectionVisibility(type) {
  const theme = TYPE_THEMES[type] || TYPE_THEMES.general;

  // Update type indicator pill in form header
  const pill = document.getElementById('paTypeIndicatorPill');
  if (pill) {
    pill.className = `pa-type-indicator-pill ${type}`;
    pill.innerHTML = `${theme.icon}<span>${theme.label}</span>`;
  }

  const detailsHeader = document.getElementById('paDetailsSectionHeader');
  if (detailsHeader) {
    detailsHeader.textContent = theme.sectionTitle;
  }

  // Update active highlight in type picker menu
  const menuItems = document.querySelectorAll('.pa-type-option-item');
  menuItems.forEach(item => {
    if (item.getAttribute('data-type') === type) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const paGeneralSection = document.getElementById('paGeneralSection');
  const paCancellationSection = document.getElementById('paCancellationSection');
  const paHolidaySection = document.getElementById('paHolidaySection');
  const paOnlineSection = document.getElementById('paOnlineSection');
  const paClassTestSection = document.getElementById('paClassTestSection');
  const paRescheduledSection = document.getElementById('paRescheduledSection');
  const paAssignmentSection = document.getElementById('paAssignmentSection');

  if (paGeneralSection) paGeneralSection.style.display = type === 'general' ? 'block' : 'none';
  if (paCancellationSection) paCancellationSection.style.display = type === 'cancellation' ? 'block' : 'none';
  if (paHolidaySection) paHolidaySection.style.display = type === 'holiday' ? 'block' : 'none';
  if (paOnlineSection) paOnlineSection.style.display = type === 'online_class' ? 'block' : 'none';
  if (paClassTestSection) paClassTestSection.style.display = type === 'class_test' ? 'block' : 'none';
  if (paRescheduledSection) paRescheduledSection.style.display = type === 'rescheduled' ? 'block' : 'none';
  if (paAssignmentSection) paAssignmentSection.style.display = type === 'assignment' ? 'block' : 'none';
}

let _currentClassMode = 'online'; // 'online' | 'offline'

export function setClassMode(mode) {
  _currentClassMode = mode === 'offline' ? 'offline' : 'online';
  const onlineBtn = document.getElementById('paModeOnlineBtn');
  const offlineBtn = document.getElementById('paModeOfflineBtn');
  const onlinePlatformContainer = document.getElementById('paOnlinePlatformContainer');
  const offlineRoomContainer = document.getElementById('paOfflineRoomContainer');

  if (onlineBtn) onlineBtn.classList.toggle('active', _currentClassMode === 'online');
  if (offlineBtn) offlineBtn.classList.toggle('active', _currentClassMode === 'offline');
  if (onlinePlatformContainer) onlinePlatformContainer.style.display = _currentClassMode === 'online' ? 'block' : 'none';
  if (offlineRoomContainer) offlineRoomContainer.style.display = _currentClassMode === 'offline' ? 'block' : 'none';
}

export function openPostForm(existingAnnouncement = null) {
  const paEditId = document.getElementById('paEditId');
  const paFormTitle = document.getElementById('postAnnounceFormTitle');
  const paFormSubtitle = document.getElementById('postAnnounceFormSubtitle');
  const paSubmitLabel = document.getElementById('postAnnounceSubmitLabel');

  const paName = document.getElementById('paName');
  const paType = document.getElementById('paType');
  const paTitle = document.getElementById('paTitle');
  const paSubject = document.getElementById('paSubject');
  const paContent = document.getElementById('paContent');
  const paPassword = document.getElementById('paPassword');

  const paCancelDate = document.getElementById('paCancelDate');
  const paHolidayRangeType = document.getElementById('paHolidayRangeType');
  const paHolidayStartDate = document.getElementById('paHolidayStartDate');
  const paHolidayEndDateContainer = document.getElementById('paHolidayEndDateContainer');
  const paHolidayEndDate = document.getElementById('paHolidayEndDate');
  const paHolidayDetails = document.getElementById('paHolidayDetails');

  const paOnlineDate = document.getElementById('paOnlineDate');
  const paOnlineSubjectSelect = document.getElementById('paOnlineSubjectSelect');
  const paOnlineStart = document.getElementById('paOnlineStart');
  const paOnlineLink = document.getElementById('paOnlineLink');

  const paClassTestDate = document.getElementById('paClassTestDate');
  const paClassTestName = document.getElementById('paClassTestName');
  const paClassTestTopics = document.getElementById('paClassTestTopics');

  // Populate Subject dropdowns from schedule
  const subjects = new Set();
  Object.values(State.schedule).forEach(dayClasses => {
    dayClasses.forEach(c => { if (c.title) subjects.add(c.title); });
  });
  const subjectOptions = Array.from(subjects)
    .sort()
    .map(sub => `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`)
    .join('');

  if (paOnlineSubjectSelect) paOnlineSubjectSelect.innerHTML = subjectOptions;

  const todayStr = new Date().toISOString().split('T')[0];

  if (existingAnnouncement) {
    // EDIT MODE
    const item = existingAnnouncement;
    _editIsPinned = !!item.is_pinned; // preserve pin state across edits
    if (paEditId) paEditId.value = item.id;
    if (paFormTitle) paFormTitle.textContent = 'Edit Announcement';
    if (paFormSubtitle) paFormSubtitle.textContent = 'Modify announcement details and timetable overrides';
    if (paSubmitLabel) paSubmitLabel.textContent = 'Save Changes';

    if (paName) paName.value = item.name || '';
    if (paType) paType.value = item.type || 'general';
    if (paPassword) paPassword.value = State.sessionDeletePassword || '';

    const type = item.type || 'general';
    setSectionVisibility(type);

    if (type === 'general') {
      if (paTitle) paTitle.value = item.title || '';
      if (paSubject) paSubject.value = item.subject || '';
      if (paContent) paContent.value = item.announcement || '';
    } else if (type === 'cancellation') {
      if (paCancelDate) paCancelDate.value = item.date_override || todayStr;
      updateCancelSubjectsList(item.subject_override || item.subject || '');
    } else if (type === 'holiday') {
      if (paHolidayRangeType) paHolidayRangeType.value = 'single';
      if (paHolidayEndDateContainer) paHolidayEndDateContainer.style.display = 'none';
      if (paHolidayStartDate) paHolidayStartDate.value = item.date_override || todayStr;
      if (paHolidayDetails) paHolidayDetails.value = (item.title || '').replace(/^Holiday:\s*/i, '');
    } else if (type === 'online_class') {
      if (paOnlineDate) paOnlineDate.value = item.date_override || todayStr;
      if (paOnlineSubjectSelect) paOnlineSubjectSelect.value = item.subject_override || item.subject || '';
      try {
        const parsed = JSON.parse(item.announcement);
        const isOnline = parsed.is_online !== false;
        setClassMode(isOnline ? 'online' : 'offline');
        if (paOnlineLink) paOnlineLink.value = parsed.platform || '';
        const paOnlineRoom = document.getElementById('paOnlineRoom');
        if (paOnlineRoom) paOnlineRoom.value = parsed.room || '';
        if (paOnlineStart) paOnlineStart.value = parseTo24h(parsed.start_time) || '09:45';
      } catch (e) {
        setClassMode('online');
        if (paOnlineLink) paOnlineLink.value = item.announcement || '';
      }
    } else if (type === 'class_test') {
      if (paClassTestDate) paClassTestDate.value = item.date_override || todayStr;
      updateClassTestSubjectsList(item.subject_override || item.subject || '');
      try {
        const parsed = JSON.parse(item.announcement);
        if (paClassTestName) paClassTestName.value = parsed.exam_name || '';
        if (paClassTestTopics) paClassTestTopics.value = parsed.topics || '';
      } catch (e) {}
    } else if (type === 'rescheduled') {
      const paRescheduleOrigDate = document.getElementById('paRescheduleOrigDate');
      const paRescheduleNewDate = document.getElementById('paRescheduleNewDate');
      const paRescheduleNewStart = document.getElementById('paRescheduleNewStart');
      const paRescheduleNewRoom = document.getElementById('paRescheduleNewRoom');
      const paRescheduleReason = document.getElementById('paRescheduleReason');

      try {
        const parsed = JSON.parse(item.announcement);
        const origDate = parsed.original_date || item.date_override || todayStr;
        const newDate = parsed.new_date || origDate;
        if (paRescheduleOrigDate) paRescheduleOrigDate.value = origDate;
        if (paRescheduleNewDate) paRescheduleNewDate.value = newDate;
        updateRescheduleSubjectsList(parsed.target_subject || item.subject_override || item.subject || '');
        if (paRescheduleNewStart) paRescheduleNewStart.value = parseTo24h(parsed.new_start_time) || '15:00';
        if (paRescheduleNewRoom) paRescheduleNewRoom.value = parsed.new_room || '';
        if (paRescheduleReason) paRescheduleReason.value = parsed.reason || '';
      } catch (e) {
        if (paRescheduleOrigDate) paRescheduleOrigDate.value = item.date_override || todayStr;
        if (paRescheduleNewDate) paRescheduleNewDate.value = item.date_override || todayStr;
        updateRescheduleSubjectsList(item.subject_override || item.subject || '');
      }
      checkRescheduleOverlap();
    } else if (type === 'assignment') {
      const paAssignmentDueDate = document.getElementById('paAssignmentDueDate');
      if (paAssignmentDueDate) paAssignmentDueDate.value = item.date_override || todayStr;
      updateAssignmentSubjectsList(item.subject_override || item.subject || '');
      try {
        const parsed = JSON.parse(item.announcement);
        const paAssignmentTitle = document.getElementById('paAssignmentTitle');
        if (paAssignmentTitle) paAssignmentTitle.value = parsed.task_title || '';
        const paAssignmentDueTime = document.getElementById('paAssignmentDueTime');
        if (paAssignmentDueTime) paAssignmentDueTime.value = parseTo24h(parsed.due_time) || '23:59';
        const paAssignmentDescription = document.getElementById('paAssignmentDescription');
        if (paAssignmentDescription) paAssignmentDescription.value = parsed.description || '';
      } catch (e) {}
    }
  } else {
    // CREATE MODE
    _editIsPinned = false;
    if (paEditId) paEditId.value = '';
    if (paFormTitle) paFormTitle.textContent = 'Post Announcement';
    if (paFormSubtitle) paFormSubtitle.textContent = 'Publish notice & notify your section';
    if (paSubmitLabel) paSubmitLabel.textContent = 'Publish & Notify';

    if (paName) paName.value = '';
    if (paType) paType.value = 'general';
    if (paTitle) paTitle.value = '';
    if (paSubject) paSubject.value = '';
    if (paContent) paContent.value = '';
    if (paPassword) paPassword.value = State.sessionDeletePassword || '';

    if (paCancelDate) { paCancelDate.value = todayStr; paCancelDate.min = todayStr; }
    if (paHolidayStartDate) { paHolidayStartDate.value = todayStr; paHolidayStartDate.min = todayStr; }
    if (paHolidayEndDate) { paHolidayEndDate.value = todayStr; paHolidayEndDate.min = todayStr; }
    if (paHolidayDetails) paHolidayDetails.value = '';
    if (paHolidayRangeType) paHolidayRangeType.value = 'single';
    if (paHolidayEndDateContainer) paHolidayEndDateContainer.style.display = 'none';

    setClassMode('online');
    if (paOnlineDate) { paOnlineDate.value = todayStr; paOnlineDate.min = todayStr; }
    if (paOnlineLink) paOnlineLink.value = '';
    const paOnlineRoom = document.getElementById('paOnlineRoom');
    if (paOnlineRoom) paOnlineRoom.value = '';
    if (paOnlineStart) paOnlineStart.value = '09:45';

    if (paClassTestDate) { paClassTestDate.value = todayStr; paClassTestDate.min = todayStr; }
    if (paClassTestName) paClassTestName.value = '';
    if (paClassTestTopics) paClassTestTopics.value = '';
    if (paClassTestShowAllSubjects) paClassTestShowAllSubjects.checked = false;

    const paRescheduleOrigDate = document.getElementById('paRescheduleOrigDate');
    const paRescheduleNewDate = document.getElementById('paRescheduleNewDate');
    const paRescheduleNewStart = document.getElementById('paRescheduleNewStart');
    const paRescheduleNewRoom = document.getElementById('paRescheduleNewRoom');
    const paRescheduleReason = document.getElementById('paRescheduleReason');
    const paRescheduleWarning = document.getElementById('paRescheduleOverlapWarning');

    if (paRescheduleOrigDate) { paRescheduleOrigDate.value = todayStr; paRescheduleOrigDate.min = todayStr; }
    if (paRescheduleNewDate) { paRescheduleNewDate.value = todayStr; paRescheduleNewDate.min = todayStr; }
    if (paRescheduleNewStart) paRescheduleNewStart.value = '15:00';
    if (paRescheduleNewRoom) paRescheduleNewRoom.value = '';
    if (paRescheduleReason) paRescheduleReason.value = '';
    if (paRescheduleWarning) paRescheduleWarning.style.display = 'none';

    const paAssignmentDueDate = document.getElementById('paAssignmentDueDate');
    const paAssignmentTitle = document.getElementById('paAssignmentTitle');
    const paAssignmentDueTime = document.getElementById('paAssignmentDueTime');
    const paAssignmentDescription = document.getElementById('paAssignmentDescription');
    const paAssignmentShowAllSubjects = document.getElementById('paAssignmentShowAllSubjects');
    if (paAssignmentDueDate) { paAssignmentDueDate.value = todayStr; paAssignmentDueDate.min = todayStr; }
    if (paAssignmentTitle) paAssignmentTitle.value = '';
    if (paAssignmentDueTime) paAssignmentDueTime.value = '23:59';
    if (paAssignmentDescription) paAssignmentDescription.value = '';
    if (paAssignmentShowAllSubjects) paAssignmentShowAllSubjects.checked = false;

    setSectionVisibility('general');
    updateCancelSubjectsList();
    updateClassTestSubjectsList();
    updateRescheduleSubjectsList();
    updateAssignmentSubjectsList();
  }

  // Refresh character counts after populating fields
  refreshAllCounters();
}

let isPostFormInitialized = false;

export function initPostForm() {
  window.__openPostAnnounceForm = (announcementItem) => {
    openPostForm(announcementItem);
  };

  if (isPostFormInitialized) return;
  isPostFormInitialized = true;

  const paName = document.getElementById('paName');
  const paTitle = document.getElementById('paTitle');
  const paHolidayDetails = document.getElementById('paHolidayDetails');
  const paOnlineLink = document.getElementById('paOnlineLink');
  const paOnlineRoom = document.getElementById('paOnlineRoom');
  const paClassTestName = document.getElementById('paClassTestName');
  const paClassTestTopics = document.getElementById('paClassTestTopics');
  const paContent = document.getElementById('paContent');

  // Mode Toggle Buttons
  const modeOnlineBtn = document.getElementById('paModeOnlineBtn');
  const modeOfflineBtn = document.getElementById('paModeOfflineBtn');
  if (modeOnlineBtn) modeOnlineBtn.addEventListener('click', () => setClassMode('online'));
  if (modeOfflineBtn) modeOfflineBtn.addEventListener('click', () => setClassMode('offline'));

  // Bind real-time character counters
  setupCharCounter(paName, document.getElementById('paNameCounter'), ANNOUNCEMENT_LIMITS.AUTHOR_NAME);
  setupCharCounter(paTitle, document.getElementById('paTitleCounter'), ANNOUNCEMENT_LIMITS.TITLE);
  setupCharCounter(paHolidayDetails, document.getElementById('paHolidayDetailsCounter'), ANNOUNCEMENT_LIMITS.HOLIDAY_NAME);
  setupCharCounter(paOnlineLink, document.getElementById('paOnlineLinkCounter'), ANNOUNCEMENT_LIMITS.PLATFORM_LINK);
  setupCharCounter(paOnlineRoom, document.getElementById('paOnlineRoomCounter'), ANNOUNCEMENT_LIMITS.ROOM);
  setupCharCounter(paClassTestName, document.getElementById('paClassTestNameCounter'), ANNOUNCEMENT_LIMITS.EXAM_NAME);
  setupCharCounter(paClassTestTopics, document.getElementById('paClassTestTopicsCounter'), ANNOUNCEMENT_LIMITS.TOPICS);
  const paRescheduleNewRoom = document.getElementById('paRescheduleNewRoom');
  const paRescheduleReason = document.getElementById('paRescheduleReason');
  setupCharCounter(paRescheduleNewRoom, document.getElementById('paRescheduleRoomCounter'), ANNOUNCEMENT_LIMITS.ROOM);
  setupCharCounter(paRescheduleReason, document.getElementById('paRescheduleReasonCounter'), ANNOUNCEMENT_LIMITS.REASON);

  const paAssignmentTitle = document.getElementById('paAssignmentTitle');
  const paAssignmentDescription = document.getElementById('paAssignmentDescription');
  setupCharCounter(paAssignmentTitle, document.getElementById('paAssignmentTitleCounter'), ANNOUNCEMENT_LIMITS.TASK_TITLE);
  setupCharCounter(paAssignmentDescription, document.getElementById('paAssignmentDescCounter'), ANNOUNCEMENT_LIMITS.ASSIGNMENT_DESC);

  // Multi-line newline collapse on blur / change
  if (paContent) {
    paContent.addEventListener('blur', () => {
      paContent.value = collapseNewlines(paContent.value);
    });
  }
  if (paClassTestTopics) {
    paClassTestTopics.addEventListener('blur', () => {
      paClassTestTopics.value = collapseNewlines(paClassTestTopics.value);
      refreshAllCounters();
    });
  }
  if (paRescheduleReason) {
    paRescheduleReason.addEventListener('blur', () => {
      paRescheduleReason.value = collapseNewlines(paRescheduleReason.value);
      refreshAllCounters();
    });
  }
  if (paAssignmentDescription) {
    paAssignmentDescription.addEventListener('blur', () => {
      paAssignmentDescription.value = collapseNewlines(paAssignmentDescription.value);
      refreshAllCounters();
    });
  }

  const paType = document.getElementById('paType');
  const paGeneralSection = document.getElementById('paGeneralSection');
  const paCancellationSection = document.getElementById('paCancellationSection');
  const paHolidaySection = document.getElementById('paHolidaySection');
  const paOnlineSection = document.getElementById('paOnlineSection');
  const paClassTestSection = document.getElementById('paClassTestSection');
  const paRescheduledSection = document.getElementById('paRescheduledSection');
  const paAssignmentSection = document.getElementById('paAssignmentSection');

  const paHolidayRangeType = document.getElementById('paHolidayRangeType');
  const paHolidayEndDateContainer = document.getElementById('paHolidayEndDateContainer');

  const paCancelDate = document.getElementById('paCancelDate');
  const paCancelSubjectSelect = document.getElementById('paCancelSubjectSelect');

  const paClassTestDate = document.getElementById('paClassTestDate');
  const paClassTestSubjectSelect = document.getElementById('paClassTestSubjectSelect');
  const paClassTestShowAllSubjects = document.getElementById('paClassTestShowAllSubjects');

  const paRescheduleOrigDate = document.getElementById('paRescheduleOrigDate');
  const paRescheduleNewDate = document.getElementById('paRescheduleNewDate');
  const paRescheduleNewStart = document.getElementById('paRescheduleNewStart');

  const paOnlineSubjectSelect = document.getElementById('paOnlineSubjectSelect');
  const paOnlineDate = document.getElementById('paOnlineDate');
  const paOnlineStart = document.getElementById('paOnlineStart');

  function autoFillOnlineTimes() {
    if (!paOnlineDate || !paOnlineSubjectSelect || !paOnlineStart) return;
    const dateVal = paOnlineDate.value;
    const subjectVal = paOnlineSubjectSelect.value;
    if (!dateVal || !subjectVal) return;

    const [y, m, d] = dateVal.split('-').map(Number);
    const dayIdx = new Date(y, m - 1, d).getDay();

    const classes = State.schedule[dayIdx] || [];
    const match = classes.find(c => c.title && c.title.toUpperCase() === subjectVal.toUpperCase());
    if (match) {
      paOnlineStart.value = match.start;
    }
  }

  if (paOnlineSubjectSelect) paOnlineSubjectSelect.addEventListener('change', autoFillOnlineTimes);
  if (paOnlineDate) paOnlineDate.addEventListener('change', autoFillOnlineTimes);

  if (paCancelDate) paCancelDate.addEventListener('change', () => updateCancelSubjectsList());
  if (paClassTestDate) paClassTestDate.addEventListener('change', () => updateClassTestSubjectsList());
  if (paClassTestShowAllSubjects) paClassTestShowAllSubjects.addEventListener('change', () => updateClassTestSubjectsList());

  if (paRescheduleOrigDate) paRescheduleOrigDate.addEventListener('change', () => updateRescheduleSubjectsList());
  if (paRescheduleNewDate) paRescheduleNewDate.addEventListener('change', checkRescheduleOverlap);
  if (paRescheduleNewStart) {
    paRescheduleNewStart.addEventListener('input', checkRescheduleOverlap);
    paRescheduleNewStart.addEventListener('change', checkRescheduleOverlap);
  }

  const paAssignmentDueDate = document.getElementById('paAssignmentDueDate');
  const paAssignmentShowAllSubjects = document.getElementById('paAssignmentShowAllSubjects');
  if (paAssignmentDueDate) paAssignmentDueDate.addEventListener('change', () => updateAssignmentSubjectsList());
  if (paAssignmentShowAllSubjects) paAssignmentShowAllSubjects.addEventListener('change', () => updateAssignmentSubjectsList());

  // Custom Popover Type Picker Binding
  const typePickerBtn = document.getElementById('paTypePickerBtn');
  const typeDropdownMenu = document.getElementById('paTypeDropdownMenu');

  function closeTypeDropdown() {
    if (typeDropdownMenu) typeDropdownMenu.style.display = 'none';
    if (typePickerBtn) {
      typePickerBtn.classList.remove('open');
      typePickerBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleTypeDropdown() {
    if (!typeDropdownMenu) return;
    const isOpen = typeDropdownMenu.style.display === 'flex';
    if (isOpen) {
      closeTypeDropdown();
    } else {
      typeDropdownMenu.style.display = 'flex';
      if (typePickerBtn) {
        typePickerBtn.classList.add('open');
        typePickerBtn.setAttribute('aria-expanded', 'true');
      }
    }
  }

  if (typePickerBtn) {
    typePickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTypeDropdown();
    });
  }

  if (typeDropdownMenu) {
    typeDropdownMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.pa-type-option-item');
      if (!item) return;
      const selectedType = item.getAttribute('data-type');
      if (paType) paType.value = selectedType;
      if (paType) paType.dispatchEvent(new Event('change'));
      closeTypeDropdown();
    });
  }

  document.addEventListener('click', (e) => {
    if (typeDropdownMenu && !typeDropdownMenu.contains(e.target) && typePickerBtn && !typePickerBtn.contains(e.target)) {
      closeTypeDropdown();
    }
  });

  if (paType) {
    paType.addEventListener('change', () => {
      const val = paType.value;
      const card = document.getElementById('paFormCard');
      if (card) card.setAttribute('data-type', val);

      const theme = TYPE_THEMES[val] || TYPE_THEMES.general;
      const pill = document.getElementById('paTypeIndicatorPill');
      if (pill) {
        pill.innerHTML = `${theme.icon}<span>${theme.label}</span>`;
      }

      const detailsHeader = document.getElementById('paDetailsSectionHeader');
      if (detailsHeader) {
        detailsHeader.textContent = theme.sectionTitle;
      }

      const menuItems = document.querySelectorAll('.pa-type-option-item');
      menuItems.forEach(item => {
        if (item.getAttribute('data-type') === val) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      if (paGeneralSection) paGeneralSection.style.display = val === 'general' ? 'block' : 'none';
      if (paCancellationSection) paCancellationSection.style.display = val === 'cancellation' ? 'block' : 'none';
      if (paHolidaySection) paHolidaySection.style.display = val === 'holiday' ? 'block' : 'none';
      if (paOnlineSection) paOnlineSection.style.display = val === 'online_class' ? 'block' : 'none';
      if (paClassTestSection) paClassTestSection.style.display = val === 'class_test' ? 'block' : 'none';
      if (paRescheduledSection) paRescheduledSection.style.display = val === 'rescheduled' ? 'block' : 'none';
      if (paAssignmentSection) paAssignmentSection.style.display = val === 'assignment' ? 'block' : 'none';
    });
  }

  if (paHolidayRangeType) {
    paHolidayRangeType.addEventListener('change', () => {
      const val = paHolidayRangeType.value;
      if (paHolidayEndDateContainer) paHolidayEndDateContainer.style.display = val === 'multiple' ? 'block' : 'none';
    });
  }

  // Back / Cancel Buttons
  const backBtn = document.getElementById('postAnnounceBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (window.switchAppView) window.switchAppView('announcements');
    });
  }

  const cancelBtn = document.getElementById('postAnnounceCancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (window.switchAppView) window.switchAppView('announcements');
    });
  }

  // Submit Handler (Create & Update)
  const submitBtn = document.getElementById('postAnnounceSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const editId = document.getElementById('paEditId')?.value;
      const isEdit = Boolean(editId);

      const name = document.getElementById('paName')?.value || '';
      const type = document.getElementById('paType')?.value || 'general';
      const password = document.getElementById('paPassword')?.value;
      const todayStr = new Date().toISOString().split('T')[0];

      if (!name.trim() || !password) {
        showToast('Please fill out Name and Password.', 'warning');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = isEdit ? 'Saving...' : 'Publishing...';

      let success = false;

      if (type === 'general') {
        const title = document.getElementById('paTitle')?.value || '';
        const content = document.getElementById('paContent')?.value || '';
        const subject = document.getElementById('paSubject')?.value || '';

        const validation = validateAnnouncementPayload({
          name,
          title,
          announcement: content,
          subject,
          type: 'general'
        });

        if (!validation.valid) {
          showToast(validation.error, 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        const s = validation.sanitized;
        if (isEdit) {
          success = await Announcements.update(editId, s.name, s.title, s.announcement, password, { subject: s.subject, type: 'general', is_pinned: _editIsPinned });
        } else {
          success = await Announcements.publish(s.name, s.title, s.announcement, password, { subject: s.subject, type: 'general' });
        }

      } else if (type === 'cancellation') {
        const subject = document.getElementById('paCancelSubjectSelect')?.value;
        const date = document.getElementById('paCancelDate')?.value;

        if (!subject || !date) {
          showToast('Please select a Subject and Date.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        if (!isEdit && date < todayStr) {
          showToast('Cannot schedule class cancellations for past dates.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Publish & Notify';
          return;
        }

        const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const title = `${subject} Class`;
        const content = `Reminding you that the ${subject} class scheduled for ${formattedDate} is cancelled.`;

        const validation = validateAnnouncementPayload({
          name,
          title,
          announcement: content,
          subject,
          type: 'cancellation',
          date_override: date,
          subject_override: subject
        });

        if (!validation.valid) {
          showToast(validation.error, 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        const s = validation.sanitized;
        if (isEdit) {
          success = await Announcements.update(editId, s.name, s.title, s.announcement, password, {
            subject: s.subject,
            type: 'cancellation',
            date_override: s.date_override,
            subject_override: s.subject_override,
            is_pinned: _editIsPinned
          });
        } else {
          success = await Announcements.publish(s.name, s.title, s.announcement, password, {
            subject: s.subject,
            type: 'cancellation',
            date_override: s.date_override,
            subject_override: s.subject_override
          });
        }

      } else if (type === 'holiday') {
        const rangeType = document.getElementById('paHolidayRangeType')?.value;
        const startDate = document.getElementById('paHolidayStartDate')?.value;
        const holidayName = document.getElementById('paHolidayDetails')?.value || 'Holiday';

        if (!startDate) {
          showToast('Please select a Start Date.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        if (!isEdit && startDate < todayStr) {
          showToast('Cannot schedule holidays for past dates.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Publish & Notify';
          return;
        }

        if (rangeType === 'single' || isEdit) {
          const formattedDate = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const title = holidayName.trim() || 'Holiday';
          const content = `Holiday / Day Off declared on ${formattedDate}. All classes are suspended.`;

          const validation = validateAnnouncementPayload({
            name,
            title,
            announcement: content,
            holiday_name: holidayName,
            type: 'holiday',
            date_override: startDate
          });

          if (!validation.valid) {
            showToast(validation.error, 'warning');
            submitBtn.disabled = false;
            submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
            return;
          }

          const s = validation.sanitized;
          if (isEdit) {
            success = await Announcements.update(editId, s.name, s.title, s.announcement, password, {
              type: 'holiday',
              date_override: s.date_override,
              is_pinned: _editIsPinned
            });
          } else {
            success = await Announcements.publish(s.name, s.title, s.announcement, password, {
              type: 'holiday',
              date_override: s.date_override
            });
          }
        } else {
          const endDate = document.getElementById('paHolidayEndDate')?.value;
          if (!endDate || endDate < startDate) {
            showToast('Please select a valid End Date.', 'warning');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publish & Notify';
            return;
          }

          const formattedStart = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const formattedEnd = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const title = holidayName.trim() || 'Holiday';
          const content = `Holiday / Day Off declared from ${formattedStart} to ${formattedEnd}. All classes are suspended.`;

          const validation = validateAnnouncementPayload({
            name,
            title,
            announcement: content,
            holiday_name: holidayName,
            type: 'holiday',
            date_override: startDate
          });

          if (!validation.valid) {
            showToast(validation.error, 'warning');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publish & Notify';
            return;
          }

          const dates = [];
          let curr = new Date(startDate);
          const last = new Date(endDate);
          while (curr <= last) {
            dates.push(curr.toISOString().split('T')[0]);
            curr.setDate(curr.getDate() + 1);
          }

          const s = validation.sanitized;
          for (let i = 0; i < dates.length; i++) {
            const pubSuccess = await Announcements.publish(s.name, s.title, s.announcement, password, {
              type: 'holiday',
              date_override: dates[i]
            });
            if (pubSuccess) success = true;
          }
        }

      } else if (type === 'online_class') {
        const subject = document.getElementById('paOnlineSubjectSelect')?.value;
        const date = document.getElementById('paOnlineDate')?.value;
        const isOnline = _currentClassMode === 'online';
        const platform = isOnline ? (document.getElementById('paOnlineLink')?.value || '') : '';
        const room = !isOnline ? (document.getElementById('paOnlineRoom')?.value || '') : '';
        const startTime = document.getElementById('paOnlineStart')?.value || '09:45';

        if (!subject || !date || !startTime) {
          showToast('Please select Subject, Date, and Start Time.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        if (!isEdit && date < todayStr) {
          showToast('Cannot schedule classes for past dates.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Publish & Notify';
          return;
        }

        const formattedStart = format12h(startTime);

        const validation = validateAnnouncementPayload({
          name,
          title: !isOnline ? `${subject} Extra Class` : `${subject} Online Class`,
          platform,
          room,
          start_time: formattedStart,
          is_extra_class: true,
          is_online: isOnline,
          type: 'online_class',
          date_override: date,
          subject_override: subject
        });

        if (!validation.valid) {
          showToast(validation.error, 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        const s = validation.sanitized;
        if (isEdit) {
          success = await Announcements.update(editId, s.name, s.title, s.announcement, password, {
            type: 'online_class',
            date_override: s.date_override,
            subject_override: s.subject_override,
            is_pinned: _editIsPinned
          });
        } else {
          success = await Announcements.publish(s.name, s.title, s.announcement, password, {
            type: 'online_class',
            date_override: s.date_override,
            subject_override: s.subject_override
          });
        }

      } else if (type === 'class_test') {
        const subject = document.getElementById('paClassTestSubjectSelect')?.value;
        const date = document.getElementById('paClassTestDate')?.value;
        const examName = document.getElementById('paClassTestName')?.value || 'Class Test';
        const topics = document.getElementById('paClassTestTopics')?.value || '';

        if (!subject || !date) {
          showToast('Please select a Subject and Date.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        if (!isEdit && date < todayStr) {
          showToast('Cannot schedule exams for past dates.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Publish & Notify';
          return;
        }

        const validation = validateAnnouncementPayload({
          name,
          exam_name: examName,
          topics,
          type: 'class_test',
          date_override: date,
          subject_override: subject
        });

        if (!validation.valid) {
          showToast(validation.error, 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        const s = validation.sanitized;
        if (isEdit) {
          success = await Announcements.update(editId, s.name, s.title, s.announcement, password, {
            type: 'class_test',
            date_override: s.date_override,
            subject_override: s.subject_override,
            is_pinned: _editIsPinned
          });
        } else {
          success = await Announcements.publish(s.name, s.title, s.announcement, password, {
            type: 'class_test',
            date_override: s.date_override,
            subject_override: s.subject_override
          });
        }

      } else if (type === 'rescheduled') {
        const origDate = document.getElementById('paRescheduleOrigDate')?.value;
        const newDate = document.getElementById('paRescheduleNewDate')?.value;
        const selectEl = document.getElementById('paRescheduleSubjectSelect');
        const subject = selectEl?.value;
        const selectedOption = selectEl?.options[selectEl.selectedIndex];
        const origStart = selectedOption?.getAttribute('data-start') || '';
        const origRoom = selectedOption?.getAttribute('data-room') || '';
        const newStart = document.getElementById('paRescheduleNewStart')?.value;
        const newRoom = document.getElementById('paRescheduleNewRoom')?.value || '';
        const reason = document.getElementById('paRescheduleReason')?.value || '';

        if (!origDate || !newDate || !subject || !newStart) {
          showToast('Please select Original Date, Class, New Date, and New Start Time.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        if (!isEdit && origDate < todayStr) {
          showToast('Cannot reschedule classes for past dates.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Publish & Notify';
          return;
        }

        const formattedStart = format12h(newStart);

        const validation = validateAnnouncementPayload({
          name,
          title: `Rescheduled: ${subject}`,
          type: 'rescheduled',
          date_override: origDate,
          subject_override: subject,
          original_date: origDate,
          original_start_time: origStart ? format12h(origStart) : '',
          original_room: origRoom,
          new_date: newDate,
          new_start_time: formattedStart,
          new_room: newRoom,
          reason
        });

        if (!validation.valid) {
          showToast(validation.error, 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        const s = validation.sanitized;
        if (isEdit) {
          success = await Announcements.update(editId, s.name, s.title, s.announcement, password, {
            type: 'rescheduled',
            date_override: s.date_override,
            subject_override: s.subject_override,
            is_pinned: _editIsPinned
          });
        } else {
          success = await Announcements.publish(s.name, s.title, s.announcement, password, {
            type: 'rescheduled',
            date_override: s.date_override,
            subject_override: s.subject_override
          });
        }

      } else if (type === 'assignment') {
        const date = document.getElementById('paAssignmentDueDate')?.value;
        const subject = document.getElementById('paAssignmentSubjectSelect')?.value || '';
        const taskTitle = document.getElementById('paAssignmentTitle')?.value || 'Assignment';
        const dueTime = document.getElementById('paAssignmentDueTime')?.value || '23:59';
        const desc = document.getElementById('paAssignmentDescription')?.value || '';

        if (!date || !subject || !taskTitle) {
          showToast('Please select a Due Date, Subject, and Task Title.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        if (!isEdit && date < todayStr) {
          showToast('Cannot post assignments with a past due date.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Publish & Notify';
          return;
        }

        const formattedDueTime = format12h(dueTime);

        const validation = validateAnnouncementPayload({
          name,
          type: 'assignment',
          date_override: date,
          subject_override: subject,
          task_title: taskTitle,
          due_time: formattedDueTime,
          description: desc
        });

        if (!validation.valid) {
          showToast(validation.error, 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        const s = validation.sanitized;
        if (isEdit) {
          success = await Announcements.update(editId, s.name, s.title, s.announcement, password, {
            type: 'assignment',
            date_override: s.date_override,
            subject_override: s.subject_override,
            is_pinned: _editIsPinned
          });
        } else {
          success = await Announcements.publish(s.name, s.title, s.announcement, password, {
            type: 'assignment',
            date_override: s.date_override,
            subject_override: s.subject_override
          });
        }
      }

      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';

      if (success) {
        if (window.switchAppView) window.switchAppView('announcements');
      }
    });
  }
}

