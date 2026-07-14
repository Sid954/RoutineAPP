import { State } from '../core/state.js';

export function getDateForDayIndex(targetDayIdx) {
  const dayOrder = [6, 0, 1, 2, 3, 4, 5]; // Sat, Sun, Mon, Tue, Wed, Thu, Fri
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIdx = today.getDay();

  const todayOffset = dayOrder.indexOf(todayIdx);
  const targetOffset = dayOrder.indexOf(targetDayIdx);
  const diff = targetOffset - todayOffset;

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns an override (holiday/cancellation/online_class) for the given day + optional subject,
 * reading from State.announcementsList to avoid circular dependency with Announcements module.
 */
export function getOverrideFor(dayIdx, subjectCode) {
  if (!State.announcementsList || State.announcementsList.length === 0) return null;

  const targetDateStr = getDateForDayIndex(dayIdx);

  // If checking a specific subject, online_class BEATS holiday for that subject
  if (subjectCode) {
    const onlineClass = State.announcementsList.find(item =>
      item.type === 'online_class' &&
      item.date_override === targetDateStr &&
      item.subject_override &&
      item.subject_override.toUpperCase().trim() === subjectCode.toUpperCase().trim()
    );
    if (onlineClass) return { type: 'online_class', announcement: onlineClass };
  }

  // Holiday covers all classes on that day (except online_class overrides above)
  const holiday = State.announcementsList.find(item =>
    item.type === 'holiday' &&
    item.date_override === targetDateStr
  );
  if (holiday) return { type: 'holiday', announcement: holiday };

  // Specific cancellation for a subject
  if (subjectCode) {
    const cancellation = State.announcementsList.find(item =>
      item.type === 'cancellation' &&
      item.date_override === targetDateStr &&
      item.subject_override &&
      item.subject_override.toUpperCase().trim() === subjectCode.toUpperCase().trim()
    );
    if (cancellation) return { type: 'cancellation', announcement: cancellation };
  }

  return null;
}
