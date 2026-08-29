import { DOM } from '../core/dom.js';
import { getClassesForDay } from '../schedule/queries.js';
import { Storage } from "../storage/storage.js";


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
  const formattedSemester = `${getOrdinalSuffix(rawSemester)} Semester`;
  const sectionText = `Section ${Storage.getSection().toUpperCase()}`;
  const sub = `${formattedSemester} - ${sectionText}`;
  
  if (salutationEl) salutationEl.textContent = salutation;
  if (DOM.greetText) DOM.greetText.textContent = 'Siddd';
  if (DOM.greetSub) DOM.greetSub.textContent = sub;
}
