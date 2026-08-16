import { DAY_NAMES, CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { toMinutes, getCurrentMinutes } from '../core/utils.js';

let _masterData = null;

export async function loadMasterRoomData(forceReload = false) {
  if (!forceReload && _masterData && !_masterData._isFallback) {
    return _masterData;
  }

  // 1. Try fetching fresh master schedule JSON (bypassing any ServiceWorker/browser HTTP cache)
  try {
    const res = await fetch('master_rooms_schedule.json?v=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.rooms && data.rooms.length > 0 && data.schedule) {
        _masterData = data;
        try {
          localStorage.removeItem('routine_master_rooms');
          localStorage.setItem('routine_master_rooms_v3', JSON.stringify(_masterData));
        } catch (e) {}
        return _masterData;
      }
    }
  } catch (e) {
    console.warn('Network load of master_rooms_schedule.json failed, checking cache:', e);
  }

  // 2. Fallback to localStorage cache v3
  try {
    const cached = localStorage.getItem('routine_master_rooms_v3');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.rooms && parsed.rooms.length > 0) {
        _masterData = parsed;
        return _masterData;
      }
    }
  } catch (e) {}

  // 3. Fallback: Generate fallback from current user schedule
  _masterData = generateFallbackMasterData();
  return _masterData;
}

function generateFallbackMasterData() {
  const master = { rooms: [], schedule: {}, _isFallback: true };
  const roomSet = new Set();
  const sched = State.schedule || CONFIG.defaultRoutine || {};

  Object.keys(sched).forEach(dayKey => {
    let dayName = dayKey;
    if (!isNaN(dayKey)) dayName = DAY_NAMES[dayKey] || dayKey;
    if (!master.schedule[dayName]) master.schedule[dayName] = {};

    const arr = sched[dayKey];
    if (Array.isArray(arr)) {
      arr.forEach(cls => {
        let room = (cls.room || '').replace(/^room\s*/i, '').trim();
        if (!room || room === '—' || room.toLowerCase() === 'no room' || room === '03' || room === '3') return;
        roomSet.add(room);
        if (!master.schedule[dayName][room]) master.schedule[dayName][room] = [];

        let startStr = cls.start || '';
        let endStr = cls.end || '';
        if (!startStr && cls.time) {
          const parts = cls.time.split('-');
          if (parts.length >= 2) {
            startStr = parts[0].trim();
            endStr = parts[1].trim();
          }
        }
        const startM = toMinutes(startStr);
        const endM = toMinutes(endStr);
        if (startM >= 0 && endM > startM) {
          master.schedule[dayName][room].push({
            start: startStr,
            end: endStr,
            startM,
            endM,
            subject: cls.subject || cls.title || 'Class',
            instructor: cls.instructor || '',
            type: cls.type || 'Theory',
            semSec: 'Personal Schedule'
          });
        }
      });
    }
  });

  master.rooms = Array.from(roomSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return master;
}

/**
 * Searches and categorizes all rooms for the given day and time.
 * Returns: { isOffDay: bool, isAfter5pm: bool, rooms: Array }
 */
export function searchFreeRooms(dayIdx, currentMins = getCurrentMinutes(), data = _masterData, sortBy = 'availability') {
  if (!data) data = _masterData || generateFallbackMasterData();
  if (!data || !data.rooms || !data.schedule) return { isOffDay: false, isAfter5pm: false, rooms: [] };

  const activeDays = CONFIG.activeDays || [6, 0, 1, 2, 3];
  if (!activeDays.includes(dayIdx)) {
    return { isOffDay: true, isAfter5pm: false, rooms: [] };
  }

  const schoolStartMins = 8 * 60 + 30; // 8:30 AM (510 mins)
  const schoolEndMins = 17 * 60; // 5:00 PM cutoff (1020 mins)
  const isBefore830am = currentMins < schoolStartMins;
  const isAfter5pm = currentMins >= schoolEndMins;
  const isCampusClosed = isBefore830am || isAfter5pm;

  const dayName = DAY_NAMES[dayIdx] || 'Sunday';
  const daySchedule = data.schedule[dayName] || {};
  const results = [];

  data.rooms.forEach(rawRoom => {
    const room = rawRoom.replace(/^room\s*/i, '').trim();
    if (!room || room === '—' || room.toLowerCase() === 'no room' || room === '03' || room === '3') return;
    
    const rawClasses = daySchedule[rawRoom] || daySchedule[room] || [];
    
    // Normalize and sort room classes by start time
    const sorted = rawClasses.map(c => {
      const startM = (typeof c.startM === 'number' && c.startM >= 0) ? c.startM : toMinutes(c.start);
      const endM = (typeof c.endM === 'number' && c.endM > 0) ? c.endM : toMinutes(c.end);
      return {
        ...c,
        startM,
        endM,
        isFinished: endM <= currentMins,
        isCurrent: currentMins >= startM && currentMins < endM,
        isFuture: startM > currentMins
      };
    }).filter(c => c.startM >= 0 && c.endM > c.startM)
      .sort((a, b) => a.startM - b.startM);

    // Identify active classes right now
    const activeClasses = sorted.filter(c => c.isCurrent);
    const nextClass = sorted.find(c => c.isFuture);
    const floor = getFloorLabel(room);

    if (activeClasses.length === 0) {
      // Room is FREE RIGHT NOW!
      const freeUntilMins = nextClass ? nextClass.startM : schoolEndMins;
      const freeDurationMins = Math.max(0, freeUntilMins - currentMins);

      results.push({
        room,
        floor,
        floorNum: getFloorNumber(room),
        status: 'FREE_NOW',
        freeStartMins: currentMins,
        freeUntilMins,
        freeDurationMins,
        nextClass: nextClass || null,
        currentClass: null,
        allClassesToday: sorted
      });

    } else {
      // Room is OCCUPIED — check if it opens up within 30 minutes
      const maxEndM = Math.max(...activeClasses.map(c => c.endM));
      const minsUntilFree = maxEndM - currentMins;
      const nextAfterCurrent = sorted.find(c => c.startM >= maxEndM);
      const freeUntilMins = nextAfterCurrent ? nextAfterCurrent.startM : schoolEndMins;
      const freeDurationMins = Math.max(0, freeUntilMins - maxEndM);

      const isOpeningSoon = minsUntilFree <= 30 && minsUntilFree > 0 && freeDurationMins >= 15;

      results.push({
        room,
        floor,
        floorNum: getFloorNumber(room),
        status: isOpeningSoon ? 'FREE_SOON' : 'OCCUPIED',
        minsUntilFree,
        freeStartMins: maxEndM,
        freeUntilMins,
        freeDurationMins,
        nextClass: nextAfterCurrent || null,
        currentClass: activeClasses[0],
        allClassesToday: sorted
      });
    }
  });

  // Apply sorting
  sortRoomResults(results, sortBy);

  return { isOffDay: false, isCampusClosed, isBefore830am, isAfter5pm, rooms: results };
}

function sortRoomResults(results, sortBy) {
  if (sortBy === 'room_asc') {
    results.sort((a, b) => parseInt(a.room, 10) - parseInt(b.room, 10));
  } else if (sortBy === 'room_desc') {
    results.sort((a, b) => parseInt(b.room, 10) - parseInt(a.room, 10));
  } else if (sortBy === 'floor') {
    results.sort((a, b) => a.floorNum - b.floorNum || parseInt(a.room, 10) - parseInt(b.room, 10));
  } else {
    // Default: Availability (FREE_NOW -> FREE_SOON -> OCCUPIED)
    const priority = { 'FREE_NOW': 1, 'FREE_SOON': 2, 'OCCUPIED': 3 };
    results.sort((a, b) => {
      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status];
      }
      if (a.status === 'FREE_NOW') {
        return b.freeDurationMins - a.freeDurationMins;
      }
      if (a.status === 'FREE_SOON') {
        return a.minsUntilFree - b.minsUntilFree;
      }
      // Occupied: soonest ending first
      return (a.minsUntilFree || 999) - (b.minsUntilFree || 999);
    });
  }
}

/** Helper to extract floor number integer */
function getFloorNumber(roomStr) {
  const num = parseInt(roomStr.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return 0;
  if (num >= 1000) return 10;
  if (num >= 900)  return 9;
  if (num >= 800)  return 8;
  if (num >= 700)  return 7;
  if (num >= 600)  return 6;
  if (num >= 500)  return 5;
  if (num >= 400)  return 4;
  if (num >= 300)  return 3;
  if (num >= 200)  return 2;
  if (num >= 100)  return 1;
  return 0;
}

/** Helper to infer building floor label */
function getFloorLabel(roomStr) {
  const floorNum = getFloorNumber(roomStr);
  if (floorNum === 0) return 'Ground Floor';
  if (floorNum === 1) return '1st Floor';
  if (floorNum === 2) return '2nd Floor';
  if (floorNum === 3) return '3rd Floor';
  return `${floorNum}th Floor`;
}
