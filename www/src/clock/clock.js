import { DOM } from '../core/dom.js';
import { DAY_NAMES, MONTHS } from '../core/config.js';
import { pad } from '../core/utils.js';

export function updateClock() {
  const now = new Date();
  const hours = now.getHours() % 12 || 12;
  const mins = pad(now.getMinutes());
  const period = now.getHours() >= 12 ? 'PM' : 'AM';

  DOM.clockHour.textContent = pad(hours);
  DOM.clockMin.textContent = mins;
  DOM.clockPeriod.textContent = period;
  DOM.dayDisplay.textContent = DAY_NAMES[now.getDay()] || 'Weekend';
  DOM.dateDisplay.textContent = `${MONTHS[now.getMonth()]} ${now.getDate()}`;
}
