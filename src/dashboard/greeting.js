import { DOM } from '../core/dom.js';
import { getClassesForDay } from '../schedule/queries.js';

export function updateGreeting() {
  const hour = new Date().getHours();
  let salutation = 'Good afternoon';
  if (hour >= 5 && hour < 12) salutation = 'Good morning';
  else if (hour >= 12 && hour < 17) salutation = 'Good afternoon';
  else if (hour >= 17 && hour < 21) salutation = 'Good evening';
  else salutation = 'Good night';

  const todayClasses = getClassesForDay(new Date().getDay());
  const count = todayClasses.length;
  const sub = count > 0 ? `${count} session${count !== 1 ? 's' : ''} scheduled` : 'No classes today — enjoy!';

  const salutationEl = document.getElementById('greetSalutation');
  if (salutationEl) salutationEl.textContent = salutation;
  if (DOM.greetText) DOM.greetText.textContent = 'Sid';
  if (DOM.greetSub) DOM.greetSub.textContent = sub;
}
