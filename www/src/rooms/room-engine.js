import { CONFIG, DAY_NAMES } from '../core/config.js';
import { format12h, getCurrentMinutes } from '../core/utils.js';
import { getEffectiveRoomClasses } from './room-overrides.js';

const MASTER_ROOMS_CACHE_KEY = 'routine_master_rooms_v4';
let _masterData = null;

/**
 * Loads master room dataset from cache or network.
 */
export async function loadMasterRoomsData() {
  if (_masterData && _masterData.rooms && _masterData.rooms.length > 0) {
    return _masterData;
  }

  // 1. Try LocalStorage cache
  try {
    const cached = localStorage.getItem(MASTER_ROOMS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.rooms) && parsed.rooms.length > 0) {
        _masterData = parsed;
        // Background refresh from server
        fetchMasterRoomsAsync();
        return _masterData;
      }
    }
  } catch (e) {
    console.warn('[RoomEngine] Failed to read localStorage cache:', e);
  }

  // 2. Fetch master_rooms_schedule.json
  try {
    const res = await fetch(`master_rooms_schedule.json?v=${CONFIG.appVersionCode || Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && Array.isArray(data.rooms)) {
      _masterData = data;
      try {
        localStorage.setItem(MASTER_ROOMS_CACHE_KEY, JSON.stringify(data));
      } catch (e) {}
      return _masterData;
    }
  } catch (e) {
    console.warn('[RoomEngine] Failed to fetch master_rooms_schedule.json:', e);
  }

  // 3. Fallback to empty shell
  _masterData = { rooms: [], schedule: {} };
  return _masterData;
}

async function fetchMasterRoomsAsync() {
  try {
    const res = await fetch(`master_rooms_schedule.json?v=${CONFIG.appVersionCode || Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.rooms)) {
        _masterData = data;
        try {
          localStorage.setItem(MASTER_ROOMS_CACHE_KEY, JSON.stringify(data));
        } catch (e) {}
      }
    }
  } catch (e) {}
}

/**
 * Formats minute of the day (0..1439) into 12-hour format string (e.g. "10:10 AM").
 */
export function formatMinuteTo12h(mins) {
  if (typeof mins !== 'number' || isNaN(mins) || mins < 0) return '';
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Returns formatted duration string (e.g. "1h 40m", "45m").
 */
export function formatDuration(durationMins) {
  if (!durationMins || durationMins <= 0) return '0m';
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

/**
 * Maps numeric floor number to formatted label.
 */
export function getFloorLabel(floorNumber) {
  const f = Number(floorNumber);
  if (f === 1) return '1st Floor';
  if (f === 2) return '2nd Floor';
  if (f === 3) return '3rd Floor';
  if (f >= 4) return `${f}th Floor`;
  return 'Ground Floor';
}

/**
 * Evaluates the occupancy status of a single room at a target minute on a specific day.
 *
 * @param {Object} roomMeta - Room metadata object { id, name, floor, type, capacity }
 * @param {Array} rawClasses - Array of classes scheduled in this room today
 * @param {number} targetMinute - Minute of day (0..1439) to check occupancy against
 * @returns {Object} Evaluated status object
 */
export function evaluateRoomStatus(roomMeta, rawClasses = [], targetMinute = getCurrentMinutes()) {
  const classes = Array.isArray(rawClasses) ? rawClasses : [];
  
  // Sort classes chronologically by start time
  const sorted = [...classes].sort((a, b) => a.startM - b.startM);

  // If no classes at all today
  if (sorted.length === 0) {
    return {
      room: roomMeta,
      status: 'FREE',
      statusText: 'Free All Day',
      subText: 'No classes scheduled today',
      freeUntilMins: null,
      freeUntilStr: 'End of Day',
      freeDurationMins: null,
      currentClasses: [],
      nextClass: null,
      hasConflict: false,
      isFreeRestOfDay: true
    };
  }

  // Active classes occurring exactly during targetMinute (startM <= targetMinute < endM)
  const activeClasses = sorted.filter(c => targetMinute >= c.startM && targetMinute < c.endM);

  // Next class starting after targetMinute
  const upcomingClasses = sorted.filter(c => c.startM > targetMinute);
  const nextClass = upcomingClasses.length > 0 ? upcomingClasses[0] : null;

  if (activeClasses.length > 0) {
    // Room is currently OCCUPIED
    const maxEndM = Math.max(...activeClasses.map(c => c.endM));
    const minsUntilFree = Math.max(0, maxEndM - targetMinute);
    const hasConflict = activeClasses.length > 1;

    // Class starting right when this one ends (or later)
    const nextAfterActive = sorted.find(c => c.startM >= maxEndM);

    return {
      room: roomMeta,
      status: 'OCCUPIED',
      statusText: 'Occupied',
      subText: `Occupied until ${formatMinuteTo12h(maxEndM)} · Free in ${formatDuration(minsUntilFree)}`,
      occupiedUntilMins: maxEndM,
      occupiedUntilStr: formatMinuteTo12h(maxEndM),
      minsUntilFree,
      currentClasses: activeClasses,
      nextClass: nextAfterActive || null,
      hasConflict,
      isFreeRestOfDay: false
    };
  }

  // Room is currently FREE
  if (nextClass) {
    const freeUntilMins = nextClass.startM;
    const freeDurationMins = Math.max(0, freeUntilMins - targetMinute);

    return {
      room: roomMeta,
      status: 'FREE',
      statusText: 'Free Now',
      subText: `Until ${formatMinuteTo12h(freeUntilMins)}`,
      freeUntilMins,
      freeUntilStr: formatMinuteTo12h(freeUntilMins),
      freeDurationMins,
      currentClasses: [],
      nextClass,
      hasConflict: false,
      isFreeRestOfDay: false
    };
  }

  // Free for the rest of the day after all scheduled classes have concluded
  return {
    room: roomMeta,
    status: 'FREE',
    statusText: 'Free Now',
    subText: 'Rest of day',
    freeUntilMins: null,
    freeUntilStr: 'Rest of Day',
    freeDurationMins: null,
    currentClasses: [],
    nextClass: null,
    hasConflict: false,
    isFreeRestOfDay: true
  };
}

/**
 * Searches and computes availability for all rooms given a day name and target minute.
 *
 * @param {string} dayName - e.g. 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
 * @param {number} targetMinute - Minute of day (0..1439)
 * @returns {Array} List of evaluated room status objects
 */
export function searchAllRoomsAvailability(dayName, targetMinute = getCurrentMinutes()) {
  if (!_masterData || !Array.isArray(_masterData.rooms)) {
    return [];
  }

  const daySchedule = (_masterData.schedule && _masterData.schedule[dayName]) || {};

  return _masterData.rooms.map(roomMeta => {
    const rawClasses = daySchedule[roomMeta.id] || [];
    return evaluateRoomStatus(roomMeta, rawClasses, targetMinute);
  });
}

/**
 * Searches and computes availability for all rooms with department-wide announcement overrides applied.
 *
 * @param {string} dayName - e.g. 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
 * @param {number} targetMinute - Minute of day (0..1439)
 * @param {string} dateStr - Target date in YYYY-MM-DD format
 * @returns {Array} List of evaluated room status objects
 */
export function searchAllRoomsAvailabilityWithOverrides(dayName, targetMinute = getCurrentMinutes(), dateStr = '') {
  if (!_masterData || !Array.isArray(_masterData.rooms)) {
    return [];
  }

  const daySchedule = (_masterData.schedule && _masterData.schedule[dayName]) || {};

  return _masterData.rooms.map(roomMeta => {
    const rawClasses = daySchedule[roomMeta.id] || [];
    const effectiveClasses = dateStr
      ? getEffectiveRoomClasses(roomMeta.id, dayName, dateStr, rawClasses)
      : rawClasses;
    return evaluateRoomStatus(roomMeta, effectiveClasses, targetMinute);
  });
}

/**
 * Returns raw scheduled classes for a specific room and day.
 */
export function getRoomDaySchedule(dayName, roomId) {
  if (!_masterData || !_masterData.schedule) return [];
  const daySchedule = _masterData.schedule[dayName] || {};
  return daySchedule[roomId] || [];
}

/**
 * Returns scheduled classes for a specific room and day with announcement overrides applied.
 *
 * @param {string} dayName - e.g. 'Saturday', 'Sunday', etc.
 * @param {string} roomId - e.g. '403'
 * @param {string} dateStr - Target date in YYYY-MM-DD format
 * @returns {Array} Array of effective class objects
 */
export function getEffectiveRoomDaySchedule(dayName, roomId, dateStr = '') {
  const rawClasses = getRoomDaySchedule(dayName, roomId);
  return dateStr
    ? getEffectiveRoomClasses(roomId, dayName, dateStr, rawClasses)
    : rawClasses;
}

/**
 * Computes per-floor live vacancy statistics.
 *
 * @param {Array} evaluatedRooms - Array of evaluated room status objects
 * @returns {Map<number, { floor: number, total: number, free: number, occupied: number }>}
 */
export function computeFloorVacancyStats(evaluatedRooms = []) {
  const statsMap = new Map();

  // Known floors
  const knownFloors = [4, 5, 6, 9, 10];
  knownFloors.forEach(f => {
    statsMap.set(f, { floor: f, total: 0, free: 0, occupied: 0 });
  });

  evaluatedRooms.forEach(item => {
    const floor = item.room.floor;
    if (!statsMap.has(floor)) {
      statsMap.set(floor, { floor, total: 0, free: 0, occupied: 0 });
    }
    const stat = statsMap.get(floor);
    stat.total++;
    if (item.status === 'FREE') {
      stat.free++;
    } else {
      stat.occupied++;
    }
  });

  return statsMap;
}

/**
 * Builds chronological timeline blocks for a room's daily schedule including explicit Free Gaps.
 *
 * @param {Object} roomMeta - Room metadata
 * @param {Array} rawClasses - Array of classes for the room on this day
 * @param {number} currentMinute - Current clock minute (to mark past vs current vs future)
 * @returns {Array} Array of timeline block objects
 */
export function getRoomDayTimeline(roomMeta, rawClasses = [], currentMinute = getCurrentMinutes()) {
  const classes = Array.isArray(rawClasses) ? rawClasses : [];
  if (classes.length === 0) {
    return [
      {
        isGap: true,
        startM: 0,
        endM: 1440,
        startStr: 'All Day',
        endStr: 'Rest of Day',
        durationMins: 1440,
        label: 'No Class Scheduled'
      }
    ];
  }

  // Sort by start time
  const sorted = [...classes].sort((a, b) => a.startM - b.startM);
  const blocks = [];

  for (let i = 0; i < sorted.length; i++) {
    const cls = sorted[i];

    // Determine state relative to current clock minute
    let timelineState = 'upcoming';
    if (currentMinute >= cls.endM) {
      timelineState = 'past';
    } else if (currentMinute >= cls.startM && currentMinute < cls.endM) {
      timelineState = 'current';
    }

    blocks.push({
      isGap: false,
      startM: cls.startM,
      endM: cls.endM,
      startStr: cls.start || formatMinuteTo12h(cls.startM),
      endStr: cls.end || formatMinuteTo12h(cls.endM),
      durationMins: cls.endM - cls.startM,
      subject: cls.subject || 'Class',
      instructor: cls.instructor || '',
      type: cls.type || 'Theory',
      semSec: cls.semSec || '',
      semester: cls.semester || '',
      section: cls.section || '',
      state: timelineState
    });

    // Check mid-day free gap between this class and next class
    if (i < sorted.length - 1) {
      const nextCls = sorted[i + 1];
      if (nextCls.startM > cls.endM) {
        const gapMins = nextCls.startM - cls.endM;
        if (gapMins > 0) {
          blocks.push({
            isGap: true,
            startM: cls.endM,
            endM: nextCls.startM,
            startStr: cls.end || formatMinuteTo12h(cls.endM),
            endStr: nextCls.start || formatMinuteTo12h(nextCls.startM),
            durationMins: gapMins,
            label: 'Free Gap'
          });
        }
      }
    }
  }

  return blocks;
}
