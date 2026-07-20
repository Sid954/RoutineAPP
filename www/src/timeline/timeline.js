import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { DAY_NAMES } from '../core/config.js';
import { getClassesForDay } from '../schedule/queries.js';
import { getOverrideFor } from '../announcements/overrides.js';
import { getSubjectTheme } from '../schedule/themes.js';
import { toMinutes, format12h, toTimeString, getCurrentMinutes, escapeHtml, formatRoom, truncateText } from '../core/utils.js';
import { bindCourseTitleClicks } from './course-title.js';

export function renderTimeline() {
  const classes = getClassesForDay(State.currentViewDayIdx);
  const currentMins = getCurrentMinutes();
  const realTodayIdx = new Date().getDay();

  // Update section titles
  if (State.currentViewDayIdx === realTodayIdx) {
    DOM.timelineTitle.textContent = "Today's Classes";
    DOM.timelineSubtitle.textContent = DAY_NAMES[State.currentViewDayIdx];
  } else {
    DOM.timelineTitle.textContent = `${DAY_NAMES[State.currentViewDayIdx]}'s Classes`;
    const nextDay = (realTodayIdx + 1) % 7;
    DOM.timelineSubtitle.textContent = State.currentViewDayIdx === nextDay ? 'Tomorrow' : 'Viewing Schedule';
  }

  // Check holiday override for the day
  const holidayOverride = getOverrideFor(State.currentViewDayIdx);
  if (holidayOverride && holidayOverride.type === 'holiday') {
    // Check if any class has an online_class override on this day
    const hasOnlineClasses = classes.some(c => {
      const ov = getOverrideFor(State.currentViewDayIdx, c.title);
      return ov && ov.type === 'online_class';
    });

    if (!hasOnlineClasses) {
      DOM.timelineGrid.innerHTML = `
        <div class="ch" style="grid-template-columns: 1fr; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 1.5px dashed var(--pink) !important; background: rgba(244, 63, 94, 0.08) !important; padding: 26px 20px; box-shadow: 0 0 20px rgba(244, 63, 94, 0.15) !important;">
          <span style="font-size: 28px; margin-bottom: 8px;">🎉</span>
          <span class="chn" style="color: var(--pink2); font-weight: 800; font-size: 17px; margin-bottom: 4px; letter-spacing: 0.5px;">HOLIDAY / DAY OFF</span>
          <span style="font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 4px;">${escapeHtml(holidayOverride.announcement.title)}</span>
          <span style="font-size: 12px; color: var(--dim); max-width: 80%;">${escapeHtml(holidayOverride.announcement.announcement)}</span>
        </div>
      `;
      return;
    }
    // Fall through to render class list so online classes appear mixed in
  }

  if (!classes.length) {
    DOM.timelineGrid.innerHTML = `<div class="t-empty" style="width:100%; min-height:100px;">No classes scheduled for ${DAY_NAMES[State.currentViewDayIdx]}</div>`;
    return;
  }

  let html = '';
  let lastEndMins = null;

  classes.forEach((item, index) => {
    const startMins = toMinutes(item.start);
    const endMins = toMinutes(item.end);

    // Insert break card between non-contiguous classes
    if (lastEndMins !== null && startMins > lastEndMins) {
      const isActiveBreak = (State.currentViewDayIdx === realTodayIdx) && (currentMins >= lastEndMins && currentMins < startMins);
      const isPastBreak = (State.currentViewDayIdx === realTodayIdx) && (startMins <= currentMins);
      const bt = { bg: 'linear-gradient(135deg, #18181b, #27272a)', border: '#3f3f46', text: '#a1a1aa', badge: 'rgba(255,255,255,0.05)' };

      html += `
        <div class="ch${isActiveBreak ? ' ca' : ''}${isPastBreak ? ' cp' : ''}" style="animation-delay:${index * 0.07 - 0.03}s; background:${bt.bg}; border-color:${bt.border}; color:#fff">
          <div class="cht" style="color:${bt.text}">${format12h(toTimeString(lastEndMins))}<br>${format12h(toTimeString(startMins))}</div>
          <div class="chi"><span class="chn" style="color:#d4d4d8; font-style:italic;">Break Time</span><span class="chr" style="color:${bt.text}">Take a breather ☕</span></div>
          <span class="ctb" style="background:${bt.badge}; color:#d4d4d8">BREAK</span>
        </div>`;
    }
    lastEndMins = endMins;

    // Check override for this specific subject
    const cancelOverride = getOverrideFor(State.currentViewDayIdx, item.title);
    const isCancelled = cancelOverride && cancelOverride.type === 'cancellation';
    const isOnline = cancelOverride && cancelOverride.type === 'online_class';
    const isClassTest = item.isExam || (cancelOverride && cancelOverride.type === 'class_test');
    // If holiday day and NO override for this subject → it's cancelled by holiday
    const isHolidayCancelled = !isOnline && !isCancelled && holidayOverride && holidayOverride.type === 'holiday';

    const isActive = (State.currentViewDayIdx === realTodayIdx) && (currentMins >= startMins && currentMins < endMins);
    const isPast = (State.currentViewDayIdx === realTodayIdx) && (endMins <= currentMins);

    const onlineTheme = { bg: 'linear-gradient(135deg, #052b1a, #073d26)', border: '#10b981', text: '#6ee7b7', badge: 'rgba(16, 185, 129, 0.25)' };
    const cancelTheme = { bg: 'linear-gradient(135deg, #1c0a0c, #3f0f13)', border: '#f43f5e', text: '#fca5a5', badge: 'rgba(244, 63, 94, 0.2)' };
    const examTheme = { bg: 'linear-gradient(135deg, #2d1506, #3d1f0a)', border: '#f97316', text: '#fdba74', badge: 'rgba(249, 115, 22, 0.30)' };
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
      <div class="ch${isActive && isOnline ? ' ca' : ''}${isActive && !isOnline && !effectiveCancelled ? ' ca' : ''}${isPast || effectiveCancelled ? ' cp' : ''}" style="animation-delay:${index * 0.07}s; background:${theme.bg}; border-color:${theme.border}; color:#fff" data-detail="${escapeHtml(JSON.stringify(detailsData))}">
        <div class="cht" style="color:${theme.text}; text-decoration:${effectiveCancelled ? 'line-through' : 'none'}">${format12h(item.start)}<br>${format12h(item.end)}</div>
        <div class="chi">
          <span class="chn course-click-title" data-title="${item.title}" title="Click to view details" style="text-decoration:${effectiveCancelled ? 'line-through' : 'none'}">${escapeHtml(truncateText(item.title, 10))}</span>
          <span class="chr" style="color:${theme.text}">
            ${isClassTest
              ? `<span style="color:#fdba74; font-weight:800; display:block;">Click to view topics</span>
                 <span style="font-size: 11px; opacity: 0.85;">${formatRoom(item.room) ? `Room ${formatRoom(item.room)}` : 'No room'} ${item.instructor ? `· ${item.instructor}` : ''}</span>`
              : isOnline
              ? (platform ? `<span style="color:#6ee7b7; font-weight:800; display:block;">${escapeHtml(truncateText(platform, 10))}</span>` : '')
              : effectiveCancelled
                ? `<span style="color:var(--pink); font-weight:800;">${isHolidayCancelled ? 'HOLIDAY — NO CLASS' : 'CANCELLED'}</span>`
                : `${formatRoom(item.room)} ${item.instructor ? `· ${item.instructor}` : ''}`}
          </span>
        </div>
        <span class="ctb" style="background:${theme.badge}; color:#fff">${isClassTest ? `📝 ${truncateText(examName, 10)}` : isOnline ? '📡 ONLINE' : effectiveCancelled ? 'CANCEL' : (theme.isLab ? '★ LAB' : item.type)}</span>
      </div>`;
  });

  DOM.timelineGrid.innerHTML = html;
  bindCourseTitleClicks(DOM.timelineGrid);
}
