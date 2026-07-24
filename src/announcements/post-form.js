import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { showToast } from '../toast/toast.js';
import { escapeHtml, format12h } from '../core/utils.js';
import { openModal, closeModal } from '../modals/modal.js';
import { Announcements } from './announcements.js';
import { getClassesForDay } from '../schedule/queries.js';

export function initPostForm() {
  function autoFillOnlineTimes() {
    const dateVal = DOM.paOnlineDate.value;
    const subjectVal = DOM.paOnlineSubjectSelect.value;
    if (!dateVal || !subjectVal) return;

    const [y, m, d] = dateVal.split('-').map(Number);
    const dayIdx = new Date(y, m - 1, d).getDay();

    const classes = State.schedule[dayIdx] || [];
    const match = classes.find(c => c.title && c.title.toUpperCase() === subjectVal.toUpperCase());
    if (match) {
      DOM.paOnlineStart.value = match.start;
      DOM.paOnlineEnd.value = match.end;
    }
  }

  function updateCancelSubjects() {
    const dateVal = DOM.paCancelDate.value;
    if (!dateVal) {
      DOM.paCancelSubjectSelect.innerHTML = '<option value="">Select a date first</option>';
      return;
    }

    const [y, m, d] = dateVal.split('-').map(Number);
    const dayIdx = new Date(y, m - 1, d).getDay();

    const classes = getClassesForDay(dayIdx);
    const subjects = Array.from(new Set(classes.map(c => c.title).filter(Boolean)));

    if (subjects.length === 0) {
      DOM.paCancelSubjectSelect.innerHTML = '<option value="">No classes scheduled on this day</option>';
    } else {
      DOM.paCancelSubjectSelect.innerHTML = subjects
        .sort()
        .map(sub => `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`)
        .join('');
    }
  }

  function updateClassTestSubjects() {
    const dateVal = DOM.paClassTestDate.value;
    if (!dateVal) {
      DOM.paClassTestSubjectSelect.innerHTML = '<option value="">Select a date first</option>';
      return;
    }

    const [y, m, d] = dateVal.split('-').map(Number);
    const dayIdx = new Date(y, m - 1, d).getDay();

    const showAll = DOM.paClassTestShowAllSubjects && DOM.paClassTestShowAllSubjects.checked;
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
      DOM.paClassTestSubjectSelect.innerHTML = `<option value="">No classes on this ${showAll ? 'schedule' : 'day'}</option>`;
    } else {
      DOM.paClassTestSubjectSelect.innerHTML = subjects
        .sort()
        .map(sub => `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`)
        .join('');
    }
  }

  DOM.paOnlineSubjectSelect.addEventListener('change', autoFillOnlineTimes);
  DOM.paOnlineDate.addEventListener('change', autoFillOnlineTimes);
  DOM.paCancelDate.addEventListener('change', updateCancelSubjects);
  DOM.paClassTestDate.addEventListener('change', updateClassTestSubjects);
  if (DOM.paClassTestShowAllSubjects) {
    DOM.paClassTestShowAllSubjects.addEventListener('change', updateClassTestSubjects);
  }

  DOM.newAnnounceBtn.addEventListener('click', () => {
    closeModal(DOM.announceModal);

    // Reset inputs
    DOM.paName.value = '';
    DOM.paType.value = 'general';
    DOM.paTitle.value = '';
    DOM.paSubject.value = '';
    DOM.paContent.value = '';
    DOM.paPassword.value = '';
    DOM.paHolidayDetails.value = '';
    DOM.paClassTestName.value = '';
    DOM.paClassTestTopics.value = '';
    if (DOM.paClassTestShowAllSubjects) {
      DOM.paClassTestShowAllSubjects.checked = false;
    }

    // Auto-fill dates with today and enforce minimum date to prevent selecting past dates
    const todayStr = new Date().toISOString().split('T')[0];
    DOM.paCancelDate.value = todayStr;
    DOM.paCancelDate.min = todayStr;

    DOM.paHolidayStartDate.value = todayStr;
    DOM.paHolidayStartDate.min = todayStr;

    DOM.paHolidayEndDate.value = todayStr;
    DOM.paHolidayEndDate.min = todayStr;

    DOM.paOnlineDate.value = todayStr;
    DOM.paOnlineDate.min = todayStr;

    DOM.paClassTestDate.value = todayStr;
    DOM.paClassTestDate.min = todayStr;

    // Populate Subject dropdowns for cancellation + online class
    const subjects = new Set();
    Object.values(State.schedule).forEach(dayClasses => {
      dayClasses.forEach(c => { if (c.title) subjects.add(c.title); });
    });
    const subjectOptions = Array.from(subjects)
      .sort()
      .map(sub => `<option value="${escapeHtml(sub)}">${escapeHtml(sub)}</option>`)
      .join('');

    DOM.paOnlineSubjectSelect.innerHTML = subjectOptions;
    DOM.paOnlineLink.value = '';

    // Populate cancel dropdown for today's date dynamically
    updateCancelSubjects();
    updateClassTestSubjects();

    // Auto-fill times for the initial subject & date
    autoFillOnlineTimes();

    // Set initial sections visibility
    DOM.paGeneralSection.style.display = 'block';
    DOM.paCancellationSection.style.display = 'none';
    DOM.paHolidaySection.style.display = 'none';
    DOM.paOnlineSection.style.display = 'none';
    DOM.paClassTestSection.style.display = 'none';
    DOM.paHolidayEndDateContainer.style.display = 'none';
    DOM.paHolidayRangeType.value = 'single';

    openModal(DOM.postAnnounceModal);
  });

  DOM.postAnnounceClose.addEventListener('click', () => {
    closeModal(DOM.postAnnounceModal);
    openModal(DOM.announceModal);
  });
  DOM.postAnnounceCancel.addEventListener('click', () => {
    closeModal(DOM.postAnnounceModal);
    openModal(DOM.announceModal);
  });

  // Handle Announcement Type change
  DOM.paType.addEventListener('change', () => {
    const val = DOM.paType.value;
    DOM.paGeneralSection.style.display = val === 'general' ? 'block' : 'none';
    DOM.paCancellationSection.style.display = val === 'cancellation' ? 'block' : 'none';
    DOM.paHolidaySection.style.display = val === 'holiday' ? 'block' : 'none';
    DOM.paOnlineSection.style.display = val === 'online_class' ? 'block' : 'none';
    DOM.paClassTestSection.style.display = val === 'class_test' ? 'block' : 'none';
  });

  DOM.paHolidayRangeType.addEventListener('change', () => {
    const val = DOM.paHolidayRangeType.value;
    DOM.paHolidayEndDateContainer.style.display = val === 'multiple' ? 'block' : 'none';
  });

  // Submit Post Announcement
  DOM.postAnnounceSubmit.addEventListener('click', async () => {
    const name = DOM.paName.value.trim();
    const type = DOM.paType.value;
    const password = DOM.paPassword.value;
    const todayStr = new Date().toISOString().split('T')[0];

    if (!name || !password) {
      showToast('Please fill out Name and Password.', 'warning');
      return;
    }

    DOM.postAnnounceSubmit.disabled = true;
    DOM.postAnnounceSubmit.textContent = 'Publishing...';

    let success = false;

    if (type === 'general') {
      const title = DOM.paTitle.value.trim();
      const content = DOM.paContent.value.trim();
      const subject = DOM.paSubject.value.trim();

      if (!title || !content) {
        showToast('Please fill out Title and Details.', 'warning');
        DOM.postAnnounceSubmit.disabled = false;
        DOM.postAnnounceSubmit.textContent = 'Publish & Notify';
        return;
      }

      success = await Announcements.publish(name, title, content, password, { subject, type: 'general' });

    } else if (type === 'cancellation') {
      const subject = DOM.paCancelSubjectSelect.value;
      const date = DOM.paCancelDate.value;

      if (!subject || !date) {
        showToast('Please select a Subject and Date.', 'warning');
        DOM.postAnnounceSubmit.disabled = false;
        DOM.postAnnounceSubmit.textContent = 'Publish & Notify';
        return;
      }

      if (date < todayStr) {
        showToast('Cannot schedule class cancellations for past dates.', 'warning');
        DOM.postAnnounceSubmit.disabled = false;
        DOM.postAnnounceSubmit.textContent = 'Publish & Notify';
        return;
      }

      const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const title = `Class Cancelled: ${subject}`;
      const content = `Reminding you that the ${subject} class scheduled for ${formattedDate} is cancelled.`;

      success = await Announcements.publish(name, title, content, password, {
        subject,
        type: 'cancellation',
        date_override: date,
        subject_override: subject
      });

    } else if (type === 'holiday') {
      const rangeType = DOM.paHolidayRangeType.value;
      const startDate = DOM.paHolidayStartDate.value;
      const holidayName = DOM.paHolidayDetails.value.trim() || 'Holiday';

      if (!startDate) {
        showToast('Please select a Start Date.', 'warning');
        DOM.postAnnounceSubmit.disabled = false;
        DOM.postAnnounceSubmit.textContent = 'Publish & Notify';
        return;
      }

      if (startDate < todayStr) {
        showToast('Cannot schedule holidays for past dates.', 'warning');
        DOM.postAnnounceSubmit.disabled = false;
        DOM.postAnnounceSubmit.textContent = 'Publish & Notify';
        return;
      }

      if (rangeType === 'single') {
        const formattedDate = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const title = `Holiday: ${holidayName}`;
        const content = `Holiday / Day Off declared on ${formattedDate}. All classes are suspended.`;

        success = await Announcements.publish(name, title, content, password, { type: 'holiday', date_override: startDate });
      } else {
        const endDate = DOM.paHolidayEndDate.value;
        if (!endDate || endDate < startDate) {
          showToast('Please select a valid End Date.', 'warning');
          DOM.postAnnounceSubmit.disabled = false;
          DOM.postAnnounceSubmit.textContent = 'Publish & Notify';
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
      const subject = DOM.paOnlineSubjectSelect.value;
      const date = DOM.paOnlineDate.value;
      const platform = DOM.paOnlineLink.value.trim();
      const startTime = DOM.paOnlineStart.value;
      const endTime = DOM.paOnlineEnd.value;

      if (!subject || !date || !startTime || !endTime) {
        showToast('Please select Subject, Date, Start Time, and End Time.', 'warning');
        DOM.postAnnounceSubmit.disabled = false;
        DOM.postAnnounceSubmit.textContent = 'Publish & Notify';
        return;
      }

      if (date < todayStr) {
        showToast('Cannot schedule online classes for past dates.', 'warning');
        DOM.postAnnounceSubmit.disabled = false;
        DOM.postAnnounceSubmit.textContent = 'Publish & Notify';
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

      success = await Announcements.publish(name, title, content, password, {
        type: 'online_class',
        date_override: date,
        subject_override: subject
      });
    } else if (type === 'class_test') {
      const subject = DOM.paClassTestSubjectSelect.value;
      const date = DOM.paClassTestDate.value;
      const examName = DOM.paClassTestName.value.trim() || 'Class Test';
      const topics = DOM.paClassTestTopics.value.trim() || 'Not Specified';

      if (!subject || !date) {
        showToast('Please select a Subject and Date.', 'warning');
        DOM.postAnnounceSubmit.disabled = false;
        DOM.postAnnounceSubmit.textContent = 'Publish & Notify';
        return;
      }

      if (date < todayStr) {
        showToast('Cannot schedule exams for past dates.', 'warning');
        DOM.postAnnounceSubmit.disabled = false;
        DOM.postAnnounceSubmit.textContent = 'Publish & Notify';
        return;
      }

      const [y, m, d] = date.split('-').map(Number);
      const formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const title = `${examName}: ${subject}`;
      const content = JSON.stringify({ exam_name: examName, topics });

      success = await Announcements.publish(name, title, content, password, {
        type: 'class_test',
        date_override: date,
        subject_override: subject
      });
    }

    DOM.postAnnounceSubmit.disabled = false;
    DOM.postAnnounceSubmit.textContent = 'Publish & Notify';

    if (success) {
      closeModal(DOM.postAnnounceModal);
      openModal(DOM.announceModal);
    }
  });
}
