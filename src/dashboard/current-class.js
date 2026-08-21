import { DOM } from '../core/dom.js';
import { getClassesForDay, getActiveClass } from '../schedule/queries.js';
import { getOverrideFor } from '../announcements/overrides.js';
import { toMinutes, format12h, formatRoom, getCurrentMinutes, toTimeString, escapeHtml } from '../core/utils.js';

export function renderCurrentClass() {
  const todayDate = new Date();
  const todayIdx = todayDate.getDay();
  const holidayOverride = getOverrideFor(todayDate);
  const progressSection = DOM.currentBar.parentElement.parentElement;
  const roomPill = DOM.currentRoom;
  const timePill = DOM.currentTimeRange;

  if (holidayOverride && holidayOverride.type === 'holiday') {
    // Check if there's an online class right now that overrides the holiday
    const todayClasses = getClassesForDay(todayIdx);
    const currentMins = getCurrentMinutes();
    const activeOnline = todayClasses.find(c => {
      const ov = getOverrideFor(todayDate, c.title);
      return ov && ov.type === 'online_class' &&
             currentMins >= toMinutes(c.start) && currentMins < toMinutes(c.end);
    });
    if (!activeOnline) {
      progressSection.style.display = 'block';
      roomPill.parentElement.style.display = 'flex';
      timePill.style.display = 'inline-block';

      DOM.currentTitle.textContent = 'Holiday / Day Off 🎉';
      roomPill.textContent = 'HOLIDAY';
      timePill.textContent = 'All classes suspended';
      DOM.currentElapsed.textContent = 'Classes off';
      DOM.currentBar.style.width = '0%';
      DOM.currentRemaining.textContent = holidayOverride.announcement.title;
      return;
    }
  }

  const todayClasses = getClassesForDay(todayIdx);
  const currentMins = getCurrentMinutes();
  let activeItem = getActiveClass(todayClasses, currentMins);
  if (activeItem) {
    const cancelOverride = getOverrideFor(todayDate, activeItem.title);
    if (cancelOverride && cancelOverride.type === 'cancellation') {
      activeItem = null;
    }
  }

  if (activeItem) {
    const cancelOverride = getOverrideFor(todayDate, activeItem.title);
    const isOnline = cancelOverride && cancelOverride.type === 'online_class';

    progressSection.style.display = 'block';
    roomPill.parentElement.style.display = 'flex';
    timePill.style.display = 'inline-block';

    if (isOnline) {
      let link = '';
      if (cancelOverride.announcement.announcement) {
        try {
          const parsed = JSON.parse(cancelOverride.announcement.announcement);
          link = parsed.platform || '';
        } catch (e) {
          link = cancelOverride.announcement.announcement;
        }
      }
      DOM.currentTitle.textContent = `${activeItem.title} (ONLINE 📡)`;
      roomPill.textContent = 'ONLINE';
      timePill.textContent = `${format12h(activeItem.start)} – ${format12h(activeItem.end)}`;
      DOM.currentElapsed.textContent = 'Virtual class';
      DOM.currentBar.style.width = '100%';
      DOM.currentRemaining.textContent = link ? `Platform: ${link}` : 'Check your class group for the link';
    } else {
      const startMins = toMinutes(activeItem.start);
      const endMins = toMinutes(activeItem.end);
      const elapsed = currentMins - startMins;
      const total = endMins - startMins;
      const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));

      const teacherHtml = activeItem.instructor
        ? ` (<span class="teacher-clickable-badge" data-teacher-code="${escapeHtml(activeItem.instructor)}" title="Click to view ${escapeHtml(activeItem.instructor)}'s profile">${escapeHtml(activeItem.instructor)}</span>)`
        : '';
      DOM.currentTitle.innerHTML = `${escapeHtml(activeItem.title)}${teacherHtml}`;
      roomPill.textContent = formatRoom(activeItem.room) || '—';
      timePill.textContent = `${format12h(activeItem.start)} – ${format12h(activeItem.end)}`;
      DOM.currentElapsed.textContent = `${toTimeString(elapsed)} elapsed`;
      DOM.currentBar.style.width = `${pct}%`;

      const remaining = total - elapsed;
      if (remaining > 0) {
        const rh = Math.floor(remaining / 60);
        const rm = Math.floor(remaining % 60);
        DOM.currentRemaining.textContent = `Remaining: ${rh > 0 ? rh + 'h ' : ''}${rm}m`;
      } else {
        DOM.currentRemaining.textContent = 'Almost done!';
      }
    }
    if (DOM.currentCard) {
      DOM.currentCard.classList.remove('free-time');
      DOM.currentCard.classList.add('in-class');
    }
  } else {
    progressSection.style.display = 'none';
    roomPill.parentElement.style.display = 'none';
    timePill.style.display = 'none';
    DOM.currentTitle.textContent = 'Free Time 🌴';
    if (DOM.currentCard) {
      DOM.currentCard.classList.add('free-time');
      DOM.currentCard.classList.remove('in-class');
    }
  }
}
