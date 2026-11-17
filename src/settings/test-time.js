/**
 * TEMPORARY test clock (user request 2026-11-17). A small "Test time" tab hangs from the top
 * of the screen; tapping it drops down a panel like the Rooms time picker: this week's days
 * and a 24-hour time slider. The app follows live (no reload): the Date offset is changed in
 * place (inline script in index.html <head>) and Home / Rooms / clock / background re-render.
 * The offset persists in localStorage `dev_time_offset` until "Real time" is tapped.
 * Remove this file, its CSS block in settings.css, the head script and the guard in
 * notifications.js when testing is done (list in NEXT_TASKS.md).
 */
const RealDate = window.__RealDate || Date;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STEP = 5;

const pad = n => String(n).padStart(2, '0');
const fmtTime = m => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${pad(mm)} ${h < 12 ? 'AM' : 'PM'}`; };
const dayStart = d => new RealDate(d.getFullYear(), d.getMonth(), d.getDate());

let tab, panel, range, readout, note, daysEl;
let selDay = null;       // RealDate at midnight of the chosen day
let rafPending = false;

function current() {
  // The (possibly shifted) "now" the app sees
  return new RealDate(RealDate.now() + (window.__devTimeOffset || 0));
}

function weekDays() {
  // Real today −2 … +4, so recent and coming days are one tap away
  const t = dayStart(new RealDate());
  return Array.from({ length: 7 }, (_, i) => new RealDate(t.getFullYear(), t.getMonth(), t.getDate() + i - 2));
}

function renderDays() {
  const realKey = dayStart(new RealDate()).getTime();
  daysEl.innerHTML = weekDays().map(d => {
    const k = d.getTime();
    return `<button type="button" class="tt-day${k === selDay.getTime() ? ' active' : ''}${k === realKey ? ' is-real' : ''}" data-k="${k}"><span>${DAYS[d.getDay()]}</span><b>${d.getDate()}</b></button>`;
  }).join('');
}

function renderReadout() {
  const on = !!window.__devTimeOffset;
  const now = current();
  readout.textContent = `${DAYS[now.getDay()]} ${now.getDate()} · ${fmtTime(now.getHours() * 60 + now.getMinutes())}`;
  note.textContent = on ? 'Test time is on · notifications paused' : 'Real time';
  tab.classList.toggle('is-on', on);
  tab.querySelector('.tt-tab-text').textContent = on ? `${DAYS[now.getDay()]} ${fmtTime(now.getHours() * 60 + now.getMinutes())}` : 'Test time';
  range.style.setProperty('--fill', `${(Number(range.value) / (24 * 60 - STEP)) * 100}%`);
}

/** Re-render whatever depends on "now". */
function refreshApp() {
  const now = current();
  try {
    if (window.__pickCalendarDate) window.__pickCalendarDate(now.getFullYear(), now.getMonth(), now.getDate());
    else if (window.renderTimeline) window.renderTimeline(true);
  } catch (e) {}
  try { if ((window.__currentAppViewId || 'home') === 'free_rooms' && window.__renderFreeRooms) window.__renderFreeRooms(); } catch (e) {}
  try { if (window.__updateAmbient) window.__updateAmbient(); } catch (e) {}
}

function apply() {
  const mins = Number(range.value);
  const target = new RealDate(selDay.getFullYear(), selDay.getMonth(), selDay.getDate(), Math.floor(mins / 60), mins % 60);
  window.__setDevTimeOffset(target.getTime() - RealDate.now());
  renderReadout();
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; refreshApp(); });
}

function syncFromNow() {
  const now = current();
  selDay = dayStart(now);
  range.value = String(Math.floor((now.getHours() * 60 + now.getMinutes()) / STEP) * STEP);
  renderDays();
  renderReadout();
}

function toggle(open) {
  const isOpen = open ?? !panel.classList.contains('open');
  if (isOpen) syncFromNow();
  panel.classList.toggle('open', isOpen);
  tab.setAttribute('aria-expanded', String(isOpen));
}

export function initTestTime() {
  if (!window.__setDevTimeOffset || document.querySelector('.tt-tab')) return;
  const clock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>';
  tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'tt-tab';
  tab.setAttribute('aria-expanded', 'false');
  tab.innerHTML = `${clock}<span class="tt-tab-text">Test time</span>`;

  panel = document.createElement('div');
  panel.className = 'tt-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Test date and time');
  panel.innerHTML = `
    <div class="tt-head">
      <div><span class="tt-readout"></span><span class="tt-note"></span></div>
      <div class="tt-head-btns">
        <button type="button" class="tt-btn tt-real">Real time</button>
        <button type="button" class="tt-btn tt-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
    </div>
    <div class="tt-days" role="group" aria-label="Day"></div>
    <input type="range" class="tt-range" min="0" max="${24 * 60 - STEP}" step="${STEP}" aria-label="Time of day">
    <div class="tt-ticks" aria-hidden="true"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>`;
  document.body.append(tab, panel);
  range = panel.querySelector('.tt-range');
  readout = panel.querySelector('.tt-readout');
  note = panel.querySelector('.tt-note');
  daysEl = panel.querySelector('.tt-days');

  tab.addEventListener('click', () => toggle());
  panel.querySelector('.tt-close').addEventListener('click', () => toggle(false));
  panel.querySelector('.tt-real').addEventListener('click', () => {
    window.__setDevTimeOffset(0);
    syncFromNow();
    refreshApp();
  });
  daysEl.addEventListener('click', e => {
    const b = e.target.closest('.tt-day');
    if (!b) return;
    selDay = new RealDate(Number(b.dataset.k));
    renderDays();
    apply();
  });
  range.addEventListener('input', apply);
  // Tap outside only closes the panel (the tap doesn't also open whatever is underneath)
  let swallowClick = false;
  document.addEventListener('pointerdown', e => {
    if (panel.classList.contains('open') && !panel.contains(e.target) && !tab.contains(e.target)) {
      toggle(false);
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 600);
    }
  }, true);
  document.addEventListener('click', e => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  syncFromNow();
  setInterval(() => { if (!panel.classList.contains('open')) renderReadout(); }, 30000);
}
