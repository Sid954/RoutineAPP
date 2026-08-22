import { State } from '../core/state.js';
import { showToast } from '../toast/toast.js';
import { escapeHtml, format12h, parseTo24h } from '../core/utils.js';
import { Announcements } from './announcements.js';
import { getClassesForDay } from '../schedule/queries.js';

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
    label: 'Online Class',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>',
    sectionTitle: 'Online Session Parameters'
  },
  class_test: {
    label: 'Class Test',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    sectionTitle: 'Class Test & Exam Parameters'
  }
};

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
  const paCancelSubjectSelect = document.getElementById('paCancelSubjectSelect');

  const paHolidayRangeType = document.getElementById('paHolidayRangeType');
  const paHolidayStartDate = document.getElementById('paHolidayStartDate');
  const paHolidayEndDateContainer = document.getElementById('paHolidayEndDateContainer');
  const paHolidayEndDate = document.getElementById('paHolidayEndDate');
  const paHolidayDetails = document.getElementById('paHolidayDetails');

  const paOnlineDate = document.getElementById('paOnlineDate');
  const paOnlineSubjectSelect = document.getElementById('paOnlineSubjectSelect');
  const paOnlineStart = document.getElementById('paOnlineStart');
  const paOnlineEnd = document.getElementById('paOnlineEnd');
  const paOnlineLink = document.getElementById('paOnlineLink');

  const paClassTestDate = document.getElementById('paClassTestDate');
  const paClassTestSubjectSelect = document.getElementById('paClassTestSubjectSelect');
  const paClassTestName = document.getElementById('paClassTestName');
  const paClassTestTopics = document.getElementById('paClassTestTopics');
  const paClassTestShowAllSubjects = document.getElementById('paClassTestShowAllSubjects');

  const paGeneralSection = document.getElementById('paGeneralSection');
  const paCancellationSection = document.getElementById('paCancellationSection');
  const paHolidaySection = document.getElementById('paHolidaySection');
  const paOnlineSection = document.getElementById('paOnlineSection');
  const paClassTestSection = document.getElementById('paClassTestSection');

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

  function updateCancelSubjectsList(selectedVal = '') {
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

  function updateClassTestSubjectsList(selectedVal = '') {
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

  function setSectionVisibility(type) {
    const card = document.getElementById('paFormCard');
    if (card) card.setAttribute('data-type', type || 'general');

    const theme = TYPE_THEMES[type] || TYPE_THEMES.general;
    const pill = document.getElementById('paTypeIndicatorPill');
    if (pill) {
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

    if (paGeneralSection) paGeneralSection.style.display = type === 'general' ? 'block' : 'none';
    if (paCancellationSection) paCancellationSection.style.display = type === 'cancellation' ? 'block' : 'none';
    if (paHolidaySection) paHolidaySection.style.display = type === 'holiday' ? 'block' : 'none';
    if (paOnlineSection) paOnlineSection.style.display = type === 'online_class' ? 'block' : 'none';
    if (paClassTestSection) paClassTestSection.style.display = type === 'class_test' ? 'block' : 'none';
  }

  if (existingAnnouncement) {
    // EDIT MODE
    const item = existingAnnouncement;
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
        if (paOnlineLink) paOnlineLink.value = parsed.platform || '';
        if (paOnlineStart) paOnlineStart.value = parseTo24h(parsed.start_time) || '09:45';
        if (paOnlineEnd) paOnlineEnd.value = parseTo24h(parsed.end_time) || '11:00';
      } catch (e) {}
    } else if (type === 'class_test') {
      if (paClassTestDate) paClassTestDate.value = item.date_override || todayStr;
      updateClassTestSubjectsList(item.subject_override || item.subject || '');
      try {
        const parsed = JSON.parse(item.announcement);
        if (paClassTestName) paClassTestName.value = parsed.exam_name || '';
        if (paClassTestTopics) paClassTestTopics.value = parsed.topics || '';
      } catch (e) {}
    }
  } else {
    // CREATE MODE
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

    if (paOnlineDate) { paOnlineDate.value = todayStr; paOnlineDate.min = todayStr; }
    if (paOnlineLink) paOnlineLink.value = '';
    if (paOnlineStart) paOnlineStart.value = '09:45';
    if (paOnlineEnd) paOnlineEnd.value = '11:00';

    if (paClassTestDate) { paClassTestDate.value = todayStr; paClassTestDate.min = todayStr; }
    if (paClassTestName) paClassTestName.value = '';
    if (paClassTestTopics) paClassTestTopics.value = '';
    if (paClassTestShowAllSubjects) paClassTestShowAllSubjects.checked = false;

    setSectionVisibility('general');
    updateCancelSubjectsList();
    updateClassTestSubjectsList();
  }
}

export function initPostForm() {
  window.__openPostAnnounceForm = (announcementItem) => {
    openPostForm(announcementItem);
  };

  const paType = document.getElementById('paType');
  const paGeneralSection = document.getElementById('paGeneralSection');
  const paCancellationSection = document.getElementById('paCancellationSection');
  const paHolidaySection = document.getElementById('paHolidaySection');
  const paOnlineSection = document.getElementById('paOnlineSection');
  const paClassTestSection = document.getElementById('paClassTestSection');

  const paHolidayRangeType = document.getElementById('paHolidayRangeType');
  const paHolidayEndDateContainer = document.getElementById('paHolidayEndDateContainer');

  const paCancelDate = document.getElementById('paCancelDate');
  const paCancelSubjectSelect = document.getElementById('paCancelSubjectSelect');

  const paClassTestDate = document.getElementById('paClassTestDate');
  const paClassTestSubjectSelect = document.getElementById('paClassTestSubjectSelect');
  const paClassTestShowAllSubjects = document.getElementById('paClassTestShowAllSubjects');

  const paOnlineSubjectSelect = document.getElementById('paOnlineSubjectSelect');
  const paOnlineDate = document.getElementById('paOnlineDate');
  const paOnlineStart = document.getElementById('paOnlineStart');
  const paOnlineEnd = document.getElementById('paOnlineEnd');

  function autoFillOnlineTimes() {
    if (!paOnlineDate || !paOnlineSubjectSelect || !paOnlineStart || !paOnlineEnd) return;
    const dateVal = paOnlineDate.value;
    const subjectVal = paOnlineSubjectSelect.value;
    if (!dateVal || !subjectVal) return;

    const [y, m, d] = dateVal.split('-').map(Number);
    const dayIdx = new Date(y, m - 1, d).getDay();

    const classes = State.schedule[dayIdx] || [];
    const match = classes.find(c => c.title && c.title.toUpperCase() === subjectVal.toUpperCase());
    if (match) {
      paOnlineStart.value = match.start;
      paOnlineEnd.value = match.end;
    }
  }

  function updateCancelSubjects() {
    if (!paCancelDate || !paCancelSubjectSelect) return;
    const dateVal = paCancelDate.value;
    if (!dateVal) {
      paCancelSubjectSelect.innerHTML = '<option value="">Select a date first</option>';
      return;
    }

    const [y, m, d] = dateVal.split('-').map(Number);
    const dayIdx = new Date(y, m - 1, d).getDay();
    const classes = getClassesForDay(dayIdx);
    const subjects = Array.from(new Set(classes.map(c => c.title).filter(Boolean)));

    if (subjects.length === 0) {
      paCancelSubjectSelect.innerHTML = '<option value="">No classes scheduled on this day</option>';
    } else {
      paCancelSubjectSelect.innerHTML = subjects
        .sort()
        .map(sub => `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`)
        .join('');
    }
  }

  function updateClassTestSubjects() {
    if (!paClassTestDate || !paClassTestSubjectSelect) return;
    const dateVal = paClassTestDate.value;
    if (!dateVal) {
      paClassTestSubjectSelect.innerHTML = '<option value="">Select a date first</option>';
      return;
    }

    const [y, m, d] = dateVal.split('-').map(Number);
    const dayIdx = new Date(y, m - 1, d).getDay();
    const showAll = paClassTestShowAllSubjects && paClassTestShowAllSubjects.checked;

    let subjects = [];
    if (showAll) {
      const allSubjs = new Set();
      Object.values(State.schedule).forEach(dayClasses => {
        dayClasses.forEach(c => { if (c.title) allSubjs.add(c.title); });
      });
      subjects = Array.from(allSubjs);
    } else {
      const classes = getClassesForDay(dayIdx);
      subjects = Array.from(new Set(classes.map(c => c.title).filter(Boolean)));
    }

    if (subjects.length === 0) {
      paClassTestSubjectSelect.innerHTML = `<option value="">No classes on this ${showAll ? 'schedule' : 'day'}</option>`;
    } else {
      paClassTestSubjectSelect.innerHTML = subjects
        .sort()
        .map(sub => `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`)
        .join('');
    }
  }

  if (paOnlineSubjectSelect) paOnlineSubjectSelect.addEventListener('change', autoFillOnlineTimes);
  if (paOnlineDate) paOnlineDate.addEventListener('change', autoFillOnlineTimes);
  if (paCancelDate) paCancelDate.addEventListener('change', updateCancelSubjects);
  if (paClassTestDate) paClassTestDate.addEventListener('change', updateClassTestSubjects);
  if (paClassTestShowAllSubjects) paClassTestShowAllSubjects.addEventListener('change', updateClassTestSubjects);

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
    const isOpen = typeDropdownMenu.style.display !== 'none';
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

  document.querySelectorAll('.pa-type-option-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const chosenType = item.getAttribute('data-type');
      if (paType) {
        paType.value = chosenType;
        paType.dispatchEvent(new Event('change'));
      }
      closeTypeDropdown();
    });
  });

  document.addEventListener('click', (e) => {
    if (typeDropdownMenu && typeDropdownMenu.style.display !== 'none') {
      if (!typeDropdownMenu.contains(e.target) && !typePickerBtn?.contains(e.target)) {
        closeTypeDropdown();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTypeDropdown();
    }
  });

  if (paType) {
    paType.addEventListener('change', () => {
      const val = paType.value;
      const card = document.getElementById('paFormCard');
      if (card) card.setAttribute('data-type', val || 'general');

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

      const name = document.getElementById('paName')?.value.trim();
      const type = document.getElementById('paType')?.value || 'general';
      const password = document.getElementById('paPassword')?.value;
      const todayStr = new Date().toISOString().split('T')[0];

      if (!name || !password) {
        showToast('Please fill out Name and Password.', 'warning');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = isEdit ? 'Saving...' : 'Publishing...';

      let success = false;

      if (type === 'general') {
        const title = document.getElementById('paTitle')?.value.trim();
        const content = document.getElementById('paContent')?.value.trim();
        const subject = document.getElementById('paSubject')?.value.trim();

        if (!title || !content) {
          showToast('Please fill out Title and Details.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        if (isEdit) {
          success = await Announcements.update(editId, name, title, content, password, { subject, type: 'general' });
        } else {
          success = await Announcements.publish(name, title, content, password, { subject, type: 'general' });
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
        const title = `Class Cancelled: ${subject}`;
        const content = `Reminding you that the ${subject} class scheduled for ${formattedDate} is cancelled.`;

        if (isEdit) {
          success = await Announcements.update(editId, name, title, content, password, {
            subject,
            type: 'cancellation',
            date_override: date,
            subject_override: subject
          });
        } else {
          success = await Announcements.publish(name, title, content, password, {
            subject,
            type: 'cancellation',
            date_override: date,
            subject_override: subject
          });
        }

      } else if (type === 'holiday') {
        const rangeType = document.getElementById('paHolidayRangeType')?.value;
        const startDate = document.getElementById('paHolidayStartDate')?.value;
        const holidayName = document.getElementById('paHolidayDetails')?.value.trim() || 'Holiday';

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
          const title = `Holiday: ${holidayName}`;
          const content = `Holiday / Day Off declared on ${formattedDate}. All classes are suspended.`;

          if (isEdit) {
            success = await Announcements.update(editId, name, title, content, password, {
              type: 'holiday',
              date_override: startDate
            });
          } else {
            success = await Announcements.publish(name, title, content, password, {
              type: 'holiday',
              date_override: startDate
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
          const title = `Holiday: ${holidayName}`;
          const content = `Holiday / Day Off declared from ${formattedStart} to ${formattedEnd}. All classes are suspended.`;

          const dates = [];
          let curr = new Date(startDate);
          const last = new Date(endDate);
          while (curr <= last) {
            dates.push(curr.toISOString().split('T')[0]);
            curr.setDate(curr.getDate() + 1);
          }

          for (let i = 0; i < dates.length; i++) {
            const pubSuccess = await Announcements.publish(name, title, content, password, {
              type: 'holiday',
              date_override: dates[i]
            });
            if (pubSuccess) success = true;
          }
        }

      } else if (type === 'online_class') {
        const subject = document.getElementById('paOnlineSubjectSelect')?.value;
        const date = document.getElementById('paOnlineDate')?.value;
        const platform = document.getElementById('paOnlineLink')?.value.trim();
        const startTime = document.getElementById('paOnlineStart')?.value;
        const endTime = document.getElementById('paOnlineEnd')?.value;

        if (!subject || !date || !startTime || !endTime) {
          showToast('Please select Subject, Date, Start Time, and End Time.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? 'Save Changes' : 'Publish & Notify';
          return;
        }

        if (!isEdit && date < todayStr) {
          showToast('Cannot schedule online classes for past dates.', 'warning');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Publish & Notify';
          return;
        }

        const formattedStart = format12h(startTime);
        const formattedEnd = format12h(endTime);

        const title = `Online Class: ${subject}`;
        const content = JSON.stringify({
          platform,
          start_time: formattedStart,
          end_time: formattedEnd
        });

        if (isEdit) {
          success = await Announcements.update(editId, name, title, content, password, {
            type: 'online_class',
            date_override: date,
            subject_override: subject
          });
        } else {
          success = await Announcements.publish(name, title, content, password, {
            type: 'online_class',
            date_override: date,
            subject_override: subject
          });
        }

      } else if (type === 'class_test') {
        const subject = document.getElementById('paClassTestSubjectSelect')?.value;
        const date = document.getElementById('paClassTestDate')?.value;
        const examName = document.getElementById('paClassTestName')?.value.trim() || 'Class Test';
        const topics = document.getElementById('paClassTestTopics')?.value.trim() || 'Not Specified';

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

        const title = `${examName}: ${subject}`;
        const content = JSON.stringify({ exam_name: examName, topics });

        if (isEdit) {
          success = await Announcements.update(editId, name, title, content, password, {
            type: 'class_test',
            date_override: date,
            subject_override: subject
          });
        } else {
          success = await Announcements.publish(name, title, content, password, {
            type: 'class_test',
            date_override: date,
            subject_override: subject
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

