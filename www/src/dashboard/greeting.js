import { DOM } from '../core/dom.js';
import { getClassesForDay } from '../schedule/queries.js';

export function updateGreeting() {
  const hour = new Date().getHours();
  let greeting;
  if (hour >= 5 && hour < 12) greeting = 'Good morning ☀️';
  else if (hour >= 12 && hour < 17) greeting = 'Good afternoon 🌤️';
  else if (hour >= 17 && hour < 21) greeting = 'Good evening 🌅';
  else greeting = 'Good night 🌙';

  const todayClasses = getClassesForDay(new Date().getDay());
  const count = todayClasses.length;
  const sub = count > 0 ? `You have ${count} class${count !== 1 ? 'es' : ''} today` : 'No classes today — enjoy!';

  if (DOM.greetText) DOM.greetText.textContent = greeting;
  if (DOM.greetSub) DOM.greetSub.textContent = sub;
}
