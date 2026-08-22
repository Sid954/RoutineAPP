import { State } from '../core/state.js';

export function getDateForDayIndex(targetDayIdx) {
  const anchor = State.viewDate ? new Date(State.viewDate) : new Date();
  anchor.setHours(0, 0, 0, 0);

  if (targetDayIdx === undefined || targetDayIdx === null) {
    const y = anchor.getFullYear();
    const m = String(anchor.getMonth() + 1).padStart(2, '0');
    const d = String(anchor.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const anchorDayIdx = anchor.getDay();
  if (Number(targetDayIdx) === anchorDayIdx) {
    const y = anchor.getFullYear();
    const m = String(anchor.getMonth() + 1).padStart(2, '0');
    const d = String(anchor.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Academic week starts on Saturday (Sat=6, Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5)
  const satOffset = (anchorDayIdx === 6) ? 0 : (anchorDayIdx + 1);
  const weekStartSat = new Date(anchor);
  weekStartSat.setDate(anchor.getDate() - satOffset);

  const targetNum = Number(targetDayIdx);
  const dayOffset = (targetNum === 6) ? 0 : (targetNum + 1);
  const targetDate = new Date(weekStartSat);
  targetDate.setDate(weekStartSat.getDate() + dayOffset);

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns an override (holiday/cancellation/online_class/class_test) for the given day + optional subject,
 * reading from State.announcementsList to avoid circular dependency with Announcements module.
 */
export function getOverrideFor(dayIdx, subjectCode) {
  if (!State.announcementsList || State.announcementsList.length === 0) return null;

  const targetDateStr = getDateForDayIndex(dayIdx);
  const targetSubj = (subjectCode || '').toUpperCase().trim();

  // 1. Online Class for specific subject (beats holiday for that subject)
  if (targetSubj) {
    const onlineClass = State.announcementsList.find(item => {
      if (item.type !== 'online_class') return false;
      const itemDate = (item.date_override || '').split('T')[0].trim();
      const itemSubj = (item.subject_override || item.subject || '').toUpperCase().trim();
      return itemDate === targetDateStr && itemSubj === targetSubj;
    });
    if (onlineClass) return { type: 'online_class', announcement: onlineClass };
  }

  // 2. Class Test / Exam for specific subject
  if (targetSubj) {
    const classTest = State.announcementsList.find(item => {
      if (item.type !== 'class_test') return false;
      const itemDate = (item.date_override || '').split('T')[0].trim();
      const itemSubj = (item.subject_override || item.subject || '').toUpperCase().trim();
      return itemDate === targetDateStr && itemSubj === targetSubj;
    });
    if (classTest) return { type: 'class_test', announcement: classTest };
  }

  // 3. Holiday covers all classes on that day (except online_class overrides above)
  const holiday = State.announcementsList.find(item => {
    if (item.type !== 'holiday') return false;
    const itemDate = (item.date_override || '').split('T')[0].trim();
    return itemDate === targetDateStr;
  });
  if (holiday) return { type: 'holiday', announcement: holiday };

  // 4. Specific Cancellation for a subject
  if (targetSubj) {
    const cancellation = State.announcementsList.find(item => {
      if (item.type !== 'cancellation') return false;
      const itemDate = (item.date_override || '').split('T')[0].trim();
      const itemSubj = (item.subject_override || item.subject || '').toUpperCase().trim();
      return itemDate === targetDateStr && itemSubj === targetSubj;
    });
    if (cancellation) return { type: 'cancellation', announcement: cancellation };
  }

  return null;
}
