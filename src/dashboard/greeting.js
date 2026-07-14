import { DOM } from '../core/dom.js';
import { getClassesForDay } from '../schedule/queries.js';
import { CONFIG } from '../core/config.js';

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

  if (DOM.greetText) {
    DOM.greetText.innerHTML = `${greeting} <span style="font-size: 11px; font-weight: 800; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); color: var(--accent2); padding: 2px 8px; border-radius: 6px; margin-left: 8px; vertical-align: middle; letter-spacing: 0.5px;">v${CONFIG.version || '1.0.0'}</span>`;
  }
  if (DOM.greetSub) DOM.greetSub.textContent = sub;
}
