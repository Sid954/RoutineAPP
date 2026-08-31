import { State } from '../core/state.js';
import { toMinutes, format12h } from '../core/utils.js';
import {
  normalizeDate,
  getDateForDayIndex,
  getOverrideFor,
  getExtraClassesForDate,
  getRescheduledClassesForDate
} from '../announcements/overrides.js';

export function getClassesForDay(dayIdx) {
  const target = dayIdx !== undefined ? dayIdx : State.currentViewDayIdx;
  const baseClasses = (State.schedule[target] || []).map(c => ({ ...c }));
  return baseClasses.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

/**
 * Returns effective classes for a day/date with all user-relevant announcement overrides applied
 * (cancellations removed, moved classes removed from origin date, incoming rescheduled classes added, extra classes added).
 *
 * @param {number} [dayIdx] - Day index (0..6)
 * @param {Date|string} [dateVal] - Optional date or anchor
 * @returns {Array} Array of effective class objects sorted chronologically
 */
export function getEffectiveClassesForDay(dayIdx, dateVal) {
  const targetDayIdx = dayIdx !== undefined ? dayIdx : State.currentViewDayIdx;
  const targetDateStr = getDateForDayIndex(targetDayIdx, dateVal);

  const holidayOverride = getOverrideFor(targetDateStr);
  const isHoliday = holidayOverride && holidayOverride.type === 'holiday';

  // Base routine classes
  let classes = (State.schedule[targetDayIdx] || []).map(c => ({ ...c }));

  // 1. Process Holidays & Cancellations
  classes = classes.map(c => {
    const cancelOv = getOverrideFor(targetDateStr, c.title);
    const isCancelled = cancelOv && cancelOv.type === 'cancellation';
    const isOnline = cancelOv && cancelOv.type === 'online_class';
    const isHolidayCancelled = !isOnline && !isCancelled && isHoliday;

    if (isCancelled || isHolidayCancelled) {
      return {
        ...c,
        isCancelled: true,
        cancelledDate: targetDateStr,
        cancelReason: isCancelled
          ? (cancelOv.announcement?.announcement || 'Class cancelled for this date')
          : (holidayOverride.announcement?.title || 'Holiday / Day Off')
      };
    }

    if (isOnline) {
      let parsed = {};
      try { parsed = JSON.parse(cancelOv.announcement?.announcement || '{}'); } catch (e) {}
      return {
        ...c,
        isMovedOnline: true,
        isOnline: true,
        platform: parsed.platform || ''
      };
    }

    return c;
  });

  // 2. Mark classes rescheduled away from this date
  if (State.announcementsList && State.announcementsList.length > 0) {
    State.announcementsList.forEach(item => {
      if (item.type !== 'rescheduled') return;
      let parsed = {};
      if (typeof item.announcement === 'string') {
        try { parsed = JSON.parse(item.announcement); } catch (e) {}
      } else if (typeof item.announcement === 'object' && item.announcement !== null) {
        parsed = item.announcement;
      }
      const origDateStr = normalizeDate(parsed.original_date || item.date_override);
      if (origDateStr === targetDateStr) {
        const targetSubj = (parsed.target_subject || item.subject_override || item.subject || '').toUpperCase().trim();
        classes = classes.map(c => {
          if ((c.title || c.subject || '').toUpperCase().trim() === targetSubj) {
            return {
              ...c,
              isRescheduled: true,
              rescheduledTo: parsed.new_date || '',
              rescheduledReason: parsed.reason || ''
            };
          }
          return c;
        });
      }
    });
  }

  // 3. Inject extra classes on this date
  const extraClasses = getExtraClassesForDate(targetDateStr);
  extraClasses.forEach(item => {
    let parsed = {};
    if (typeof item.announcement === 'string') {
      try { parsed = JSON.parse(item.announcement); } catch (e) {}
    } else if (typeof item.announcement === 'object' && item.announcement !== null) {
      parsed = item.announcement;
    }
    const isOnline = (parsed.is_online === false || /extra class/i.test(item.title || '')) ? false : true;
    const startStr = parsed.start_time || '10:00 AM';
    const endStr = parsed.end_time || (toMinutes(startStr) >= 0 ? format12h(toMinutes(startStr) + 75) : '11:15 AM');

    classes.push({
      title: item.subject_override || item.subject || parsed.subject || item.title || 'Extra Class',
      start: format12h(startStr),
      end: format12h(endStr),
      room: parsed.room || (isOnline ? 'ONLINE' : 'TBA'),
      teacher: parsed.teacher || item.name || '',
      instructor: parsed.teacher || item.name || '',
      type: 'Theory',
      isExtraClass: true,
      isOnline: isOnline,
      platform: parsed.platform || ''
    });
  });

  // 4. Inject incoming rescheduled classes on this date
  const rescheduledClasses = getRescheduledClassesForDate(targetDateStr);
  rescheduledClasses.forEach(item => {
    let parsed = {};
    if (typeof item.announcement === 'string') {
      try { parsed = JSON.parse(item.announcement); } catch (e) {}
    } else if (typeof item.announcement === 'object' && item.announcement !== null) {
      parsed = item.announcement;
    }
    const startStr = parsed.new_start_time || '03:00 PM';
    const endStr = parsed.new_end_time || (toMinutes(startStr) >= 0 ? format12h(toMinutes(startStr) + 75) : '04:15 PM');
    const room = parsed.new_room || parsed.original_room || 'TBA';
    const teacher = parsed.teacher || item.name || '';

    classes.push({
      title: parsed.target_subject || item.subject_override || item.subject || 'Rescheduled Class',
      start: format12h(startStr),
      end: format12h(endStr),
      room: room,
      teacher: teacher,
      instructor: teacher,
      type: 'Theory',
      isRescheduled: true,
      rescheduledReason: parsed.reason || '',
      origDate: parsed.original_date || item.date_override || '',
      origStart: parsed.original_start_time ? format12h(parsed.original_start_time) : ''
    });
  });

  return classes.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export function getActiveClass(entries, currentMins) {
  for (const item of entries) {
    if (item.isCancelled) continue;
    if (currentMins >= toMinutes(item.start) && currentMins < toMinutes(item.end)) return item;
  }
  return null;
}

export function getNextClass(entries, currentMins) {
  let next = null;
  let minDiff = Infinity;
  for (const item of entries) {
    if (item.isCancelled) continue;
    const startMins = toMinutes(item.start);
    const diff = startMins - currentMins;
    if (diff > 0 && diff < minDiff) { minDiff = diff; next = item; }
  }
  return next;
}
