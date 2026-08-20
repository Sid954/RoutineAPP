/**
 * validation.js — Shared Validation, Character Limits & Anti-Abuse Formatting
 * Enforces field limits, whitespace trimming, and multi-line newline collapse.
 */

export const ANNOUNCEMENT_LIMITS = {
  AUTHOR_NAME: 15,
  TITLE: 15,
  HOLIDAY_NAME: 15,
  EXAM_NAME: 15,
  TOPICS: 50,
  PLATFORM_LINK: 100,
  FEED_COLLAPSE_CHARS: 50
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
      return { valid: false, error: 'Online class Date is required.' };
    }
    const subj = cleanString(rawData.subject_override || rawData.subject);
    if (!subj) {
      return { valid: false, error: 'Online class Subject is required.' };
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

    const structuredObj = {
      platform: platformCheck.cleaned,
      start_time: cleanString(parsedPayload.start_time || rawData.start_time || '09:45 AM')
    };
    if (parsedPayload.end_time && cleanString(parsedPayload.end_time)) {
      structuredObj.end_time = cleanString(parsedPayload.end_time);
    }
    const structuredAnnouncement = JSON.stringify(structuredObj);

    sanitized.title = formatAnnouncementTitle({ type: 'online_class', subject_override: subj, title: rawData.title });
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
  }

  return { valid: true, sanitized };
}