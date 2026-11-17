/**
 * Notifications page (#notifModal, a full page opened from Settings → Notifications).
 * Sections: master switch + health, quick pause, coming up (today/tomorrow, each alert and each
 * day can be switched off), what you get (per type, with options), notice types, weekdays and
 * quiet hours. Every change saves at once and re-plans (Notifications.scheduleForToday).
 */
import { Notifications } from './notifications.js';
import { getPrefs, updatePrefs, getPause, getSkips, setClassSkipped, setDaySkipped, setItemSkipped, setDeadlineDone, endOfToday } from './notif-store.js';
import { fmtTime, NOTICE_TYPES } from './planner.js';
import { escapeHtml } from '../core/utils.js';

const $ = id => document.getElementById(id);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]; // university week starts on Saturday
const NOTICE_LABEL = { cancellation: 'Cancelled', holiday: 'Holiday', class_test: 'Tests', online_class: 'Online', rescheduled: 'Moved', assignment: 'Assignments', general: 'General' };
const KIND_LABEL = { class: 'Reminder', start: 'Starting', briefing: 'Morning', preview: 'Preview', test: 'Test', test_eve: 'Test', deadline: 'Deadline', deadline_day: 'Deadline' };

const ICON = {
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  test: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  due: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/></svg>'
};
const KIND_ICON = { class: ICON.bell, start: ICON.bell, briefing: ICON.sun, preview: ICON.moon, test: ICON.test, test_eve: ICON.test, deadline: ICON.due, deadline_day: ICON.due };

const toTime = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromTime = v => { const [h, m] = String(v || '').split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null; };

function sw(pref, on, label, hint = '') {
  return `<label class="st-switch-row nf-row">
      <span><strong>${label}</strong>${hint ? `<span>${hint}</span>` : ''}</span>
      <input type="checkbox" class="st-switch-input" data-pref="${pref}" ${on ? 'checked' : ''}>
      <span class="st-switch-ui" aria-hidden="true"></span>
    </label>`;
}
function seg(pref, value, options, label) {
  return `<div class="nf-opt"><span class="nf-opt-label">${label}</span>
      <div class="nf-seg" role="radiogroup" aria-label="${label}">${options.map(([v, t]) => `<button type="button" role="radio" aria-checked="${String(v) === String(value)}" class="${String(v) === String(value) ? 'active' : ''}" data-pref="${pref}" data-val="${v}">${t}</button>`).join('')}</div>
    </div>`;
}
function timeField(pref, mins, label) {
  return `<label class="nf-opt nf-time"><span class="nf-opt-label">${label}</span><input type="time" class="st-input nf-time-input" data-pref="${pref}" value="${toTime(mins)}"></label>`;
}

/* ── Sections ─────────────────────────────────────────────────────────────── */
function renderStatus(prefs, pause, perm) {
  const master = $('nfMaster');
  if (master) master.checked = prefs.enabled;
  const line = $('nfStatusLine');
  if (!line) return;
  if (perm !== 'granted') line.textContent = 'Allow notifications on this phone to get them';
  else if (!prefs.enabled) line.textContent = 'Off. Nothing will be sent.';
  else if (pause === -1) line.textContent = 'Paused until you resume';
  else if (pause) line.textContent = `Paused until ${new Date(pause).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
  else {
    const n = Notifications.getPlan().length;
    line.textContent = n ? `On. ${n} alert${n === 1 ? '' : 's'} planned this week` : 'On. Nothing planned this week';
  }
  document.querySelector('#notifModal .st-body')?.classList.toggle('nf-off', !prefs.enabled);
}

function renderPause(pause) {
  const el = $('nfPause');
  if (!el) return;
  const paused = pause !== 0;
  const until = pause === -1 ? 'until you resume' : `until ${new Date(pause).toLocaleString('en-US', { weekday: pause > endOfToday() ? 'short' : undefined, hour: 'numeric', minute: '2-digit' })}`;
  el.innerHTML = `${paused ? `<div class="nf-paused"><span class="nf-paused-icon">${ICON.pause}</span><div><strong>Paused ${until}</strong><span>No reminders or notices until then.</span></div><button type="button" class="st-btn st-btn-primary" data-pause="resume">Resume</button></div>` : ''}
    <div class="nf-chips">
      <button type="button" data-pause="60">1 hour</button>
      <button type="button" data-pause="180">3 hours</button>
      <button type="button" data-pause="today">Rest of today</button>
      <button type="button" data-pause="off">Until I resume</button>
    </div>`;
}

function upcomingRows(plan, date, skips, dayOff) {
  const rows = plan.filter(n => n.at >= Date.now() && new Date(n.at).toDateString() === new Date(`${date}T12:00:00`).toDateString());
  // Show each class once (its reminder); the "starting" alert follows the same switch
  const seen = new Set();
  return rows.filter(n => {
    if (n.kind === 'start' && rows.some(r => r.kind === 'class' && r.classKey === n.classKey)) return false;
    if (seen.has(n.key)) return false;
    seen.add(n.key);
    return true;
  }).map(n => {
    const isClass = (n.kind === 'class' || n.kind === 'start' || n.kind === 'test') && n.classKey;
    const off = dayOff || (isClass ? ((skips.classes[n.date] || []).includes(n.classKey)) : (skips.items.includes(n.key) || (n.deadlineId && skips.deadlines.includes(String(n.deadlineId)))));
    const ctrl = isClass ? `data-skip-class="${escapeHtml(n.date)}|${escapeHtml(n.classKey)}"` : (n.deadlineId ? `data-skip-deadline="${escapeHtml(n.deadlineId)}"` : `data-skip-item="${escapeHtml(n.key)}"`);
    return `<label class="nf-up-row${off ? ' is-off' : ''}">
        <span class="nf-up-time">${fmtTime(new Date(n.at).getHours() * 60 + new Date(n.at).getMinutes())}</span>
        <span class="nf-up-icon is-${n.kind}">${KIND_ICON[n.kind] || ICON.bell}</span>
        <span class="nf-up-text"><strong>${escapeHtml(n.title)}</strong><span>${escapeHtml(KIND_LABEL[n.kind] || '')}${n.body ? ` · ${escapeHtml(n.body.split('\n')[0])}` : ''}</span></span>
        <input type="checkbox" class="st-switch-input" ${ctrl} ${off ? '' : 'checked'} ${dayOff ? 'disabled' : ''} aria-label="Send this alert">
        <span class="st-switch-ui" aria-hidden="true"></span>
      </label>`;
  });
}

function renderUpcoming(prefs, perm) {
  const el = $('nfUpcoming');
  if (!el) return;
  if (!prefs.enabled) { el.innerHTML = '<div class="nf-empty">Notifications are off.</div>'; return; }
  const plan = Notifications.getPlan({ ignoreSkips: true });
  const skips = getSkips();
  const now = new Date();
  const dates = [ymd(now), ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))];
  const html = dates.map((date, i) => {
    const dayOff = skips.days.includes(date);
    const rows = upcomingRows(plan, date, skips, dayOff);
    const d = new Date(`${date}T12:00:00`);
    return `<div class="nf-day">
        <label class="nf-day-head">
          <span><strong>${i === 0 ? 'Today' : 'Tomorrow'}</strong><span>${DAY_SHORT[d.getDay()]} ${d.getDate()}${rows.length ? ` · ${rows.length} alert${rows.length === 1 ? '' : 's'}` : ''}</span></span>
          <input type="checkbox" class="st-switch-input" data-skip-day="${date}" ${dayOff ? '' : 'checked'} aria-label="Alerts on this day">
          <span class="st-switch-ui" aria-hidden="true"></span>
        </label>
        ${rows.length ? rows.join('') : `<div class="nf-empty">${dayOff ? 'Alerts are off for this day.' : 'Nothing planned.'}</div>`}
      </div>`;
  }).join('');
  el.innerHTML = (perm !== 'granted' ? '<div class="nf-note">Allow notifications above to receive these.</div>' : '') + html;
}

function renderTypes(p) {
  const el = $('nfTypes');
  if (!el) return;
  const card = (body) => `<div class="st-card nf-type">${body}</div>`;
  el.innerHTML = [
    card(`${sw('classes.on', p.classes.on, 'Class reminders', 'Before each class, with room and teacher')}
      ${p.classes.on ? `<div class="nf-opts">
        ${seg('classes.lead', p.classes.lead, [[5, '5 min'], [10, '10'], [15, '15'], [20, '20'], [30, '30']], 'Remind me')}
        ${seg('classes.labLead', p.classes.labLead, [[0, 'Same'], [15, '15 min'], [20, '20'], [30, '30']], 'For labs')}
        ${seg('classes.scope', p.classes.scope, [['all', 'Every class'], ['first', 'First class only']], 'Which classes')}
        ${sw('classes.atStart', p.classes.atStart, 'Also when a class starts')}
      </div>` : ''}`),
    card(`${sw('briefing.on', p.briefing.on, 'Morning summary', "Today's classes, cancellations, tests and deadlines")}
      ${p.briefing.on ? `<div class="nf-opts">${timeField('briefing.time', p.briefing.time, 'At')}</div>` : ''}`),
    card(`${sw('preview.on', p.preview.on, 'Tomorrow preview', 'The evening before: classes, changes, tests, deadlines')}
      ${p.preview.on ? `<div class="nf-opts">${timeField('preview.time', p.preview.time, 'At')}</div>` : ''}`),
    card(`${sw('tests.on', p.tests.on, 'Tests', 'A reminder before the test class')}
      ${p.tests.on ? `<div class="nf-opts">
        ${seg('tests.lead', p.tests.lead, [[15, '15 min'], [30, '30'], [60, '1 hour'], [120, '2 hours']], 'Remind me')}
        ${p.preview.on ? '' : sw('tests.eveningBefore', p.tests.eveningBefore, 'Heads-up the evening before')}
      </div>` : ''}`),
    card(`${sw('deadlines.on', p.deadlines.on, 'Assignment deadlines', 'From assignment notices; tap Done to stop them')}
      ${p.deadlines.on ? `<div class="nf-opts">
        ${seg('deadlines.hoursBefore', p.deadlines.hoursBefore, [[0, 'Off'], [1, '1 hour'], [3, '3'], [6, '6'], [12, '12']], 'Before it is due')}
        ${p.preview.on ? '' : sw('deadlines.dayBefore', p.deadlines.dayBefore, 'Heads-up the evening before')}
      </div>` : ''}`)
  ].join('');
}

function renderNotices(p) {
  const el = $('nfNotices');
  if (!el) return;
  const unsupported = Notifications.serverPrefsStatus() === 'unsupported';
  el.innerHTML = `${sw('notices.on', p.notices.on, 'Notice alerts', 'Cancellations, tests, holidays and more, as they are posted')}
    ${p.notices.on ? `<div class="nf-opts"><span class="nf-opt-label">Alert me about</span>
      <div class="nf-chips nf-toggle-chips">${NOTICE_TYPES.map(t => `<button type="button" data-notice-type="${t}" aria-pressed="${p.notices.types[t] !== false}" class="${p.notices.types[t] !== false ? 'active' : ''}">${NOTICE_LABEL[t]}</button>`).join('')}</div>
      ${unsupported ? '<p class="nf-note">These switches apply to notices shown while the app is open. Pushes start following them after the server update.</p>' : ''}
    </div>` : ''}`;
}

function renderWhen(p) {
  const el = $('nfWhen');
  if (!el) return;
  el.innerHTML = `<div class="nf-opt"><span class="nf-opt-label">Days with class reminders and summaries</span>
      <div class="nf-weekdays">${WEEK_ORDER.map(d => `<button type="button" data-weekday="${d}" aria-pressed="${p.days.includes(d)}" class="${p.days.includes(d) ? 'active' : ''}">${DAY_SHORT[d]}</button>`).join('')}</div>
    </div>
    ${sw('quiet.on', p.quiet.on, 'Quiet hours', 'No reminders, and notices arrive without sound')}
    ${p.quiet.on ? `<div class="nf-opts nf-quiet">${timeField('quiet.from', p.quiet.from, 'From')}${timeField('quiet.to', p.quiet.to, 'To')}</div>` : ''}`;
}

export async function renderNotifCenter() {
  const page = $('notifModal');
  if (!page) return;
  const prefs = getPrefs();
  const pause = getPause();
  const perm = await Notifications.updatePermissionUI();
  renderStatus(prefs, pause, perm);
  renderPause(pause);
  renderUpcoming(prefs, perm);
  renderTypes(prefs);
  renderNotices(prefs);
  renderWhen(prefs);
}

/** Short status for Settings → Notifications. */
export function notifSummary() {
  const p = getPrefs();
  const pause = getPause();
  if (!p.enabled) return { text: 'Off', warn: true };
  if (pause === -1) return { text: 'Paused until you resume', warn: true };
  if (pause) return { text: `Paused until ${new Date(pause).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`, warn: true };
  const next = Notifications.getPlan()[0];
  return { text: next ? `Next: ${next.title}` : 'On', warn: false };
}

/* ── Events ───────────────────────────────────────────────────────────────── */
let _bound = false;
function changed(syncServer) {
  Notifications.scheduleForToday();
  if (syncServer) Notifications.syncServerPrefs();
  renderNotifCenter();
}

function setPref(path, value) {
  const [section, field] = path.split('.');
  updatePrefs(section, { [field]: value });
  changed(section === 'notices' || section === 'quiet');
}

export function initNotifCenter() {
  if (_bound) return;
  const page = $('notifModal');
  if (!page) return;
  _bound = true;

  page.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'nfMaster') {
      if (t.checked && (await Notifications.getPermission()) !== 'granted') {
        const ok = await Notifications.requestPermission();
        if (!ok) { t.checked = false; renderNotifCenter(); return; }
      }
      Notifications.setEnabled(t.checked);
      renderNotifCenter();
      return;
    }
    if (t.dataset.pref) {
      if (t.type === 'checkbox') return setPref(t.dataset.pref, t.checked);
      if (t.type === 'time') { const m = fromTime(t.value); if (m !== null) setPref(t.dataset.pref, m); return; }
    }
    if (t.dataset.skipDay) { setDaySkipped(t.dataset.skipDay, !t.checked); return changed(false); }
    if (t.dataset.skipClass) { const [date, key] = t.dataset.skipClass.split('|'); setClassSkipped(date, key, !t.checked); return changed(false); }
    if (t.dataset.skipItem) { setItemSkipped(t.dataset.skipItem, !t.checked); return changed(false); }
    if (t.dataset.skipDeadline) { setDeadlineDone(t.dataset.skipDeadline, !t.checked); return changed(false); }
  });

  page.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !page.contains(b)) return;
    if (b.dataset.pref && b.dataset.val !== undefined) {
      const raw = b.dataset.val;
      setPref(b.dataset.pref, /^\d+$/.test(raw) ? Number(raw) : raw);
      return;
    }
    if (b.dataset.noticeType) {
      const p = getPrefs();
      const types = { ...p.notices.types, [b.dataset.noticeType]: p.notices.types[b.dataset.noticeType] === false };
      updatePrefs('notices', { types });
      return changed(true);
    }
    if (b.dataset.weekday !== undefined) {
      const d = Number(b.dataset.weekday);
      const days = new Set(getPrefs().days);
      days.has(d) ? days.delete(d) : days.add(d);
      updatePrefs({ days: Array.from(days).sort() });
      return changed(false);
    }
    if (b.dataset.pause) {
      const v = b.dataset.pause;
      if (v === 'resume') Notifications.resume();
      else if (v === 'today') Notifications.pause(endOfToday());
      else if (v === 'off') Notifications.pause(-1);
      else Notifications.pause(Date.now() + Number(v) * 60000);
      renderNotifCenter();
    }
  });
}
