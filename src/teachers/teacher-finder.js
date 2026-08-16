import { DAY_NAMES, CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { toMinutes, getCurrentMinutes } from '../core/utils.js';
import { getAllFacultyKeys, getTeacherInfo } from './teacher-names.js';

let _masterTeacherData = null;

export async function loadMasterTeacherData(forceReload = false) {
  if (!forceReload && _masterTeacherData && !_masterTeacherData._isFallback) {
    return _masterTeacherData;
  }

  // 1. Try fetching fresh master teacher schedule JSON
  try {
    const res = await fetch('master_teachers_schedule.json?v=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.teachers && data.teachers.length > 0 && data.schedule) {
        _masterTeacherData = data;
        try {
          localStorage.removeItem('routine_master_teachers');
          localStorage.setItem('routine_master_teachers_v1', JSON.stringify(_masterTeacherData));
        } catch (e) {}
        return _masterTeacherData;
      }
    }
  } catch (e) {
    console.warn('Network load of master_teachers_schedule.json failed, checking cache:', e);
  }

  // 2. Fallback to localStorage cache
  try {
    const cached = localStorage.getItem('routine_master_teachers_v1');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.teachers && parsed.teachers.length > 0) {
        _masterTeacherData = parsed;
        return _masterTeacherData;
      }
    }
  } catch (e) {}

  // 3. Fallback: generate from current active schedule
  _masterTeacherData = generateFallbackTeacherData();
  return _masterTeacherData;
}

function generateFallbackTeacherData() {
  const master = { teachers: [], schedule: {}, _isFallback: true };
  const teacherSet = new Set();
  const sched = State.schedule || CONFIG.defaultRoutine || {};

  Object.keys(sched).forEach(dayKey => {
    let dayName = dayKey;
    if (!isNaN(dayKey)) dayName = DAY_NAMES[dayKey] || dayKey;
    if (!master.schedule[dayName]) master.schedule[dayName] = {};

    const arr = sched[dayKey];
    if (Array.isArray(arr)) {
      arr.forEach(cls => {
        const teacher = (cls.instructor || '').trim();
        const room = (cls.room || '').replace(/^room\s*/i, '').trim();
        if (!teacher || teacher === '—' || teacher.toLowerCase() === 'tba') return;
        teacherSet.add(teacher);
        if (!master.schedule[dayName][teacher]) master.schedule[dayName][teacher] = [];

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
          master.schedule[dayName][teacher].push({
            room: (room && room !== '—' && room !== '03' && room !== '3') ? room : '',
            start: startStr,
            end: endStr,
            startM,
            endM,
            subject: cls.subject || cls.title || 'Class',
            type: cls.type || 'Theory',
            semSec: 'Personal Schedule'
          });
        }
      });
    }
  });

  master.teachers = Array.from(teacherSet).sort((a, b) => a.localeCompare(b));
  return master;
}

/**
 * Merges master faculty database with live State.schedule (so custom routine edits/imports immediately reflect)
 */
function getMergedTeacherData(baseData) {
  if (!baseData) baseData = _masterTeacherData || generateFallbackTeacherData();
  
  // Clone base data
  const merged = {
    teachers: [...(baseData.teachers || [])],
    schedule: JSON.parse(JSON.stringify(baseData.schedule || {}))
  };
  const teacherSet = new Set(merged.teachers);

  // Overlay live State.schedule
  const activeSched = State.schedule || {};
  Object.keys(activeSched).forEach(dayKey => {
    let dayName = dayKey;
    if (!isNaN(dayKey)) dayName = DAY_NAMES[dayKey] || dayKey;
    if (!merged.schedule[dayName]) merged.schedule[dayName] = {};

    const arr = activeSched[dayKey];
    if (Array.isArray(arr)) {
      arr.forEach(cls => {
        const teacher = (cls.instructor || '').trim();
        const room = (cls.room || '').replace(/^room\s*/i, '').trim();
        if (!teacher || teacher === '—' || teacher.toLowerCase() === 'tba') return;
        
        teacherSet.add(teacher);
        if (!merged.schedule[dayName][teacher]) merged.schedule[dayName][teacher] = [];

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
          const existing = merged.schedule[dayName][teacher].find(c => c.startM === startM && c.endM === endM && c.subject === (cls.subject || cls.title));
          if (!existing) {
            merged.schedule[dayName][teacher].push({
              room: (room && room !== '—' && room !== '03' && room !== '3') ? room : '',
              start: startStr,
              end: endStr,
              startM,
              endM,
              subject: cls.subject || cls.title || 'Class',
              type: cls.type || 'Theory',
              semSec: 'Active Routine'
            });
          }
        }
      });
    }
  });

  merged.teachers = Array.from(teacherSet).sort((a, b) => a.localeCompare(b));
  return merged;
}

/**
 * Searches and classifies all faculty members sorted alphabetically by name.
 * Returns: { isOffDay: bool, isAfter5pm: bool, teachers: Array }
 */
export function searchTeachers(dayIdx, currentMins = getCurrentMinutes(), data = _masterTeacherData) {
  const mergedData = getMergedTeacherData(data);
  if (!mergedData || !mergedData.teachers || !mergedData.schedule) {
    return { isOffDay: false, isAfter5pm: false, teachers: [] };
  }

  const activeDays = CONFIG.activeDays || [6, 0, 1, 2, 3];
  const isOffDay = !activeDays.includes(dayIdx);
  const effectiveDayIdx = isOffDay ? activeDays[0] : dayIdx;

  const dayName = DAY_NAMES[effectiveDayIdx] || DAY_NAMES[dayIdx] || 'Sunday';
  const daySchedule = mergedData.schedule[dayName] || {};
  const results = [];

  // Unified set combining all routine teachers + all scraped official university faculty
  const facultyKeySet = new Set([...(mergedData.teachers || []), ...getAllFacultyKeys()]);
  const allTeacherKeys = Array.from(facultyKeySet);

  const seenPersons = new Set();

  allTeacherKeys.forEach(teacher => {
    const info = getTeacherInfo(teacher);
    const personIdentity = (info.officialUsername || info.name || teacher).toLowerCase().trim();

    // Prevent duplicate entries for the same person (e.g. username vs routine code)
    if (seenPersons.has(personIdentity)) return;
    seenPersons.add(personIdentity);

    // Prefer the routine code as primary key if available so routine lookup works seamlessly
    const primaryKey = info.code || teacher;
    const rawClasses = daySchedule[primaryKey] || daySchedule[teacher] || [];

    // Normalize and sort classes by start time
    const sorted = rawClasses.map(c => {
      const startM = (typeof c.startM === 'number' && c.startM >= 0) ? c.startM : toMinutes(c.start);
      const endM = (typeof c.endM === 'number' && c.endM > 0) ? c.endM : toMinutes(c.end);
      return {
        ...c,
        startM,
        endM,
        isFinished: isOffDay ? false : endM <= currentMins,
        isCurrent: isOffDay ? false : (currentMins >= startM && currentMins < endM),
        isFuture: isOffDay ? true : startM > currentMins
      };
    }).filter(c => c.startM >= 0 && c.endM > c.startM)
      .sort((a, b) => a.startM - b.startM);

    const currentClass = sorted.find(c => c.isCurrent);
    const nextClass = sorted.find(c => c.isFuture);

    if (currentClass) {
      // 🟢 Currently in class
      results.push({
        teacher: primaryKey,
        status: 'IN_CLASS',
        currentClass,
        nextClass: nextClass || null,
        allClassesToday: sorted
      });
    } else {
      // Free / Off / Done
      results.push({
        teacher: primaryKey,
        status: 'FREE',
        currentClass: null,
        nextClass: nextClass || null,
        allClassesToday: sorted
      });
    }
  });

  // Always sort alphabetically by Display Name (A-Z)
  results.sort((a, b) => {
    const nameA = (getTeacherInfo(a.teacher).name || a.teacher).toLowerCase();
    const nameB = (getTeacherInfo(b.teacher).name || b.teacher).toLowerCase();
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });

  return { isOffDay: false, isAfter5pm: false, teachers: results };
}
