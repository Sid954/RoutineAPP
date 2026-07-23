import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { DOM } from '../core/dom.js';
import { getCurrentMinutes, toMinutes } from '../core/utils.js';
import { renderCurrentClass } from './current-class.js';
import { renderNextClass } from './next-class.js';
import { renderTimeline } from '../timeline/timeline.js';
import { renderWeeklyMatrix } from '../weekly-matrix/matrix.js';
import { updateNativeWidget } from '../widget/widget.js';

function checkAutoSwitchTomorrow() {
  const realTodayIdx = new Date().getDay();
  if (!CONFIG.activeDays.includes(realTodayIdx)) return;
  const todayEntries = State.schedule[realTodayIdx] || [];
  if (!todayEntries.length) return;
  const lastClassEnd = Math.max(...todayEntries.map(x => toMinutes(x.end)));
  if (getCurrentMinutes() >= lastClassEnd && State.currentViewDayIdx === realTodayIdx) {
    const currIndex = CONFIG.activeDays.indexOf(realTodayIdx);
    State.currentViewDayIdx = CONFIG.activeDays[(currIndex + 1) % CONFIG.activeDays.length];
  }
}

export function updateDashboard() {
  const currentMins = getCurrentMinutes();
  if (State.lastRenderedMinute === currentMins) return;
  State.lastRenderedMinute = currentMins;
  checkAutoSwitchTomorrow();
  renderCurrentClass();
  renderNextClass();
  renderTimeline();
  if (DOM.viewModal.classList.contains('open')) renderWeeklyMatrix();
  updateNativeWidget();
}

export function forceUpdate() {
  State.lastRenderedMinute = -1;
  updateDashboard();
}
