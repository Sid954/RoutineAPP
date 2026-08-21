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

  // Academic week starts on Saturday (Sat=6, Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5)
  // If anchor is on Thursday (4) or Friday (5) and we are viewing a real school day (Sat..Wed: 6,0,1,2,3),
  // and explicitAnchorDate was NOT passed, the user is looking ahead to the upcoming academic week.
  let satOffset;
  if (anchorDayIdx === 6) {
    satOffset = 0;
  } else if (!explicitAnchorDate && (anchorDayIdx === 4 || anchorDayIdx === 5) && (targetDayIdx === 6 || targetDayIdx <= 3)) {
    satOffset = (anchorDayIdx === 4) ? -2 : -1;
  } else {
    satOffset = anchorDayIdx + 1;
  }

  const weekStartSat = new Date(anchor);
  weekStartSat.setDate(anchor.getDate() - satOffset);

  const dayOffset = (targetDayIdx === 6) ? 0 : (targetDayIdx + 1);
  const targetDate = new Date(weekStartSat);
  targetDate.setDate(weekStartSat.getDate() + dayOffset);

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

  // Helper for matching subject codes flexibly
  const isSubjMatch = (itemSubj) => {
    if (!targetSubj) return true;
    const cleanItem = (itemSubj || '').toUpperCase().trim();
    if (!cleanItem) return false;
    return cleanItem === targetSubj || targetSubj.includes(cleanItem) || cleanItem.includes(targetSubj);
  };

  // 1. Online Class for specific subject (beats holiday for that subject)
  if (targetSubj) {
    const onlineClass = State.announcementsList.find(item => {
      if (item.type !== 'online_class') return false;
      const itemDate = normalizeDate(item.date_override);
      const itemSubj = item.subject_override || item.subject || '';
      return itemDate === targetDateStr && isSubjMatch(itemSubj);
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

  return null;
}
