/**
 * Notice payload validation, shared by api/announcements.js (admin posts) and
 * api/suggestions.js (community suggestions), so both accept exactly the same shapes.
 */
const LIMITS = {
  AUTHOR_NAME: 15,
  TITLE: 50,
  EXAM_NAME: 15,
  TOPICS: 50,
  PLATFORM_LINK: 100,
  TASK_TITLE: 15,
  ASSIGNMENT_DESC: 50,
  ROOM: 20,
  REASON: 50
};

function collapseNewlines(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\n{3,}/g, '\n\n').trim();
}

function toMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return -1;
  const clean = timeStr.trim();
  const match12 = clean.match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const p = match12[3] ? match12[3].toUpperCase() : null;
    if (p === 'PM' && h !== 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const parts = clean.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
  }
  return -1;
}

function calculateEndTime(startTimeStr, endTimeStr) {
  const startM = toMinutes(startTimeStr);
  const endM = toMinutes(endTimeStr);
  if (endM > startM && startM >= 0) {
    return endTimeStr.trim();
  }
  if (startM >= 0) {
    const m = Math.min(1439, startM + 75);
    const h = Math.floor(m / 60);
    const min = m % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;
  }
  return '11:00 AM';
}

function sanitizeAndValidatePayload(body) {
  const { name, title, announcement, type, subject, date_override, subject_override, semester, section, is_pinned } = body || {};

  const cleanName = (typeof name === 'string' ? name.trim() : '');
  if (!cleanName) {
    return { error: 'Name is required and cannot be whitespace only.' };
  }
  if (cleanName.length > LIMITS.AUTHOR_NAME) {
    return { error: `Name cannot exceed ${LIMITS.AUTHOR_NAME} characters.` };
  }

  const cleanTitle = (typeof title === 'string' ? title.trim() : '');
  if (!cleanTitle) {
    return { error: 'Title is required and cannot be whitespace only.' };
  }
  if (cleanTitle.length > LIMITS.TITLE) {
    return { error: `Title cannot exceed ${LIMITS.TITLE} characters.` };
  }

  let cleanAnnouncement = announcement;
  const itemType = type || 'general';

  if (itemType === 'general') {
    cleanAnnouncement = collapseNewlines(typeof announcement === 'string' ? announcement : '');
    if (!cleanAnnouncement) {
      return { error: 'Announcement content is required and cannot be whitespace only.' };
    }
  } else if (itemType === 'class_test') {
    try {
      const parsed = typeof announcement === 'string' ? JSON.parse(announcement) : announcement;
      const examName = (parsed?.exam_name || '').trim();
      const topics = collapseNewlines(parsed?.topics || '');
      
      if (!examName) {
        return { error: 'Exam name is required.' };
      }
      if (examName.length > LIMITS.EXAM_NAME) {
        return { error: `Exam name cannot exceed ${LIMITS.EXAM_NAME} characters.` };
      }
      if (topics.length > LIMITS.TOPICS) {
        return { error: `Syllabus / Topics cannot exceed ${LIMITS.TOPICS} characters.` };
      }
      cleanAnnouncement = JSON.stringify({
        exam_name: examName,
        topics: topics || 'Not Specified'
      });
    } catch (e) {
      return { error: 'Invalid class_test payload structure.' };
    }
  } else if (itemType === 'online_class') {
    try {
      const parsed = typeof announcement === 'string' ? JSON.parse(announcement) : announcement;
      const platform = (parsed?.platform || '').trim();
      if (platform.length > LIMITS.PLATFORM_LINK) {
        return { error: `Platform link cannot exceed ${LIMITS.PLATFORM_LINK} characters.` };
      }
      // Plain text ("Zoom", "Google Meet") or an http(s) link only — never script/data URLs
      if (/^\s*(javascript|data|vbscript|file):/i.test(platform)) {
        return { error: 'Platform link must be an http(s) URL or plain text.' };
      }
      const isOnline = parsed?.is_online !== undefined ? Boolean(parsed.is_online) : true;
      const isExtra = parsed?.is_extra_class !== undefined ? Boolean(parsed.is_extra_class) : false;
      const room = (parsed?.room || '').trim();
      if (!isOnline && room.length > LIMITS.ROOM) {
        return { error: `Room cannot exceed ${LIMITS.ROOM} characters.` };
      }
      const teacher = (parsed?.teacher || '').trim();

      const obj = {
        is_extra_class: isExtra,
        is_online: isOnline,
        platform: isOnline ? platform : '',
        room: !isOnline ? room : '',
        teacher,
        start_time: (parsed?.start_time || '09:45 AM').trim(),
        end_time: (parsed?.end_time || '').trim()
      };
      cleanAnnouncement = JSON.stringify(obj);
    } catch (e) {
      return { error: 'Invalid online_class payload structure.' };
    }
  } else if (itemType === 'rescheduled') {
    try {
      const parsed = typeof announcement === 'string' ? JSON.parse(announcement) : announcement;
      const newRoom = (parsed?.new_room || '').trim();
      if (newRoom.length > LIMITS.ROOM) {
        return { error: `Room cannot exceed ${LIMITS.ROOM} characters.` };
      }
      const reason = collapseNewlines(parsed?.reason || '');
      if (reason.length > LIMITS.REASON) {
        return { error: `Reason cannot exceed ${LIMITS.REASON} characters.` };
      }
      const obj = {
        original_date: (parsed?.original_date || date_override || '').trim(),
        original_start_time: (parsed?.original_start_time || '').trim(),
        original_room: (parsed?.original_room || '').trim(),
        new_date: (parsed?.new_date || date_override || '').trim(),
        new_start_time: (parsed?.new_start_time || '03:00 PM').trim(),
        new_room: newRoom,
        reason: reason
      };
      cleanAnnouncement = JSON.stringify(obj);
    } catch (e) {
      return { error: 'Invalid rescheduled payload structure.' };
    }
  } else if (itemType === 'assignment') {
    try {
      const parsed = typeof announcement === 'string' ? JSON.parse(announcement) : announcement;
      const taskTitle = (parsed?.task_title || '').trim();
      if (!taskTitle) {
        return { error: 'Task title is required.' };
      }
      if (taskTitle.length > LIMITS.TASK_TITLE) {
        return { error: `Task title cannot exceed ${LIMITS.TASK_TITLE} characters.` };
      }
      const desc = collapseNewlines(parsed?.description || '');
      if (desc.length > LIMITS.ASSIGNMENT_DESC) {
        return { error: `Notes / Submission Info cannot exceed ${LIMITS.ASSIGNMENT_DESC} characters.` };
      }
      const obj = {
        task_title: taskTitle,
        due_time: (parsed?.due_time || '').trim(),
        description: desc
      };
      cleanAnnouncement = JSON.stringify(obj);
    } catch (e) {
      cleanAnnouncement = collapseNewlines(typeof announcement === 'string' ? announcement : '');
    }
  } else {
    cleanAnnouncement = collapseNewlines(typeof announcement === 'string' ? announcement : '');
  }

  return {
    data: {
      name: cleanName,
      title: cleanTitle,
      announcement: cleanAnnouncement,
      subject: (typeof subject === 'string' ? subject.trim() : null) || null,
      type: itemType,
      date_override: (typeof date_override === 'string' ? date_override.trim() : null) || null,
      subject_override: (typeof subject_override === 'string' ? subject_override.trim() : null) || null,
      semester: (typeof semester === 'string' ? semester.trim() : null) || null,
      section: (typeof section === 'string' ? section.trim() : null) || null,
      is_pinned: typeof is_pinned === 'boolean' ? is_pinned : (is_pinned === 'true' ? true : false)
    }
  };
}

module.exports = { sanitizeAndValidatePayload, LIMITS, collapseNewlines, toMinutes };
