import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { DAY_NAMES, FULL_COURSE_NAMES } from '../core/config.js';
import { getClassesForDay, getEffectiveClassesForDay } from '../schedule/queries.js';
import { getOverrideFor, getOverridesByDateMap, normalizeDate, getDateForDayIndex, getExtraClassesForDate, getRescheduledClassesForDate, getDeadlinesForDate } from '../announcements/overrides.js';
import { toMinutes, format12h, toTimeString, getCurrentMinutes, escapeHtml, formatRoom } from '../core/utils.js';
import { getFullName } from '../teachers/teacher-names.js';
import { Storage } from '../storage/storage.js';

let _lastRenderHash = '';

const OVERRIDE_ICONS = {
  cancellation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  holiday: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  class_test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  online_class: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>',
  rescheduled: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  assignment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>'
};

export function renderWeekStrip() {
  const container = document.getElementById('focalStripContainer');
  if (!container) return;

  const realToday = new Date();
  const realTodayIdx = realToday.getDay();

  const anchorDate = State.viewDate || realToday;
  const anchorDayIdx = anchorDate.getDay();

  // Academic week rolls over on Thursday (Thu=4, Fri=5, Sat=6, Sun=0, Mon=1, Tue=2, Wed=3)
  const academicDaysOrder = [4, 5, 6, 0, 1, 2, 3];
  const thuOffset = (anchorDayIdx - 4 + 7) % 7;
  const weekStartThu = new Date(anchorDate);
  weekStartThu.setDate(anchorDate.getDate() - thuOffset);

  const short3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const overridesMap = getOverridesByDateMap();

  let html = '';
  academicDaysOrder.forEach((dow, index) => {
    const d = new Date(weekStartThu);
    d.setDate(weekStartThu.getDate() + index);

    const isSelected = (dow === State.currentViewDayIdx);
    const isToday = (dow === realTodayIdx && d.getFullYear() === realToday.getFullYear() && d.getMonth() === realToday.getMonth() && d.getDate() === realToday.getDate());
    const isOffDay = (dow === 4 || dow === 5);

    const dateStr = normalizeDate(d);
    const override = overridesMap.get(dateStr);
    const isHoliday = override && override.type === 'holiday';
    const isOnlineClass = override && override.type === 'online_class';

    // Calculate actual effective class count for this specific date (with cancellations, extras, and reschedules)
    const activeClasses = getEffectiveClassesForDay(dow, d);
    const classCount = activeClasses.length;

    // Subtext label logic
    let subText = '';
    if (isHoliday) {
      subText = ''; // No class count and no "Holiday" text label (icon + box color communicates status)
    } else if (isOffDay) {
      if (isOnlineClass && classCount > 0) {
        subText = `${classCount} ${classCount === 1 ? 'class' : 'classes'}`; // Suppress 'Off Day' if online class exists
      } else {
        subText = 'Off Day';
      }
    } else {
      subText = `${classCount} ${classCount === 1 ? 'class' : 'classes'}`;
    }

    const overrideClass = override ? `override-${override.type}` : '';
    const isEffectiveOffDay = isOffDay && !isOnlineClass;

    if (isSelected) {
      const focalBadge = override ? `<span class="focal-override-badge ${override.type}" title="${override.type.replace('_', ' ')}">${OVERRIDE_ICONS[override.type] || ''}</span>` : '';
      html += `
        <div class="focal-day-card ${overrideClass}" onclick="if(window.openCalendarPicker) window.openCalendarPicker();" title="${DAY_NAMES[dow]} (Tap to change date)">
          ${focalBadge}
          <span class="focal-num-large">${d.getDate()}</span>
          <div class="focal-meta">
            <span class="focal-day-label">${DAY_NAMES[dow]}</span>
            ${subText ? `<span class="focal-day-sub">${subText}</span>` : ''}
          </div>
        </div>
      `;
    } else {
      const satelliteBadge = override ? `<span class="satellite-override-badge ${override.type}" title="${override.type.replace('_', ' ')}">${OVERRIDE_ICONS[override.type] || ''}</span>` : '';
      html += `
        <div class="satellite-pill ${overrideClass} ${isEffectiveOffDay ? 'off-day' : ''} ${isToday ? 'is-real-today' : ''}" onclick="window.__switchTimelineDay(${dow}, ${d.getTime()})" title="${DAY_NAMES[dow]}${override ? ` (${override.type.replace('_', ' ')})` : ''}">
          ${satelliteBadge}
          <span class="satellite-name">${short3[dow]}</span>
          <span class="satellite-num">${d.getDate()}</span>
          ${isToday ? '<span class="today-subtle-dot" title="Today"></span>' : ''}
        </div>
      `;
    }
  });

  container.innerHTML = html;
}

window.__switchTimelineDay = function(dayIdx, timestamp) {
  State.currentViewDayIdx = dayIdx;
  if (timestamp) {
    State.viewDate = new Date(timestamp);
  }
  renderTimeline(true);
};

export function renderTimeline(force = false) {
  window.renderTimeline = renderTimeline;
  if (!DOM.timelineGrid) DOM.timelineGrid = document.getElementById('chG');
  if (!DOM.timelineTitle) DOM.timelineTitle = document.getElementById('timelineTitle');
  if (!DOM.timelineSubtitle) DOM.timelineSubtitle = document.getElementById('timelineSubtitle');

  renderWeekStrip();

  const classes = getClassesForDay(State.currentViewDayIdx);
  const currentMins = getCurrentMinutes();
  const realTodayIdx = new Date().getDay();
  const isToday = State.currentViewDayIdx === realTodayIdx;
  const isOffDay = (State.currentViewDayIdx === 4 || State.currentViewDayIdx === 5);

  // Skip redundant re-renders: same day + same minute = identical output
  const renderHash = `${State.currentViewDayIdx}:${isToday ? currentMins : -1}:${classes.length}`;
  if (!force && renderHash === _lastRenderHash) return;
  _lastRenderHash = renderHash;

  // Update section titles
  const titleText = isToday ? `Today's Schedule` : `${DAY_NAMES[State.currentViewDayIdx]} Schedule`;
  const subText = isOffDay ? 'OFF DAY' : `${classes.length} ${classes.length === 1 ? 'SESSION' : 'SESSIONS'}`;
  
  if (DOM.timelineTitle) DOM.timelineTitle.textContent = titleText;
  if (DOM.timelineSubtitle) DOM.timelineSubtitle.textContent = subText;

  // Check holiday override for the day
  const holidayOverride = getOverrideFor(State.currentViewDayIdx);
  if (holidayOverride && holidayOverride.type === 'holiday') {
    const hasOnlineClasses = classes.some(c => {
      const ov = getOverrideFor(State.currentViewDayIdx, c.title);
      return ov && ov.type === 'online_class';
    });

    if (!hasOnlineClasses) {
      if (DOM.timelineGrid) {
        DOM.timelineGrid.innerHTML = `
          <div class="off-day-card">
            <span class="off-day-icon">🎉</span>
            <div class="off-day-title">Holiday / Day Off</div>
            <div style="font-size: 13px; font-weight: 700; color: var(--accent); margin: 2px 0;">${escapeHtml(holidayOverride.announcement.title)}</div>
            <div class="off-day-desc">${escapeHtml(holidayOverride.announcement.announcement)}</div>
          </div>
        `;
      }
      return;
    }
  }

  // Process extra classes, rescheduled classes, and deadlines for the current view day
  const extraClassesList = getExtraClassesForDate(State.currentViewDayIdx);
  const rescheduledIncoming = getRescheduledClassesForDate(State.currentViewDayIdx);
  const deadlinesList = getDeadlinesForDate(State.currentViewDayIdx);

  // Clone classes array to avoid mutating global schedule
  let allScheduleClasses = classes.map(c => ({ ...c }));

function findInstructorForSubject(subj) {
  if (!subj) return '';
  const cleanSubj = subj.toUpperCase().trim();
  if (State.schedule) {
    for (const day in State.schedule) {
      const list = State.schedule[day] || [];
      const match = list.find(c => (c.title || c.subject || '').toUpperCase().trim() === cleanSubj);
      if (match && (match.instructor || match.teacher)) {
        return (match.instructor || match.teacher).trim();
      }
    }
  }
  return '';
}

  // Inject net-new extra classes
  extraClassesList.forEach(item => {
    let parsed = {};
    try { parsed = JSON.parse(item.announcement); } catch (e) {}
    const subj = item.subject_override || item.subject || 'Extra Class';
    const startStr = parsed.start_time || '09:45 AM';
    const startM = toMinutes(startStr);
    const endM = startM >= 0 ? startM + 75 : -1;
    const isOnline = (parsed.is_online === false || /extra class/i.test(item.title || '')) 
      ? false 
      : (parsed.is_online !== undefined ? Boolean(parsed.is_online) : true);
    const room = parsed.room || (isOnline ? 'Online' : 'TBA');
    const teacher = (parsed.teacher || '').trim() || findInstructorForSubject(subj);
    allScheduleClasses.push({
      start: startStr,
      end: '',
      startM: startM,
      endM: endM,
      hasExplicitEndTime: false,
      subject: subj,
      title: subj,
      room: room,
      teacher: teacher,
      instructor: teacher,
      type: 'Theory',
      isExtraClass: true,
      isOnline: isOnline,
      platform: parsed.platform || ''
    });
  });

  // Inject incoming rescheduled classes on destination date
  rescheduledIncoming.forEach(item => {
    let parsed = {};
    if (typeof item.announcement === 'string') {
      try { parsed = JSON.parse(item.announcement); } catch (e) {}
    } else if (typeof item.announcement === 'object' && item.announcement !== null) {
      parsed = item.announcement;
    }
    const subj = parsed.target_subject || item.subject_override || item.subject || 'Rescheduled Class';
    const startStr = format12h(parsed.new_start_time || '03:00 PM');
    const startM = toMinutes(startStr);
    const endM = startM >= 0 ? startM + 75 : -1;
    const room = parsed.new_room || parsed.original_room || 'TBA';
    const teacher = (parsed.teacher || '').trim() || findInstructorForSubject(subj);
    allScheduleClasses.push({
      start: startStr,
      end: '',
      startM: startM,
      endM: endM,
      hasExplicitEndTime: false,
      subject: subj,
      title: subj,
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

  // Process rescheduled classes & create ghost strips for original time slots (on original date)
  const ghostStrips = [];
  if (State.announcementsList && State.announcementsList.length > 0) {
    const targetDateStr = getDateForDayIndex(State.currentViewDayIdx);
    State.announcementsList.forEach(item => {
      if (item.type !== 'rescheduled') return;
      let parsed = {};
      if (typeof item.announcement === 'string') {
        try { parsed = JSON.parse(item.announcement); } catch (e) {}
      } else if (typeof item.announcement === 'object' && item.announcement !== null) {
        parsed = item.announcement;
      }
      const origDateStr = normalizeDate(parsed.original_date || item.date_override);
      if (origDateStr !== targetDateStr) return;

      const targetSubj = (parsed.target_subject || item.subject_override || item.subject || '').toUpperCase().trim();
      const targetClassIdx = allScheduleClasses.findIndex(c => (c.title || c.subject || '').toUpperCase().trim() === targetSubj && !c.isRescheduled);
      const targetClass = targetClassIdx >= 0 ? allScheduleClasses[targetClassIdx] : null;

      // Remove original routine class from this day
      if (targetClassIdx >= 0) {
        allScheduleClasses.splice(targetClassIdx, 1);
      }

      const rawOrigStart = parsed.original_start_time || targetClass?.start || '09:45 AM';
      const origStart = format12h(rawOrigStart);
      const newStart = format12h(parsed.new_start_time || '03:00 PM');
      const newDateStr = parsed.new_date || '';
      let formattedNewDate = newDateStr;
      if (newDateStr) {
        const [ny, nm, nd] = newDateStr.split('-').map(Number);
        if (ny && nm && nd) {
          const dObj = new Date(ny, nm - 1, nd);
          const dNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          formattedNewDate = `${dNames[dObj.getDay()]}, ${mNames[dObj.getMonth()]} ${nd}`;
        }
      }

      ghostStrips.push({
        type: 'ghost_strip',
        subject: parsed.target_subject || item.subject_override || item.subject || 'Class',
        origStart: origStart,
        sortM: toMinutes(origStart),
        newDate: newDateStr,
        formattedNewDate: formattedNewDate,
        newStart: newStart
      });
    });
  }

  // Build items array to render chronologically
  const renderItems = [];

  allScheduleClasses.forEach(c => {
    renderItems.push({
      kind: 'class',
      sortM: toMinutes(c.start),
      data: c
    });
  });

  ghostStrips.forEach(g => {
    renderItems.push({
      kind: 'ghost_strip',
      sortM: g.sortM,
      data: g
    });
  });

  deadlinesList.forEach(d => {
    let parsed = {};
    try { parsed = JSON.parse(d.announcement); } catch (e) {}
    renderItems.push({
      kind: 'deadline',
      sortM: toMinutes(parsed.due_time || '23:59'),
      data: {
        subject: d.subject_override || d.subject || parsed.subject || 'Assignment',
        taskTitle: parsed.task_title || 'Assignment',
        dueTime: parsed.due_time || '11:59 PM',
        description: parsed.description || d.announcement || ''
      }
    });
  });

  // Sort all items chronologically
  renderItems.sort((a, b) => a.sortM - b.sortM);

  if (!renderItems.length) {
    if (DOM.timelineGrid) {
      DOM.timelineGrid.innerHTML = `
        <div class="off-day-card">
          <span class="off-day-icon">🌴</span>
          <div class="off-day-title">No Classes Scheduled</div>
          <div class="off-day-desc">Enjoy your restful break! Recharge and prepare for your upcoming sessions.</div>
        </div>
      `;
    }
    return;
  }

  let html = '';
  let lastEndMins = null;

  renderItems.forEach((item) => {
    if (item.kind === 'ghost_strip') {
      const g = item.data;
      const destinationText = g.newDate && g.formattedNewDate ? `moved to ${escapeHtml(g.formattedNewDate)}` : 'moved to new slot';
      html += `
        <div class="timeline-ghost-strip ${g.newDate ? 'tappable' : ''}" ${g.newDate ? `onclick="if(window.navigateToDate) window.navigateToDate('${escapeHtml(g.newDate)}');"` : ''} title="${g.newDate ? `Tap to jump to ${escapeHtml(g.formattedNewDate)}` : ''}">
          <div class="timeline-ghost-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${escapeHtml(g.subject)} ${destinationText}</span>
          </div>
          <span class="timeline-ghost-badge">
            <span>${escapeHtml(g.newStart)}</span>
            ${g.newDate ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>' : ''}
          </span>
        </div>
      `;
      return;
    }

    if (item.kind === 'deadline') {
      const d = item.data;
      html += `
        <div class="timeline-deadline-banner">
          <div class="timeline-deadline-left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            <span>${escapeHtml(d.taskTitle)}: ${escapeHtml(d.subject)}</span>
          </div>
          <span class="timeline-deadline-time">Due ${escapeHtml(d.dueTime)}</span>
        </div>
      `;
      return;
    }

    const c = item.data;
    const hasExplicitEndTime = Boolean(c.hasExplicitEndTime) || (Boolean(c.end) && !c.isExtraClass);
    const startMins = toMinutes(c.start);
    const endMins = hasExplicitEndTime ? toMinutes(c.end) : (startMins >= 0 ? startMins + 75 : -1);
    const durationMins = hasExplicitEndTime ? Math.max(0, endMins - startMins) : 0;
    const durHours = Math.floor(durationMins / 60);
    const durMinsRemainder = durationMins % 60;
    const durationLabel = hasExplicitEndTime ? (durHours > 0 ? (durMinsRemainder > 0 ? `${durHours}h ${durMinsRemainder}m` : `${durHours}h`) : `${durMinsRemainder}m`) : '';
    const fullTiming = hasExplicitEndTime ? `${format12h(c.start)} – ${format12h(c.end)}` : `Starts at ${format12h(c.start)}`;
    const isLab = (c.type || '').toLowerCase() === 'lab';

    // Insert break card between non-contiguous classes (only when startMins > lastEndMins)
    const isOverlap = lastEndMins !== null && startMins < lastEndMins;
    if (lastEndMins !== null && startMins > lastEndMins) {
      const breakDuration = startMins - lastEndMins;
      const breakTiming = `${format12h(toTimeString(lastEndMins))} – ${format12h(toTimeString(startMins))}`;
      html += `
        <div class="break-transition-strip">
          <div class="break-left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
            <span>Cafeteria Recharge</span>
          </div>
          <span class="break-time-badge">${breakTiming} &bull; ${breakDuration}m</span>
        </div>
      `;
    }
    if (lastEndMins === null || endMins > lastEndMins) {
      lastEndMins = endMins;
    }

    // Check cancellation & active states
    const cancelOverride = getOverrideFor(State.currentViewDayIdx, c.title);
    const isCancelled = cancelOverride && cancelOverride.type === 'cancellation';
    const isOnline = c.isExtraClass
      ? Boolean(c.isOnline)
      : (Boolean(c.isOnline) || (cancelOverride && cancelOverride.type === 'online_class'));
    const isClassTest = Boolean(c.isExam) || (cancelOverride && cancelOverride.type === 'class_test');
    const isHolidayCancelled = !isOnline && !isCancelled && holidayOverride && holidayOverride.type === 'holiday';
    const effectiveCancelled = isCancelled || isHolidayCancelled;

    let examName = 'Exam';
    let examTopics = '';
    let onlinePlatform = c.platform || '';
    let cancelReason = '';

    if (cancelOverride && cancelOverride.announcement) {
      const ann = cancelOverride.announcement;
      if (isClassTest) {
        try {
          const parsed = JSON.parse(ann.announcement);
          examName = parsed.exam_name || 'Class Test';
          examTopics = parsed.topics || '';
        } catch (e) {
          examName = ann.title ? ann.title.split(':')[0] : 'Class Test';
          examTopics = ann.announcement || '';
        }
      } else if (isOnline) {
        try {
          const parsed = JSON.parse(ann.announcement);
          onlinePlatform = parsed.platform || onlinePlatform;
        } catch (e) {
          onlinePlatform = ann.announcement || onlinePlatform;
        }
      } else if (isCancelled) {
        cancelReason = ann.announcement || 'Class cancelled for this date';
      }
    }

    const isActive = isToday && currentMins >= startMins && currentMins < endMins && !effectiveCancelled;
    const isPast = isToday && endMins <= currentMins;

    const teacherCode = (c.teacher || c.instructor || '').trim() || findInstructorForSubject(c.title);
    const teacherFullName = getFullName(teacherCode) || teacherCode || 'TBA';
    const cleanRoom = isOnline ? 'Online' : formatRoom(c.room);

    const detailsData = {
      title: c.title,
      code: c.title,
      name: FULL_COURSE_NAMES[c.title] || c.title,
      start: format12h(c.start),
      end: hasExplicitEndTime ? format12h(c.end) : '',
      hasExplicitEndTime: hasExplicitEndTime,
      timing: fullTiming,
      duration: durationLabel,
      type: isLab ? 'Lab' : 'Theory',
      room: cleanRoom || 'TBA',
      instructor: teacherCode || 'TBA',
      teacher: teacherCode || 'TBA',
      instructorName: teacherFullName,
      isExam: isClassTest,
      examName: examName,
      examTopics: examTopics,
      isOnline: isOnline,
      onlinePlatform: onlinePlatform,
      isCancelled: effectiveCancelled,
      cancelReason: cancelReason,
      isRescheduled: !!c.isRescheduled,
      rescheduledReason: c.rescheduledReason || '',
      origDate: c.origDate || '',
      origStart: c.origStart || '',
      isLive: isActive,
      isPast: isPast,
      dayName: DAY_NAMES[State.currentViewDayIdx],
      dayIdx: State.currentViewDayIdx,
      semSec: c.semSec || '',
      semester: c.semester || Storage.getSemester(),
      section: (c.section || Storage.getSection() || '').toUpperCase(),
      isFromTimeline: true
    };

    const detailsJson = escapeHtml(JSON.stringify(detailsData));

    // Dynamic Card Styling Classes & Badges
    let cardModifierClass = '';
    let titleHtml = escapeHtml(c.title);
    let tagHtml = `<span class="resting-tag ${isLab ? 'lab' : 'theory'}">${isLab ? '★ LAB' : 'THEORY'}</span>`;
    let subMetaHtml = '';

    if (c.isRescheduled) {
      cardModifierClass = 'is-rescheduled-override';
      tagHtml = `<span class="resting-tag rescheduled">RESCHEDULED</span>`;
      if (c.rescheduledReason) {
        subMetaHtml = `
          <div class="meta-line-item rescheduled-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${escapeHtml(c.rescheduledReason)}</span>
          </div>
        `;
      }
    } else if (c.isExtraClass) {
      if (isOnline) {
        cardModifierClass = 'is-online-override';
        tagHtml = `<span class="resting-tag online">ONLINE</span>`;
      } else {
        cardModifierClass = 'is-extra-override';
        tagHtml = `<span class="resting-tag extra">EXTRA CLASS</span>`;
      }
    } else if (isClassTest) {
      cardModifierClass = 'is-exam-override';
      titleHtml = `${escapeHtml(c.title)} <span class="override-indicator exam">(EXAM)</span>`;
      tagHtml = `<span class="resting-tag exam">${escapeHtml(examName.toUpperCase())}</span>`;
      if (examTopics) {
        subMetaHtml = `
          <div class="meta-line-item exam-topics">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>${escapeHtml(examTopics)}</span>
          </div>
        `;
      }
    } else if (isOnline) {
      cardModifierClass = 'is-online-override';
      tagHtml = `<span class="resting-tag online">ONLINE</span>`;
    } else if (effectiveCancelled) {
      cardModifierClass = 'is-cancelled-override';
    }

    // 1. Live Hero Card
    if (isActive) {
      const elapsed = currentMins - startMins;
      const remaining = Math.max(0, durationMins - elapsed);
      html += `
        <div class="resting-class-row is-live-card ${cardModifierClass}" onclick='window.openClassDetailSheet(${detailsJson})' style="border-color: var(--accent); background: var(--card-bg);">
          <div class="resting-left">
            <div class="resting-time-col ${hasExplicitEndTime ? '' : 'single-time'}">
              ${hasExplicitEndTime ? `
                <div class="time-connector-track">
                  <span class="time-node-dot start"></span>
                  <span class="time-connector-line"></span>
                  <span class="time-node-dot"></span>
                </div>
              ` : ''}
              <span class="resting-time-start" style="color: var(--accent);">${format12h(c.start)}</span>
              ${hasExplicitEndTime ? `<span class="resting-time-end">${format12h(c.end)}</span>` : ''}
            </div>
            <div class="resting-info-col">
              <div class="resting-title-row">
                <span class="resting-code">${titleHtml}</span>
                ${tagHtml}
              </div>
              <div class="card-meta-stacked">
                <div class="meta-line-item room">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>Room ${cleanRoom || 'TBA'}</span>
                </div>
                <div class="meta-line-item instructor">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>${escapeHtml(teacherFullName)}</span>
                </div>
                ${subMetaHtml}
              </div>
            </div>
          </div>
          <div class="resting-right-meta">
            ${hasExplicitEndTime ? `
              <span class="finished-check-badge" style="background: var(--accent-subtle); color: var(--accent); border-color: var(--accent-border);">
                ${remaining}m left
              </span>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      // 2. Resting Class Row
      html += `
        <div class="resting-class-row ${cardModifierClass} ${effectiveCancelled ? 'cancelled' : ''}" onclick='window.openClassDetailSheet(${detailsJson})'>
          <div class="resting-left">
            <div class="resting-time-col ${hasExplicitEndTime ? '' : 'single-time'}">
              ${hasExplicitEndTime ? `
                <div class="time-connector-track">
                  <span class="time-node-dot start"></span>
                  <span class="time-connector-line"></span>
                  <span class="time-node-dot"></span>
                </div>
              ` : ''}
              <span class="resting-time-start">${format12h(c.start)}</span>
              ${hasExplicitEndTime ? `<span class="resting-time-end">${format12h(c.end)}</span>` : ''}
            </div>
            <div class="resting-info-col">
              <div class="resting-title-row">
                <span class="resting-code">${titleHtml}</span>
                ${tagHtml}
              </div>
              <div class="card-meta-stacked">
                <div class="meta-line-item room">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>Room ${cleanRoom || 'TBA'}</span>
                </div>
                <div class="meta-line-item instructor">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>${escapeHtml(teacherFullName)}</span>
                </div>
                ${subMetaHtml}
              </div>
            </div>
          </div>
          <div class="resting-right-meta">
            ${effectiveCancelled ? `
              <span class="finished-check-badge cancelled" style="background: rgba(244, 63, 94, 0.12); color: #FDA4AF; border: 1px solid rgba(244, 63, 94, 0.3);">
                CANCELLED
              </span>
            ` : isPast ? `
              <span class="finished-check-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                DONE
              </span>
            ` : durationLabel ? `
              <span class="duration-chip">${durationLabel}</span>
            ` : ''}
          </div>
        </div>
      `;
    }
  });

  if (DOM.timelineGrid) {
    DOM.timelineGrid.innerHTML = html;
  }
}

