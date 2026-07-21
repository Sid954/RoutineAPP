import { State } from '../core/state.js';
import { toMinutes, parseTo24h } from '../core/utils.js';
import { getDateForDayIndex } from '../announcements/overrides.js';

export function getClassesForDay(dayIdx) {
  const target = dayIdx !== undefined ? dayIdx : State.currentViewDayIdx;
  const baseClasses = (State.schedule[target] || []).map(c => ({ ...c }));

  // Convert target day index to date string (e.g. "2026-07-14")
  const targetDateStr = getDateForDayIndex(target);

  // Search announcements for overrides/class tests on this date
  if (State.announcementsList && State.announcementsList.length > 0) {
    // 1. Process Online Class Overrides
    const onlineClasses = State.announcementsList.filter(item => 
      item.type === 'online_class' && 
      item.date_override === targetDateStr &&
      item.subject_override
    );

    onlineClasses.forEach(item => {
      let startTime = "09:45 AM";
      let endTime = "11:00 AM";
      let platform = item.announcement || "";
      try {
        const parsed = JSON.parse(item.announcement);
        platform = parsed.platform || "";
        if (parsed.start_time) startTime = parsed.start_time;
        if (parsed.end_time) endTime = parsed.end_time;
      } catch (e) {
        // Fallback for legacy plain text: search routine schedule to find normal times
        for (const day in State.schedule) {
          const match = State.schedule[day].find(c => c.title && c.title.toUpperCase() === item.subject_override.toUpperCase());
          if (match) {
            startTime = match.start;
            endTime = match.end;
            break;
          }
        }
      }
      
      startTime = parseTo24h(startTime);
      endTime = parseTo24h(endTime);

      // Check if this class is already in the list for this day
      const existing = baseClasses.find(c => c.title && c.title.toUpperCase() === item.subject_override.toUpperCase());
      if (existing) {
        existing.room = "ONLINE";
        existing.start = startTime;
        existing.end = endTime;
      } else {
        // Find default instructor for this subject from the routine schedule
        let instructor = "";
        for (const day in State.schedule) {
          const match = State.schedule[day].find(c => c.title && c.title.toUpperCase() === item.subject_override.toUpperCase());
          if (match && match.instructor) {
            instructor = match.instructor;
            break;
          }
        }

        // Add new online class dynamically to routine
        baseClasses.push({
          start: startTime,
          end: endTime,
          title: item.subject_override,
          room: "ONLINE",
          instructor: instructor,
          type: "Theory"
        });
      }
    });

    // 2. Process Class Test / Exam Overrides
    const classTests = State.announcementsList.filter(item => 
      item.type === 'class_test' && 
      item.date_override === targetDateStr &&
      item.subject_override
    );

    classTests.forEach(item => {
      let examName = "Class Test";
      let topics = "";
      try {
        const parsed = JSON.parse(item.announcement);
        examName = parsed.exam_name || "Class Test";
        topics = parsed.topics || "";
      } catch (e) {
        examName = item.title || "Class Test";
        topics = item.announcement || "";
      }

      const existing = baseClasses.find(c => c.title && c.title.toUpperCase() === item.subject_override.toUpperCase());
      if (existing) {
        existing.type = "Exam";
        existing.isExam = true;
        existing.examName = examName;
        existing.examTopics = topics;
      } else {
        // Out of date subject exam: find normal times, room, instructor
        let startTime = "09:45 AM";
        let endTime = "11:00 AM";
        let room = "TBA";
        let instructor = "";
        for (const day in State.schedule) {
          const match = State.schedule[day].find(c => c.title && c.title.toUpperCase() === item.subject_override.toUpperCase());
          if (match) {
            startTime = match.start;
            endTime = match.end;
            if (match.room) room = match.room;
            if (match.instructor) instructor = match.instructor;
            break;
          }
        }

        startTime = parseTo24h(startTime);
        endTime = parseTo24h(endTime);

        baseClasses.push({
          start: startTime,
          end: endTime,
          title: item.subject_override,
          room: room,
          instructor: instructor,
          type: "Exam",
          isExam: true,
          examName: examName,
          examTopics: topics
        });
      }
    });
  }

  return baseClasses.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export function getActiveClass(entries, currentMins) {
  for (const item of entries) {
    if (currentMins >= toMinutes(item.start) && currentMins < toMinutes(item.end)) return item;
  }
  return null;
}

export function getNextClass(entries, currentMins) {
  let next = null;
  let minDiff = Infinity;
  for (const item of entries) {
    const startMins = toMinutes(item.start);
    const diff = startMins - currentMins;
    if (diff > 0 && diff < minDiff) { minDiff = diff; next = item; }
  }
  return next;
}
