/**
 * Motion engine v2 (Nov 2026): one place for interactive motion across the app.
 *
 *  Tiers (html[data-motion]): full | lite | off
 *    auto: picked from the device (cores / memory) and a short frame-time probe at launch,
 *    then stepped down at runtime if long frames pile up. prefers-reduced-motion -> off.
 *    Settings can force a tier (localStorage 'motion_pref': auto|full|lite|off).
 *  Everything animates transform / opacity only, so it composites on the GPU.
 *
 *  Provides: ripple + press spring on every tappable thing, haptics, staggered list
 *  entrances on re-render (skipped for minute-tick refreshes), drag-to-dismiss for bottom
 *  sheets, pull-to-refresh on Home / Notices / Faculty / Rooms, and small celebrations.
 */
const PREF_KEY = 'motion_pref';
const HAPTIC_KEY = 'haptics_pref';

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
const root = () => document.documentElement;
const reduceMQ = () => (window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false });

export const Motion = {
  tier: 'full',
  auto: true,

  /* ── Tier selection ──────────────────────────────────────────────── */
  pref() { return ls.get(PREF_KEY) || 'auto'; },
  setPref(p) {
    ls.set(PREF_KEY, p);
    this.applyTier(p === 'auto' ? this.deviceTier() : p, p === 'auto');
  },
  /** Static guess from hardware; the probe refines it. */
  deviceTier() {
    if (reduceMQ().matches) return 'off';
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    const saveData = navigator.connection && navigator.connection.saveData;
    if (saveData || cores <= 2 || mem <= 2) return 'lite';
    return 'full';
  },
  applyTier(t, auto) {
    this.tier = t;
    this.auto = !!auto;
    root().dataset.motion = t;
  },
  /** ~1.2s of frame timing after launch; step down if the device struggles. */
  probe() {
    if (!this.auto || this.tier === 'off' || !window.requestAnimationFrame) return;
    const frames = [];
    let last = performance.now();
    const start = last;
    const tick = now => {
      frames.push(now - last);
      last = now;
      if (now - start < 1200) { requestAnimationFrame(tick); return; }
      const sorted = frames.slice(2).sort((a, b) => a - b);
      if (sorted.length < 10) return;
      const p90 = sorted[Math.floor(sorted.length * 0.9)];
      const slow = sorted.filter(f => f > 34).length / sorted.length;
      if (this.tier === 'full' && (p90 > 26 || slow > 0.15)) this.applyTier('lite', true);
    };
    requestAnimationFrame(tick);
  },
  /** Runtime guard: many long tasks in a short window -> step down a tier. */
  watchLongTasks() {
    if (!('PerformanceObserver' in window)) return;
    let hits = [];
    try {
      new PerformanceObserver(list => {
        if (!this.auto) return;
        const now = performance.now();
        list.getEntries().forEach(e => { if (e.duration > 120) hits.push(now); });
        hits = hits.filter(t => now - t < 15000);
        if (hits.length >= 6) {
          hits = [];
          if (this.tier === 'full') this.applyTier('lite', true);
        }
      }).observe({ entryTypes: ['longtask'] });
    } catch (e) {}
  },

  /* ── Haptics ─────────────────────────────────────────────────────── */
  _sysOff: false,   // phone has no vibrator or Android touch vibration is off
  hapticsOn() { return !this._sysOff && ls.get(HAPTIC_KEY) !== 'off'; },
  setHaptics(on) { ls.set(HAPTIC_KEY, on ? 'on' : 'off'); if (on) this.haptic('success'); },
  _lastHaptic: 0,
  /** kind: tap | select | success | warning | error | heavy */
  haptic(kind = 'tap') {
    if (!this.hapticsOn()) return;
    const now = Date.now();
    if (kind === 'tap' && now - this._lastHaptic < 45) return;
    this._lastHaptic = now;
    const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    try {
      if (H) {
        if (kind === 'success' || kind === 'warning' || kind === 'error') H.notification({ type: kind.toUpperCase() });
        else if (kind === 'select') H.selectionChanged ? H.selectionStart().then(() => H.selectionChanged()).then(() => H.selectionEnd()) : H.impact({ style: 'LIGHT' });
        else H.impact({ style: kind === 'heavy' ? 'MEDIUM' : 'LIGHT' });
        return;
      }
      if (navigator.vibrate && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        navigator.vibrate(kind === 'error' ? [18, 40, 18] : kind === 'success' ? [10, 30, 10] : kind === 'heavy' ? 16 : 8);
      }
    } catch (e) {}
  }
};

/* ── Ripple + press ───────────────────────────────────────────────── */
const TAPPABLE = [
  'button', 'a[href]', '[role="button"]', '[role="tab"]', '[data-ripple]',
  '.apps-hub-card', '.resting-class-row', '.satellite-pill', '.focal-day-card', '.calendar-day-cell',
  '.rm-room', '.fd-row', '.fd-tl-row', '.nt-card', '.nt-up', '.hm-cls', '.widget-size-pill',
  '.theme-palette-card', '.t-card', '.m-matrix-card', '.st-row', '.st-class', '.timeline-ghost-strip.tappable',
  '.day-done-strip.tappable', '.timeline-deadline-banner.tappable', '.dock-tab', '.dock-center-raised-fab'
].join(',');
// Elements that must not get a ripple layer (tiny, or positioned children that would clip)
const NO_RIPPLE = '.satellite-pill, .focal-day-card, [data-no-ripple], input, select, textarea, .teacher-clickable-badge, .dock-center-raised-fab';

function ripple(el, x, y) {
  if (Motion.tier === 'off' || el.matches(NO_RIPPLE)) return;
  const rect = el.getBoundingClientRect();
  if (rect.width < 24 || rect.height < 20) return;
  if (!el._mxPos) {
    el._mxPos = true;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  }
  let layer = el.querySelector(':scope > .mx-ripple-layer');
  if (!layer) {
    layer = document.createElement('span');
    layer.className = 'mx-ripple-layer';
    layer.setAttribute('aria-hidden', 'true');
    el.appendChild(layer);
  }
  // Just big enough to reach the farthest corner from the touch point (was 2x the diagonal)
  const px = (x || rect.left + rect.width / 2) - rect.left;
  const py = (y || rect.top + rect.height / 2) - rect.top;
  const size = 2 * Math.hypot(Math.max(px, rect.width - px), Math.max(py, rect.height - py));
  const r = document.createElement('span');
  r.className = 'mx-ripple';
  r.style.width = r.style.height = `${size}px`;
  r.style.left = `${px - size / 2}px`;
  r.style.top = `${py - size / 2}px`;
  layer.appendChild(r);
  const done = () => r.remove();
  r.addEventListener('animationend', done, { once: true });
  setTimeout(done, 900);
}

// A touch only becomes a "press" once it's clearly a tap: after PRESS_DELAY ms without
// moving, or when the finger lifts first. Scroll flicks no longer scale a card, add a ripple
// and repaint it at the very moment the page starts to scroll.
const PRESS_DELAY = 70;
const MOVE_SLOP = 8;

function bindPress() {
  let pressed = null;
  let pending = null; // { el, x, y, timer }
  const begin = (el, x, y) => {
    pressed = el;
    el.classList.add('mx-pressed');
    ripple(el, x, y);
  };
  const cancelPending = () => { if (pending) { clearTimeout(pending.timer); pending = null; } };
  const release = () => {
    cancelPending();
    if (pressed) { const el = pressed; pressed = null; el.classList.remove('mx-pressed'); }
  };
  document.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    const el = ev.target.closest(TAPPABLE);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    release();
    if (ev.pointerType === 'mouse') { begin(el, ev.clientX, ev.clientY); return; }
    pending = { el, x: ev.clientX, y: ev.clientY, timer: setTimeout(() => { const p = pending; pending = null; if (p) begin(p.el, p.x, p.y); }, PRESS_DELAY) };
  }, { passive: true });
  document.addEventListener('pointermove', ev => {
    if (pending && Math.hypot(ev.clientX - pending.x, ev.clientY - pending.y) > MOVE_SLOP) cancelPending();
  }, { passive: true });
  document.addEventListener('pointerup', () => {
    // Quick tap: lifted before the delay. Show the press feedback now, briefly.
    if (pending) {
      const p = pending; cancelPending();
      begin(p.el, p.x, p.y);
      setTimeout(release, 120);
      return;
    }
    release();
  }, { passive: true });
  ['pointercancel', 'scroll'].forEach(t => document.addEventListener(t, release, { passive: true, capture: t === 'scroll' }));
  document.addEventListener('click', ev => {
    const el = ev.target.closest(TAPPABLE);
    if (!el || el.disabled) return;
    Motion.haptic(el.matches('[role="tab"], .dock-tab, .satellite-pill, .nt-chip, .fd-chip, .rm-day, .hm-day, .st-day, .fd-day, .pa-type, .pa-secs button') ? 'select' : 'tap');
  }, { capture: true, passive: true });
  document.addEventListener('change', ev => {
    if (ev.target && ev.target.matches('input[type="checkbox"], input[type="radio"], select')) Motion.haptic('select');
  }, { capture: true, passive: true });
}

/* ── Staggered entrances when a list re-renders ───────────────────── */
// Containers whose children enter with a stagger. Signature ignores digits, so a minute
// tick that only changes "in 40m" -> "in 39m" doesn't replay the animation.
const STAGGER = ['#chG', '#teacherFinderGrid', '#announceList', '#rmList', '#paTypeGrid', '#rCols', '#facultyProfileHero', '#ntSheetBody', '.apps-hub-grid', '#ntUpcoming', '#homeAlerts', '#tGrid', '#calendarDaysGrid', '#focalStripContainer', '#rmSheetTimeline', '#fdFilters', '#announceFilterBar'];
const sig = el => `${el.children.length}|${(el.textContent || '').replace(/\d+/g, '#').slice(0, 1500)}`;

function staggerReplay(el) {
  const s = sig(el);
  if (el._mxSig === s) return;
  const first = el._mxSig === undefined;
  el._mxSig = s;
  if (Motion.tier === 'off') return;
  // Home timeline and week strip: switching days must not animate at all (user: "no jumping").
  // They cascade only on first load or after a pull-to-refresh.
  if ((el.id === 'chG' || el.id === 'focalStripContainer') && !first &&
      !(el._mxForceUntil && Date.now() < el._mxForceUntil)) return;
  // Rapid re-renders (dragging the Rooms time slider, typing in search): no replay
  const now = Date.now();
  const rapid = el._mxLast && now - el._mxLast < 700;
  el._mxLast = now;
  if (rapid) return;
  // Static rows: the week strip morphs on its own, filter chip rows never fade
  if (NO_FADE.has(el.id)) return;
  // One opacity animation on the container (a single compositor layer, no forced layout).
  // It used to restart a CSS animation on every child: 92 Faculty rows = 92 layers at once.
  if (!el.animate) return;
  if (el._mxAnim) el._mxAnim.cancel();
  el._mxAnim = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Motion.tier === 'full' ? 200 : 140, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  el._mxAnim.onfinish = () => { el._mxAnim = null; };
}
const NO_FADE = new Set(['focalStripContainer', 'fdFilters', 'announceFilterBar', 'calendarDaysGrid']);

function bindStagger() {
  const seen = new WeakSet();
  const attach = () => {
    STAGGER.forEach(sel => document.querySelectorAll(sel).forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);
      new MutationObserver(() => staggerReplay(el)).observe(el, { childList: true });
      if (el.children.length) staggerReplay(el);
    }));
  };
  attach();
  // Some containers are created later (sheets, dynamic sections)
  setTimeout(attach, 1500);
  setTimeout(attach, 5000);
}

/* ── Smooth height for lists whose length changes per day ─────────── */
// Room sheet timeline, weekly matrix, settings day editor: grow/shrink smoothly instead of
// jumping when one day has 5 classes and the next has none.
const SMOOTH_HEIGHT = ['#rmSheetTimeline', '#tGrid', '#rCols', '#fdProfileTimeline'];

function bindSmoothHeight() {
  const seen = new WeakSet();
  const attach = () => SMOOTH_HEIGHT.forEach(sel => document.querySelectorAll(sel).forEach(el => {
    if (seen.has(el)) return;
    seen.add(el);
    el._mxH = el.offsetHeight;
    new MutationObserver(() => {
      const from = el._mxH;
      const to = el.offsetHeight;
      el._mxH = to;
      if (Motion.tier === 'off' || !from || !to || Math.abs(to - from) < 4 || !el.animate || !el.offsetParent) return;
      const prevOverflow = el.style.overflow;
      el.style.overflow = 'hidden';
      const anim = el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: Motion.tier === 'full' ? 280 : 160, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
      anim.onfinish = anim.oncancel = () => { el.style.overflow = prevOverflow; };
    }).observe(el, { childList: true, subtree: false });
  }));
  attach();
  setTimeout(attach, 1500);
  setTimeout(attach, 5000);
}

/* ── Drag-to-dismiss for bottom sheets ─────────────────────────────── */
const SHEETS = '.rm-sheet, .fd-sheet, .nt-sheet, .up-sheet, .class-detail-bottom-sheet';

function bindSheetDrag() {
  let s = null;
  document.addEventListener('touchstart', ev => {
    if (Motion.tier === 'off' || ev.touches.length !== 1) return;
    const sheet = ev.target.closest(SHEETS);
    if (!sheet) return;
    const scroller = ev.target.closest('.rm-sheet-body, .fd-sheet-body, .nt-sheet-body, .up-body, .up-notes') || sheet;
    if (scroller.scrollTop > 0 && !ev.target.closest('[class*="grip"], .sheet-drag-handle-bar')) return;
    if (ev.target.closest('input, textarea, select, .rm-range, .up-progress')) return;
    s = { sheet, overlay: sheet.parentElement, y0: ev.touches[0].clientY, x0: ev.touches[0].clientX, t0: performance.now(), dy: 0, active: false };
  }, { passive: true });
  document.addEventListener('touchmove', ev => {
    if (!s) return;
    const dy = ev.touches[0].clientY - s.y0;
    const dx = ev.touches[0].clientX - s.x0;
    if (!s.active) {
      if (dy > 8 && dy > Math.abs(dx) * 1.3) {
        s.active = true;
        s.sheet.classList.add('mx-dragging');
      } else if (Math.abs(dx) > 10 || dy < -6) { s = null; return; }
    }
    if (s.active) {
      s.dy = Math.max(0, dy);
      s.sheet.style.transform = `translateY(${s.dy}px)`;
    }
  }, { passive: true });
  const end = () => {
    if (!s) return;
    const { sheet, overlay, dy, t0, active } = s;
    s = null;
    if (!active) return;
    sheet.classList.remove('mx-dragging');
    const v = dy / Math.max(1, performance.now() - t0);
    if (dy > 110 || v > 0.6) {
      Motion.haptic('tap');
      sheet.style.transform = '';
      if (overlay) overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } else {
      sheet.classList.add('mx-snap');
      sheet.style.transform = '';
      setTimeout(() => sheet.classList.remove('mx-snap'), 380);
    }
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}

/* ── Pull to refresh ──────────────────────────────────────────────── */
const PULL_VIEWS = {
  dashboardView: () => {
    const g = document.getElementById('chG');
    if (g) { g._mxForceUntil = Date.now() + 3000; g._mxSig = ''; }
    if (window.__fetchAndRenderAnnouncements) window.__fetchAndRenderAnnouncements();
    if (window.renderTimeline) window.renderTimeline(true);
  },
  announcementsAppView: () => window.__fetchAndRenderAnnouncements && window.__fetchAndRenderAnnouncements(),
  facultyAppView: () => window.__renderFacultyDirectory && window.__renderFacultyDirectory(),
  freeRoomsAppView: () => window.__renderFreeRooms && window.__renderFreeRooms()
};

function bindPull() {
  const ind = document.createElement('div');
  ind.className = 'mx-pull';
  ind.setAttribute('aria-hidden', 'true');
  ind.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/></svg>';
  document.body.appendChild(ind);
  let p = null;
  const TRIGGER = 72;
  document.addEventListener('touchstart', ev => {
    if (Motion.tier === 'off' || ev.touches.length !== 1 || document.body.classList.contains('modal-open')) return;
    const view = ev.target.closest('.app-page-view');
    if (!view || !PULL_VIEWS[view.id] || view.style.display === 'none') return;
    const scroller = view.id === 'dashboardView' ? (document.getElementById('chG') || view) : view;
    if (view.scrollTop > 0 || scroller.scrollTop > 0) return;
    if (ev.target.closest('.rm-range, input, textarea, .hm-days, #focalStripContainer, .nt-up-row, .fd-filters, .nt-filters')) return;
    p = { view, y0: ev.touches[0].clientY, x0: ev.touches[0].clientX, d: 0, on: false };
  }, { passive: true });
  document.addEventListener('touchmove', ev => {
    if (!p) return;
    const dy = ev.touches[0].clientY - p.y0, dx = ev.touches[0].clientX - p.x0;
    if (!p.on) {
      if (dy > 12 && dy > Math.abs(dx) * 1.5) p.on = true;
      else if (Math.abs(dx) > 12 || dy < -4) { p = null; return; }
    }
    if (p.on) {
      p.d = Math.min(130, dy * 0.5);
      ind.classList.add('is-visible');
      ind.classList.toggle('is-armed', p.d >= TRIGGER);
      ind.style.transform = `translate(-50%, ${p.d}px) rotate(${p.d * 3}deg)`;
      ind.style.opacity = String(Math.min(1, p.d / 50));
      if (p.d >= TRIGGER && !p.buzzed) { p.buzzed = true; Motion.haptic('select'); }
      if (p.d < TRIGGER) p.buzzed = false;
    }
  }, { passive: true });
  const end = () => {
    if (!p) return;
    const fire = p.on && p.d >= TRIGGER;
    const view = p.view;
    p = null;
    if (fire) {
      ind.classList.add('is-spinning');
      ind.style.transform = 'translate(-50%, 56px)';
      try { PULL_VIEWS[view.id](); } catch (e) {}
      setTimeout(() => {
        ind.classList.remove('is-spinning', 'is-visible', 'is-armed');
        ind.style.transform = '';
        ind.style.opacity = '';
        Motion.haptic('success');
      }, 900);
    } else {
      ind.classList.remove('is-visible', 'is-armed');
      ind.style.transform = '';
      ind.style.opacity = '';
    }
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}

/* ── Toast + view hooks ────────────────────────────────────────────── */
function bindToastHaptics() {
  const toast = document.getElementById('toast');
  if (!toast) return;
  new MutationObserver(() => {
    if (!toast.classList.contains('show')) return;
    if (toast.classList.contains('toast-success')) Motion.haptic('success');
    else if (toast.classList.contains('toast-error')) Motion.haptic('error');
    else if (toast.classList.contains('toast-warning')) Motion.haptic('warning');
  }).observe(toast, { attributes: true, attributeFilter: ['class'] });
}

let _inited = false;
export function initMotion() {
  if (_inited) return;
  _inited = true;
  const pref = Motion.pref();
  Motion.applyTier(pref === 'auto' ? Motion.deviceTier() : pref, pref === 'auto');
  const mq = reduceMQ();
  if (mq.addEventListener) mq.addEventListener('change', () => { if (Motion.pref() === 'auto') Motion.applyTier(Motion.deviceTier(), true); });
  bindPress();
  bindStagger();
  bindSheetDrag();
  bindSmoothHeight();
  bindPull();
  bindToastHaptics();
  setTimeout(() => Motion.probe(), 1400); // after the launch entrance settles
  // Respect Android's own touch-vibration setting (the haptics plugin would vibrate anyway)
  const syncSys = () => {
    const WP = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.WidgetPlugin;
    if (WP && WP.getSystemState) WP.getSystemState().then(st => { Motion._sysOff = st.hasVibrator === false || st.hapticFeedbackEnabled === false; }).catch(() => {});
  };
  syncSys();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSys(); });
  Motion.watchLongTasks();
  window.__motion = Motion;
  window.__refreshHome = PULL_VIEWS.dashboardView;
}
