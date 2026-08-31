import { State } from '../core/state.js';

export function normalizeDate(dateVal) {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(dateVal).split('T')[0].trim();
}

/**
 * Returns a YYYY-MM-DD string for a given target day index (0..6) or date.
 * If targetDayOrDate is already a Date or date string, normalizes and returns it.
 * If targetDayOrDate is a day index (0..6):
 *   - If explicitAnchorDate is provided, uses that as the anchor.
 *   - Otherwise uses State.viewDate (or real today).
 *   - Correctly maps to the active academic week (Sat..Wed) without falling back to past weeks on Thu/Fri.
 */
export function getDateForDayIndex(targetDayOrDate, explicitAnchorDate) {
  if (targetDayOrDate === undefined || targetDayOrDate === null) {
    return normalizeDate(explicitAnchorDate || State.viewDate || new Date());
  }

  if (targetDayOrDate instanceof Date) {
    return normalizeDate(targetDayOrDate);
  }

  if (typeof targetDayOrDate === 'string' && targetDayOrDate.includes('-')) {
    return normalizeDate(targetDayOrDate);
  }

  const targetDayIdx = Number(targetDayOrDate);
  const anchor = explicitAnchorDate ? new Date(explicitAnchorDate) : (State.viewDate ? new Date(State.viewDate) : new Date());
  anchor.setHours(0, 0, 0, 0);

  const anchorDayIdx = anchor.getDay();
  if (targetDayIdx === anchorDayIdx) {
    return normalizeDate(anchor);
  }

  // Academic week rolls over on Thursday (Thu=4, Fri=5, Sat=6, Sun=0, Mon=1, Tue=2, Wed=3)
  const thuOffset = (anchorDayIdx - 4 + 7) % 7;
  const weekStartThu = new Date(anchor);
  weekStartThu.setDate(anchor.getDate() - thuOffset);

  const targetOffset = (targetDayIdx - 4 + 7) % 7;
  const targetDate = new Date(weekStartThu);
  targetDate.setDate(weekStartThu.getDate() + targetOffset);

  return normalizeDate(targetDate);
}

/**
 * Returns an override (holiday/cancellation/online_class/class_test) for the given day + optional subject,
 * reading from State.announcementsList to avoid circular dependency with Announcements module.
 * @param {number|string|Date} dayOrDate - Day index (0..6), Date instance, or YYYY-MM-DD string
 * @param {string} [subjectCode] - Optional subject title/code
 * @param {Date|string} [explicitAnchor] - Optional explicit anchor date
 */
export function getOverrideFor(dayOrDate, subjectCode, explicitAnchor) {
  if (!State.announcementsList || State.announcementsList.length === 0) return null;

  const targetDateStr = getDateForDayIndex(dayOrDate, explicitAnchor);
  const targetSubj = (subjectCode || '').toUpperCase().trim();

  // Helper for matching subject codes (exact match)
  const isSubjMatch = (itemSubj) => {
    if (!targetSubj) return true;
    const cleanItem = (itemSubj || '').toUpperCase().trim();
    if (!cleanItem) return false;
    return cleanItem === targetSubj;
  };

  // 1. Online Class for specific subject (beats holiday for that subject, but only if online)
  if (targetSubj) {
    const onlineClass = State.announcementsList.find(item => {
      if (item.type !== 'online_class') return false;
      const itemDate = normalizeDate(item.date_override);
      const itemSubj = item.subject_override || item.subject || '';
      if (itemDate !== targetDateStr || !isSubjMatch(itemSubj)) return false;

      let parsed = {};
      try { parsed = JSON.parse(item.announcement); } catch (e) {}
      const isOnline = (parsed.is_online === false || /extra class/i.test(item.title || '')) ? false : true;
      return isOnline;
    });
    if (onlineClass) return { type: 'online_class', announcement: onlineClass };
  }

  // 2. Class Test / Exam for specific subject
  if (targetSubj) {
    const classTest = State.announcementsList.find(item => {
      if (item.type !== 'class_test') return false;
      const itemDate = normalizeDate(item.date_override);
      const itemSubj = item.subject_override || item.subject || '';
      return itemDate === targetDateStr && isSubjMatch(itemSubj);
    });
    if (classTest) return { type: 'class_test', announcement: classTest };
  }

  // 3. Holiday covers all classes on that day (except online_class overrides above)
  const holiday = State.announcementsList.find(item => {
    if (item.type !== 'holiday') return false;
    const itemDate = normalizeDate(item.date_override);
    return itemDate === targetDateStr;
  });
  if (holiday) return { type: 'holiday', announcement: holiday };

  // 4. Specific Cancellation for a subject
  if (targetSubj) {
    const cancellation = State.announcementsList.find(item => {
      if (item.type !== 'cancellation') return false;
      const itemDate = normalizeDate(item.date_override);
      const itemSubj = item.subject_override || item.subject || '';
      return itemDate === targetDateStr && isSubjMatch(itemSubj);
    });
    if (cancellation) return { type: 'cancellation', announcement: cancellation };
  }

  // 5. Rescheduled Class for a subject
  if (targetSubj) {
    const rescheduled = State.announcementsList.find(item => {
      if (item.type !== 'rescheduled') return false;
      const itemDate = normalizeDate(item.date_override);
      const itemSubj = item.subject_override || item.subject || '';
      return itemDate === targetDateStr && isSubjMatch(itemSubj);
    });
    if (rescheduled) return { type: 'rescheduled', announcement: rescheduled };
  }

  return null;
}

/**
 * Returns all net-new extra classes (online or offline) posted for a specific date.
 */
export function getExtraClassesForDate(dayOrDate, explicitAnchor) {
  if (!State.announcementsList || State.announcementsList.length === 0) return [];
  const targetDateStr = getDateForDayIndex(dayOrDate, explicitAnchor);

  return State.announcementsList.filter(item => {
    if (item.type !== 'online_class') return false;
    const itemDate = normalizeDate(item.date_override);
    if (itemDate !== targetDateStr) return false;

    let parsed = {};
    if (typeof item.announcement === 'string') {
      try { parsed = JSON.parse(item.announcement); } catch (e) {}
    } else if (typeof item.announcement === 'object' && item.announcement !== null) {
      parsed = item.announcement;
    }
    return Boolean(parsed.is_extra_class) || parsed.is_online === false || /extra class/i.test(item.title || '');
  });
}

/**
 * Returns all classes rescheduled TO a specific date.
 */
export function getRescheduledClassesForDate(dayOrDate, explicitAnchor) {
  if (!State.announcementsList || State.announcementsList.length === 0) return [];
  const targetDateStr = getDateForDayIndex(dayOrDate, explicitAnchor);

  return State.announcementsList.filter(item => {
    if (item.type !== 'rescheduled') return false;
    let parsed = {};
    if (typeof item.announcement === 'string') {
      try { parsed = JSON.parse(item.announcement); } catch (e) {}
    } else if (typeof item.announcement === 'object' && item.announcement !== null) {
      parsed = item.announcement;
    }
    const destinationDate = normalizeDate(parsed.new_date || item.date_override);
    return destinationDate === targetDateStr;
  });
}

/**
 * Returns all assignment/deadline reminders for a specific date.
 */
export function getDeadlinesForDate(dayOrDate, explicitAnchor) {
  if (!State.announcementsList || State.announcementsList.length === 0) return [];
  const targetDateStr = getDateForDayIndex(dayOrDate, explicitAnchor);

  return State.announcementsList.filter(item => {
    if (item.type !== 'assignment') return false;
    const itemDate = normalizeDate(item.date_override);
    return itemDate === targetDateStr;
  });
}

/**
 * Pre-builds a Map of YYYY-MM-DD -> { type, count, announcement }
 * with resolved multi-override priority: holiday > cancellation > class_test > rescheduled > online_class > assignment.
 */
export function getOverridesByDateMap() {
  const map = new Map();
  if (!State.announcementsList || State.announcementsList.length === 0) return map;

  const PRIORITY = { holiday: 1, cancellation: 2, class_test: 3, rescheduled: 4, online_class: 5, assignment: 6 };

  State.announcementsList.forEach(item => {
    if (!item.date_override) return;
    const dateStr = normalizeDate(item.date_override);
    if (!dateStr) return;

    const itemType = item.type || 'general';
    if (!PRIORITY[itemType]) return; // Skip general announcements without schedule override

    const existing = map.get(dateStr);
    if (!existing) {
      map.set(dateStr, { type: itemType, count: 1, announcement: item });
    } else {
      existing.count++;
      // If new item has higher priority (lower priority number), it wins the visual badge
      if (PRIORITY[itemType] < PRIORITY[existing.type]) {
        existing.type = itemType;
        existing.announcement = item;
      }
    }

    // For rescheduled, also index the destination date (new_date) so the week strip
    // and calendar picker can badge the day the class is moving TO, not just the origin.
    if (itemType === 'rescheduled') {
      let parsedAnn = {};
      if (typeof item.announcement === 'string') {
        try { parsedAnn = JSON.parse(item.announcement); } catch (e) {}
      } else if (typeof item.announcement === 'object' && item.announcement !== null) {
        parsedAnn = item.announcement;
      }
      const destDateStr = parsedAnn.new_date ? normalizeDate(parsedAnn.new_date) : '';
      // Only index destination if it differs from origin (avoid double-counting same-day reschedules)
      if (destDateStr && destDateStr !== dateStr) {
        const destExisting = map.get(destDateStr);
        if (!destExisting) {
          map.set(destDateStr, { type: itemType, count: 1, announcement: item });
        } else {
          destExisting.count++;
          if (PRIORITY[itemType] < PRIORITY[destExisting.type]) {
            destExisting.type = itemType;
            destExisting.announcement = item;
          }
        }
      }
    }
  });

  return map;
}
