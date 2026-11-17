import { DOM } from '../core/dom.js';
import { DAY_NAMES, FULL_MONTHS, MONTHS } from '../core/config.js';
import { pad } from '../core/utils.js';

export function updateClock() {
  const now = new Date();
  const hours = now.getHours() % 12 || 12;
  const mins = pad(now.getMinutes());
  const period = now.getHours() >= 12 ? 'PM' : 'AM';

  setText(DOM.clockHour, pad(hours));
  setText(DOM.clockMin, mins);
  // Minute progress line under the clock + time-of-day tint for the greeting (motion-plus.css)
  const clock = DOM.clockHour && DOM.clockHour.closest('.digital-clock');
  if (clock) {
    clock.style.setProperty('--sec', String(now.getSeconds()));
    if (clock._min !== now.getMinutes()) {
      clock._min = now.getMinutes();
      clock.classList.remove('is-minute');
      void clock.offsetWidth;
      clock.classList.add('is-minute');
    }
  }
  const h = now.getHours();
  document.documentElement.dataset.daypart = h >= 20 || h < 5 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'day' : 'evening';
  if (DOM.clockPeriod) DOM.clockPeriod.textContent = period;
  if (DOM.dateDisplay) DOM.dateDisplay.textContent = `${DAY_NAMES[now.getDay()] || ''}, ${now.getDate()} ${FULL_MONTHS[now.getMonth()] || MONTHS[now.getMonth()]}`;
}

/** Write only when the value changed (avoids needless text reflow every second). */
function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}
