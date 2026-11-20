/**
 * Desktop input (Nov 2026): the app's touch gestures also work with a mouse or trackpad.
 *
 *  - bindMouseDrag(): lets a touch gesture (sheet drag-to-close, pull to refresh, swiping days on
 *    Home and in the Weekly Routine) run with a mouse drag. Touch code stays as it was; each gesture
 *    calls the same start/move/end logic from both. During a mouse drag text isn't selected, and the
 *    click that follows a real drag is swallowed (so dragging over a card doesn't open it).
 *  - Mouse drag scrolls everything like a finger (pages, lists, sheets, sideways rows), with a fling
 *    on release; at an edge the drag goes to the gestures above, as on a phone.
 *  - Rows that scroll sideways with hidden scrollbars: the mouse wheel scrolls them sideways.
 *  - Arrow keys switch days on Home (desktop keyboards).
 */

const MOVE_SLOP = 5;   // px before a mouse press counts as a drag
let _suppressClickUntil = 0;

function suppressNextClick() { _suppressClickUntil = performance.now() + 400; }

/**
 * @param {Element|Document} target where the press must start
 * @param {{ start(x:number, y:number, el:Element, ev:PointerEvent): (boolean|void),
 *           move(x:number, y:number, ev:PointerEvent): void,
 *           end(x:number, y:number, ev:PointerEvent|null): void }} h
 *   start returning false ignores this press.
 */
export function bindMouseDrag(target, h) {
  if (!target || !target.addEventListener) return;
  target.addEventListener('pointerdown', ev => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
    if (h.start(ev.clientX, ev.clientY, ev.target, ev) === false) return;
    const x0 = ev.clientX;
    const y0 = ev.clientY;
    let dragged = false;
    const root = document.documentElement;
    const onMove = e => {
      if (!dragged && Math.hypot(e.clientX - x0, e.clientY - y0) > MOVE_SLOP) {
        dragged = true;
        root.classList.add('mx-mouse-drag');
        const sel = window.getSelection && window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      }
      h.move(e.clientX, e.clientY, e);
    };
    const finish = (e, cancelled) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      root.classList.remove('mx-mouse-drag');
      h.end(e && !cancelled ? e.clientX : x0, e && !cancelled ? e.clientY : y0, cancelled ? null : e);
      if (dragged) suppressNextClick();
    };
    const onUp = e => finish(e, false);
    const onCancel = e => finish(e, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  });
}

/* ── Sideways rows: wheel + drag ─────────────────────────────────────────── */
function sidewaysScroller(el) {
  for (let n = el; n && n !== document.body && n.nodeType === 1; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 2) {
      const ox = getComputedStyle(n).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && !(n.scrollHeight > n.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(n).overflowY))) return n;
    }
  }
  return null;
}

function bindSidewaysRows() {
  // Vertical wheel over a sideways-only row scrolls it sideways (trackpads already send deltaX)
  document.addEventListener('wheel', ev => {
    if (ev.ctrlKey || Math.abs(ev.deltaX) >= Math.abs(ev.deltaY)) return;
    const row = sidewaysScroller(ev.target);
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    const next = Math.max(0, Math.min(max, row.scrollLeft + ev.deltaY));
    if (next === row.scrollLeft) return; // at the end: let the page scroll
    row.scrollLeft = next;
    ev.preventDefault();
  }, { passive: false });

}

/* ── Mouse drag scrolls everything, like a finger ───────────────────────────
   Drag anywhere: the nearest container that can still scroll in that direction follows the
   mouse (pages, lists, sheets, sideways rows), and a fast release keeps it gliding (fling).
   When nothing can scroll that way (top of a page, top of a sheet, sideways on the Home
   schedule) the drag is left to the other gestures: pull to refresh, sheet drag-to-close, day
   swipe. Same hand-off as on a phone. */
const NO_DRAG_SCROLL = 'input, textarea, select, [contenteditable], .rm-range, [data-no-drag-scroll]';

function scrollable(el, axis, dir) {
  if (!el || el.nodeType !== 1) return false;
  const doc = el === document.scrollingElement || el === document.documentElement;
  if (!doc) {
    const ov = axis === 'y' ? getComputedStyle(el).overflowY : getComputedStyle(el).overflowX;
    if (!/(auto|scroll|overlay)/.test(ov)) return false;
  }
  const max = axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
  if (max <= 1) return false;
  const pos = axis === 'y' ? el.scrollTop : el.scrollLeft;
  return dir > 0 ? pos < max - 1 : pos > 0.5;
}

/** Nearest ancestor that can scroll further along axis in dir (+1 = towards the end). */
function scrollerFor(start, axis, dir) {
  for (let n = start; n && n.nodeType === 1; n = n.parentElement) {
    if (scrollable(n, axis, dir)) return n;
  }
  const se = document.scrollingElement;
  return se && scrollable(se, axis, dir) ? se : null;
}

let _fling = null;
function stopFling() { if (_fling) { cancelAnimationFrame(_fling.raf); _fling = null; document.documentElement.classList.remove('mx-mouse-fling'); } }

function fling(el, axis, v) {
  stopFling();
  if (Math.abs(v) < 0.05) return;
  const root = document.documentElement;
  root.classList.add('mx-mouse-fling');
  let last = performance.now();
  const f = { raf: 0 };
  _fling = f;
  const step = now => {
    const dt = Math.min(32, now - last);
    last = now;
    const before = axis === 'y' ? el.scrollTop : el.scrollLeft;
    if (axis === 'y') el.scrollTop = before + v * dt; else el.scrollLeft = before + v * dt;
    const after = axis === 'y' ? el.scrollTop : el.scrollLeft;
    v *= Math.pow(0.9965, dt); // decelerates like a phone fling, no bounce
    if (Math.abs(v) < 0.02 || after === before) { stopFling(); return; }
    f.raf = requestAnimationFrame(step);
  };
  f.raf = requestAnimationFrame(step);
}

function bindDragScroll() {
  let d = null;
  bindMouseDrag(document, {
    start(x, y, el) {
      stopFling();
      if (el.closest(NO_DRAG_SCROLL)) return false;
      d = { el, x0: x, y0: y, lx: x, ly: y, mode: '', target: null, axis: '', samples: [] };
      return true;
    },
    move(x, y) {
      if (!d) return;
      if (!d.mode) {
        const dx = x - d.x0, dy = y - d.y0;
        if (Math.hypot(dx, dy) < 6) return;
        d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        const delta = d.axis === 'x' ? dx : dy;
        d.target = scrollerFor(d.el, d.axis, delta < 0 ? 1 : -1);
        d.mode = d.target ? 'scroll' : 'none';
        d.lx = x; d.ly = y;
        if (!d.target) return;
      }
      if (d.mode !== 'scroll') return;
      const step = d.axis === 'y' ? y - d.ly : x - d.lx;
      if (d.axis === 'y') d.target.scrollTop -= step; else d.target.scrollLeft -= step;
      d.lx = x; d.ly = y;
      const now = performance.now();
      d.samples.push({ t: now, p: d.axis === 'y' ? y : x });
      while (d.samples.length > 2 && now - d.samples[0].t > 80) d.samples.shift();
    },
    end() {
      if (!d) return;
      const { mode, target, axis, samples } = d;
      d = null;
      if (mode !== 'scroll' || samples.length < 2) return;
      const a = samples[0], b = samples[samples.length - 1];
      if (performance.now() - b.t > 60) return; // the mouse stopped before release: no fling
      const v = -(b.p - a.p) / Math.max(1, b.t - a.t); // px/ms in scroll direction
      fling(target, axis, Math.max(-6, Math.min(6, v)));
    }
  });
  // A wheel turn or a new press stops a fling
  document.addEventListener('wheel', stopFling, { passive: true });
}

/* ── Keyboard: arrow keys switch days on Home ───────────────────────────── */
function bindArrowKeys() {
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const t = ev.target;
    if (t && (t.closest('input, textarea, select, [contenteditable]') || t.isContentEditable)) return;
    if ((window.__currentAppViewId || 'home') !== 'day') return;
    if (document.querySelector('.mo.open, .class-sheet-modal-overlay.open, .rm-sheet-overlay.open, #calendarPickerModal.open')) return;
    const btn = document.getElementById(ev.key === 'ArrowLeft' ? 'prevDayBtn' : 'nextDayBtn');
    if (btn) { btn.click(); ev.preventDefault(); }
  });
}

/**
 * Trackpad two-finger swipe (horizontal wheel) on an element: calls onSwipe('next'|'prev')
 * once per gesture.
 */
export function bindWheelSwipe(el, onSwipe, { threshold = 70, cooldown = 550 } = {}) {
  if (!el) return;
  let acc = 0;
  let lockUntil = 0;
  let resetT = null;
  el.addEventListener('wheel', ev => {
    if (Math.abs(ev.deltaX) <= Math.abs(ev.deltaY) || sidewaysScroller(ev.target)) return;
    const now = performance.now();
    if (now < lockUntil) return;
    acc += ev.deltaX;
    clearTimeout(resetT);
    resetT = setTimeout(() => { acc = 0; }, 180);
    if (Math.abs(acc) >= threshold) {
      onSwipe(acc > 0 ? 'next' : 'prev');
      acc = 0;
      lockUntil = now + cooldown;
    }
  }, { passive: true });
}

let _inited = false;
export function initDesktopInput() {
  if (_inited) return;
  _inited = true;
  // Swallow the click a browser fires right after a mouse drag
  window.addEventListener('click', ev => {
    if (performance.now() < _suppressClickUntil) {
      _suppressClickUntil = 0;
      ev.stopPropagation();
      ev.preventDefault();
    }
  }, true);
  bindSidewaysRows();
  bindDragScroll();
  bindArrowKeys();
}
