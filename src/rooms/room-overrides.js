import { State } from '../core/state.js';
import { normalizeDate } from '../announcements/overrides.js';
import { formatMinuteTo12h } from './room-engine.js';

/**
 * Parses time string (e.g. "10:10 AM", "14:30", "2:00 PM") into minutes of day (0..1439).
 */
export function parseTimeToMins(str) {
  if (!str) return -1;
  const clean = String(str).trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3] ? match[3].toUpperCase() : null;
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  return -1;
}

/**
 * Normalizes room identifier string (e.g. "Room 403" -> "403").
 */
export function normalizeRoomId(raw) {
  return String(raw || '').replace(/^room\s*/i, '').trim().toLowerCase();
}

/**
 * Matches announcement semester & section against class semSec string (e.g. "Sem 3-B").
 */
export function matchesSemSec(classSemSec, annSemester, annSection) {
  if (!annSemester && !annSection) return true; // Global announcement
  const match = String(classSemSec || '').match(/Sem\s*(\d+)(?:-([A-Za-z0-9]+))?/i);
  if (!match) return true;

  const classSem = match[1];
  const classSec = (match[2] || '').toLowerCase();
  const annSem = (annSemester || '').toString().toLowerCase().replace(/^(?:sem\s*)?/i, '').trim();
  const annSec = (annSection || '').toString().toLowerCase().trim();

  if (annSem && classSem !== annSem) return false;
  if (annSec && classSec && classSec !== annSec) return false;
  return true;
}

/**
 * Flexible subject acronym / code matcher.
 */
export function isSubjMatch(annSubj, classSubj) {
  const a = (annSubj || '').toUpperCase().trim();
  const c = (classSubj || '').toUpperCase().trim();
  if (!a || !c) return false;
  return a === c || a.includes(c) || c.includes(a);
}

/**
 * Returns effective class list for a room on a given day/date, with department-wide announcement overrides applied.
 *
 * @param {string} roomId - e.g. "403"
 * @param {string} dayName - e.g. "Tuesday"
 * @param {string} dateStr - Target date in YYYY-MM-DD format
 * @param {Array} baseClasses - Raw scheduled classes for this room from master_rooms_schedule
 * @returns {Array} Updated array of class objects with cancellations removed, reschedules moved, and extra classes added
 */
export function getEffectiveRoomClasses(roomId, dayName, dateStr, baseClasses = []) {
  const announcements = (State.allAnnouncementsList && State.allAnnouncementsList.length > 0)
    ? State.allAnnouncementsList
    : (State.announcementsList || []);

  if (!announcements || announcements.length === 0 || !dateStr) {
    return Array.isArray(baseClasses) ? [...baseClasses] : [];
  }

  const cleanTargetRoom = normalizeRoomId(roomId);
  const targetDate = normalizeDate(dateStr);

  // 1. Check for Holiday on this date
  const holiday = announcements.find(item => {
    if (item.type !== 'holiday') return false;
    return normalizeDate(item.date_override) === targetDate;
  });

  if (holiday) {
    // If university-wide holiday or general holiday, all rooms are completely free
    if (!holiday.semester) {
      return [];
    }
  }

  // Clone base classes for modification
  let effectiveClasses = Array.isArray(baseClasses) ? baseClasses.map(c => ({ ...c })) : [];

  // Filter out classes affected by holiday (if batch-specific holiday)
  if (holiday && holiday.semester) {
    effectiveClasses = effectiveClasses.filter(cls => !matchesSemSec(cls.semSec, holiday.semester, holiday.section));
  }

  // 2. Process Removals: Cancellations, Online Classes (replacements), and Rescheduled (from original slot)
  announcements.forEach(item => {
    const itemDate = normalizeDate(item.date_override);
    let parsed = {};
    if (typeof item.announcement === 'string') {
      try { parsed = JSON.parse(item.announcement); } catch (e) {}
    } else if (typeof item.announcement === 'object' && item.announcement !== null) {
      parsed = item.announcement;
    }

    // A. Cancellation
    if (item.type === 'cancellation' && itemDate === targetDate) {
      const annSubj = item.subject_override || item.subject || '';
      effectiveClasses = effectiveClasses.filter(cls => {
        const subjMatch = isSubjMatch(annSubj, cls.subject);
        const semMatch = matchesSemSec(cls.semSec, item.semester, item.section);
        return !(subjMatch && semMatch);
      });
    }

    // B. Online Class (replaces scheduled in-person session, freeing the physical room)
    if (item.type === 'online_class' && itemDate === targetDate) {
      const isOnline = (parsed.is_online === false || /extra class/i.test(item.title || '')) ? false : true;
      if (isOnline) {
        const annSubj = item.subject_override || item.subject || '';
        effectiveClasses = effectiveClasses.filter(cls => {
          const subjMatch = isSubjMatch(annSubj, cls.subject);
          const semMatch = matchesSemSec(cls.semSec, item.semester, item.section);
          return !(subjMatch && semMatch);
        });
      }
    }

    // C. Rescheduled: Remove from original slot if this is the origin date
    if (item.type === 'rescheduled' && itemDate === targetDate) {
      const annSubj = item.subject_override || item.subject || parsed.target_subject || '';
      effectiveClasses = effectiveClasses.filter(cls => {
        const subjMatch = isSubjMatch(annSubj, cls.subject);
        const semMatch = matchesSemSec(cls.semSec, item.semester, item.section);
        return !(subjMatch && semMatch);
      });
    }
  });

  // 3. Process Additions: Rescheduled (destination slot) and Extra Classes (in-person into this room)
  announcements.forEach(item => {
    let parsed = {};
    if (typeof item.announcement === 'string') {
      try { parsed = JSON.parse(item.announcement); } catch (e) {}
    } else if (typeof item.announcement === 'object' && item.announcement !== null) {
      parsed = item.announcement;
    }

    // A. Rescheduled moving INTO this room on targetDate
    if (item.type === 'rescheduled') {
      const destDate = normalizeDate(parsed.new_date || item.date_override);
      if (destDate === targetDate) {
        const destRoom = normalizeRoomId(parsed.new_room || parsed.original_room);
        if (destRoom && destRoom === cleanTargetRoom) {
          const startM = parseTimeToMins(parsed.new_start_time);
          if (startM >= 0) {
            const endM = parseTimeToMins(parsed.new_end_time) > startM
              ? parseTimeToMins(parsed.new_end_time)
              : Math.min(1440, startM + 80); // Default 1h 20m duration

            const subj = parsed.target_subject || item.subject_override || item.subject || 'Rescheduled Class';
            const teacher = parsed.teacher || item.name || '';
            const semSec = item.semester && item.section
              ? `Sem ${item.semester}-${item.section.toUpperCase()}`
              : (item.semester ? `Sem ${item.semester}` : '');

            effectiveClasses.push({
              start: formatMinuteTo12h(startM),
              end: formatMinuteTo12h(endM),
              startM: startM,
              endM: endM,
              subject: subj,
              instructor: teacher,
              teacher: teacher,
              type: 'Theory',
              semSec: semSec,
              semester: item.semester || '',
              section: item.section || '',
              isRescheduledOverride: true
            });
          }
        }
      }
    }

    // B. Extra In-Person Class scheduled into this room on targetDate
    if (item.type === 'online_class') {
      const itemDate = normalizeDate(item.date_override);
      const isExtraInPerson = (parsed.is_extra_class === true || parsed.is_online === false || /extra class/i.test(item.title || ''));
      if (isExtraInPerson && itemDate === targetDate) {
        const extraRoom = normalizeRoomId(parsed.room || parsed.room_number);
        if (extraRoom && extraRoom === cleanTargetRoom) {
          const startM = parseTimeToMins(parsed.start_time);
          if (startM >= 0) {
            const endM = parseTimeToMins(parsed.end_time) > startM
              ? parseTimeToMins(parsed.end_time)
              : Math.min(1440, startM + 80);

            const subj = item.subject_override || item.subject || 'Extra Class';
            const teacher = parsed.teacher || item.name || '';
            const semSec = item.semester && item.section
              ? `Sem ${item.semester}-${item.section.toUpperCase()}`
              : (item.semester ? `Sem ${item.semester}` : '');

            effectiveClasses.push({
              start: formatMinuteTo12h(startM),
              end: formatMinuteTo12h(endM),
              startM: startM,
              endM: endM,
              subject: subj,
              instructor: teacher,
              teacher: teacher,
              type: 'Theory',
              semSec: semSec,
              semester: item.semester || '',
              section: item.section || '',
              isExtraClassOverride: true
            });
          }
        }
      }
    }
  });

  // Sort chronologically by start time
  return effectiveClasses.sort((a, b) => a.startM - b.startM);
}
