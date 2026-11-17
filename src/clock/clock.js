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
  if (clock && clock._min !== now.getMinutes()) {
    clock._min = now.getMinutes();
    startMinuteLine(clock, now);
  }
  const h = now.getHours();
  document.documentElement.dataset.daypart = h >= 20 || h < 5 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'day' : 'evening';
  if (DOM.clockPeriod) DOM.clockPeriod.textContent = period;
  if (DOM.dateDisplay) DOM.dateDisplay.textContent = `${DAY_NAMES[now.getDay()] || ''}, ${now.getDate()} ${FULL_MONTHS[now.getMonth()] || MONTHS[now.getMonth()]}`;
}

/**
 * The thin line under the clock fills across each minute. Driven by the Web Animations API with
 * literal transform values so it runs on the GPU. (The CSS version had calc(var(--sec)) inside its
 * keyframes, which Chrome can't composite, so the main thread recalculated styles every frame.)
 */
function startMinuteLine(clock, now) {
  const motion = document.documentElement.dataset.motion;
  const sec = now.getSeconds() + now.getMilliseconds() / 1000;
  const from = `scaleX(${(sec / 60).toFixed(4)})`;
  if (clock._line) { clock._line.cancel(); clock._line = null; }
  clock.style.setProperty('--sec', String(Math.floor(sec)));
  if (!clock.animate || motion === 'off') return;
  try {
    clock._line = clock.animate([{ transform: from }, { transform: 'scaleX(1)' }], {
      duration: Math.max(0, (60 - sec) * 1000), easing: 'linear', fill: 'forwards', pseudoElement: '::after'
    });
  } catch (e) { /* pseudoElement unsupported: the static --sec position still shows */ }
}

/** Write only when the value changed (avoids needless text reflow every second). */
function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}
