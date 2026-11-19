/**
 * Shared by the Notifications page (Upcoming alerts) and the day sheet opened from the bell on Home:
 * the planned alerts of one date as switchable rows, and the handler for those switches.
 */
import { Notifications } from './notifications.js';
import { getSkips, setClassSkipped, setDaySkipped, setItemSkipped, setDeadlineDone } from './notif-store.js';
import { fmtTime } from './planner.js';
import { escapeHtml } from '../core/utils.js';

const ICON = {
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  due: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
};
const KIND_ICON = { class: ICON.bell, start: ICON.bell, briefing: ICON.sun, preview: ICON.moon, test: ICON.test, test_eve: ICON.test, deadline: ICON.due, deadline_day: ICON.due };
const KIND_LABEL = { class: 'Reminder', start: 'Starting', briefing: 'Morning', preview: 'Preview', test: 'Test', test_eve: 'Test', deadline: 'Deadline', deadline_day: 'Deadline' };
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Planned alerts that fall on `date`, one row per class (its "starting" alert follows the same switch). */
export function dayAlerts(plan, date) {
  const day = new Date(`${date}T12:00:00`).toDateString();
  const rows = plan.filter(n => n.at >= Date.now() && new Date(n.at).toDateString() === day);
  const seen = new Set();
  return rows.filter(n => {
    if (n.kind === 'start' && rows.some(r => r.kind === 'class' && r.classKey === n.classKey)) return false;
    if (seen.has(n.key)) return false;
    seen.add(n.key);
    return true;
  });
}

export function alertRowHtml(n, skips, dayOff) {
  const isClass = (n.kind === 'class' || n.kind === 'start' || n.kind === 'test') && n.classKey;
  const off = dayOff || (isClass ? (skips.classes[n.date] || []).includes(n.classKey) : (skips.items.includes(n.key) || (n.deadlineId && skips.deadlines.includes(String(n.deadlineId)))));
  const ctrl = isClass ? `data-skip-class="${escapeHtml(n.date)}|${escapeHtml(n.classKey)}"` : (n.deadlineId ? `data-skip-deadline="${escapeHtml(n.deadlineId)}"` : `data-skip-item="${escapeHtml(n.key)}"`);
  const t = new Date(n.at);
  return `<label class="nf-up-row${off ? ' is-off' : ''}">
      <span class="nf-up-time">${fmtTime(t.getHours() * 60 + t.getMinutes())}</span>
      <span class="nf-up-icon is-${n.kind}">${KIND_ICON[n.kind] || ICON.bell}</span>
      <span class="nf-up-text"><strong>${escapeHtml(n.title)}</strong><span>${escapeHtml(KIND_LABEL[n.kind] || '')}${n.body ? ` · ${escapeHtml(n.body.split('\n')[0])}` : ''}</span></span>
      <input type="checkbox" class="st-switch-input" ${ctrl} ${off ? '' : 'checked'} ${dayOff ? 'disabled' : ''} aria-label="Send this alert">
      <span class="st-switch-ui" aria-hidden="true"></span>
    </label>`;
}

/** Day header (with the whole-day switch) plus its alert rows. */
export function dayBlockHtml(date, plan, skips, label, editable = false) {
  const dayOff = skips.days.includes(date);
  const rows = dayAlerts(plan, date);
  const d = new Date(`${date}T12:00:00`);
  return `<div class="nf-day">
      <label class="nf-day-head">
        <span><strong>${escapeHtml(label || DAY_SHORT[d.getDay()])}</strong><span>${DAY_SHORT[d.getDay()]} ${d.getDate()}${rows.length ? ` · ${rows.length} alert${rows.length === 1 ? '' : 's'}` : ''}</span></span>
        <input type="checkbox" class="st-switch-input" data-skip-day="${date}" ${dayOff ? '' : 'checked'} aria-label="Alerts on this day">
        <span class="st-switch-ui" aria-hidden="true"></span>
      </label>
      ${rows.length ? rows.map(n => alertRowHtml(n, skips, dayOff)).join('') : `<div class="nf-empty">${dayOff ? 'Alerts are off for this day.' : 'Nothing planned.'}</div>`}
      ${editable ? `<button type="button" class="nf-day-edit" data-day-edit="${date}">Customize this day</button>` : ''}
    </div>`;
}

export function upcomingPlan() { return Notifications.getPlan({ ignoreSkips: true }); }
export { getSkips };

/** Handles the switches rendered above. Returns true when the event was one of them. */
export function handleSkipChange(t) {
  if (t.dataset.skipDay) { setDaySkipped(t.dataset.skipDay, !t.checked); return true; }
  if (t.dataset.skipClass) { const [date, key] = t.dataset.skipClass.split('|'); setClassSkipped(date, key, !t.checked); return true; }
  if (t.dataset.skipItem) { setItemSkipped(t.dataset.skipItem, !t.checked); return true; }
  if (t.dataset.skipDeadline) { setDeadlineDone(t.dataset.skipDeadline, !t.checked); return true; }
  return false;
}
