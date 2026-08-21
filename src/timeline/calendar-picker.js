/**
 * calendar-picker.js — Universal Calendar Month Picker
 *
 * Allows users to jump to any date across the academic calendar.
 */

import { State } from '../core/state.js';
import { DAY_NAMES, MONTHS, FULL_MONTHS } from '../core/config.js';
import { renderTimeline } from './timeline.js';
import { getOverridesByDateMap, normalizeDate } from '../announcements/overrides.js';

let _calendarViewMonth = new Date().getMonth();
let _calendarViewYear = new Date().getFullYear();
let _selectedDate = new Date();

export function openCalendarPicker() {
  const modal = document.getElementById('calendarPickerModal');
  if (!modal) return;

  _calendarViewMonth = _selectedDate.getMonth();
  _calendarViewYear = _selectedDate.getFullYear();
  renderCalendarMonthGrid();
  modal.classList.add('open');
}

export function closeCalendarPicker(e) {
  const modal = document.getElementById('calendarPickerModal');
  if (!modal) return;
  if (e && e.target !== modal && e.target !== document.getElementById('calendarPickerCloseBtn')) return;
  modal.classList.remove('open');
}

export function prevMonth() {
  _calendarViewMonth--;
  if (_calendarViewMonth < 0) {
    _calendarViewMonth = 11;
    _calendarViewYear--;
  }
  renderCalendarMonthGrid();
}

export function nextMonth() {
  _calendarViewMonth++;
  if (_calendarViewMonth > 11) {
    _calendarViewMonth = 0;
    _calendarViewYear++;
  }
  renderCalendarMonthGrid();
}

function isSameCalendarDay(d1, d2) {
  if (!d1 || !d2) return false;
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

export function renderCalendarMonthGrid() {
  const titleEl = document.getElementById('calMonthTitle');
  const gridEl = document.getElementById('calendarDaysGrid');
  if (!titleEl || !gridEl) return;

  titleEl.textContent = `${FULL_MONTHS[_calendarViewMonth] || MONTHS[_calendarViewMonth]} ${_calendarViewYear}`;

  const firstDay = new Date(_calendarViewYear, _calendarViewMonth, 1);
  const lastDay = new Date(_calendarViewYear, _calendarViewMonth + 1, 0);
  const realToday = new Date();
  const overridesMap = getOverridesByDateMap();

  // Academic week starts on Saturday (Sat=6 => index 0, Sun=0 => 1, Mon=1 => 2, ..., Fri=5 => 6)
  const firstDaySatIndex = (firstDay.getDay() === 6) ? 0 : (firstDay.getDay() + 1);

  let gridHtml = '';

  for (let i = 0; i < firstDaySatIndex; i++) {
    gridHtml += `<div class="calendar-day-cell other-month"></div>`;
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const thisDate = new Date(_calendarViewYear, _calendarViewMonth, day);
    const dow = thisDate.getDay();
    const isOff = (dow === 4 || dow === 5);
    const isSelected = isSameCalendarDay(thisDate, _selectedDate);
    const isToday = isSameCalendarDay(thisDate, realToday);

    const dateStr = normalizeDate(thisDate);
    const override = overridesMap.get(dateStr);
    const overrideClass = override ? `cal-override-${override.type}` : '';
    const overrideDot = override ? `<span class="cal-override-dot ${override.type}"></span>` : '';

    gridHtml += `
      <div class="calendar-day-cell ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''} ${isOff ? 'is-offday' : ''} ${overrideClass}" 
           onclick="window.__pickCalendarDate(${_calendarViewYear}, ${_calendarViewMonth}, ${day})"
           title="${DAY_NAMES[dow]} ${day} ${isToday ? '(Today)' : ''} ${override ? `(${override.type.replace('_', ' ')})` : ''}">
        <span class="cal-day-num">${day}</span>
        <div class="cal-indicators-row">
          ${isToday && !isSelected ? '<span class="today-subtle-dot"></span>' : ''}
          ${overrideDot}
        </div>
      </div>
    `;
  }

  gridEl.innerHTML = gridHtml;
}

export function pickDate(year, month, day) {
  _selectedDate = new Date(year, month, day);
  const dow = _selectedDate.getDay();
  State.currentViewDayIdx = dow;
  State.viewDate = _selectedDate;
  State.lastRenderedMinute = -1;

  // Update date badge text
  const dateDisplay = document.getElementById('dateD');
  if (dateDisplay) {
    dateDisplay.textContent = `${DAY_NAMES[dow]}, ${day} ${FULL_MONTHS[month] || MONTHS[month]}`;
  }

  const modal = document.getElementById('calendarPickerModal');
  if (modal) modal.classList.remove('open');

  renderTimeline(true);
}

export function jumpToToday() {
  _selectedDate = new Date();
  const dow = _selectedDate.getDay();
  State.currentViewDayIdx = dow;
  State.viewDate = _selectedDate;
  State.lastRenderedMinute = -1;

  const dateDisplay = document.getElementById('dateD');
  if (dateDisplay) {
    dateDisplay.textContent = `${DAY_NAMES[dow]}, ${_selectedDate.getDate()} ${FULL_MONTHS[_selectedDate.getMonth()] || MONTHS[_selectedDate.getMonth()]}`;
  }

  const modal = document.getElementById('calendarPickerModal');
  if (modal) modal.classList.remove('open');

  renderTimeline(true);

  const chg = document.getElementById('chG');
  if (chg) chg.scrollTo({ top: 0, behavior: 'smooth' });
}

export function jumpToNextWeek() {
  const nextW = new Date(_selectedDate);
  nextW.setDate(_selectedDate.getDate() + 7);
  pickDate(nextW.getFullYear(), nextW.getMonth(), nextW.getDate());
}

export function initCalendarPicker() {
  const dateBadge = document.getElementById('dateBadgeBtn');
  const modal = document.getElementById('calendarPickerModal');
  const closeBtn = document.getElementById('calendarPickerCloseBtn');
  const prevBtn = document.getElementById('calPrevMonthBtn');
  const nextBtn = document.getElementById('calNextMonthBtn');
  const jumpTodayBtn = document.getElementById('calJumpTodayBtn');
  const jumpNextWeekBtn = document.getElementById('calJumpNextWeekBtn');

  if (dateBadge) {
    dateBadge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openCalendarPicker();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) modal.classList.remove('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', prevMonth);
  if (nextBtn) nextBtn.addEventListener('click', nextMonth);
  if (jumpTodayBtn) jumpTodayBtn.addEventListener('click', jumpToToday);
  if (jumpNextWeekBtn) jumpNextWeekBtn.addEventListener('click', jumpToNextWeek);

  window.__pickCalendarDate = pickDate;
  window.openCalendarPicker = openCalendarPicker;
  window.closeCalendarPicker = closeCalendarPicker;
}
