import { DAY_NAMES, MONTHS, FULL_MONTHS } from '../core/config.js';
import { getCurrentMinutes, escapeHtml } from '../core/utils.js';
import { getTeacherInfo } from '../teachers/teacher-names.js';
import { showClassDetails } from '../timeline/class-detail.js';
import { openTeacherDetailByCode } from '../teachers/teacher-modal.js';
import { normalizeDate, getDateForDayIndex } from '../announcements/overrides.js';
import {
  loadMasterRoomsData,
  searchAllRoomsAvailability,
  searchAllRoomsAvailabilityWithOverrides,
  computeFloorVacancyStats,
  getRoomDayTimeline,
  getRoomDaySchedule,
  getEffectiveRoomDaySchedule,
  formatMinuteTo12h,
  formatDuration,
  getFloorLabel
} from './room-engine.js';

// State
let _selectedDate = new Date();
let _calViewMonth = new Date().getMonth();
let _calViewYear = new Date().getFullYear();
let _targetMode = 'NOW'; // 'NOW' | 'CUSTOM'
let _customMinute = getCurrentMinutes();
let _selectedFloor = 'ALL'; // 'ALL' | 4 | 5 | 6 | 9 | 10
let _selectedType = 'ALL'; // 'ALL' | 'classroom' | 'lab'
let _searchQuery = '';
let _liveTickerTimer = null;
let _currentOpenRoomData = null;
let _sheetLocalDayIdx = new Date().getDay();
let _isFilterDrawerOpen = false;
let _freeRoomsReturnView = null;

// Campus Floors & Academic Days
const CAMPUS_FLOORS = [4, 5, 6, 9, 10];
const ACADEMIC_DAYS = [6, 0, 1, 2, 3, 4, 5]; // Sat, Sun, Mon, Tue, Wed, Thu, Fri

/**
 * Initializes Free Rooms UI event listeners and controls.
 */
export function initFreeRoomsUI() {
  const backBtn = document.getElementById('freeRoomsPageBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const dest = _freeRoomsReturnView || 'apps';
      _freeRoomsReturnView = null;
      if (window.switchAppView) window.switchAppView(dest);
    });
  }

  const refreshBtn = document.getElementById('freeRoomsRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.style.opacity = '0.6';
      await loadMasterRoomsData();
      renderFreeRoomsView();
      setTimeout(() => { refreshBtn.style.opacity = '1'; }, 300);
    });
  }

  // 1. Search Bar Interaction
  const searchInput = document.getElementById('frSearchInput');
  const searchClear = document.getElementById('frSearchClear');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      _searchQuery = searchInput.value.trim().toLowerCase();
      if (searchClear) searchClear.style.display = _searchQuery ? 'block' : 'none';
      renderFreeRoomsView();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      _searchQuery = '';
      searchClear.style.display = 'none';
      renderFreeRoomsView();
    });
  }

  // 2. Day/Time Pill Popover Trigger
  const dayTimeTriggerBtn = document.getElementById('frDayTimeTriggerBtn');
  if (dayTimeTriggerBtn) {
    dayTimeTriggerBtn.addEventListener('click', () => {
      openDayTimePickerSheet();
    });
  }

  // 3. Floor Filter Button Trigger
  const floorFilterBtn = document.getElementById('frFloorFilterBtn');
  if (floorFilterBtn) {
    floorFilterBtn.addEventListener('click', () => {
      openFloorPickerSheet();
    });
  }

  // 4. Secondary Room Type Filter Drawer Toggle
  const toggleFilterBtn = document.getElementById('frToggleFilterBtn');
  const filterDrawer = document.getElementById('frFilterDrawer');
  if (toggleFilterBtn && filterDrawer) {
    toggleFilterBtn.addEventListener('click', () => {
      _isFilterDrawerOpen = !_isFilterDrawerOpen;
      filterDrawer.style.display = _isFilterDrawerOpen ? 'flex' : 'none';
      toggleFilterBtn.classList.toggle('active', _isFilterDrawerOpen);
    });
  }

  // Room Type Filter Toggle
  const typeToggleGroup = document.getElementById('frTypeToggleGroup');
  if (typeToggleGroup) {
    typeToggleGroup.querySelectorAll('.fr-type-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        typeToggleGroup.querySelectorAll('.fr-type-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _selectedType = btn.dataset.type || 'ALL';

        const filterDot = document.getElementById('frFilterActiveDot');
        if (filterDot) filterDot.style.display = _selectedType !== 'ALL' ? 'inline-block' : 'none';

        renderFreeRoomsView();
      });
    });
  }

  // 5. Date & Time Picker Sheet Controls
  initDayTimePickerEvents();

  // 6. Floor Picker Sheet Controls
  initFloorPickerEvents();

  // 7. Room Schedule Bottom Sheet & In-Sheet Day Switcher Events
  initRoomScheduleSheetEvents();

  // 60-second ticker to update 'NOW' mode live
  if (_liveTickerTimer) clearInterval(_liveTickerTimer);
  _liveTickerTimer = setInterval(() => {
    if (_targetMode === 'NOW' && window.__currentAppViewId === 'free_rooms') {
      renderFreeRoomsView();
      if (_currentOpenRoomData) {
        renderRoomScheduleSheetTimeline(_currentOpenRoomData.roomMeta, _sheetLocalDayIdx);
      }
    }
  }, 60000);

  // Global render trigger
  window.__renderFreeRooms = async function() {
    await loadMasterRoomsData();
    renderFreeRoomsView();
  };
}

/**
 * Initializes Date + Time Picker Sheet controls & calendar navigation.
 */
function initDayTimePickerEvents() {
  const sheet = document.getElementById('frDayTimePickerSheet');
  const closeBtn = document.getElementById('frDayTimePickerCloseBtn');
  const applyBtn = document.getElementById('frDayTimePickerApplyBtn');
  const quickNowBtn = document.getElementById('frQuickRightNowBtn');
  const prevMonthBtn = document.getElementById('frCalPrevMonthBtn');
  const nextMonthBtn = document.getElementById('frCalNextMonthBtn');
  const timeInput = document.getElementById('frSheetTimePickerInput');

  if (closeBtn) closeBtn.addEventListener('click', closeDayTimePickerSheet);
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      closeDayTimePickerSheet();
      renderFreeRoomsView();
    });
  }
  if (sheet) {
    sheet.addEventListener('click', e => {
      if (e.target === sheet) closeDayTimePickerSheet();
    });
  }

  // Quick "Right Now" Shortcut
  if (quickNowBtn) {
    quickNowBtn.addEventListener('click', () => {
      _selectedDate = new Date();
      _calViewMonth = _selectedDate.getMonth();
      _calViewYear = _selectedDate.getFullYear();
      _targetMode = 'NOW';
      _customMinute = getCurrentMinutes();

      syncDayTimeSheetState();
      renderDayTimeCalendarGrid();
    });
  }

  // Month navigation
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      _calViewMonth--;
      if (_calViewMonth < 0) {
        _calViewMonth = 11;
        _calViewYear--;
      }
      renderDayTimeCalendarGrid();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      _calViewMonth++;
      if (_calViewMonth > 11) {
        _calViewMonth = 0;
        _calViewYear++;
      }
      renderDayTimeCalendarGrid();
    });
  }

  // Time picker input change
  if (timeInput) {
    timeInput.addEventListener('change', () => {
      if (timeInput.value) {
        const [h, m] = timeInput.value.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          _targetMode = 'CUSTOM';
          _customMinute = h * 60 + m;
          syncDayTimeSheetState();
        }
      }
    });
  }
}

function openDayTimePickerSheet() {
  const sheet = document.getElementById('frDayTimePickerSheet');
  if (!sheet) return;

  _calViewMonth = _selectedDate.getMonth();
  _calViewYear = _selectedDate.getFullYear();

  syncDayTimeSheetState();
  renderDayTimeCalendarGrid();

  sheet.classList.add('open');
}

function closeDayTimePickerSheet() {
  const sheet = document.getElementById('frDayTimePickerSheet');
  if (sheet) sheet.classList.remove('open');
}

function syncDayTimeSheetState() {
  const quickNowBtn = document.getElementById('frQuickRightNowBtn');
  const timeInput = document.getElementById('frSheetTimePickerInput');
  const timeFormattedLabel = document.getElementById('frSheetTimeFormattedLabel');

  const currentMin = _targetMode === 'NOW' ? getCurrentMinutes() : _customMinute;
  const isLiveNow = _targetMode === 'NOW';

  if (quickNowBtn) quickNowBtn.classList.toggle('active', isLiveNow);

  if (timeInput) {
    const hh = String(Math.floor(currentMin / 60)).padStart(2, '0');
    const mm = String(currentMin % 60).padStart(2, '0');
    timeInput.value = `${hh}:${mm}`;
  }

  if (timeFormattedLabel) {
    timeFormattedLabel.textContent = formatMinuteTo12h(currentMin);
  }
}

/**
 * Renders the calendar month date-picker grid inside #frDayTimePickerSheet.
 */
function renderDayTimeCalendarGrid() {
  const monthLabel = document.getElementById('frCalMonthLabel');
  const daysGrid = document.getElementById('frCalDaysGrid');
  if (!monthLabel || !daysGrid) return;

  monthLabel.textContent = `${FULL_MONTHS[_calViewMonth] || MONTHS[_calViewMonth]} ${_calViewYear}`;

  const firstDay = new Date(_calViewYear, _calViewMonth, 1);
  const lastDay = new Date(_calViewYear, _calViewMonth + 1, 0);
  const realToday = new Date();

  // Academic week starts Saturday (Sat=6 => 0, Sun=0 => 1, Mon=1 => 2, ..., Fri=5 => 6)
  const firstDaySatIndex = (firstDay.getDay() === 6) ? 0 : (firstDay.getDay() + 1);

  let gridHtml = '';

  for (let i = 0; i < firstDaySatIndex; i++) {
    gridHtml += `<div class="fr-cal-day-cell other-month"></div>`;
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const thisDate = new Date(_calViewYear, _calViewMonth, day);
    const dow = thisDate.getDay();
    const isOff = (dow === 4 || dow === 5);
    const isSelected = isSameCalendarDay(thisDate, _selectedDate);
    const isToday = isSameCalendarDay(thisDate, realToday);

    gridHtml += `
      <div class="fr-cal-day-cell ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''} ${isOff ? 'is-offday' : ''}"
           data-year="${_calViewYear}" data-month="${_calViewMonth}" data-day="${day}">
        <span>${day}</span>
      </div>
    `;
  }

  daysGrid.innerHTML = gridHtml;

  // Wire day cell clicks
  daysGrid.querySelectorAll('.fr-cal-day-cell:not(.other-month)').forEach(cell => {
    cell.addEventListener('click', () => {
      const year = parseInt(cell.dataset.year, 10);
      const month = parseInt(cell.dataset.month, 10);
      const day = parseInt(cell.dataset.day, 10);

      _selectedDate = new Date(year, month, day);
      _targetMode = 'CUSTOM';
      syncDayTimeSheetState();
      renderDayTimeCalendarGrid();
    });
  });
}

function isSameCalendarDay(d1, d2) {
  if (!d1 || !d2) return false;
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

/**
 * Initializes Floor Picker Sheet.
 */
function initFloorPickerEvents() {
  const sheet = document.getElementById('frFloorPickerSheet');
  const closeBtn = document.getElementById('frFloorPickerCloseBtn');

  if (closeBtn) closeBtn.addEventListener('click', closeFloorPickerSheet);
  if (sheet) {
    sheet.addEventListener('click', e => {
      if (e.target === sheet) closeFloorPickerSheet();
    });
  }
}

function openFloorPickerSheet() {
  const sheet = document.getElementById('frFloorPickerSheet');
  const optionsContainer = document.getElementById('frFloorPickerOptions');
  if (!sheet || !optionsContainer) return;

  const dayName = DAY_NAMES[_selectedDate.getDay()] || 'Saturday';
  const targetMinute = _targetMode === 'NOW' ? getCurrentMinutes() : _customMinute;
  const allEvaluated = searchAllRoomsAvailability(dayName, targetMinute);
  const floorStats = computeFloorVacancyStats(allEvaluated);

  const totalFree = allEvaluated.filter(r => r.status === 'FREE').length;
  const totalRooms = allEvaluated.length;

  let optionsHtml = `
    <button class="fr-floor-option-btn ${_selectedFloor === 'ALL' ? 'active' : ''}" data-floor="ALL">
      <span>All Floors</span>
      <span class="fr-floor-opt-badge ${totalFree > 0 ? 'is-free' : 'is-occupied'}">${totalFree}/${totalRooms} Free</span>
    </button>
  `;

  CAMPUS_FLOORS.forEach(floorNum => {
    const stat = floorStats.get(floorNum) || { total: 0, free: 0 };
    const isActive = _selectedFloor === floorNum;
    optionsHtml += `
      <button class="fr-floor-option-btn ${isActive ? 'active' : ''}" data-floor="${floorNum}">
        <span>${getFloorLabel(floorNum)}</span>
        <span class="fr-floor-opt-badge ${stat.free > 0 ? 'is-free' : 'is-occupied'}">${stat.free}/${stat.total} Free</span>
      </button>
    `;
  });

  optionsContainer.innerHTML = optionsHtml;

  // Wire option clicks
  optionsContainer.querySelectorAll('.fr-floor-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const floorVal = btn.dataset.floor;
      _selectedFloor = floorVal === 'ALL' ? 'ALL' : parseInt(floorVal, 10);
      closeFloorPickerSheet();
      renderFreeRoomsView();
    });
  });

  sheet.classList.add('open');
}

function closeFloorPickerSheet() {
  const sheet = document.getElementById('frFloorPickerSheet');
  if (sheet) sheet.classList.remove('open');
}

/**
 * Initializes Room Schedule Sheet and In-Sheet Day Switcher controls.
 */
function initRoomScheduleSheetEvents() {
  const sheet = document.getElementById('roomScheduleSheet');
  const sheetCloseBtn = document.getElementById('roomSheetCloseBtn');
  const prevDayBtn = document.getElementById('frSheetPrevDayBtn');
  const nextDayBtn = document.getElementById('frSheetNextDayBtn');
  const dayPillsContainer = document.getElementById('frSheetDayPills');

  if (sheetCloseBtn) {
    sheetCloseBtn.addEventListener('click', closeRoomScheduleSheet);
  }
  if (sheet) {
    sheet.addEventListener('click', e => {
      if (e.target === sheet) closeRoomScheduleSheet();
    });
  }

  // Previous Day in Sheet
  if (prevDayBtn) {
    prevDayBtn.addEventListener('click', () => {
      if (!_currentOpenRoomData) return;
      const currIdx = ACADEMIC_DAYS.indexOf(_sheetLocalDayIdx);
      const newIdx = (currIdx - 1 + ACADEMIC_DAYS.length) % ACADEMIC_DAYS.length;
      _sheetLocalDayIdx = ACADEMIC_DAYS[newIdx];
      _currentOpenRoomData.dayIdx = _sheetLocalDayIdx;
      syncSheetDayPills();
      renderRoomScheduleSheetTimeline(_currentOpenRoomData.roomMeta, _sheetLocalDayIdx);
    });
  }

  // Next Day in Sheet
  if (nextDayBtn) {
    nextDayBtn.addEventListener('click', () => {
      if (!_currentOpenRoomData) return;
      const currIdx = ACADEMIC_DAYS.indexOf(_sheetLocalDayIdx);
      const newIdx = (currIdx + 1) % ACADEMIC_DAYS.length;
      _sheetLocalDayIdx = ACADEMIC_DAYS[newIdx];
      _currentOpenRoomData.dayIdx = _sheetLocalDayIdx;
      syncSheetDayPills();
      renderRoomScheduleSheetTimeline(_currentOpenRoomData.roomMeta, _sheetLocalDayIdx);
    });
  }

  // Day Pill Click in Sheet
  if (dayPillsContainer) {
    dayPillsContainer.querySelectorAll('.fr-sheet-day-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!_currentOpenRoomData) return;
        const dayVal = parseInt(btn.dataset.day, 10);
        _sheetLocalDayIdx = dayVal;
        _currentOpenRoomData.dayIdx = _sheetLocalDayIdx;
        syncSheetDayPills();
        renderRoomScheduleSheetTimeline(_currentOpenRoomData.roomMeta, _sheetLocalDayIdx);
      });
    });
  }
}

function syncSheetDayPills() {
  const dayPills = document.getElementById('frSheetDayPills');
  if (dayPills) {
    dayPills.querySelectorAll('.fr-sheet-day-pill').forEach(btn => {
      const dayVal = parseInt(btn.dataset.day, 10);
      btn.classList.toggle('active', dayVal === _sheetLocalDayIdx);
    });
  }
}

/**
 * Main render function for the flat Free Rooms view.
 */
export function renderFreeRoomsView() {
  const flatContainer = document.getElementById('frFlatRoomsListContainer');
  const dayTimeLabel = document.getElementById('frDayTimeLabel');
  const floorFilterBtn = document.getElementById('frFloorFilterBtn');
  const floorFilterLabel = document.getElementById('frFloorFilterLabel');
  if (!flatContainer) return;

  const dayName = DAY_NAMES[_selectedDate.getDay()] || 'Saturday';
  const targetMinute = _targetMode === 'NOW' ? getCurrentMinutes() : _customMinute;
  const isRealToday = isSameCalendarDay(_selectedDate, new Date());

  // 1. Evaluate availability for all department rooms with announcement overrides
  const dateStr = normalizeDate(_selectedDate);
  const allEvaluated = searchAllRoomsAvailabilityWithOverrides(dayName, targetMinute, dateStr);

  // 2. Update Compact Day/Time Pill Label
  if (dayTimeLabel) {
    const timeStr = _targetMode === 'NOW' ? 'Right Now' : formatMinuteTo12h(targetMinute);
    const dateStr = isRealToday
      ? 'Today'
      : `${_selectedDate.getDate()} ${MONTHS[_selectedDate.getMonth()] || ''}`;
    dayTimeLabel.textContent = `${dateStr} · ${timeStr}`;
  }

  // 3. Update Floor Filter Pill Label
  if (floorFilterLabel && floorFilterBtn) {
    const floorLabel = _selectedFloor === 'ALL' ? 'All Floors' : getFloorLabel(_selectedFloor);
    floorFilterLabel.textContent = floorLabel;
    floorFilterBtn.classList.toggle('active', _selectedFloor !== 'ALL');
  }

  // 4. Filter flat room list
  let filteredRooms = allEvaluated.filter(item => {
    // Floor filter
    if (_selectedFloor !== 'ALL' && item.room.floor !== _selectedFloor) return false;

    // Room Type filter
    if (_selectedType !== 'ALL' && item.room.type !== _selectedType) return false;

    // Search query
    if (_searchQuery) {
      const matchId = (item.room.id || '').toLowerCase().includes(_searchQuery);
      const matchName = (item.room.name || '').toLowerCase().includes(_searchQuery);
      const matchFloor = `${item.room.floor}`.includes(_searchQuery);
      if (!matchId && !matchName && !matchFloor) return false;
    }

    return true;
  });

  // Empty state when search or filter yields nothing
  if (filteredRooms.length === 0) {
    flatContainer.innerHTML = `
      <div class="fr-empty-state">
        <svg style="width: 36px; height: 36px; color: var(--text-muted);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <div class="fr-empty-title">No Rooms Found</div>
        <div class="fr-empty-sub">No classrooms or laboratories match the selected filters.</div>
      </div>
    `;
    return;
  }

  // 5. 3-Tier Sort: Free rooms (tier 1) -> Freeing Soon (tier 2, <= 30m) -> Occupied (tier 3)
  function getTierRank(item) {
    if (item.status === 'FREE') return 1;
    if (item.status === 'OCCUPIED' && item.minsUntilFree > 0 && item.minsUntilFree <= 30) return 2;
    return 3;
  }

  filteredRooms.sort((a, b) => {
    const rankA = getTierRank(a);
    const rankB = getTierRank(b);
    if (rankA !== rankB) return rankA - rankB;
    // Within Freeing Soon tier, sort by soonest freeing first
    if (rankA === 2 && rankB === 2) {
      if (a.minsUntilFree !== b.minsUntilFree) {
        return a.minsUntilFree - b.minsUntilFree;
      }
    }
    return a.room.id.localeCompare(b.room.id, undefined, { numeric: true });
  });

  // 6. Render minimal room cards in a single flat scrolling list
  const cardsHtml = filteredRooms.map(item => {
    const r = item.room;
    const isFree = item.status === 'FREE';
    const isFreeingSoon = item.status === 'OCCUPIED' && item.minsUntilFree > 0 && item.minsUntilFree <= 30;
    const isConflict = item.hasConflict;

    let cardStatusClass = 'is-occupied';
    if (isConflict) {
      cardStatusClass = 'has-conflict';
    } else if (isFree) {
      cardStatusClass = 'is-free';
    } else if (isFreeingSoon) {
      cardStatusClass = 'is-freeing-soon';
    }

    // Title: Room number leading + Lab name in parens if it's a lab
    let roomLabel = r.id;
    if (r.type === 'lab' && r.name && r.name !== `Room ${r.id}`) {
      roomLabel = `${r.id} <span class="fr-card-lab-name">(${escapeHtml(r.name)})</span>`;
    }

    // Shortened, scannable status text (end-time only, no duration parenthetical)
    let statusText = '';
    if (isConflict) {
      statusText = '⚠️ Conflict';
    } else if (isFree) {
      if (item.isFreeRestOfDay) {
        statusText = item.currentClasses && item.currentClasses.length === 0 && !item.nextClass && !isRealToday
          ? 'All day'
          : 'Rest of day';
      } else if (item.freeUntilStr) {
        statusText = `Until ${item.freeUntilStr}`;
      } else {
        statusText = 'Free';
      }
    } else if (isFreeingSoon) {
      statusText = `Free in ${item.minsUntilFree}m`;
    } else {
      statusText = `Occupied until ${item.occupiedUntilStr || 'End'}`;
    }

    return `
      <div class="fr-room-card ${cardStatusClass}" data-room-id="${escapeHtml(r.id)}">
        <div class="fr-card-left">
          <span class="fr-card-room-num">${roomLabel}</span>
        </div>
        <div class="fr-card-right">
          <span class="fr-card-status-text">${escapeHtml(statusText)}</span>
          <svg class="fr-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </div>
    `;
  }).join('');

  flatContainer.innerHTML = cardsHtml;

  // Wire room card clicks to open Room Schedule Sheet
  flatContainer.querySelectorAll('.fr-room-card').forEach(card => {
    card.addEventListener('click', () => {
      const roomId = card.dataset.roomId;
      const targetRoom = allEvaluated.find(i => i.room.id === roomId);
      if (targetRoom) {
        openRoomScheduleSheet(targetRoom.room, _selectedDate.getDay());
      }
    });
  });
}

/**
 * Opens the Room Daily Schedule Detail Bottom Sheet.
 *
 * @param {Object} roomMeta - Room metadata
 * @param {number} dayIdx - Day of the week index (0..6)
 */
export function openRoomScheduleSheet(roomMeta, dayIdx = _selectedDate.getDay()) {
  const sheet = document.getElementById('roomScheduleSheet');
  const titleEl = document.getElementById('roomSheetTitle');
  const metaEl = document.getElementById('roomSheetMeta');
  if (!sheet || !roomMeta) return;

  _currentOpenRoomData = { roomMeta, dayIdx };
  _sheetLocalDayIdx = dayIdx;

  let sheetTitle = roomMeta.name || `Room ${roomMeta.id}`;
  if (roomMeta.type === 'lab' && roomMeta.name && roomMeta.name !== `Room ${roomMeta.id}`) {
    sheetTitle = `${roomMeta.id} (${roomMeta.name})`;
  } else if (!sheetTitle.startsWith('Room ')) {
    sheetTitle = `Room ${roomMeta.id}`;
  }
  if (titleEl) titleEl.textContent = sheetTitle;
  if (metaEl) {
    const typeLabel = roomMeta.type === 'lab' ? '🧪 Laboratory' : '🏢 Lecture Classroom';
    metaEl.textContent = `${getFloorLabel(roomMeta.floor)} · ${typeLabel}`;
  }

  // Sync In-Sheet Day Switcher Pills
  syncSheetDayPills();

  // Render Timeline Blocks
  renderRoomScheduleSheetTimeline(roomMeta, _sheetLocalDayIdx);

  sheet.classList.add('open');
}

/**
 * Renders the room schedule timeline list for the requested local day.
 */
function renderRoomScheduleSheetTimeline(roomMeta, dayIdx) {
  const listEl = document.getElementById('roomSheetTimelineList');
  if (!listEl || !roomMeta) return;

  const dayName = DAY_NAMES[dayIdx] || 'Saturday';
  const dateStr = getDateForDayIndex(dayIdx, _selectedDate);
  const rawClasses = getEffectiveRoomDaySchedule(dayName, roomMeta.id, dateStr);
  const currentMinute = _targetMode === 'NOW' ? getCurrentMinutes() : _customMinute;
  const timelineBlocks = getRoomDayTimeline(roomMeta, rawClasses, currentMinute);

  listEl.innerHTML = timelineBlocks.map((block, idx) => {
    if (block.isGap) {
      let timeText = `${escapeHtml(block.startStr)} – ${escapeHtml(block.endStr)}`;
      if (block.startStr === 'All Day') {
        timeText = '';
      } else if (block.endStr === 'Rest of Day') {
        timeText = `${escapeHtml(block.startStr)} – Rest of Day`;
      } else if (block.startStr === 'Start of Day') {
        timeText = `Start of Day – ${escapeHtml(block.endStr)}`;
      }

      let durLabel = `${formatDuration(block.durationMins)} Free`;
      if (block.startStr === 'All Day') {
        durLabel = 'Free All Day';
      } else if (block.endStr === 'Rest of Day') {
        durLabel = 'Rest of Day';
      }

      return `
        <div class="fr-tl-gap-card ${block.startStr === 'All Day' ? 'is-all-day' : ''}">
          <div class="fr-tl-gap-left">
            <div class="fr-tl-gap-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>
            <div class="fr-tl-gap-info">
              <div class="fr-tl-gap-title">${escapeHtml(block.label)}</div>
              ${timeText ? `<div class="fr-tl-gap-time">${escapeHtml(timeText)}</div>` : ''}
            </div>
          </div>
          <div class="fr-tl-gap-right">
            <span class="fr-tl-gap-pill">${escapeHtml(durLabel)}</span>
          </div>
        </div>
      `;
    }

    // Class block
    const isLive = block.state === 'current';
    const isPast = block.state === 'past';
    const stateClass = isPast ? 'is-past' : (isLive ? 'is-current' : 'is-upcoming');
    const isLab = (block.type || '').toLowerCase() === 'lab';
    const isCancelled = Boolean(block.isCancelled);
    const isRescheduled = Boolean(block.isRescheduled);
    const isMovedOnline = Boolean(block.isMovedOnline);
    const isExtra = Boolean(block.isExtraClass);

    let overrideCardClass = '';
    let overrideBadgeHtml = '';

    if (isCancelled) {
      overrideCardClass = 'is-cancelled-override cancelled';
      overrideBadgeHtml = `<span class="fr-tl-override-badge cancelled">CANCELLED</span>`;
    } else if (isRescheduled) {
      overrideCardClass = 'is-rescheduled-override rescheduled';
      overrideBadgeHtml = `<span class="fr-tl-override-badge rescheduled">RESCHEDULED</span>`;
    } else if (isMovedOnline) {
      overrideCardClass = 'is-online-override online';
      overrideBadgeHtml = `<span class="fr-tl-override-badge online">ONLINE</span>`;
    } else if (isExtra) {
      overrideCardClass = 'is-extra-override extra';
      overrideBadgeHtml = `<span class="fr-tl-override-badge extra">EXTRA CLASS</span>`;
    }

    const teacherCode = (block.instructor || '').trim();
    const info = getTeacherInfo(teacherCode);
    const teacherDisplayName = info?.name || teacherCode || 'TBA';
    const initials = (teacherDisplayName || teacherCode).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const semSec = block.semSec || (block.semester && block.section ? `${block.semester}-${block.section.toUpperCase()}` : '');

    return `
      <div class="fr-tl-card ${stateClass} ${isLab ? 'is-lab' : 'is-theory'} ${overrideCardClass} fr-tl-class-card" data-block-idx="${idx}">
        <!-- Top Row: Subject + Badges + Time -->
        <div class="fr-tl-top-row">
          <div class="fr-tl-subject-group">
            <span class="fr-tl-subject-code ${isCancelled ? 'cancelled-text' : ''}">${escapeHtml(block.subject || 'Class')}</span>
            <span class="fr-tl-type-badge ${isLab ? 'lab' : 'theory'}">${isLab ? 'LAB' : 'THEORY'}</span>
            ${overrideBadgeHtml}
            ${semSec ? `<span class="fr-tl-semsec-badge">${escapeHtml(semSec)}</span>` : ''}
          </div>
          <div class="fr-tl-time-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${escapeHtml(block.startStr)} – ${escapeHtml(block.endStr)}</span>
          </div>
        </div>

        <!-- Bottom Row: Teacher Button (separate tap) + Duration + Arrow -->
        <div class="fr-tl-bottom-row">
          <div class="fr-tl-teacher-wrapper">
            ${teacherCode && teacherCode !== 'TBA' && teacherCode !== '—' ? `
              <button class="fr-tl-teacher-pill" data-teacher="${escapeHtml(teacherCode)}" title="View ${escapeHtml(teacherDisplayName)} profile">
                <span class="fr-tl-teacher-avatar">${escapeHtml(initials)}</span>
                <span class="fr-tl-teacher-name">${escapeHtml(teacherDisplayName)}</span>
              </button>
            ` : `
              <span class="fr-tl-teacher-tba">Instructor TBA</span>
            `}
          </div>
          <div class="fr-tl-card-right-group">
            <span class="fr-tl-duration-chip">${formatDuration(block.durationMins)}</span>
            <svg class="fr-tl-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 1. Wire entire class card click -> opens class detail modal
  listEl.querySelectorAll('.fr-tl-class-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Guard: if tap originated on or inside the teacher button, ignore it here
      if (e.target.closest('.fr-tl-teacher-pill')) return;

      const idx = parseInt(card.dataset.blockIdx, 10);
      const block = timelineBlocks[idx];
      if (!block || block.isGap) return;

      const semMatch = String(block.semSec || '').match(/Sem\s*(\d+)(?:-([A-Za-z0-9]+))?/i);
      const semester = semMatch ? semMatch[1] : (block.semester || '');
      const section = semMatch ? semMatch[2] : (block.section || '');

      const classData = {
        code: block.subject,
        title: block.subject,
        subject: block.subject,
        room: roomMeta.id,
        instructor: block.instructor,
        teacher: block.instructor,
        instructorName: block.instructor,
        start: block.startStr,
        end: block.endStr,
        timing: `${block.startStr} – ${block.endStr}`,
        type: block.type,
        duration: formatDuration(block.durationMins),
        hasExplicitEndTime: true,
        dayIdx: _sheetLocalDayIdx,
        dayName: DAY_NAMES[_sheetLocalDayIdx],
        semSec: block.semSec || '',
        semester: semester,
        section: section,
        isCancelled: Boolean(block.isCancelled),
        cancelReason: block.cancelReason || '',
        isRescheduled: Boolean(block.isRescheduled),
        rescheduledReason: block.rescheduledReason || '',
        isOnline: Boolean(block.isMovedOnline),
        isFromRoom: true
      };

      if (typeof showClassDetails === 'function') {
        showClassDetails(classData);
      } else if (typeof window.openClassDetailSheet === 'function') {
        window.openClassDetailSheet(classData);
      }
    });
  });

  // 2. Wire teacher profile button click -> opens teacher profile with stopPropagation & preventDefault
  listEl.querySelectorAll('.fr-tl-teacher-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const teacherCode = btn.dataset.teacher;
      if (!teacherCode) return;
      if (typeof openTeacherDetailByCode === 'function') {
        openTeacherDetailByCode(teacherCode);
      } else if (typeof window.openTeacherDetailByCode === 'function') {
        window.openTeacherDetailByCode(teacherCode);
      }
    });
  });
}

/**
 * Closes the Room Daily Schedule Bottom Sheet without modifying main list day.
 */
export function closeRoomScheduleSheet() {
  const sheet = document.getElementById('roomScheduleSheet');
  if (sheet) sheet.classList.remove('open');
  _currentOpenRoomData = null;
}

/**
 * Deep-links into the Free Rooms page for a specific room and day.
 * Pre-filters the search bar, opens the room's schedule sheet, and tracks return view.
 *
 * @param {string} rawRoomId - e.g. "1002" or "Room 1002"
 * @param {number} dayIdx - Optional day index (0..6)
 * @param {string} returnView - Optional view ID to return to when backing out
 */
export function openRoomInFreeRooms(rawRoomId, dayIdx = _selectedDate.getDay(), returnView = null) {
  if (!returnView) {
    returnView = (window.__currentAppViewId === 'faculty_directory')
      ? 'faculty_directory'
      : ((window.__currentAppViewId === 'home') ? 'home' : 'apps');
  }
  _freeRoomsReturnView = returnView;

  // Dismiss stacked modals
  if (typeof window.closeClassDetailSheet === 'function') {
    window.closeClassDetailSheet();
  }
  if (typeof window.closeTeacherDetailModal === 'function') {
    window.closeTeacherDetailModal();
  }

  // Navigate to Free Rooms app page
  if (typeof window.switchAppView === 'function') {
    window.switchAppView('free_rooms');
  }

  // Synchronize Free Rooms date and sheet day to the requested dayIdx
  if (typeof dayIdx === 'number' && !isNaN(dayIdx)) {
    const today = new Date();
    const diff = (dayIdx - today.getDay() + 7) % 7;
    _selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
    _sheetLocalDayIdx = dayIdx;
  }

  const cleanRoom = String(rawRoomId || '').replace(/^room\s*/i, '').trim();
  const searchInput = document.getElementById('frSearchInput');
  const searchClear = document.getElementById('frSearchClear');

  if (cleanRoom && cleanRoom.toLowerCase() !== 'tba' && cleanRoom.toLowerCase() !== 'online') {
    if (searchInput) {
      searchInput.value = cleanRoom;
      if (searchClear) searchClear.style.display = 'block';
    }
    _searchQuery = cleanRoom.toLowerCase();
  }

  loadMasterRoomsData().then(master => {
    renderFreeRoomsView();
    if (cleanRoom && cleanRoom.toLowerCase() !== 'tba' && cleanRoom.toLowerCase() !== 'online') {
      const rooms = master?.rooms || [];
      const target = rooms.find(r => r.id.toLowerCase() === cleanRoom.toLowerCase() || (r.name && r.name.toLowerCase() === cleanRoom.toLowerCase()));
      if (target) {
        openRoomScheduleSheet(target, dayIdx);
      }
    }
  });
}

window.openRoomInFreeRooms = openRoomInFreeRooms;

/**
 * In-place refresh of Free Rooms flat list and currently open Room Schedule Sheet.
 * Triggered automatically whenever new announcements/overrides are fetched.
 */
export function refreshFreeRoomsIfVisible() {
  const isFreeRoomsActive = (window.__currentAppViewId === 'free_rooms') ||
    (document.getElementById('freeRoomsAppView') && document.getElementById('freeRoomsAppView').classList.contains('active'));

  if (isFreeRoomsActive) {
    renderFreeRoomsView();
  }

  // If a room schedule sheet is currently open, refresh its timeline in-place
  const sheet = document.getElementById('roomScheduleSheet');
  if (sheet && sheet.classList.contains('open') && _currentOpenRoomData && _currentOpenRoomData.roomMeta) {
    renderRoomScheduleSheetTimeline(_currentOpenRoomData.roomMeta, _sheetLocalDayIdx);
  }
}

window.refreshFreeRoomsIfVisible = refreshFreeRoomsIfVisible;
