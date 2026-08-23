import { toMinutes, format12h, toTimeString } from '../core/utils.js';

export const ANNOUNCEMENT_LIMITS = {
  AUTHOR_NAME: 15,
  TITLE: 15,
  HOLIDAY_NAME: 15,
  EXAM_NAME: 15,
  TOPICS: 50,
  PLATFORM_LINK: 100,
  FEED_COLLAPSE_CHARS: 50,
  TASK_TITLE: 15,
  ASSIGNMENT_DESC: 50,
  ROOM: 20,
  REASON: 50
};

/**
 * Collapses multiple consecutive newlines into a single newline
 * and trims leading/trailing whitespace.
 * @param {string} str
 * @returns {string}
 */
export function collapseNewlines(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Trims leading/trailing whitespace from text and normalizes empty strings.
 * @param {string} str
 * @returns {string}
 */
export function cleanString(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

/**
 * Validates a single text field against max length and required constraints.
 * @param {string} value - The input value.
 * @param {number} maxLength - Maximum allowable characters.
 * @param {string} fieldLabel - Human-readable field name for errors.
 * @param {boolean} required - Whether the field is mandatory.
 * @returns {{ valid: boolean, error?: string, cleaned: string }}
 */
export function validateField(value, maxLength, fieldLabel, required = false) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  if (required && cleaned.length === 0) {
    return {
      valid: false,
      error: `${fieldLabel} is required and cannot be empty or whitespace only.`,
      cleaned: ''
    };
  }
  if (maxLength && cleaned.length > maxLength) {
    return {
      valid: false,
      error: `${fieldLabel} cannot exceed ${maxLength} characters (currently ${cleaned.length}).`,
      cleaned
    };
  }
  return { valid: true, cleaned };
}

/**
 * Generates or cleans announcement titles to remove redundant type prefixes
 * and apply clean descriptive context.
 * 
 * Rules:
 * - Online Class: "[Subject] Session" (e.g. "CFL Session")
 * - Holiday: "[Holiday Name] Holiday" (e.g. "Random Holiday")
 * - Cancelled: "[Subject] Class" (e.g. "ICMP Class")
 * - Class Test: "[Exam Name]: [Subject]" or "[Subject] Assessment" (e.g. "CT-1: EDC")
 * - General: User's custom title directly
 * 
 * @param {Object} item
 * @returns {string} Clean title
 */
export function formatAnnouncementTitle(item = {}) {
  const type = item.type || 'general';
  const rawTitle = (item.title || '').trim();
  const subject = (item.subject_override || item.subject || '').trim();

  if (type === 'general') {
    return rawTitle || 'Announcement';
  }

  if (type === 'online_class') {
    let isOnline = true;
    if (typeof item.announcement === 'string') {
      try {
        const parsed = JSON.parse(item.announcement);
        if (parsed.is_online === false) isOnline = false;
      } catch (e) {}
    } else if (typeof item.announcement === 'object' && item.announcement !== null) {
      if (item.announcement.is_online === false) isOnline = false;
    }
    if (item.is_online === false) isOnline = false;

    if (!isOnline) {
      if (subject) return `${subject} Extra Class`;
      const stripped = rawTitle.replace(/^(Extra Class|Offline Class|In-Person Class)\s*[:\-–—]\s*/i, '').trim();
      return stripped ? `${stripped} Extra Class` : 'Extra Class';
    }

    if (subject) return `${subject} Session`;
    const stripped = rawTitle.replace(/^(Online Class|Online Session|Online)\s*[:\-–—]\s*/i, '').trim();
    return stripped ? `${stripped} Session` : 'Online Session';
  }

  if (type === 'cancellation') {
    if (subject) return `${subject} Class`;
    const stripped = rawTitle.replace(/^(Class Cancelled|Cancellation|Cancelled)\s*[:\-–—]\s*/i, '').trim();
    return stripped ? `${stripped} Class` : 'Cancelled Class';
  }

  if (type === 'holiday') {
    let holName = (item.holiday_name || '').trim();
    if (!holName) {
      holName = rawTitle.replace(/^(Holiday|Day Off)\s*[:\-–—]\s*/i, '').trim();
    }
    if (!holName || /^holiday( declared)?$/i.test(holName) || /^day off$/i.test(holName)) {
      return 'University Holiday';
    }
    if (/holiday|vacation|break|day off/i.test(holName)) {
      return holName;
    }
    return `${holName} Holiday`;
  }

  if (type === 'class_test') {
    let examName = '';
    if (typeof item.announcement === 'string') {
      try {
        const parsed = JSON.parse(item.announcement);
        examName = (parsed.exam_name || '').trim();
      } catch (e) {}
    } else if (typeof item.announcement === 'object' && item.announcement !== null) {
      examName = (item.announcement.exam_name || '').trim();
    }
    if (!examName && item.exam_name) {
      examName = item.exam_name.trim();
    }
    if (!examName) {
      const stripped = rawTitle.replace(/^(Class Test|Exam|Quiz|Assessment)\s*[:\-–—]\s*/i, '').trim();
      if (stripped && stripped !== subject) examName = stripped;
    }

    if (examName && !/^class test$/i.test(examName)) {
      if (subject) {
        if (examName.toLowerCase().includes(subject.toLowerCase())) {
          return examName;
        }
        return `${examName}: ${subject}`;
      }
      return examName;
    }

    if (subject) {
      return `${subject} Assessment`;
    }
    return 'Class Assessment';
  }

  if (type === 'rescheduled') {
    if (subject) return `Rescheduled: ${subject}`;
    return rawTitle || 'Rescheduled Class';
  }

  if (type === 'assignment') {
    let taskTitle = '';
    if (typeof item.announcement === 'string') {
      try {
        const parsed = JSON.parse(item.announcement);
        taskTitle = (parsed.task_title || '').trim();
      } catch (e) {}
    } else if (typeof item.announcement === 'object' && item.announcement !== null) {
      taskTitle = (item.announcement.task_title || '').trim();
    }
    if (taskTitle) {
      return subject ? `${taskTitle}: ${subject}` : taskTitle;
    }
    return subject ? `Due: ${subject}` : (rawTitle || 'Assignment Deadline');
  }

  return rawTitle;
}

/**
 * Validates and sanitizes the full announcement payload.
 * Ensures class_test and online_class structured JSON round-trips cleanly without data loss.
 * @param {Object} rawData
 * @returns {{ valid: boolean, error?: string, sanitized?: Object }}
 */
export function validateAnnouncementPayload(rawData = {}) {
  const type = rawData.type || 'general';
  const nameCheck = validateField(rawData.name, ANNOUNCEMENT_LIMITS.AUTHOR_NAME, 'Your Name / Author', true);
  if (!nameCheck.valid) return { valid: false, error: nameCheck.error };

  const sanitized = {
    ...rawData,
    type,
    name: nameCheck.cleaned
  };

  if (type === 'general') {
    const titleCheck = validateField(rawData.title, ANNOUNCEMENT_LIMITS.TITLE, 'Announcement Title', true);
    if (!titleCheck.valid) return { valid: false, error: titleCheck.error };

    const content = collapseNewlines(rawData.announcement || '');
    if (!content) {
      return { valid: false, error: 'Announcement Content is required and cannot be empty.' };
    }

    sanitized.title = titleCheck.cleaned;
    sanitized.announcement = content;
    sanitized.subject = cleanString(rawData.subject || '');

  } else if (type === 'cancellation') {
    if (!cleanString(rawData.date_override)) {
      return { valid: false, error: 'Cancellation Date is required.' };
    }
    const subj = cleanString(rawData.subject_override || rawData.subject);
    if (!subj) {
      return { valid: false, error: 'Subject to cancel is required.' };
    }
    sanitized.title = formatAnnouncementTitle({ type: 'cancellation', subject_override: subj, title: rawData.title });
    sanitized.announcement = collapseNewlines(rawData.announcement || '');

  } else if (type === 'holiday') {
    if (!cleanString(rawData.date_override)) {
      return { valid: false, error: 'Holiday Date is required.' };
    }
    let holidayName = '';
    if (rawData.holiday_name) {
      const holCheck = validateField(rawData.holiday_name, ANNOUNCEMENT_LIMITS.HOLIDAY_NAME, 'Holiday Name / Reason', false);
      if (!holCheck.valid) return { valid: false, error: holCheck.error };
      holidayName = holCheck.cleaned;
      sanitized.holiday_name = holidayName;
    }
    sanitized.title = formatAnnouncementTitle({ type: 'holiday', holiday_name: holidayName, title: rawData.title });
    sanitized.announcement = collapseNewlines(rawData.announcement || '');

  } else if (type === 'online_class') {
    if (!cleanString(rawData.date_override)) {
      return { valid: false, error: 'Class Date is required.' };
    }
    const subj = cleanString(rawData.subject_override || rawData.subject);
    if (!subj) {
      return { valid: false, error: 'Subject is required.' };
    }

    let parsedPayload = {};
    if (typeof rawData.announcement === 'string') {
      try {
        parsedPayload = JSON.parse(rawData.announcement);
      } catch (e) {
        parsedPayload = { platform: rawData.announcement };
      }
    } else if (typeof rawData.announcement === 'object' && rawData.announcement !== null) {
      parsedPayload = rawData.announcement;
    }

    const platformRaw = parsedPayload.platform || rawData.platform || '';
    const platformCheck = validateField(platformRaw, ANNOUNCEMENT_LIMITS.PLATFORM_LINK, 'Platform / Join Link', false);
    if (!platformCheck.valid) return { valid: false, error: platformCheck.error };

    const isExtra = Boolean(parsedPayload.is_extra_class || rawData.is_extra_class);
    const isOnline = parsedPayload.is_online !== undefined ? Boolean(parsedPayload.is_online) : (rawData.is_online !== undefined ? Boolean(rawData.is_online) : true);

    const startTimeStr = cleanString(parsedPayload.start_time || rawData.start_time || '09:45 AM');
    const endTimeStr = cleanString(parsedPayload.end_time || rawData.end_time || '');

    const structuredObj = {
      is_extra_class: isExtra,
      is_online: isOnline,
      platform: platformCheck.cleaned,
      start_time: startTimeStr,
      end_time: endTimeStr,
      room: cleanString(parsedPayload.room || rawData.room || ''),
      teacher: cleanString(parsedPayload.teacher || rawData.teacher || '')
    };
    const structuredAnnouncement = JSON.stringify(structuredObj);

    sanitized.title = formatAnnouncementTitle({
      type: 'online_class',
      subject_override: subj,
      is_online: isOnline,
      announcement: structuredObj,
      title: rawData.title
    });
    sanitized.announcement = structuredAnnouncement;

  } else if (type === 'class_test') {
    if (!cleanString(rawData.date_override)) {
      return { valid: false, error: 'Exam / Class Test Date is required.' };
    }
    const subj = cleanString(rawData.subject_override || rawData.subject);
    if (!subj) {
      return { valid: false, error: 'Exam Subject is required.' };
    }

    let parsedPayload = {};
    if (typeof rawData.announcement === 'string') {
      try {
        parsedPayload = JSON.parse(rawData.announcement);
      } catch (e) {
        parsedPayload = { exam_name: rawData.announcement, topics: '' };
      }
    } else if (typeof rawData.announcement === 'object' && rawData.announcement !== null) {
      parsedPayload = rawData.announcement;
    }

    const examNameRaw = parsedPayload.exam_name || rawData.exam_name || 'Class Test';
    const examCheck = validateField(examNameRaw, ANNOUNCEMENT_LIMITS.EXAM_NAME, 'Exam / Test Name', true);
    if (!examCheck.valid) return { valid: false, error: examCheck.error };

    const topicsRaw = collapseNewlines(parsedPayload.topics || rawData.topics || '');
    const topicsCheck = validateField(topicsRaw, ANNOUNCEMENT_LIMITS.TOPICS, 'Syllabus / Topics', false);
    if (!topicsCheck.valid) return { valid: false, error: topicsCheck.error };

    const structuredAnnouncement = JSON.stringify({
      exam_name: examCheck.cleaned,
      topics: topicsCheck.cleaned || 'Not Specified'
    });

    sanitized.title = formatAnnouncementTitle({
      type: 'class_test',
      exam_name: examCheck.cleaned,
      subject_override: subj,
      title: rawData.title
    });
    sanitized.announcement = structuredAnnouncement;

  } else if (type === 'rescheduled') {
    let parsedPayload = {};
    if (typeof rawData.announcement === 'string') {
      try { parsedPayload = JSON.parse(rawData.announcement); } catch (e) {}
    } else if (typeof rawData.announcement === 'object' && rawData.announcement !== null) {
      parsedPayload = rawData.announcement;
    }

    const origDate = cleanString(parsedPayload.original_date || rawData.date_override);
    if (!origDate) {
      return { valid: false, error: 'Original Scheduled Date is required.' };
    }

    const newDate = cleanString(parsedPayload.new_date || rawData.new_date || origDate);
    if (!newDate) {
      return { valid: false, error: 'New Scheduled Date is required.' };
    }

    const subj = cleanString(parsedPayload.target_subject || rawData.subject_override || rawData.subject);
    if (!subj) {
      return { valid: false, error: 'Class to reschedule is required.' };
    }

    const newStart = cleanString(parsedPayload.new_start_time || rawData.new_start_time || '03:00 PM');
    const origStart = cleanString(parsedPayload.original_start_time || rawData.original_start_time || '');
    const origRoom = cleanString(parsedPayload.original_room || rawData.original_room || '');
    const newRoom = cleanString(parsedPayload.new_room || rawData.new_room || '');
    const reasonRaw = collapseNewlines(parsedPayload.reason || rawData.reason || '');
    const reasonCheck = validateField(reasonRaw, ANNOUNCEMENT_LIMITS.REASON, 'Reason / Instructions', false);
    if (!reasonCheck.valid) return { valid: false, error: reasonCheck.error };

    const structuredObj = {
      target_subject: subj,
      original_date: origDate,
      original_start_time: origStart,
      original_room: origRoom,
      new_date: newDate,
      new_start_time: newStart,
      new_room: newRoom,
      reason: reasonCheck.cleaned
    };

    sanitized.title = `Rescheduled: ${subj}`;
    sanitized.date_override = origDate;
    sanitized.subject_override = subj;
    sanitized.announcement = JSON.stringify(structuredObj);

  } else if (type === 'assignment') {
    if (!cleanString(rawData.date_override)) {
      return { valid: false, error: 'Due Date is required.' };
    }
    const subj = cleanString(rawData.subject_override || rawData.subject);
    if (!subj) {
      return { valid: false, error: 'Course / Subject is required.' };
    }

    let parsedPayload = {};
    if (typeof rawData.announcement === 'string') {
      try { parsedPayload = JSON.parse(rawData.announcement); } catch (e) {}
    } else if (typeof rawData.announcement === 'object' && rawData.announcement !== null) {
      parsedPayload = rawData.announcement;
    }

    const taskTitleRaw = parsedPayload.task_title || rawData.task_title || 'Assignment';
    const taskTitleCheck = validateField(taskTitleRaw, ANNOUNCEMENT_LIMITS.TASK_TITLE, 'Task Title', true);
    if (!taskTitleCheck.valid) return { valid: false, error: taskTitleCheck.error };

    const dueTime = cleanString(parsedPayload.due_time || rawData.due_time || '11:59 PM');

    const descRaw = collapseNewlines(parsedPayload.description || rawData.description || '');
    const descCheck = validateField(descRaw, ANNOUNCEMENT_LIMITS.ASSIGNMENT_DESC, 'Notes / Submission Info', false);
    if (!descCheck.valid) return { valid: false, error: descCheck.error };

    const structuredObj = {
      subject: subj,
      task_title: taskTitleCheck.cleaned,
      due_date: cleanString(rawData.date_override),
      due_time: dueTime,
      description: descCheck.cleaned
    };

    sanitized.title = `${taskTitleCheck.cleaned}: ${subj}`;
    sanitized.date_override = cleanString(rawData.date_override);
    sanitized.subject_override = subj;
    sanitized.announcement = JSON.stringify(structuredObj);
  }

  return { valid: true, sanitized };
}