import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG, DAY_NAMES, DAY_SHORT, MONTHS } from '../core/config.js';
import { getClassesForDay } from '../schedule/queries.js';
import { getDateForDayIndex } from '../announcements/overrides.js';
import { getSubjectTheme } from '../schedule/themes.js';
import { toMinutes, format12h, getCurrentMinutes, escapeHtml, formatRoom, truncateText, LAB_LABEL_HTML, setHtmlIfChanged, localDateStr, toTimeString } from '../core/utils.js';
import { bindCourseTitleClicks } from '../timeline/course-title.js';
import { bindMouseDrag, bindWheelSwipe } from '../core/desktop-input.js';

/** Card text colour: white on the dark palettes, the palette's own dark ink on light ones
 *  (white on the light pastel gradients was unreadable). */
const cardInk = theme => document.documentElement.getAttribute('data-color') === 'light' ? (theme.text || '#0f172a') : '#fff';

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

  // One core for touch, mouse drag and trackpad swipes (desktop-input.js). Phone layout only.
  const cards = () => (DOM.matrixGrid ? DOM.matrixGrid.querySelector('.m-matrix-cards') : null);
  const start = (x, y) => {
    if (window.innerWidth > 640) return false;
    matrixTouchStartX = x;
    matrixTouchStartY = y;
    isMatrixDragging = false;
    targetMatrixDayIdx = -1;
    return true;
  };
  const move = (x, y) => {
    if (window.innerWidth > 640) return;
    const cardsEl = cards();
    const deltaX = x - matrixTouchStartX;
    const deltaY = y - matrixTouchStartY;

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
  };
  const end = (x) => {
    if (window.innerWidth > 640) return;
    const cardsEl = cards();
    if (!isMatrixDragging) return;
    isMatrixDragging = false;

    const deltaX = x - matrixTouchStartX;
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
  };

  modalEl.addEventListener('touchstart', e => { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  modalEl.addEventListener('touchmove', e => { if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  modalEl.addEventListener('touchend', e => end(e.changedTouches[0].clientX));
  bindMouseDrag(modalEl, { start: (x, y) => start(x, y), move, end: (x) => end(x) });
  bindWheelSwipe(modalEl, dir => { if (window.innerWidth <= 640) switchMatrixDay(dir); });
}

/**
 * The Weekly Routine is the plain routine, on purpose (user, 2026-11-20): no cancellations, holidays,
 * exams, online classes or any other notice change anything here. Home (timeline.js) is where those show.
 */
export function renderWeeklyMatrix() {
  if (window.__updateFabAway) setTimeout(window.__updateFabAway, 0);
  const todayIdx = new Date().getDay();
  const currentMins = getCurrentMinutes();
  const intervals = CONFIG.matrixIntervals;
  const isMobile = window.innerWidth <= 640;

  if (isMobile) {
    // Mobile Tab View
    const realToday = localDateStr();
    const dateOf = {};
    let html = `<div class="m-matrix-tabs">`;
    CONFIG.activeDays.forEach(dayIdx => {
      const ds = getDateForDayIndex(dayIdx);
      dateOf[dayIdx] = ds;
      const isSelected = dayIdx === State.matrixSelectedDayIdx;
      const isToday = ds === realToday;
      html += `
        <button class="m-matrix-tab${isSelected ? ' active' : ''}${isToday ? ' today' : ''}" data-day="${dayIdx}" aria-label="${DAY_NAMES[dayIdx]} ${Number(ds.slice(8))}${isToday ? ', today' : ''}">
          <span class="m-tab-name">${DAY_SHORT[dayIdx]}</span>
          <span class="m-tab-date">${Number(ds.slice(8))}</span>
          ${isToday ? '<span class="m-tab-dot"></span>' : ''}
        </button>
      `;
    });
    html += `</div>`;

    // Header subtitle: the week being shown
    const sub = document.querySelector('#viewModal .page-subtitle');
    const first = dateOf[CONFIG.activeDays[0]];
    const last = dateOf[CONFIG.activeDays[CONFIG.activeDays.length - 1]];
    if (sub && first && last) {
      const f = new Date(first + 'T00:00:00'), l = new Date(last + 'T00:00:00');
      sub.textContent = `${f.getDate()} ${MONTHS[f.getMonth()]} to ${l.getDate()} ${MONTHS[l.getMonth()]}`;
    }

    // Active day classes
    const dayEntries = getClassesForDay(State.matrixSelectedDayIdx);

    html += `<div class="m-matrix-cards">`;
    if (dayEntries.length) {
      // Day summary: what the day looks like in one line
      const starts = dayEntries.map(c => toMinutes(c.start)).filter(m => m >= 0);
      const ends = dayEntries.map(c => toMinutes(c.end)).filter(m => m >= 0);
      const sumDate = new Date(dateOf[State.matrixSelectedDayIdx] + 'T00:00:00');
      html += `<div class="m-day-sum"><span class="m-day-sum-d">${DAY_NAMES[State.matrixSelectedDayIdx]}, ${sumDate.getDate()} ${MONTHS[sumDate.getMonth()]}</span><span class="m-day-sum-n">${dayEntries.length} ${dayEntries.length === 1 ? 'class' : 'classes'}${starts.length && ends.length ? ` · ${format12h(toTimeString(Math.min(...starts)))} to ${format12h(toTimeString(Math.max(...ends)))}` : ''}</span></div>`;
      let lastEnd = null;
      dayEntries.forEach((item, index) => {
        const sM = toMinutes(item.start);
        if (lastEnd !== null && sM - lastEnd >= 15) {
          const g = sM - lastEnd;
          html += `<div class="m-gap"><span>${g >= 60 ? `${Math.floor(g / 60)}h${g % 60 ? ` ${g % 60}m` : ''}` : `${g}m`} free</span></div>`;
        }
        const eM = toMinutes(item.end);
        if (lastEnd === null || eM > lastEnd) lastEnd = eM;
        const startMins = toMinutes(item.start);
        const endMins = toMinutes(item.end);
        const isLive = (State.matrixSelectedDayIdx === todayIdx) && (currentMins >= startMins && currentMins < endMins);
        const isPast = (State.matrixSelectedDayIdx === todayIdx) && (endMins <= currentMins);
        const theme = getSubjectTheme(item.title, item.type);

        const detailsData = {
          title: item.title,
          start: format12h(item.start),
          end: format12h(item.end),
          type: item.type,
          room: item.room,
          instructor: item.instructor,
          plain: true // opened from the Weekly Routine: the class sheet shows no notices either
        };

        html += `
          <div class="m-matrix-card${isLive ? ' live' : ''}${isPast ? ' past' : ''}" style="animation-delay:${index * 0.05}s; background:${theme.bg}; border-color:${theme.border}; color:${cardInk(theme)}" data-detail="${escapeHtml(JSON.stringify(detailsData))}">
            <div class="m-card-time" style="color:${theme.text}">
              <span>${format12h(item.start)}</span>
              <span class="m-card-arrow">→</span>
              <span>${format12h(item.end)}</span>
            </div>
            <div class="m-card-details">
              <div class="m-card-title course-click-title" data-title="${item.title}">${escapeHtml(truncateText(item.title, 10))}</div>
              <div class="m-card-sub" style="color:${theme.text}">
                ${formatRoom(item.room) ? `Room ${formatRoom(item.room)}` : 'No room'}
                ${item.instructor ? `· <span class="teacher-clickable-badge" data-teacher-code="${escapeHtml(item.instructor)}" title="Click to view ${escapeHtml(item.instructor)}'s profile">${escapeHtml(item.instructor)}</span>` : ''}
              </div>
            </div>
            <span class="m-card-badge" style="background:${theme.badge}; color:${cardInk(theme)}">${theme.isLab ? LAB_LABEL_HTML : escapeHtml(item.type)}</span>
          </div>
        `;
      });
    } else {
      html += `<div class="m-matrix-empty">No classes scheduled for ${DAY_NAMES[State.matrixSelectedDayIdx]}</div>`;
    }
    html += `</div>`;

    // Same week, same day, same minute state: keep the existing DOM (and its handlers)
    if (!setHtmlIfChanged(DOM.matrixGrid, html)) { bindMatrixTouchSwipe(); return; }
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
      html += `<div class="day-card${isToday ? ' tod' : ''}"><div class="d-name">${DAY_NAMES[dayIdx]}</div>${isToday ? '<span class="d-tag">TODAY</span>' : ''}</div>`;

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

          const isLive = isToday && currentMins >= toMinutes(match.start) && currentMins < toMinutes(match.end);
          const theme = getSubjectTheme(match.title, match.type);

          const detailsData = {
            title: match.title,
            start: format12h(match.start),
            end: format12h(match.end),
            type: match.type,
            room: match.room,
            instructor: match.instructor,
            plain: true
          };

          html += `
            <div class="t-card${isLive ? ' live' : ''}" style="grid-column: span ${spanCount}; background:${theme.bg}; border-color:${theme.border}; color:#fff" title="Click to view details" data-detail="${escapeHtml(JSON.stringify(detailsData))}">
              <div class="t-subj course-click-title" data-title="${match.title}">${escapeHtml(truncateText(match.title, 10))}</div>
              ${match.instructor ? `<div class="t-inst" style="color:${theme.text}"><span class="teacher-clickable-badge" data-teacher-code="${escapeHtml(match.instructor)}" title="Click to view ${escapeHtml(match.instructor)}'s profile">${escapeHtml(truncateText(match.instructor, 10))}</span></div>` : ''}
              <div class="t-meta">
                <span style="color:${theme.text}">${formatRoom(match.room) || 'No room'}</span>
                <span class="t-badge" style="background:${theme.badge}; color:${cardInk(theme)}">${theme.isLab ? LAB_LABEL_HTML : escapeHtml(match.type)}</span>
              </div>
            </div>`;
        } else {
          const isLiveEmpty = isToday && (currentMins >= slot.startM && currentMins < slot.endM);
          html += `<div class="t-empty${isLiveEmpty ? ' live-empty' : ''}">${isLiveEmpty ? '• FREE •' : '—'}</div>`;
        }
      });
    });

    if (setHtmlIfChanged(DOM.matrixGrid, html)) bindCourseTitleClicks(DOM.matrixGrid);
  }
}
