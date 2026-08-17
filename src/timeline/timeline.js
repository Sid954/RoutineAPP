import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG, DAY_NAMES, DAY_SHORT } from '../core/config.js';
import { getClassesForDay } from '../schedule/queries.js';
import { getOverrideFor } from '../announcements/overrides.js';
import { getSubjectTheme } from '../schedule/themes.js';
import { toMinutes, format12h, toTimeString, getCurrentMinutes, escapeHtml, formatRoom, truncateText } from '../core/utils.js';
import { bindCourseTitleClicks } from './course-title.js';

let _lastRenderHash = '';

export function renderTimeline(force = false) {
  const classes = getClassesForDay(State.currentViewDayIdx);
  const currentMins = getCurrentMinutes();
  const realTodayIdx = new Date().getDay();

  // Skip redundant re-renders: same day + same minute = identical output
  const renderHash = `${State.currentViewDayIdx}:${State.currentViewDayIdx === realTodayIdx ? currentMins : -1}`;
  if (!force && renderHash === _lastRenderHash) return;
  _lastRenderHash = renderHash;

  // Update section titles
  if (State.currentViewDayIdx === realTodayIdx) {
    DOM.timelineTitle.textContent = "Today's Classes";
    DOM.timelineSubtitle.textContent = DAY_NAMES[State.currentViewDayIdx];
  } else {
    DOM.timelineTitle.textContent = `${DAY_NAMES[State.currentViewDayIdx]}'s Classes`;
    const nextDay = (realTodayIdx + 1) % 7;
    DOM.timelineSubtitle.textContent = State.currentViewDayIdx === nextDay ? 'Tomorrow' : 'Viewing Schedule';
  }

  // Update nav buttons text dynamically
  const activeDays = CONFIG.activeDays || [6, 0, 1, 2, 3];
  const activeIdx = activeDays.indexOf(State.currentViewDayIdx);
  if (activeIdx !== -1) {
    const prevDayIdx = activeDays[(activeIdx - 1 + activeDays.length) % activeDays.length];
    const nextDayIdx = activeDays[(activeIdx + 1) % activeDays.length];
    const prevBtn = document.getElementById('prevDayBtn');
    const nextBtn = document.getElementById('nextDayBtn');
    if (prevBtn) prevBtn.textContent = `← ${DAY_SHORT[prevDayIdx] || DAY_NAMES[prevDayIdx]}`;
    if (nextBtn) nextBtn.textContent = `${DAY_SHORT[nextDayIdx] || DAY_NAMES[nextDayIdx]} →`;
  }

  const isLightMode = document.documentElement.getAttribute('data-color') === 'light';

  // Check holiday override for the day
  const holidayOverride = getOverrideFor(State.currentViewDayIdx);
  if (holidayOverride && holidayOverride.type === 'holiday') {
    const hasOnlineClasses = classes.some(c => {
      const ov = getOverrideFor(State.currentViewDayIdx, c.title);
      return ov && ov.type === 'online_class';
    });

    if (!hasOnlineClasses) {
      DOM.timelineGrid.innerHTML = `
        <div class="ch" style="grid-template-columns: 1fr; width: 100%; height: 100%; min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 1.5px dashed var(--pink) !important; background: rgba(244, 63, 94, 0.08) !important; padding: 26px 20px; box-shadow: 0 0 20px rgba(244, 63, 94, 0.15) !important;">
          <span style="font-size: 28px; margin-bottom: 8px;">🎉</span>
          <span class="chn" style="color: var(--pink2); font-weight: 800; font-size: 17px; margin-bottom: 4px; letter-spacing: 0.5px;">HOLIDAY / DAY OFF</span>
          <span style="font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 4px;">${escapeHtml(holidayOverride.announcement.title)}</span>
          <span style="font-size: 12px; color: var(--dim); max-width: 80%;">${escapeHtml(holidayOverride.announcement.announcement)}</span>
        </div>
      `;
      return;
    }
  }

  if (!classes.length) {
    DOM.timelineGrid.innerHTML = `<div class="t-empty" style="width:100%; height: 100%; min-height: 280px; display: flex; align-items: center; justify-content: center;">No classes scheduled for ${DAY_NAMES[State.currentViewDayIdx]}</div>`;
    return;
  }

  let html = '';
  let lastEndMins = null;

  const onlineTheme = isLightMode
    ? { bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', border: '#059669', text: '#064e3b', badge: '#10b981' }
    : { bg: 'linear-gradient(135deg, #052b1a, #073d26)', border: '#10b981', text: '#6ee7b7', badge: 'rgba(16, 185, 129, 0.25)' };

  const cancelTheme = isLightMode
    ? { bg: 'linear-gradient(135deg, #ffe4e6, #fecdd3)', border: '#e11d48', text: '#4c0519', badge: '#f43f5e' }
    : { bg: 'linear-gradient(135deg, #1c0a0c, #3f0f13)', border: '#f43f5e', text: '#fca5a5', badge: 'rgba(244, 63, 94, 0.2)' };

  const examTheme = isLightMode
    ? { bg: 'linear-gradient(135deg, #ffedd5, #fed7aa)', border: '#ea580c', text: '#431407', badge: '#fb923c' }
    : { bg: 'linear-gradient(135deg, #2d1506, #3d1f0a)', border: '#f97316', text: '#fdba74', badge: 'rgba(249, 115, 22, 0.30)' };

  const breakTheme = isLightMode
    ? { bg: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', border: '#94a3b8', text: '#0f172a', badge: '#cbd5e1' }
    : { bg: 'linear-gradient(135deg, #18181b, #27272a)', border: '#3f3f46', text: '#a1a1aa', badge: 'rgba(255,255,255,0.05)' };

  classes.forEach((item, index) => {
    const startMins = toMinutes(item.start);
    const endMins = toMinutes(item.end);

    // Insert break card between non-contiguous classes
    if (lastEndMins !== null && startMins > lastEndMins) {
      const isActiveBreak = (State.currentViewDayIdx === realTodayIdx) && (currentMins >= lastEndMins && currentMins < startMins);
      const isPastBreak = (State.currentViewDayIdx === realTodayIdx) && (startMins <= currentMins);

      html += `
        <div class="ch${isActiveBreak ? ' ca' : ''}${isPastBreak ? ' cp' : ''}" style="animation-delay:${index * 0.07 - 0.03}s; background:${breakTheme.bg}; border-color:${breakTheme.border}; color:${breakTheme.text}">
          <div class="cht" style="color:${breakTheme.text}">${format12h(toTimeString(lastEndMins))}<br>${format12h(toTimeString(startMins))}</div>
          <div class="chi"><span class="chn" style="color:${breakTheme.text}; font-style:italic;">Break Time</span><span class="chr" style="color:${breakTheme.text}">Take a breather ☕</span></div>
          <span class="ctb" style="background:${breakTheme.badge}; color:${breakTheme.text}">BREAK</span>
        </div>`;
    }
    lastEndMins = endMins;

    // Check override for this specific subject
    const cancelOverride = getOverrideFor(State.currentViewDayIdx, item.title);
    const isCancelled = cancelOverride && cancelOverride.type === 'cancellation';
    const isOnline = cancelOverride && cancelOverride.type === 'online_class';
    const isClassTest = item.isExam || (cancelOverride && cancelOverride.type === 'class_test');
    const isHolidayCancelled = !isOnline && !isCancelled && holidayOverride && holidayOverride.type === 'holiday';

    const isActive = (State.currentViewDayIdx === realTodayIdx) && (currentMins >= startMins && currentMins < endMins);
    const isPast = (State.currentViewDayIdx === realTodayIdx) && (endMins <= currentMins);

    const theme = isClassTest ? examTheme : isOnline ? onlineTheme : (isCancelled || isHolidayCancelled) ? cancelTheme : getSubjectTheme(item.title, item.type);

    const effectiveCancelled = isCancelled || isHolidayCancelled;
    let platform = '';
    if (isOnline && cancelOverride.announcement.announcement) {
      try {
        const parsed = JSON.parse(cancelOverride.announcement.announcement);
        platform = parsed.platform || '';
      } catch (e) {
        platform = cancelOverride.announcement.announcement;
      }
    }
    let examName = item.examName || '';
    let examTopics = item.examTopics || '';
    if (isClassTest && !examName && cancelOverride && cancelOverride.announcement.announcement) {
      try {
        const parsed = JSON.parse(cancelOverride.announcement.announcement);
        examName = parsed.exam_name || 'Class Test';
        examTopics = parsed.topics || 'Not Specified';
      } catch (e) {
        examName = 'Class Test';
        examTopics = 'Not Specified';
      }
    }

    const detailsData = {
      title: item.title,
      start: format12h(item.start),
      end: format12h(item.end),
      type: item.type,
      room: item.room,
      instructor: item.instructor,
      isExam: isClassTest,
      examName: examName,
      examTopics: examTopics,
      isOnline: isOnline,
      platform: platform,
      isCancelled: effectiveCancelled,
      cancellationType: isHolidayCancelled ? 'holiday' : (isCancelled ? 'cancellation' : '')
    };

    html += `
      <div class="ch${isActive && isOnline ? ' ca' : ''}${isActive && !isOnline && !effectiveCancelled ? ' ca' : ''}${isPast || effectiveCancelled ? ' cp' : ''}" style="animation-delay:${index * 0.07}s; background:${theme.bg}; border-color:${theme.border}; color:${theme.text}" data-detail="${escapeHtml(JSON.stringify(detailsData))}">
        <div class="cht" style="color:${theme.text}; text-decoration:${effectiveCancelled ? 'line-through' : 'none'}">${format12h(item.start)}<br>${format12h(item.end)}</div>
        <div class="chi">
          <span class="chn course-click-title" data-title="${item.title}" title="Click to view details" style="color:${theme.text}; text-decoration:${effectiveCancelled ? 'line-through' : 'none'}">${escapeHtml(truncateText(item.title, 10))}</span>
          <span class="chr" style="color:${theme.text}; opacity: 0.9;">
            ${isClassTest
              ? `<span style="color:${theme.text}; font-weight:800; display:block;">Click to view topics</span>
                 <span style="font-size: 11px; opacity: 0.85;">${formatRoom(item.room) ? `Room ${formatRoom(item.room)}` : 'No room'} ${item.instructor ? `· <span class="teacher-clickable-badge" data-teacher-code="${escapeHtml(item.instructor)}" title="Click to view ${escapeHtml(item.instructor)}'s profile">${escapeHtml(item.instructor)}</span>` : ''}</span>`
              : isOnline
              ? (platform ? `<span style="color:${theme.text}; font-weight:800; display:block;">${escapeHtml(truncateText(platform, 10))}</span>` : '')
              : effectiveCancelled
                ? `<span style="color:${theme.text}; font-weight:800;">${isHolidayCancelled ? 'HOLIDAY — NO CLASS' : 'CANCELLED'}</span>`
                : `${formatRoom(item.room)} ${item.instructor ? `· <span class="teacher-clickable-badge" data-teacher-code="${escapeHtml(item.instructor)}" title="Click to view ${escapeHtml(item.instructor)}'s profile">${escapeHtml(item.instructor)}</span>` : ''}`}
          </span>
        </div>
        <span class="ctb" style="background:${theme.badge}; color:${theme.text}">${isClassTest ? `📝 ${truncateText(examName, 10)}` : isOnline ? '📡 ONLINE' : effectiveCancelled ? 'CANCEL' : (theme.isLab ? '★ LAB' : item.type)}</span>
      </div>`;
  });

  DOM.timelineGrid.innerHTML = html;
  bindCourseTitleClicks(DOM.timelineGrid);
}
