/**
 * Notifications page (#notifModal, opened from Settings → Notifications), One UI style:
 * a hub (master switch, pause, one row per kind of alert) and a sub page per row. Every change
 * saves at once and re-plans (Notifications.scheduleForToday). Dates are edited from the bell on Home
 * (day-sheet.js) or under "Upcoming alerts".
 */
import { Notifications } from './notifications.js';
import { getPrefs, updatePrefs, getPause, endOfToday } from './notif-store.js';
import { fmtTime, NOTICE_TYPES, SOUNDS } from './planner.js';
import { handleSkipChange } from './upcoming.js';

const $ = id => document.getElementById(id);
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]; // university week starts on Saturday
const NOTICE_LABEL = { cancellation: 'Cancelled', holiday: 'Holiday', class_test: 'Tests', online_class: 'Online', rescheduled: 'Moved', assignment: 'Assignments', general: 'General' };
const SOUND_LABEL = Object.fromEntries(SOUNDS.map(s => [s.id, s.label]));

const svg = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  bell: svg('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  test: svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  due: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  notice: svg('<path d="M3 11l18-8v18L3 13z"/><path d="M11 14v5a2 2 0 0 1-4 0v-3"/>'),
  sound: svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
  clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  pause: svg('<line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/>', 2.2),
  play: svg('<polygon points="6 4 20 12 6 20 6 4"/>'),
  chev: svg('<polyline points="9 18 15 12 9 6"/>')
};

const toTime = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromTime = v => { const [h, m] = String(v || '').split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null; };

/* ── Building blocks ──────────────────────────────────────────────────────── */
const sec = (title, inner, note = '') => `<div class="st-sec">${title ? `<h3 class="st-sec-title">${title}</h3>` : ''}<div class="st-sec-card">${inner}</div>${note ? `<p class="st-sec-note">${note}</p>` : ''}</div>`;
const sw = (pref, on, label, hint = '') => `<label class="st-switch-row st-item">
    <span><strong>${label}</strong>${hint ? `<span>${hint}</span>` : ''}</span>
    <input type="checkbox" class="st-switch-input" data-pref="${pref}" ${on ? 'checked' : ''}>
    <span class="st-switch-ui" aria-hidden="true"></span>
  </label>`;
const seg = (pref, value, options, label) => `<div class="st-item nf-opt"><span class="nf-opt-label">${label}</span>
    <div class="nf-seg" role="radiogroup" aria-label="${label}">${options.map(([v, t]) => `<button type="button" role="radio" aria-checked="${String(v) === String(value)}" class="${String(v) === String(value) ? 'active' : ''}" data-pref="${pref}" data-val="${v}">${t}</button>`).join('')}</div>
  </div>`;
const timeField = (pref, mins, label) => `<label class="st-item nf-time"><span class="nf-opt-label">${label}</span><input type="time" class="st-input nf-time-input" data-pref="${pref}" value="${toTime(mins)}"></label>`;
const hubRow = (view, color, icon, title, sub) => `<button type="button" class="nf-link" data-view="${view}" style="--ic:${color}">
    <span class="nf-link-icon">${icon}</span>
    <span class="nf-link-text"><strong>${title}</strong><span>${sub}</span></span>
    <span class="nf-link-chev">${ICON.chev}</span>
  </button>`;
const cluster = rows => `<div class="st-cluster nf-cluster">${rows.join('')}</div>`;

/* ── Pages ────────────────────────────────────────────────────────────────── */
const PAGES = {
  class: { title: 'Class reminders', sub: 'Before each class' },
  digest: { title: 'Daily summary', sub: 'Morning and evening overviews' },
  tests: { title: 'Tests', sub: 'Before a test class' },
  deadlines: { title: 'Assignment deadlines', sub: 'From assignment notices' },
  notices: { title: 'Notices', sub: 'Posted by your section' },
  sounds: { title: 'Sound and vibration', sub: 'One sound for each kind of alert' },
  when: { title: 'Days and quiet hours', sub: 'When alerts may arrive' }
};

function pageClass(p) {
  const c = p.classes;
  return sec('', sw('classes.on', c.on, 'Class reminders', 'Room, teacher and time before each class')) + (c.on ? [
    sec('Timing',
      seg('classes.lead', c.lead, [[5, '5 min'], [10, '10'], [15, '15'], [20, '20'], [30, '30']], 'Remind me before a class') +
      seg('classes.labLead', c.labLead, [[0, 'Same'], [15, '15 min'], [20, '20'], [30, '30']], 'Before a lab')),
    sec('Which classes',
      seg('classes.scope', c.scope, [['all', 'Every class'], ['first', 'First class only']], 'Remind me for') +
      sw('classes.online', c.online, 'Online classes', 'Also remind for classes held online') +
      sw('classes.atStart', c.atStart, 'When a class starts', 'One more alert at the start time'),
      'To change one day only, tap the bell beside the day title on Home.')
  ].join('') : '');
}
function pageDigest(p) {
  return sec('Morning summary', sw('briefing.on', p.briefing.on, 'Morning summary', "Today's classes, cancellations, tests and deadlines") + (p.briefing.on ? timeField('briefing.time', p.briefing.time, 'Send at') : '')) +
    sec('Tomorrow preview', sw('preview.on', p.preview.on, 'Tomorrow preview', 'The evening before: classes, changes, tests, deadlines') + (p.preview.on ? timeField('preview.time', p.preview.time, 'Send at') : ''));
}
function pageTests(p) {
  const t = p.tests;
  return sec('', sw('tests.on', t.on, 'Test reminders', 'A reminder before the test class')) + (t.on ? sec('Timing',
    seg('tests.lead', t.lead, [[15, '15 min'], [30, '30'], [60, '1 hour'], [120, '2 hours']], 'Remind me before') +
    (p.preview.on ? '' : sw('tests.eveningBefore', t.eveningBefore, 'Evening before', 'A heads-up the night before'))) : '');
}
function pageDeadlines(p) {
  const d = p.deadlines;
  return sec('', sw('deadlines.on', d.on, 'Deadline reminders', 'Tap Done on an alert to stop reminders for it')) + (d.on ? sec('Timing',
    seg('deadlines.hoursBefore', d.hoursBefore, [[0, 'Off'], [1, '1 hour'], [3, '3'], [6, '6'], [12, '12']], 'Remind me before it is due') +
    (p.preview.on ? '' : sw('deadlines.dayBefore', d.dayBefore, 'Evening before', 'A heads-up the night before'))) : '');
}
function pageNotices(p) {
  const unsupported = Notifications.serverPrefsStatus() === 'unsupported';
  return sec('', sw('notices.on', p.notices.on, 'Notice alerts', 'Cancellations, tests, holidays and more, as they are posted')) + (p.notices.on ? sec('Alert me about',
    `<div class="st-item"><div class="nf-chips nf-toggle-chips">${NOTICE_TYPES.map(t => `<button type="button" data-notice-type="${t}" aria-pressed="${p.notices.types[t] !== false}" class="${p.notices.types[t] !== false ? 'active' : ''}">${NOTICE_LABEL[t]}</button>`).join('')}</div></div>`,
    unsupported ? 'These switches apply to notices shown while the app is open. Pushes start following them after the server update.' : '') : '');
}
const SOUND_GROUPS = [
  ['class', 'Class reminders'], ['digest', 'Daily summary'], ['test', 'Tests'], ['deadline', 'Deadlines'], ['notice', 'Notices']
];
function pageSounds(p) {
  return SOUND_GROUPS.map(([type, name]) => sec(name,
    `<div class="nf-sounds" role="radiogroup" aria-label="${name} sound">${SOUNDS.map(s => `<button type="button" role="radio" class="nf-sound${p.sounds[type] === s.id ? ' active' : ''}" aria-checked="${p.sounds[type] === s.id}" data-sound-type="${type}" data-sound-id="${s.id}"><span>${s.label}</span><span class="nf-radio" aria-hidden="true"></span></button>`).join('')}</div>` +
    sw(`vibrate.${type}`, p.vibrate[type], 'Vibrate') +
    `<div class="st-item"><button type="button" class="st-btn nf-test" data-test="${type}">Send a test</button></div>`)).join('') +
    sec('Lock screen', sw('privacy.hideOnLock', p.privacy.hideOnLock, 'Hide details when locked', 'Show only that an alert arrived'),
      'Android keeps a sound for each alert type, so a new choice applies to the next alerts that are planned or arrive.');
}
function pageWhen(p) {
  return sec('Days with class reminders and summaries', `<div class="st-item"><div class="nf-weekdays">${WEEK_ORDER.map(d => `<button type="button" data-weekday="${d}" aria-pressed="${p.days.includes(d)}" class="${p.days.includes(d) ? 'active' : ''}">${DAY_SHORT[d]}</button>`).join('')}</div></div>`) +
    sec('Quiet hours', sw('quiet.on', p.quiet.on, 'Quiet hours', 'No reminders, and notices arrive without sound') + (p.quiet.on ? `<div class="st-item nf-quiet">${timeField('quiet.from', p.quiet.from, 'From').replace('st-item ', '')}${timeField('quiet.to', p.quiet.to, 'To').replace('st-item ', '')}</div>` : ''));
}
const BUILDERS = { class: pageClass, digest: pageDigest, tests: pageTests, deadlines: pageDeadlines, notices: pageNotices, sounds: pageSounds, when: pageWhen };

/* ── Hub ──────────────────────────────────────────────────────────────────── */
function renderStatus(prefs, pause, perm) {
  const master = $('nfMaster');
  if (master) master.checked = prefs.enabled;
  const line = $('nfStatusLine');
  if (line) {
    if (perm !== 'granted') line.textContent = 'Allow notifications on this phone to get them';
    else if (!prefs.enabled) line.textContent = 'Off. Nothing will be sent.';
    else if (pause === -1) line.textContent = 'Paused until you resume';
    else if (pause) line.textContent = `Paused until ${new Date(pause).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
    else {
      const n = Notifications.getPlan().length;
      line.textContent = n ? `On. ${n} alert${n === 1 ? '' : 's'} planned this week` : 'On. Nothing planned this week';
    }
  }
  $('notifModal')?.classList.toggle('nf-off', !prefs.enabled);
}

function pauseHtml(pause) {
  const paused = pause !== 0;
  const until = pause === -1 ? 'until you resume' : `until ${new Date(pause).toLocaleString('en-US', { weekday: pause > endOfToday() ? 'short' : undefined, hour: 'numeric', minute: '2-digit' })}`;
  return sec('Pause', `${paused ? `<div class="st-item nf-paused"><span class="nf-paused-icon">${ICON.pause}</span><div><strong>Paused ${until}</strong><span>No reminders or notices until then.</span></div><button type="button" class="st-btn st-btn-primary" data-pause="resume">Resume</button></div>` : ''}
    <div class="st-item"><div class="nf-chips">
      <button type="button" data-pause="60">1 hour</button><button type="button" data-pause="180">3 hours</button>
      <button type="button" data-pause="today">Rest of today</button><button type="button" data-pause="off">Until I resume</button>
    </div></div>`);
}

const onOff = v => (v ? 'On' : 'Off');
function hubHtml(p, pause) {
  const sounds = new Set(Object.values(p.sounds));
  const soundSub = sounds.size === 1 ? SOUND_LABEL[[...sounds][0]] : 'Different sounds';
  const rowsAlerts = [
    hubRow('class', '#3B82F6', ICON.bell, 'Class reminders', p.classes.on ? `${p.classes.lead} min before${p.classes.scope === 'first' ? ', first class' : ''}` : 'Off'),
    hubRow('digest', '#F59E0B', ICON.sun, 'Daily summary', `Morning ${p.briefing.on ? fmtTime(p.briefing.time) : 'off'} · Evening ${p.preview.on ? fmtTime(p.preview.time) : 'off'}`),
    hubRow('tests', '#F97316', ICON.test, 'Tests', p.tests.on ? `${p.tests.lead >= 60 ? `${p.tests.lead / 60} h` : `${p.tests.lead} min`} before` : 'Off'),
    hubRow('deadlines', '#A855F7', ICON.due, 'Assignment deadlines', p.deadlines.on ? (p.deadlines.hoursBefore ? `${p.deadlines.hoursBefore} h before` : 'Evening before') : 'Off'),
    hubRow('notices', '#F43F5E', ICON.notice, 'Notices', p.notices.on ? `${NOTICE_TYPES.filter(t => p.notices.types[t] !== false).length} of ${NOTICE_TYPES.length} types` : 'Off')
  ];
  const rowsMore = [
    hubRow('sounds', '#22C55E', ICON.sound, 'Sound and vibration', soundSub),
    hubRow('when', '#6366F1', ICON.clock, 'Days and quiet hours', p.quiet.on ? `Quiet ${fmtTime(p.quiet.from)} to ${fmtTime(p.quiet.to)}` : `${p.days.length} days · quiet hours ${onOff(false).toLowerCase()}`)
  ];
  return pauseHtml(pause) + `<div class="st-sec"><h3 class="st-sec-title">Alerts</h3>${cluster(rowsAlerts)}</div><div class="st-sec"><h3 class="st-sec-title">More</h3>${cluster(rowsMore)}</div>`;
}

/* ── Render ───────────────────────────────────────────────────────────────── */
let _view = 'hub';
export async function renderNotifCenter(view) {
  const page = $('notifModal');
  if (!page) return;
  const switched = !!view && view !== _view;
  if (view) _view = view;
  if (_view !== 'hub' && !PAGES[_view]) _view = 'hub';
  const prefs = getPrefs();
  const pause = getPause();
  const perm = await Notifications.updatePermissionUI();
  renderStatus(prefs, pause, perm);
  page.dataset.view = _view;
  const title = page.querySelector('.page-title');
  const subtitle = $('nfSubtitle');
  if (title) title.textContent = _view === 'hub' ? 'Notifications' : PAGES[_view].title;
  if (subtitle) subtitle.textContent = _view === 'hub' ? 'What your phone tells you, and when' : PAGES[_view].sub;
  const back = page.querySelector('#notifModalClose span');
  if (back) back.textContent = _view === 'hub' ? 'Back' : 'Notifications';
  const root = $('nfRoot');
  if (!root) return;
  const scroll = page.querySelector('.md');
  const keep = scroll && !switched ? scroll.scrollTop : 0;
  const html = _view === 'hub' ? hubHtml(prefs, pause) : `${BUILDERS[_view](prefs)}`;
  root.innerHTML = html;
  if (scroll) scroll.scrollTop = keep;
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

/* ── Sound preview ────────────────────────────────────────────────────────── */
let _audio = null;
function previewSound(id) {
  try { if (_audio) { _audio.pause(); _audio = null; } } catch (e) {}
  if (id === 'default' || id === 'silent') return;
  try { _audio = new Audio(new URL(`./sounds/${id}.wav`, import.meta.url).href); _audio.play().catch(() => {}); } catch (e) {}
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
  changed(['notices', 'quiet', 'sounds', 'vibrate', 'privacy'].includes(section));
}

export function initNotifCenter() {
  if (_bound) return;
  const page = $('notifModal');
  if (!page) return;
  _bound = true;

  // Back inside a sub page returns to the hub instead of closing the page
  page.addEventListener('click', e => {
    if (_view !== 'hub' && e.target.closest('#notifModalClose')) { e.stopPropagation(); renderNotifCenter('hub'); }
  }, true);

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
    if (handleSkipChange(t)) changed(false);
  });

  page.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !page.contains(b)) return;
    if (b.dataset.view) { renderNotifCenter(b.dataset.view); return; }
    if (b.dataset.soundId) {
      previewSound(b.dataset.soundId);
      updatePrefs('sounds', { [b.dataset.soundType]: b.dataset.soundId });
      return changed(b.dataset.soundType === 'notice');
    }
    if (b.dataset.test) {
      b.disabled = true;
      Notifications.sendTest(b.dataset.test).then(ok => { b.textContent = ok ? 'Sent' : 'Allow notifications first'; setTimeout(() => { b.disabled = false; b.textContent = 'Send a test'; }, 1800); });
      return;
    }
    if (b.dataset.pref && b.dataset.val !== undefined) {
      const raw = b.dataset.val;
      setPref(b.dataset.pref, /^\d+$/.test(raw) ? Number(raw) : raw);
      return;
    }
    if (b.dataset.noticeType) {
      const p = getPrefs();
      updatePrefs('notices', { types: { ...p.notices.types, [b.dataset.noticeType]: p.notices.types[b.dataset.noticeType] === false } });
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
