import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG, DAY_NAMES, DAY_SHORT } from '../core/config.js';
import { getClassesForDay } from '../schedule/queries.js';
import { getOverrideFor } from '../announcements/overrides.js';
import { getSubjectTheme } from '../schedule/themes.js';
import { toMinutes, format12h, getCurrentMinutes, escapeHtml, formatRoom, truncateText } from '../core/utils.js';
import { bindCourseTitleClicks } from '../timeline/course-title.js';

let matrixTouchStartX = 0;
let matrixTouchStartY = 0;
let isMatrixDragging = false;
let targetMatrixDayIdx = -1;
let isMatrixSwipeBound = false;

export function switchMatrixDay(direction) {
  const cardsEl = DOM.matrixGrid ? DOM.matrixGrid.querySelector('.m-matrix-cards') : null;
  if (!cardsEl) return;

  const activeDays = CONFIG.activeDays;
  const currentIdx = activeDays.indexOf(State.matrixSelectedDayIdx);
  if (currentIdx === -1) return;

  const nextIdx = direction === 'next'
    ? activeDays[(currentIdx + 1) % activeDays.length]
    : activeDays[(currentIdx - 1 + activeDays.length) % activeDays.length];

  const isNext = direction === 'next';
  const exitX = isNext ? -350 : 350;
  const entryX = isNext ? 350 : -350;

  cardsEl.classList.add('swipe-transition');
  cardsEl.style.transform = `translateX(${exitX}px)`;
  cardsEl.style.opacity = '0';

  setTimeout(() => {
    State.matrixSelectedDayIdx = nextIdx;
    renderWeeklyMatrix();

    const newCardsEl = DOM.matrixGrid ? DOM.matrixGrid.querySelector('.m-matrix-cards') : null;
    if (newCardsEl) {
      newCardsEl.style.transform = `translateX(${entryX}px)`;
      newCardsEl.style.opacity = '0';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          newCardsEl.classList.add('swipe-transition');
          newCardsEl.style.transform = 'translateX(0)';
          newCardsEl.style.opacity = '1';
          setTimeout(() => {
            newCardsEl.classList.remove('swipe-transition');
          }, 240);
        });
      });
    }
  }, 160);
}

function bindMatrixTouchSwipe() {
  if (isMatrixSwipeBound) return;
  const modalEl = DOM.viewModal ? DOM.viewModal.querySelector('.view-md') : null;
  if (!modalEl) return;
  isMatrixSwipeBound = true;

  modalEl.addEventListener('touchstart', e => {
    if (window.innerWidth > 640) return;
    if (e.touches.length !== 1) return;
    matrixTouchStartX = e.touches[0].clientX;
    matrixTouchStartY = e.touches[0].clientY;
    isMatrixDragging = false;
    targetMatrixDayIdx = -1;
  }, { passive: true });

  modalEl.addEventListener('touchmove', e => {
    if (window.innerWidth > 640) return;
    if (e.touches.length !== 1) return;
    const cardsEl = DOM.matrixGrid ? DOM.matrixGrid.querySelector('.m-matrix-cards') : null;
    const deltaX = e.touches[0].clientX - matrixTouchStartX;
    const deltaY = e.touches[0].clientY - matrixTouchStartY;

    if (!isMatrixDragging) {
      if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) {
        isMatrixDragging = true;
        if (cardsEl) cardsEl.classList.add('swiping');
      }
    }

    if (isMatrixDragging && cardsEl) {
      const resistance = 0.75;
      const draggedX = deltaX * resistance;
      const opacity = Math.max(0.3, 1 - Math.abs(draggedX) / 320);

      cardsEl.style.transform = `translateX(${draggedX}px)`;
      cardsEl.style.opacity = opacity.toFixed(2);

      const activeDays = CONFIG.activeDays;
      const currentIdx = activeDays.indexOf(State.matrixSelectedDayIdx);

      if (deltaX < 0) {
        targetMatrixDayIdx = activeDays[(currentIdx + 1) % activeDays.length];
      } else if (deltaX > 0) {
        targetMatrixDayIdx = activeDays[(currentIdx - 1 + activeDays.length) % activeDays.length];
      }
    }
  }, { passive: true });

  modalEl.addEventListener('touchend', e => {
    if (window.innerWidth > 640) return;
    const cardsEl = DOM.matrixGrid ? DOM.matrixGrid.querySelector('.m-matrix-cards') : null;
    if (!isMatrixDragging) return;
    isMatrixDragging = false;

    const deltaX = e.changedTouches[0].clientX - matrixTouchStartX;
    if (cardsEl) cardsEl.classList.remove('swiping');

    if (Math.abs(deltaX) > 60 && targetMatrixDayIdx !== -1) {
      switchMatrixDay(deltaX < 0 ? 'next' : 'prev');
    } else if (cardsEl) {
      cardsEl.classList.add('swipe-transition');
      cardsEl.style.transform = 'translateX(0)';
      cardsEl.style.opacity = '1';
      setTimeout(() => {
        cardsEl.classList.remove('swipe-transition');
      }, 220);
    }
  });
}

export function renderWeeklyMatrix() {
  const todayIdx = new Date().getDay();
  const currentMins = getCurrentMinutes();
  const intervals = CONFIG.matrixIntervals;
  const isMobile = window.innerWidth <= 640;

  if (isMobile) {
    // Mobile Tab View
    let html = `<div class="m-matrix-tabs">`;
    CONFIG.activeDays.forEach(dayIdx => {
      const isSelected = dayIdx === State.matrixSelectedDayIdx;
      const isToday = dayIdx === todayIdx;
      html += `
        <button class="m-matrix-tab${isSelected ? ' active' : ''}${isToday ? ' today' : ''}" data-day="${dayIdx}">
          <span class="m-tab-name">${DAY_SHORT[dayIdx]}</span>
          ${isToday ? '<span class="m-tab-dot"></span>' : ''}
        </button>
      `;
    });
    html += `</div>`;

    // Active day classes
    const dayEntries = getClassesForDay(State.matrixSelectedDayIdx);
    const holidayOverride = getOverrideFor(State.matrixSelectedDayIdx);
    const isHoliday = holidayOverride && holidayOverride.type === 'holiday';

    // Verify if there are online classes declared on this holiday
    const hasOnlineClasses = dayEntries.some(c => {
      const ov = getOverrideFor(State.matrixSelectedDayIdx, c.title);
      return ov && ov.type === 'online_class';
    });

    html += `<div class="m-matrix-cards">`;
    if (isHoliday && !hasOnlineClasses) {
      html += `
        <div class="m-matrix-empty" style="border: 1.5px dashed var(--pink) !important; color: var(--pink2); background: rgba(244, 63, 94, 0.05) !important; padding: 25px 15px; border-radius: var(--rx); text-align: center;">
          <span style="font-size: 24px; display: block; margin-bottom: 6px;">🎉</span>
          <span style="font-weight: 800; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase;">HOLIDAY / DAY OFF</span>
          <div style="font-size: 13px; color: var(--text); font-weight: bold; margin-top: 4px;">${escapeHtml(holidayOverride.announcement.title)}</div>
        </div>
      `;
    } else if (dayEntries.length) {
      dayEntries.forEach((item, index) => {
        const startMins = toMinutes(item.start);
        const endMins = toMinutes(item.end);
        const cancelOverride = getOverrideFor(State.matrixSelectedDayIdx, item.title);
        const isCancelled = cancelOverride && cancelOverride.type === 'cancellation';
        const isOnline = cancelOverride && cancelOverride.type === 'online_class';
        const isClassTest = item.isExam || (cancelOverride && cancelOverride.type === 'class_test');
        const isHolidayCancelled = !isOnline && !isCancelled && isHoliday;

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

        const effectiveCancelled = isCancelled || isHolidayCancelled;
        const isLive = (State.matrixSelectedDayIdx === todayIdx) && (currentMins >= startMins && currentMins < endMins) && !effectiveCancelled;
        const isPast = (State.matrixSelectedDayIdx === todayIdx) && (endMins <= currentMins) || effectiveCancelled;

        const examTheme = { bg: 'linear-gradient(135deg, #2d1506, #3d1f0a)', border: '#f97316', text: '#fdba74', badge: 'rgba(249, 115, 22, 0.30)' };
        const theme = isClassTest ? examTheme
          : isOnline
          ? { bg: 'linear-gradient(135deg, #052b1a, #073d26)', border: '#10b981', text: '#6ee7b7', badge: 'rgba(16, 185, 129, 0.25)' }
          : effectiveCancelled
            ? { bg: 'linear-gradient(135deg, #1c0a0c, #3f0f13)', border: '#f43f5e', text: '#fca5a5', badge: 'rgba(244, 63, 94, 0.2)' }
            : getSubjectTheme(item.title, item.type);

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
          <div class="m-matrix-card${isLive ? ' live' : ''}${isPast ? ' past' : ''}" style="animation-delay:${index * 0.05}s; background:${theme.bg}; border-color:${theme.border}; color:#fff" data-detail="${escapeHtml(JSON.stringify(detailsData))}">
            <div class="m-card-time" style="color:${theme.text}; text-decoration:${effectiveCancelled ? 'line-through' : 'none'}">
              <span>${format12h(item.start)}</span>
              <span class="m-card-arrow">→</span>
              <span>${format12h(item.end)}</span>
            </div>
            <div class="m-card-details">
              <div class="m-card-title course-click-title" data-title="${item.title}" style="text-decoration:${effectiveCancelled ? 'line-through' : 'none'}">${escapeHtml(truncateText(item.title, 10))}</div>
              <div class="m-card-sub" style="color:${theme.text}">
                ${isClassTest
                  ? `<span style="color:#fdba74; font-weight:800; display:block; margin-bottom: 2px;">Click to view topics</span>
                     <span style="font-size: 11px; opacity: 0.85;">${formatRoom(item.room) ? `Room ${formatRoom(item.room)}` : 'No room'} ${item.instructor ? `· ${item.instructor}` : ''}</span>`
                  : isOnline
                  ? (platform ? `<span style="color:#6ee7b7; font-weight:800; display:block;">${escapeHtml(truncateText(platform, 10))}</span>` : '')
                  : effectiveCancelled
                    ? `<span style="color:var(--pink); font-weight:800;">${isHolidayCancelled ? 'HOLIDAY — NO CLASS' : 'CANCELLED'}</span>`
                    : (formatRoom(item.room) ? `Room ${formatRoom(item.room)}` : 'No room')}
                ${item.instructor && !effectiveCancelled && !isClassTest ? `· ${item.instructor}` : ''}
              </div>
            </div>
            <span class="m-card-badge" style="background:${theme.badge}; color:#fff">${isClassTest ? `📝 ${truncateText(examName, 10)}` : isOnline ? '📡 ONLINE' : effectiveCancelled ? 'CANCEL' : (theme.isLab ? '★ LAB' : item.type)}</span>
          </div>
        `;
      });
    } else {
      html += `<div class="m-matrix-empty">No classes scheduled for ${DAY_NAMES[State.matrixSelectedDayIdx]}</div>`;
    }
    html += `</div>`;

    DOM.matrixGrid.innerHTML = html;
    bindCourseTitleClicks(DOM.matrixGrid);

    // Handle tab clicks
    DOM.matrixGrid.querySelectorAll('.m-matrix-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        State.matrixSelectedDayIdx = parseInt(btn.dataset.day);
        renderWeeklyMatrix();
      });
    });

    // Bind touch swipe to entire modal container
    bindMatrixTouchSwipe();
  } else {
    // Desktop Grid View
    let html = `<div class="t-header th-day">DAY / TIME</div>`;
    intervals.forEach(t => {
      const isNow = currentMins >= t.startM && currentMins < t.endM;
      html += `<div class="t-header${isNow ? ' active-time-col' : ''}">${t.lbl}</div>`;
    });

    CONFIG.activeDays.forEach(dayIdx => {
      const isToday = dayIdx === todayIdx;
      const dayEntries = getClassesForDay(dayIdx);
      const holidayOverride = getOverrideFor(dayIdx);
      const isHoliday = holidayOverride && holidayOverride.type === 'holiday';

      // Check if this day has online class overrides on holiday
      const hasOnlineClasses = dayEntries.some(c => {
        const ov = getOverrideFor(dayIdx, c.title);
        return ov && ov.type === 'online_class';
      });

      html += `<div class="day-card${isToday ? ' tod' : ''}"><div class="d-name">${DAY_NAMES[dayIdx]}</div>${isToday ? '<span class="d-tag">TODAY</span>' : ''}</div>`;

      if (isHoliday && !hasOnlineClasses) {
        html += `
          <div style="grid-column: span ${intervals.length}; display: flex; align-items: center; justify-content: center; background: rgba(244, 63, 94, 0.05); color: var(--pink2); border: 1.5px dashed var(--pink); font-size: 12px; font-weight: bold; padding: 10px; text-transform: uppercase;" title="${escapeHtml(holidayOverride.announcement.announcement)}">
            🎉 HOLIDAY: ${escapeHtml(holidayOverride.announcement.title)}
          </div>
        `;
        return;
      }

      let skipUntilIdx = 0;
      intervals.forEach((slot, idx) => {
        if (idx < skipUntilIdx) return;
        const match = dayEntries.find(x => toMinutes(x.start) <= slot.startM && toMinutes(x.end) >= slot.endM);

        if (match) {
          let spanCount = 0;
          for (let k = idx; k < intervals.length; k++) {
            if (toMinutes(match.end) >= intervals[k].endM) spanCount++;
            else break;
          }
          skipUntilIdx = idx + spanCount;

          const cancelOverride = getOverrideFor(dayIdx, match.title);
          const isCancelled = cancelOverride && cancelOverride.type === 'cancellation';
          const isOnline = cancelOverride && cancelOverride.type === 'online_class';
          const isClassTest = match.isExam || (cancelOverride && cancelOverride.type === 'class_test');
          const isHolidayCancelled = !isOnline && !isCancelled && isHoliday;

          const effectiveCancelled = isCancelled || isHolidayCancelled;
          const isLive = isToday && currentMins >= toMinutes(match.start) && currentMins < toMinutes(match.end) && !effectiveCancelled;

          const examTheme = { bg: 'linear-gradient(135deg, #2d1506, #3d1f0a)', border: '#f97316', text: '#fdba74', badge: 'rgba(249, 115, 22, 0.30)' };
          const theme = isClassTest ? examTheme
            : isOnline
            ? { bg: 'linear-gradient(135deg, #052b1a, #073d26)', border: '#10b981', text: '#6ee7b7', badge: 'rgba(16, 185, 129, 0.25)' }
            : effectiveCancelled
              ? { bg: 'linear-gradient(135deg, #1c0a0c, #3f0f13)', border: '#f43f5e', text: '#fca5a5', badge: 'rgba(244, 63, 94, 0.2)' }
              : getSubjectTheme(match.title, match.type);

          let examName = match.examName || '';
          let examTopics = match.examTopics || '';
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
            title: match.title,
            start: format12h(match.start),
            end: format12h(match.end),
            type: match.type,
            room: match.room,
            instructor: match.instructor,
            isExam: isClassTest,
            examName: examName,
            examTopics: examTopics,
            isOnline: isOnline,
            platform: '',
            isCancelled: effectiveCancelled,
            cancellationType: isHolidayCancelled ? 'holiday' : (isCancelled ? 'cancellation' : '')
          };

          if (isOnline && cancelOverride && cancelOverride.announcement.announcement) {
            try {
              const parsed = JSON.parse(cancelOverride.announcement.announcement);
              detailsData.platform = parsed.platform || '';
            } catch (e) {
              detailsData.platform = cancelOverride.announcement.announcement;
            }
          }

          html += `
            <div class="t-card${isLive ? ' live' : ''}" style="grid-column: span ${spanCount}; background:${theme.bg}; border-color:${theme.border}; color:#fff" title="${effectiveCancelled ? 'Cancelled Class' : 'Click to view details'}" data-detail="${escapeHtml(JSON.stringify(detailsData))}">
              <div class="t-subj course-click-title" data-title="${match.title}" style="text-decoration:${effectiveCancelled ? 'line-through' : 'none'}">${escapeHtml(truncateText(match.title, 10))}</div>
              ${isClassTest
                ? `<div class="t-inst" style="color:#fdba74; font-weight:800;">Click to view topics</div>
                   ${match.instructor && !effectiveCancelled ? `<div class="t-inst" style="color:${theme.text}">${escapeHtml(truncateText(match.instructor, 10))}</div>` : ''}`
                : match.instructor && !effectiveCancelled
                  ? `<div class="t-inst" style="color:${theme.text}">${escapeHtml(truncateText(match.instructor, 10))}</div>`
                  : ''}
              <div class="t-meta">
                <span style="color:${theme.text}">
                  ${isClassTest ? (formatRoom(match.room) || 'No room') : isOnline
                    ? '📡 ONLINE'
                    : effectiveCancelled
                      ? `<span style="color:var(--pink); font-weight:800;">${isHolidayCancelled ? 'HOLIDAY' : 'CANCEL'}</span>`
                      : (formatRoom(match.room) || 'No room')}
                </span>
                <span class="t-badge" style="background:${theme.badge}; color:#fff">${isClassTest ? `📝 ${truncateText(examName, 10)}` : isOnline ? '📡 ONLINE' : effectiveCancelled ? 'CANCEL' : (theme.isLab ? '★ LAB' : match.type)}</span>
              </div>
            </div>`;
        } else {
          const isLiveEmpty = isToday && (currentMins >= slot.startM && currentMins < slot.endM);
          html += `<div class="t-empty${isLiveEmpty ? ' live-empty' : ''}">${isLiveEmpty ? '• FREE •' : '—'}</div>`;
        }
      });
    });

    DOM.matrixGrid.innerHTML = html;
    bindCourseTitleClicks(DOM.matrixGrid);
  }
}
