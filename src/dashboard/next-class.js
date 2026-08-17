import { DOM } from '../core/dom.js';
import { getClassesForDay, getActiveClass, getNextClass } from '../schedule/queries.js';
import { getOverrideFor } from '../announcements/overrides.js';
import { toMinutes, format12h, formatRoom, getCurrentMinutes, escapeHtml } from '../core/utils.js';

export function renderNextClass() {
  const todayIdx = new Date().getDay();
  const holidayOverride = getOverrideFor(todayIdx);
  const subRow = DOM.nextRoom.parentElement;
  const currentMins = getCurrentMinutes();

  const todayClasses = getClassesForDay(todayIdx);

  // If holiday and no online classes are scheduled, render break message and exit
  const hasOnlineClasses = todayClasses.some(c => {
    const ov = getOverrideFor(todayIdx, c.title);
    return ov && ov.type === 'online_class';
  });

  if (holidayOverride && holidayOverride.type === 'holiday' && !hasOnlineClasses) {
    DOM.nextTitle.textContent = 'Enjoy your break!';
    DOM.nextEta.style.display = 'none';
    subRow.style.display = 'none';
    return;
  }

  const activeItem = getActiveClass(todayClasses, currentMins);
  let nextItem = null;

  if (activeItem) {
    const activeEnd = toMinutes(activeItem.end);
    for (const item of todayClasses) {
      if (toMinutes(item.start) >= activeEnd) { nextItem = item; break; }
    }
  } else {
    nextItem = getNextClass(todayClasses, currentMins);
  }

  if (nextItem) {
    const cancelOverride = getOverrideFor(todayIdx, nextItem.title);
    const isCancelled = cancelOverride && cancelOverride.type === 'cancellation';
    const isOnline = cancelOverride && cancelOverride.type === 'online_class';
    const isHolidayCancelled = !isOnline && !isCancelled && holidayOverride && holidayOverride.type === 'holiday';

    const effectiveCancelled = isCancelled || isHolidayCancelled;
    const diff = toMinutes(nextItem.start) - currentMins;

    const teacherHtml = nextItem.instructor
      ? ` (<span class="teacher-clickable-badge" data-teacher-code="${escapeHtml(nextItem.instructor)}" title="Click to view ${escapeHtml(nextItem.instructor)}'s profile">${escapeHtml(nextItem.instructor)}</span>)`
      : '';
    DOM.nextTitle.innerHTML = `${escapeHtml(nextItem.title)}${teacherHtml}`;
    DOM.nextTimeRange.textContent = `${format12h(nextItem.start)} – ${format12h(nextItem.end)}`;
    DOM.nextEta.style.display = 'inline-block';
    subRow.style.display = 'block';
    if (DOM.nextCard) DOM.nextCard.classList.remove('no-classes');

    if (effectiveCancelled) {
      DOM.nextRoom.textContent = isHolidayCancelled ? 'HOLIDAY' : 'CANCELLED';
      DOM.nextEta.textContent = isHolidayCancelled ? 'HOLIDAY' : 'CANCELLED';
    } else {
      DOM.nextRoom.textContent = isOnline ? 'ONLINE' : (formatRoom(nextItem.room) || '—');
      if (diff > 0) {
        const dh = Math.floor(diff / 60);
        const dm = Math.floor(diff % 60);
        DOM.nextEta.textContent = dh > 0 ? `in ${dh}h ${dm}m` : `in ${dm}m`;
      } else {
        DOM.nextEta.textContent = 'now';
      }
    }
  } else {
    DOM.nextTitle.textContent = 'No upcoming classes 🎉';
    DOM.nextEta.style.display = 'none';
    subRow.style.display = 'none';
    if (DOM.nextCard) DOM.nextCard.classList.add('no-classes');
  }
}
