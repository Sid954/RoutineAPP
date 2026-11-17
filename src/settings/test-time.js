/**
 * TEMPORARY test clock (user request 2026-11-17): pick any date/time in Settings and the app
 * behaves as if it were then. The offset is stored in localStorage `dev_time_offset` and applied
 * by the inline script at the top of index.html (it replaces Date before the app loads), so
 * changes take effect with a reload. A banner shows while it's on.
 * Remove this file, its Settings card, its CSS, the head script and the guard in
 * notifications.js when testing is done.
 */
const KEY = 'dev_time_offset';
const RealDate = window.__RealDate || Date;

const pad = n => String(n).padStart(2, '0');
const toLocalInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmt = d => d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function setOffsetAndReload(ms) {
  try {
    if (ms && Math.abs(ms) >= 30000) localStorage.setItem(KEY, String(Math.round(ms)));
    else localStorage.removeItem(KEY);
  } catch (e) {}
  location.reload();
}

function renderBanner() {
  if (!window.__devTimeOffset) return;
  const b = document.createElement('div');
  b.className = 'dev-time-banner';
  b.setAttribute('role', 'status');
  b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
    <span>Test time <b class="dev-time-now"></b></span>
    <button type="button" class="dev-time-reset">Real time</button>`;
  document.body.appendChild(b);
  const now = b.querySelector('.dev-time-now');
  const tick = () => { now.textContent = fmt(new Date()); };
  tick();
  setInterval(tick, 15000);
  b.querySelector('.dev-time-reset').addEventListener('click', () => setOffsetAndReload(0));
}

export function initTestTime() {
  renderBanner();
  const input = document.getElementById('stTestTime');
  if (!input) return;
  const status = document.getElementById('stTestTimeStatus');
  const refresh = () => {
    input.value = toLocalInput(new Date());
    if (status) status.textContent = window.__devTimeOffset ? `On: ${fmt(new Date())} (real time ${fmt(new RealDate())})` : 'Off: using the real time.';
  };
  refresh();
  // Keep the picker current when Settings is opened later
  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.activeElement !== input) refresh(); });
  document.getElementById('stTestTimeApply')?.addEventListener('click', () => {
    if (!input.value) return;
    const target = new RealDate(input.value); // local time
    if (isNaN(target)) return;
    setOffsetAndReload(target.getTime() - RealDate.now());
  });
  document.getElementById('stTestTimeReset')?.addEventListener('click', () => setOffsetAndReload(0));
  document.querySelectorAll('[data-tt]').forEach(btn => btn.addEventListener('click', () => {
    const base = input.value ? new RealDate(input.value) : new Date();
    input.value = toLocalInput(new RealDate(base.getTime() + Number(btn.dataset.tt) * 60000));
  }));
}
