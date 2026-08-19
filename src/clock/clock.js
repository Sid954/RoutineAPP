import { DOM } from '../core/dom.js';
import { DAY_NAMES, FULL_MONTHS, MONTHS } from '../core/config.js';
import { pad } from '../core/utils.js';

export function updateClock() {
  const now = new Date();
  const hours = now.getHours() % 12 || 12;
  const mins = pad(now.getMinutes());
  const period = now.getHours() >= 12 ? 'PM' : 'AM';

  if (DOM.clockHour) DOM.clockHour.textContent = pad(hours);
  if (DOM.clockMin) DOM.clockMin.textContent = mins;
  if (DOM.clockPeriod) DOM.clockPeriod.textContent = period;
  if (DOM.dayDisplay) DOM.dayDisplay.textContent = DAY_NAMES[now.getDay()] || 'Weekend';
  if (DOM.dateDisplay) DOM.dateDisplay.textContent = `${DAY_NAMES[now.getDay()] || ''}, ${now.getDate()} ${FULL_MONTHS[now.getMonth()] || MONTHS[now.getMonth()]}`;
}
