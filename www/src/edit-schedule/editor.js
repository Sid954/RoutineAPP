import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG, DAY_NAMES, DAY_SHORT } from '../core/config.js';
import { getClassesForDay } from '../schedule/queries.js';
import { getSubjectTheme } from '../schedule/themes.js';
import { toMinutes, format12h, getCurrentMinutes, formatRoom } from '../core/utils.js';
import { Storage } from '../storage/storage.js';
import { showToast } from '../toast/toast.js';
import { forceUpdate } from '../dashboard/update.js';
import { normalizeSchedule } from '../schedule/normalizer.js';
import { Notifications } from '../notifications/notifications.js';

export function populateDaySelect() {
  DOM.editDaySelect.innerHTML = '';
  for (const dayIdx of CONFIG.activeDays) {
    const opt = document.createElement('option');
    opt.value = dayIdx;
    opt.textContent = DAY_NAMES[dayIdx];
    if (dayIdx === State.selectedDay) opt.selected = true;
    DOM.editDaySelect.appendChild(opt);
  }
}

export function renderEditColumns() {
  const currentMins = getCurrentMinutes();
  const todayIdx = new Date().getDay();
  let html = '';

  CONFIG.activeDays.forEach((dayIdx, colIndex) => {
    const entries = getClassesForDay(dayIdx);
    const isToday = dayIdx === todayIdx;

    html += `<div class="dc${isToday ? ' tod' : ''}" style="animation-delay:${colIndex * 0.06}s">`;
    html += `<div class="dc-h"><span class="dn">${DAY_SHORT[dayIdx]}</span><span class="cnt">${entries.length}</span></div>`;
    html += `<div class="dc-b">`;

    if (entries.length) {
      entries.forEach(item => {
        const isLive = isToday && currentMins >= toMinutes(item.start) && currentMins < toMinutes(item.end);
        html += `
          <div class="dc-e${isLive ? ' ac' : ''}">
            <div class="et">${format12h(item.start)} – ${format12h(item.end)}</div>
            <div class="en" title="${item.title}">${item.title}</div>
            ${item.instructor ? `<div class="ei">${item.instructor}</div>` : ''}
            <div class="er">${formatRoom(item.room)} · ${item.type}</div>
            <button class="ed" data-day="${dayIdx}" data-ti="${encodeURIComponent(item.title)}" title="Delete">✕</button>
          </div>`;
      });
    } else {
      html += `<div class="dc-empty">No classes</div>`;
    }

    html += `</div></div>`;
  });

  DOM.editCols.innerHTML = html;

  // Delete buttons
  DOM.editCols.querySelectorAll('.ed').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetDay = parseInt(btn.dataset.day);
      const title = decodeURIComponent(btn.dataset.ti);
      const dayEntries = State.schedule[targetDay] || [];
      const removeIdx = dayEntries.findIndex(x => x.title === title);
      if (removeIdx === -1) return;

      const removed = dayEntries[removeIdx];
      const origIdx = removeIdx;
      State.schedule[targetDay].splice(removeIdx, 1);
      Storage.saveSchedule(); renderEditColumns(); forceUpdate();

      showToast(`Removed "${removed.title}"`, 'info', () => {
        State.schedule[targetDay].splice(origIdx, 0, removed);
        State.schedule[targetDay].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
        Storage.saveSchedule(); renderEditColumns(); forceUpdate();
        showToast(`Restored "${removed.title}"`, 'success');
      });
    });
  });

  // Click day column to select it
  DOM.editCols.querySelectorAll('.dc').forEach(col => {
    col.addEventListener('click', e => {
      if (e.target.closest('.ed')) return;
      const nameEl = col.querySelector('.dn');
      if (nameEl) {
        const match = Object.entries(DAY_SHORT).find(([, label]) => label === nameEl.textContent.trim());
        if (match) { State.selectedDay = parseInt(match[0]); populateDaySelect(); }
      }
    });
  });
}

export function initEditorEvents() {
  // Day select change
  DOM.editDaySelect.addEventListener('change', e => { State.selectedDay = parseInt(e.target.value); });

  // Add entry
  document.getElementById('addB').addEventListener('click', () => {
    const startTime = DOM.editStart.value;
    const endTime = DOM.editEnd.value;
    const title = DOM.editTitle.value.trim();
    const room = DOM.editRoom.value.trim();
    const instructor = DOM.editInstructor.value.trim();
    const classType = DOM.editType.value;
    const targetDay = parseInt(DOM.editDaySelect.value);

    if (!startTime || !endTime || !title) {
      showToast('Please fill out Start Time, End Time, and Title.', 'warning');
      return;
    }

    if (!State.schedule[targetDay]) State.schedule[targetDay] = [];
    State.schedule[targetDay].push({ start: startTime, end: endTime, title, room, instructor, type: classType });
    State.schedule[targetDay].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    Storage.saveSchedule(); renderEditColumns(); forceUpdate();
    Notifications.scheduleForToday();

    DOM.editTitle.value = ''; DOM.editRoom.value = ''; DOM.editInstructor.value = '';
    showToast(`Added "${title}" to ${DAY_NAMES[targetDay]}`, 'success');
  });

  // Clear day
  document.getElementById('clrB').addEventListener('click', () => {
    const targetDay = parseInt(DOM.editDaySelect.value);
    if (!State.schedule[targetDay] || !State.schedule[targetDay].length) {
      showToast(`${DAY_NAMES[targetDay]} is already empty.`, 'info');
      return;
    }
    const backup = JSON.parse(JSON.stringify(State.schedule[targetDay]));
    State.schedule[targetDay] = [];
    Storage.saveSchedule(); renderEditColumns(); forceUpdate();

    showToast(`Cleared all classes for ${DAY_NAMES[targetDay]}`, 'info', () => {
      State.schedule[targetDay] = backup;
      Storage.saveSchedule(); renderEditColumns(); forceUpdate();
      showToast(`Restored ${DAY_NAMES[targetDay]} schedule`, 'success');
    });
  });

  // Reset to default
  document.getElementById('rstB').addEventListener('click', () => {
    const backup = JSON.parse(JSON.stringify(State.schedule));
    State.schedule = JSON.parse(JSON.stringify(normalizeSchedule(CONFIG.defaultRoutine)));
    Storage.saveSchedule(); renderEditColumns(); forceUpdate();

    showToast('Reset to default schedule', 'info', () => {
      State.schedule = backup;
      Storage.saveSchedule(); renderEditColumns(); forceUpdate();
      showToast('Undo successful', 'success');
    });
  });

  // Note: editBtn and ecC modal open/close are handled by main.js
  // to keep modal management centralized.
}
