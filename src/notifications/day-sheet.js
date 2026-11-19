/**
 * Day sheet: the bell beside the day title on Home opens it. It edits the notifications of ONE date
 * (viewed date): the whole day on/off, class reminders, their lead time, the morning and evening-before
 * summaries, and each planned alert. Stored as per-date overrides (notif-store.js), planned by planner.js.
 */
import { State } from '../core/state.js';
import { Notifications } from './notifications.js';
import { getPrefs, getDateOverrides, setDateOverride, clearDateOverrides } from './notif-store.js';
import { fmtTime } from './planner.js';
import { alertRowHtml, dayAlerts, upcomingPlan, getSkips, handleSkipChange, ymd, DAY_SHORT } from './upcoming.js';
import { openModal, closeModal } from '../modals/modal.js';

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
    if (b.dataset.openPage) { closeDaySheet(); document.getElementById('notifSettingsBtn')?.click(); }
  });
  return _el;
}

function changed() {
  Notifications.scheduleForToday();
  render();
  updateBellDot();
}

function render() {
  const body = document.getElementById('nfDayBody');
  if (!body || !_date) return;
  const p = getPrefs();
  const ov = getDateOverrides()[_date] || {};
  const skips = getSkips();
  const d = new Date(`${_date}T12:00:00`);
  const today = ymd(new Date());
  const past = _date < today;
  const dayOff = skips.days.includes(_date);
  const label = _date === today ? 'Today' : DAY_SHORT[d.getDay()];
  const eff = (k, dflt) => (ov[k] === undefined ? dflt : ov[k]);
  const lead = ov.lead || 0;
  const plan = upcomingPlan();
  const rows = dayAlerts(plan, _date);
  const inRange = (d - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 864e5 <= 7;

  let html = `<div class="nf-day-head-block"><h2 id="nfDayTitle">${label}, ${MONTHS[d.getMonth()]} ${d.getDate()}</h2><p>Notifications for this day only</p></div>`;
  if (past) {
    html += '<p class="st-sec-note">This day has passed.</p>';
  } else {
    html += sec('', sw(`data-skip-day="${_date}"`, !dayOff, 'Alerts on this day', dayOff ? 'Everything is off for this day' : 'Switch the whole day off'));
    if (!dayOff) {
      html += sec('For this day',
        sw('data-ov="classes"', eff('classes', p.classes.on), 'Class reminders', 'Before each class') +
        `<div class="st-item nf-opt"><span class="nf-opt-label">Remind me before (minutes; usual is ${p.classes.lead})</span>
          <div class="nf-seg" role="radiogroup" aria-label="Remind me before">${[[0, 'Usual'], [5, '5'], [10, '10'], [15, '15'], [20, '20'], [30, '30']].map(([v, t]) => `<button type="button" role="radio" aria-checked="${v === lead}" class="${v === lead ? 'active' : ''}" data-ov-lead="${v}">${t}</button>`).join('')}</div>
        </div>` +
        sw('data-ov="briefing"', eff('briefing', p.briefing.on), 'Morning summary', `At ${fmtTime(p.briefing.time)}`) +
        sw('data-ov="preview"', eff('preview', p.preview.on), 'Evening-before summary', `Sent the night before at ${fmtTime(p.preview.time)}`),
        'These apply to this date only. Usual settings are under Settings, Notifications.');
      html += `<div class="st-sec"><h3 class="st-sec-title">Planned alerts</h3><div class="st-sec-card nf-day-card">${rows.length ? rows.map(n => alertRowHtml(n, skips, false)).join('') : `<div class="nf-empty">${inRange ? 'Nothing planned for this day.' : 'Alerts are planned 7 days ahead, so this day fills in later. Your choices above will apply then.'}</div>`}</div></div>`;
    }
    if (Object.keys(ov).length || dayOff) html += `<button type="button" class="st-btn nf-reset" data-reset="1">Back to usual for this day</button>`;
  }
  html += `<button type="button" class="nf-more" data-open-page="1">All notification settings</button>`;
  body.innerHTML = html;
}

export function openDaySheet(date) {
  _date = date || ymd(State.viewDate || new Date());
  ensure();
  render();
  openModal(_el);
}
export function closeDaySheet() { if (_el) closeModal(_el); }

/** Dot on the bell when the viewed day has its own settings. */
export function updateBellDot() {
  const dot = document.querySelector('#dayNotifBtn .timeline-bell-dot');
  if (!dot) return;
  const date = ymd(State.viewDate || new Date());
  const has = !!getDateOverrides()[date] || getSkips().days.includes(date);
  dot.hidden = !has;
}

export function initDaySheet() {
  const btn = document.getElementById('dayNotifBtn');
  if (!btn || btn._bound) return;
  btn._bound = true;
  btn.addEventListener('click', () => openDaySheet());
  updateBellDot();
}
