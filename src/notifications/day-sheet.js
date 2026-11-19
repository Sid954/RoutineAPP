/**
 * Day sheet: the bell beside the day title on Home opens it. It edits the notifications of ONE date:
 * the whole day on/off, class reminders and their lead time, and each planned alert. Swipe sideways (or
 * use the arrows) to move to the next or previous day. Summaries are not per-day: they live on the main
 * Notifications page. Stored as per-date overrides (notif-store.js), planned by planner.js.
 *
 * The bell shows the viewed day's state: plain bell, bell with a cross (day switched off), or a bell
 * with sliders (this day has its own settings).
 */
import { State } from '../core/state.js';
import { Notifications } from './notifications.js';
import { getPrefs, getDateOverrides, setDateOverride, clearDateOverrides } from './notif-store.js';
import { alertRowHtml, dayAlerts, upcomingPlan, getSkips, handleSkipChange, ymd, DAY_SHORT } from './upcoming.js';
import { openModal, closeModal } from '../modals/modal.js';
import { bindMouseDrag } from '../core/desktop-input.js';

const MAX_DAYS_AHEAD = 60;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let _date = '';
let _el = null;

const sw = (attr, on, label, hint = '') => `<label class="st-switch-row st-item">
    <span><strong>${label}</strong>${hint ? `<span>${hint}</span>` : ''}</span>
    <input type="checkbox" class="st-switch-input" ${attr} ${on ? 'checked' : ''}>
    <span class="st-switch-ui" aria-hidden="true"></span>
  </label>`;
const sec = (title, inner, note = '') => `<div class="st-sec">${title ? `<h3 class="st-sec-title">${title}</h3>` : ''}<div class="st-sec-card">${inner}</div>${note ? `<p class="st-sec-note">${note}</p>` : ''}</div>`;

function ensure() {
  if (_el) return _el;
  _el = document.createElement('div');
  _el.className = 'class-sheet-modal-overlay nf-day-overlay';
  _el.id = 'nfDaySheet';
  _el.style.zIndex = '100040';
  _el.innerHTML = `<div class="nt-sheet nf-day-sheet st-page nf-page" role="dialog" aria-modal="true" aria-labelledby="nfDayTitle">
      <div class="nt-grip"></div>
      <button type="button" class="nt-sheet-close" id="nfDayClose" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
      <div class="nt-sheet-body" id="nfDayBody"></div>
    </div>`;
  document.body.appendChild(_el);
  _el.addEventListener('click', e => { if (e.target === _el || e.target.closest('#nfDayClose')) closeDaySheet(); });
  _el.addEventListener('change', e => {
    const t = e.target;
    if (handleSkipChange(t)) return changed();
    if (t.dataset.ov) {
      const p = getPrefs();
      const dflt = { classes: p.classes.on, briefing: p.briefing.on, preview: p.preview.on }[t.dataset.ov];
      setDateOverride(_date, t.dataset.ov, t.checked === dflt ? undefined : t.checked);
      changed();
    }
  });
  _el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ovLead !== undefined) { const v = Number(b.dataset.ovLead); setDateOverride(_date, 'lead', v > 0 ? v : undefined); changed(); }
    if (b.dataset.reset) { clearDateOverrides(_date); changed(); }
    if (b.dataset.dayStep) shiftDay(Number(b.dataset.dayStep));
    if (b.dataset.openPage) { closeDaySheet(); document.getElementById('notifSettingsBtn')?.click(); }
  });
  // Swipe sideways (touch, or a mouse drag on desktop) to step through the days
  let sx = 0, sy = 0, tracking = false;
  const begin = (x, y) => { sx = x; sy = y; tracking = true; };
  const finish = (x, y) => {
    if (!tracking) return;
    tracking = false;
    const dx = x - sx, dy = y - sy;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftDay(dx < 0 ? 1 : -1);
  };
  const sheet = _el.querySelector('.nf-day-sheet');
  sheet.addEventListener('touchstart', e => { if (e.touches.length === 1) begin(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  sheet.addEventListener('touchend', e => { const t = e.changedTouches[0]; if (t) finish(t.clientX, t.clientY); }, { passive: true });
  sheet.addEventListener('touchcancel', () => { tracking = false; }, { passive: true });
  bindMouseDrag(sheet, { start: (x, y) => begin(x, y), move: () => {}, end: (x, y, ev) => (ev ? finish(x, y) : (tracking = false)) });
  return _el;
}

const dayStr = (base, n) => { const d = new Date(`${base}T12:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
/** Step to the next (+1) or previous (-1) day; today is the first day and 60 days ahead the last. */
function shiftDay(dir) {
  const next = dayStr(_date, dir);
  const today = ymd(new Date());
  if (next < today || next > dayStr(today, MAX_DAYS_AHEAD)) return;
  _date = next;
  render();
  const body = document.getElementById('nfDayBody');
  if (body && body.animate && document.documentElement.dataset.motion !== 'off') body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
}

function changed() {
  Notifications.scheduleForToday();
  render();
  updateBell();
}

function render() {
  const body = document.getElementById('nfDayBody');
  if (!body || !_date) return;
  const p = getPrefs();
  const ov = getDateOverrides()[_date] || {};
  const skips = getSkips();
  const d = new Date(`${_date}T12:00:00`);
  const today = ymd(new Date());
  const dayOff = skips.days.includes(_date);
  const custom = Object.keys(ov).length > 0;
  const label = _date === today ? 'Today' : (_date === dayStr(today, 1) ? 'Tomorrow' : DAY_SHORT[d.getDay()]);
  const eff = (k, dflt) => (ov[k] === undefined ? dflt : ov[k]);
  const lead = ov.lead || 0;
  const rows = dayAlerts(upcomingPlan(), _date);
  const inRange = (d - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 864e5 <= 7;
  const canPrev = _date > today, canNext = _date < dayStr(today, MAX_DAYS_AHEAD);
  const chev = dir => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="${dir < 0 ? '15 18 9 12 15 6' : '9 18 15 12 9 6'}"/></svg>`;

  let html = `<div class="nf-day-nav">
      <button type="button" class="nf-day-step" data-day-step="-1" aria-label="Previous day" ${canPrev ? '' : 'disabled'}>${chev(-1)}</button>
      <div class="nf-day-head-block"><h2 id="nfDayTitle">${label}, ${MONTHS[d.getMonth()]} ${d.getDate()}</h2><p>${DAY_SHORT[d.getDay()]}${dayOff ? ' · Alerts off' : custom ? ' · Customized' : ' · Usual settings'}</p></div>
      <button type="button" class="nf-day-step" data-day-step="1" aria-label="Next day" ${canNext ? '' : 'disabled'}>${chev(1)}</button>
    </div>`;
  html += sec('', sw(`data-skip-day="${_date}"`, !dayOff, 'Alerts on this day', dayOff ? 'Everything is off for this day' : 'Switch the whole day off'));
  if (!dayOff) {
    html += sec('Class reminders',
      sw('data-ov="classes"', eff('classes', p.classes.on), 'Class reminders', 'Before each class') +
      `<div class="st-item nf-opt"><span class="nf-opt-label">Remind me before (minutes; usual is ${p.classes.lead})</span>
        <div class="nf-seg" role="radiogroup" aria-label="Remind me before">${[[0, 'Usual'], [5, '5'], [10, '10'], [15, '15'], [20, '20'], [30, '30']].map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === lead}" class="${v === lead ? 'active' : ''}" data-ov-lead="${v}">${t}</button>`).join('')}</div>
      </div>`,
      'Applies to this date only. Morning and evening summaries are set in Settings, Notifications.');
    html += `<div class="st-sec"><h3 class="st-sec-title">Planned alerts</h3><div class="st-sec-card nf-day-card">${rows.length ? rows.map(n => alertRowHtml(n, skips, false)).join('') : `<div class="nf-empty">${inRange ? 'Nothing planned for this day.' : 'Alerts are planned 7 days ahead, so this day fills in later. Your choices above will apply then.'}</div>`}</div></div>`;
  }
  if (custom || dayOff) html += `<button type="button" class="st-btn nf-reset" data-reset="1">Back to usual for this day</button>`;
  html += `<p class="nf-swipe-hint">Swipe sideways for the next day</p><button type="button" class="nf-more" data-open-page="1">All notification settings</button>`;
  body.innerHTML = html;
}

export function openDaySheet(date) {
  _date = date || ymd(State.viewDate || new Date());
  ensure();
  render();
  openModal(_el);
}
export function closeDaySheet() { if (_el) closeModal(_el); }

const BELL = {
  normal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  // Switched off for the day: bell with a cross badge
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 7.5A4.5 4.5 0 0 0 7.5 8c0 6-2.5 8-2.5 8h8"/><path d="M10.27 20a2 2 0 0 0 3.46 0"/><path d="M16 12l5 5M21 12l-5 5" stroke-width="2.4"/></svg>',
  // Customized for the day: bell with a small sliders badge
  custom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8.5A5.5 5.5 0 0 0 5.5 9c0 6-2.5 8-2.5 8h10"/><path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M15 13h6M15 18h6" stroke-width="2.2"/><circle cx="17" cy="13" r="1.6" fill="currentColor" stroke="none"/><circle cx="19.5" cy="18" r="1.6" fill="currentColor" stroke="none"/></svg>'
};

/** The bell on Home shows the viewed day's state: usual, switched off (cross) or customized (sliders). */
export function updateBell() {
  const btn = document.getElementById('dayNotifBtn');
  if (!btn) return;
  const date = ymd(State.viewDate || new Date());
  const state = getSkips().days.includes(date) ? 'off' : (getDateOverrides()[date] ? 'custom' : 'normal');
  if (btn.dataset.state === state) return;
  btn.dataset.state = state;
  btn.innerHTML = BELL[state];
  btn.title = state === 'off' ? 'Notifications are off for this day' : state === 'custom' ? 'This day has its own notification settings' : 'Notifications for this day';
}

export function initDaySheet() {
  const btn = document.getElementById('dayNotifBtn');
  if (!btn || btn._bound) return;
  btn._bound = true;
  btn.addEventListener('click', () => openDaySheet());
  updateBell();
}
