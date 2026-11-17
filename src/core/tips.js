/**
 * Idle tips: after ~8s without touches on Home or Apps, a small dismissible tip slides up
 * above the dock. One per launch, at most every 6 hours, never over a popup. "Got it"
 * retires that tip; tips rotate so each is seen before any repeats.
 */
const SEEN_KEY = 'tips_seen';
const DONE_KEY = 'tips_done';
const LAST_KEY = 'tips_last_at';
const IDLE_MS = 8000;
const GAP_MS = 6 * 60 * 60 * 1000;

const TIPS = [
  { id: 'hold-fab', text: 'Hold the centre button to open the calendar.' },
  { id: 'tap-fab', text: 'On Home, tap the centre button to jump to today, or tap again to refresh.' },
  { id: 'pull', text: 'Pull down at the top of Home, Notices, Faculty or Rooms to refresh.' },
  { id: 'swipe-day', text: 'Swipe the schedule left or right to change the day.' },
  { id: 'drag-sheet', text: 'Drag any bottom sheet down to close it.' },
  { id: 'teacher', text: 'Tap a teacher\'s name anywhere to see their profile and where they are now.' },
  { id: 'rooms', text: 'Rooms: drag the time slider to see which rooms are free later today.' },
  { id: 'dept', text: 'Notices: switch to Department to see what every section is up to.' },
  { id: 'back', text: 'The phone\'s back button closes popups and steps back a page.' },
  { id: 'offdays', text: 'Settings → Your class: choose your university\'s off days and hide them when nothing\'s on.' },
  { id: 'motion', text: 'Settings → Appearance: tune animations (Auto, Full, Lite, Off) and tap vibration.' },
  { id: 'widgets', text: 'Add a home-screen widget from Settings to see your next class without opening the app.' },
  { id: 'class-sheet', text: 'Tap a class to see its room, teacher, and to add a test or cancellation.' }
];

const ls = {
  json(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} }
};

function nextTip() {
  const done = new Set(ls.json(DONE_KEY, []));
  let seen = ls.json(SEEN_KEY, []);
  let pool = TIPS.filter(t => !done.has(t.id) && !seen.includes(t.id));
  if (!pool.length) { seen = []; ls.set(SEEN_KEY, seen); pool = TIPS.filter(t => !done.has(t.id)); }
  return pool[0] || null;
}

let shownThisLaunch = false;
let timer = null;
let el = null;

function canShow() {
  if (shownThisLaunch) return false;
  if (document.hidden || document.body.classList.contains('modal-open')) return false;
  if (document.querySelector('.mo.open, .class-sheet-modal-overlay.open, .rm-sheet-overlay.open, #calendarPickerModal.open, .toast.show')) return false;
  const view = window.__currentAppViewId || 'home';
  if (view !== 'home' && view !== 'apps') return false;
  const last = Number(localStorage.getItem(LAST_KEY) || 0);
  return Date.now() - last > GAP_MS;
}

function hide(markDone) {
  if (!el) return;
  if (markDone && el.dataset.tip) {
    const done = ls.json(DONE_KEY, []);
    if (!done.includes(el.dataset.tip)) done.push(el.dataset.tip);
    ls.set(DONE_KEY, done);
  }
  el.classList.remove('is-shown');
}

function show() {
  if (!canShow()) return;
  const tip = nextTip();
  if (!tip) return;
  shownThisLaunch = true;
  ls.set(LAST_KEY, String(Date.now()));
  const seen = ls.json(SEEN_KEY, []);
  seen.push(tip.id);
  ls.set(SEEN_KEY, seen);
  if (!el) {
    el = document.createElement('div');
    el.className = 'mx-tip';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      if (e.target.closest('[data-tip-done]')) hide(true);
      else if (e.target.closest('[data-tip-close]')) hide(false);
    });
  }
  el.dataset.tip = tip.id;
  el.innerHTML = `<span class="mx-tip-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg></span>
    <span class="mx-tip-text"><strong>Tip</strong> ${tip.text}</span>
    <button type="button" class="mx-tip-btn" data-tip-done>Got it</button>
    <button type="button" class="mx-tip-x" data-tip-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  requestAnimationFrame(() => el.classList.add('is-shown'));
  setTimeout(() => hide(false), 12000);
}

function arm() {
  clearTimeout(timer);
  if (shownThisLaunch) return;
  timer = setTimeout(show, IDLE_MS);
}

export function initTips() {
  ['pointerdown', 'keydown', 'scroll'].forEach(t => document.addEventListener(t, arm, { passive: true, capture: true }));
  // First tip only after the app has settled
  setTimeout(arm, 6000);
}
