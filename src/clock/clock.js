import { DOM } from '../core/dom.js';
import { DAY_NAMES, FULL_MONTHS, MONTHS } from '../core/config.js';
import { pad } from '../core/utils.js';

export function updateClock() {
  const now = new Date();
  const hours = now.getHours() % 12 || 12;
  const mins = pad(now.getMinutes());
  const period = now.getHours() >= 12 ? 'PM' : 'AM';

  setRolling(DOM.clockHour, pad(hours));
  setRolling(DOM.clockMin, mins);
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

/** Set text and replay the roll-in animation only when the value actually changed. */
function setRolling(el, text) {
  if (!el || el.textContent === text) return;
  const first = el.textContent === '' || el.dataset.ready !== '1';
  el.textContent = text;
  el.dataset.ready = '1';
  if (first) return;
  el.classList.remove('is-rolling');
  void el.offsetWidth;
  el.classList.add('is-rolling');
}
