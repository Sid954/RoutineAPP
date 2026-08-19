import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG, DAY_NAMES, DAY_SHORT, FULL_COURSE_NAMES } from '../core/config.js';
import { getClassesForDay } from '../schedule/queries.js';
import { getOverrideFor } from '../announcements/overrides.js';
import { toMinutes, format12h, toTimeString, getCurrentMinutes, escapeHtml, formatRoom } from '../core/utils.js';
import { getFullName } from '../teachers/teacher-names.js';
import { showClassDetails } from './class-detail.js';

let _lastRenderHash = '';

export function renderWeekStrip() {
  const container = document.getElementById('focalStripContainer');
  if (!container) return;

  const realToday = new Date();
  const realTodayIdx = realToday.getDay();

  const anchorDate = State.viewDate || realToday;
  const anchorDayIdx = anchorDate.getDay();

  // Academic week starts on Saturday (Sat=6, Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5)
  const academicDaysOrder = [6, 0, 1, 2, 3, 4, 5];
  const satOffset = (anchorDayIdx === 6) ? 0 : (anchorDayIdx + 1);
  const weekStartSat = new Date(anchorDate);
  weekStartSat.setDate(anchorDate.getDate() - satOffset);

  const short3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const short2 = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  let html = '';
  academicDaysOrder.forEach(dow => {
    const d = new Date(weekStartSat);
    const dayOffset = (dow === 6) ? 0 : (dow + 1);
    d.setDate(weekStartSat.getDate() + dayOffset);

    const isSelected = (dow === State.currentViewDayIdx);
    const isToday = (dow === realTodayIdx && d.getFullYear() === realToday.getFullYear() && d.getMonth() === realToday.getMonth() && d.getDate() === realToday.getDate());
    const isOffDay = (dow === 4 || dow === 5);
    const classes = getClassesForDay(dow);
    const classCount = classes.length;

    if (isSelected) {
      const subText = isOffDay ? 'Off Day' : `${classCount} ${classCount === 1 ? 'class' : 'classes'}`;
      html += `
        <div class="focal-day-card" onclick="if(window.openCalendarPicker) window.openCalendarPicker();" title="${DAY_NAMES[dow]} (Tap to change date)">
          <span class="focal-num-large">${d.getDate()}</span>
          <div class="focal-meta">
            <span class="focal-day-label">${DAY_NAMES[dow]}</span>
            <span class="focal-day-sub">${subText}</span>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="satellite-pill ${isOffDay ? 'off-day' : ''} ${isToday ? 'is-real-today' : ''}" onclick="window.__switchTimelineDay(${dow}, ${d.getTime()})" title="${DAY_NAMES[dow]}">
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

  if (!classes.length) {
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

  classes.forEach((c) => {
    const startMins = toMinutes(c.start);
    const endMins = toMinutes(c.end);
    const durationMins = endMins - startMins;
    const durHours = Math.floor(durationMins / 60);
    const durMinsRemainder = durationMins % 60;
    const durationLabel = durHours > 0 ? (durMinsRemainder > 0 ? `${durHours}h ${durMinsRemainder}m` : `${durHours}h`) : `${durMinsRemainder}m`;
    const fullTiming = `${format12h(c.start)} – ${format12h(c.end)}`;
    const isLab = (c.type || '').toLowerCase() === 'lab';

    // Insert break card between non-contiguous classes
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
    lastEndMins = endMins;

    // Check cancellation & active states
    const cancelOverride = getOverrideFor(State.currentViewDayIdx, c.title);
    const isCancelled = cancelOverride && cancelOverride.type === 'cancellation';
    const isOnline = cancelOverride && cancelOverride.type === 'online_class';
    const isClassTest = c.isExam || (cancelOverride && cancelOverride.type === 'class_test');
    const isHolidayCancelled = !isOnline && !isCancelled && holidayOverride && holidayOverride.type === 'holiday';
    const effectiveCancelled = isCancelled || isHolidayCancelled;

    const isActive = isToday && currentMins >= startMins && currentMins < endMins && !effectiveCancelled;
    const isPast = isToday && endMins <= currentMins;

    const teacherCode = (c.teacher || c.instructor || '').trim();
    const teacherFullName = getFullName(teacherCode) || teacherCode || 'TBA';
    const cleanRoom = formatRoom(c.room);

    const detailsData = {
      title: c.title,
      code: c.title,
      name: FULL_COURSE_NAMES[c.title] || c.title,
      start: format12h(c.start),
      end: format12h(c.end),
      timing: fullTiming,
      duration: durationLabel,
      type: isLab ? 'Lab' : 'Theory',
      room: cleanRoom || 'TBA',
      instructor: teacherCode || 'TBA',
      teacher: teacherCode || 'TBA',
      instructorName: teacherFullName,
      isExam: isClassTest,
      isOnline: isOnline,
      isCancelled: effectiveCancelled,
      isLive: isActive,
      isPast: isPast
    };

    const detailsJson = escapeHtml(JSON.stringify(detailsData));

    // 1. Live Hero Card
    if (isActive) {
      const elapsed = currentMins - startMins;
      const remaining = Math.max(0, durationMins - elapsed);
      html += `
        <div class="resting-class-row is-live-card" onclick='window.openClassDetailSheet(${detailsJson})' style="border-color: var(--accent); background: var(--card-bg);">
          <div class="resting-left">
            <div class="resting-time-col">
              <div class="time-connector-track">
                <span class="time-node-dot start"></span>
                <span class="time-connector-line"></span>
                <span class="time-node-dot"></span>
              </div>
              <span class="resting-time-start" style="color: var(--accent);">${format12h(c.start)}</span>
              <span class="resting-time-end">${format12h(c.end)}</span>
            </div>
            <div class="resting-info-col">
              <div class="resting-title-row">
                <span class="resting-code">${escapeHtml(c.title)}</span>
                <span class="resting-tag ${isLab ? 'lab' : 'theory'}">${isLab ? '★ LAB' : 'THEORY'}</span>
              </div>
              <div class="card-meta-stacked">
                <div class="meta-line-item room">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>Room ${cleanRoom || 'TBA'}</span>
                </div>
                <div class="meta-line-item instructor">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>${escapeHtml(teacherCode || 'TBA')}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="resting-right-meta">
            <span class="finished-check-badge" style="background: var(--accent-subtle); color: var(--accent); border-color: var(--accent-border);">
              ${remaining}m left
            </span>
          </div>
        </div>
      `;
    } else {
      // 2. Solid Resting Card with Dotted Time Connector
      html += `
        <div class="resting-class-row ${isPast ? 'is-finished' : ''}" onclick='window.openClassDetailSheet(${detailsJson})'>
          <div class="resting-left">
            <div class="resting-time-col">
              <div class="time-connector-track">
                <span class="time-node-dot start"></span>
                <span class="time-connector-line"></span>
                <span class="time-node-dot"></span>
              </div>
              <span class="resting-time-start">${format12h(c.start)}</span>
              <span class="resting-time-end">${format12h(c.end)}</span>
            </div>
            <div class="resting-info-col">
              <div class="resting-title-row">
                <span class="resting-code">${escapeHtml(c.title)}</span>
                <span class="resting-tag ${isLab ? 'lab' : 'theory'}">${isLab ? '★ LAB' : 'THEORY'}</span>
              </div>
              <div class="card-meta-stacked">
                <div class="meta-line-item room">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>Room ${cleanRoom || 'TBA'}</span>
                </div>
                <div class="meta-line-item instructor">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>${escapeHtml(teacherCode || 'TBA')}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="resting-right-meta">
            ${isPast ? `
              <span class="finished-check-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                DONE
              </span>
            ` : `
              <span class="duration-chip">${durationLabel}</span>
            `}
          </div>
        </div>
      `;
    }
  });

  if (DOM.timelineGrid) {
    DOM.timelineGrid.innerHTML = html;
  }
}

