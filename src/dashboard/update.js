import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { DOM } from '../core/dom.js';
import { getCurrentMinutes, toMinutes } from '../core/utils.js';
import { renderCurrentClass } from './current-class.js';
import { renderNextClass } from './next-class.js';
import { updateGreeting } from './greeting.js';
import { updateStats } from './stats.js';
import { renderTimeline } from '../timeline/timeline.js';
import { renderWeeklyMatrix } from '../weekly-matrix/matrix.js';
import { updateNativeWidget } from '../widget/widget.js';

export function updateDashboard() {
  const currentMins = getCurrentMinutes();
  if (State.lastRenderedMinute === currentMins) return;
  State.lastRenderedMinute = currentMins;
  updateGreeting();
  updateStats();
  renderCurrentClass();
  renderNextClass();
  renderTimeline();
  if (DOM.viewModal && DOM.viewModal.classList.contains('open')) renderWeeklyMatrix();
  updateNativeWidget();
}

export function forceUpdate() {
  State.lastRenderedMinute = -1;
  updateDashboard();
}
