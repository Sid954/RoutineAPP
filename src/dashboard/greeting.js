import { DOM } from '../core/dom.js';
import { getClassesForDay } from '../schedule/queries.js';
import { Storage } from "../storage/storage.js";


const SALUTATION_ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>',
  sunset: '<path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="16 5 12 9 8 5"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
};

export function updateGreeting() {
  const hour = new Date().getHours();
  let salutation = 'Good afternoon';
  if (hour >= 5 && hour < 12) salutation = 'Good morning';
  else if (hour >= 12 && hour < 17) salutation = 'Good afternoon';
  else if (hour >= 17 && hour < 21) salutation = 'Good evening';
  else salutation = 'Good night';

  const todayClasses = getClassesForDay(new Date().getDay());

  const salutationEl = document.getElementById('greetSalutation');


  function getOrdinalSuffix(num) {
    const n = Number(num);
    if (n === 1) return `${n}st`;
    if (n === 2) return `${n}nd`;
    if (n === 3) return `${n}rd`;
    return `${n}th`;
  }
  const rawSemester = Storage.getSemester();
  const sub = `${getOrdinalSuffix(rawSemester)} semester · Section ${String(Storage.getSection()).toUpperCase()}`;
  
  if (salutationEl) salutationEl.textContent = salutation;

  // Icon follows the time of day (it was always a sun, even for "Good night")
  const iconEl = document.querySelector('.salutation-icon');
  const iconKey = (hour >= 5 && hour < 17) ? 'sun' : (hour >= 17 && hour < 21) ? 'sunset' : 'moon';
  if (iconEl && iconEl.dataset.icon !== iconKey) {
    iconEl.dataset.icon = iconKey;
    iconEl.innerHTML = SALUTATION_ICONS[iconKey];
  }
  // Per-user name from Settings / onboarding (was hardcoded, so every user saw the developer's name)
  if (DOM.greetText) DOM.greetText.textContent = Storage.getDisplayName() || 'Student';
  if (DOM.greetSub) DOM.greetSub.textContent = sub;
}
