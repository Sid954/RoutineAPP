/**
 * Ambient background for Home: a quiet layer behind the content that follows the day.
 *   night (8pm–5am) stars + small moon · morning (5–11) sun · day · evening (5–8pm) warm tint
 *   in class: faint ruled lines · break: drifting bubbles · holiday / test day: confetti dots
 * Low opacity, pointer-events: none, transform/opacity animations only; follows the motion
 * tier (off: hidden, lite: still, full: animated). Re-evaluated every minute.
 */
import { getEffectiveClassesForDay } from '../schedule/queries.js';
import { getOverrideFor } from '../announcements/overrides.js';
import { toMinutes } from './utils.js';

let layer = null;
let lastMode = '';

function seeded(n, seed) {
  // Deterministic scatter so stars don't jump around on every re-render
  const out = [];
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    const a = x / 233280;
    x = (x * 9301 + 49297) % 233280;
    const b = x / 233280;
    out.push([a, b, i]);
  }
  return out;
}

/** What the background should show right now. */
export function ambientMode(now = new Date()) {
  const h = now.getHours();
  const m = h * 60 + now.getMinutes();
  let base = h >= 20 || h < 5 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'day' : 'evening';
  let accent = '';
  try {
    const hol = getOverrideFor(now);
    if (hol && hol.type === 'holiday') accent = 'holiday';
    const held = getEffectiveClassesForDay(now.getDay(), now).filter(c => !c.isCancelled && !('rescheduledTo' in c));
    const cur = held.find(c => m >= toMinutes(c.start) && m < toMinutes(c.end));
    if (!accent && cur) accent = 'class';
    else if (!accent && held.some(c => toMinutes(c.end) <= m) && held.some(c => toMinutes(c.start) > m)) accent = 'break';
    if (!accent && held.some(c => { const o = getOverrideFor(now, c.title); return o && o.type === 'class_test'; })) accent = 'test';
  } catch (e) {}
  return accent ? `${base} ${accent}` : base;
}

function build(mode) {
  const parts = [];
  if (mode.includes('night')) {
    const stars = seeded(16, 7).map(([a, b, i]) =>
      `<i class="amb-star" style="left:${(a * 100).toFixed(1)}%;top:${(b * 38).toFixed(1)}%;--d:${(2.5 + (i % 5) * 0.7).toFixed(1)}s;--s:${i % 3 === 0 ? 3 : 2}px"></i>`).join('');
    parts.push(stars, '<i class="amb-moon"></i>');
  }
  // Morning / evening: a warm sky with a soft sun, light rays and a few lit clouds
  if (mode.includes('morning') || mode.includes('evening')) {
    const tone = mode.includes('evening') ? 'is-evening' : 'is-morning';
    parts.push(`<i class="amb-sky ${tone}"></i><i class="amb-rays ${tone}"></i><i class="amb-sun ${tone}"></i>` +
      `<i class="amb-cloud c1 ${tone}"></i><i class="amb-cloud c2 ${tone}"></i><i class="amb-cloud c3 ${tone}"></i>`);
  }
  if (mode.includes('day')) parts.push('<i class="amb-daylight"></i>');
  if (mode.includes('class')) parts.push('<i class="amb-lines"></i>');
  if (mode.includes('break')) parts.push(seeded(7, 3).map(([a, , i]) => `<i class="amb-bubble" style="left:${(8 + a * 84).toFixed(1)}%;--d:${(9 + i * 1.7).toFixed(1)}s;--delay:-${(i * 2.3).toFixed(1)}s"></i>`).join(''));
  if (mode.includes('holiday') || mode.includes('test')) {
    parts.push(seeded(12, mode.includes('holiday') ? 11 : 5).map(([a, b, i]) =>
      `<i class="amb-dot ${mode.includes('holiday') ? 'is-holiday' : 'is-test'}" style="left:${(a * 100).toFixed(1)}%;top:${(4 + b * 30).toFixed(1)}%;--d:${(4 + (i % 4)).toFixed(1)}s"></i>`).join(''));
  }
  return parts.join('');
}

export function updateAmbient() {
  if (!layer) return;
  const onHome = (window.__currentAppViewId || 'home') === 'home';
  layer.classList.toggle('is-hidden', !onHome);
  const mode = ambientMode();
  if (mode === lastMode) return;
  lastMode = mode;
  layer.dataset.mode = mode;
  layer.innerHTML = build(mode);
}

export function initAmbient() {
  if (layer) return;
  layer = document.createElement('div');
  layer.id = 'ambientLayer';
  layer.setAttribute('aria-hidden', 'true');
  // Inside #app so it paints above the app's own opaque background but under .wi (z-index 1)
  const host = document.getElementById('app') || document.body;
  host.insertBefore(layer, host.firstChild);
  updateAmbient();
  setInterval(updateAmbient, 60 * 1000);
  // Hide while on other pages (switchAppView updates __currentAppViewId)
  document.addEventListener('click', () => setTimeout(updateAmbient, 50), true);
  window.__updateAmbient = updateAmbient;
}
