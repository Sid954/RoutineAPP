/**
 * Desktop input (Nov 2026): the app's touch gestures also work with a mouse or trackpad.
 *
 *  - bindMouseDrag(): lets a touch gesture (sheet drag-to-close, pull to refresh, swiping days on
 *    Home and in the Weekly Routine) run with a mouse drag. Touch code stays as it was; each gesture
 *    calls the same start/move/end logic from both. During a mouse drag text isn't selected, and the
 *    click that follows a real drag is swallowed (so dragging over a card doesn't open it).
 *  - Rows that scroll sideways with hidden scrollbars (filter chips, "Coming up", day tabs): the mouse
 *    wheel scrolls them sideways, and they can be dragged.
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

  // Drag a row sideways with the mouse
  let drag = null;
  bindMouseDrag(document, {
    start(x, y, el) {
      if (el.closest('input, textarea, select, [contenteditable]')) return false;
      const row = sidewaysScroller(el);
      if (!row) return false;
      drag = { row, x0: x, left0: row.scrollLeft };
      return true;
    },
    move(x) { if (drag) drag.row.scrollLeft = drag.left0 - (x - drag.x0); },
    end() { drag = null; }
  });
}

/* ── Keyboard: arrow keys switch days on Home ───────────────────────────── */
function bindArrowKeys() {
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const t = ev.target;
    if (t && (t.closest('input, textarea, select, [contenteditable]') || t.isContentEditable)) return;
    if ((window.__currentAppViewId || 'home') !== 'home') return;
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
  bindArrowKeys();
}
