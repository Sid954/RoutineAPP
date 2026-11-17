/**
 * Simple / Advanced mode for the post form.
 *   Simple (default): date chips (Today, Tomorrow, the next few days) under every date,
 *   course chips instead of the course dropdowns, and empty optional fields tucked away.
 *   Advanced: everything, as before.
 * Purely a layer over the existing inputs: chips set the real input/select value and fire
 * the same input/change events, so validation, previews and course lists work unchanged.
 */
import { localDateStr, escapeHtml } from '../core/utils.js';

const MODE_KEY = 'post_mode';
const CHIP_SELECTS = ['paCancelSubject', 'paTestSubject', 'paTaskSubject', 'paClassSubject', 'paMoveClass'];
const MAX_CHIPS = 12;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const $ = id => document.getElementById(id);
let page = null;

function getMode() {
  try { return localStorage.getItem(MODE_KEY) === 'advanced' ? 'advanced' : 'easy'; } catch (e) { return 'easy'; }
}
function setMode(m) {
  try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
  applyMode();
}

function fire(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function dateChoices() {
  const out = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const ymd = localDateStr(d);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${DOW[d.getDay()]} ${d.getDate()}`;
    out.push({ ymd, label });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function buildDateChips(input) {
  let row = input.parentElement.querySelector(':scope > .pa-chips[data-chips-for]');
  if (!row) {
    row = document.createElement('div');
    row.className = 'pa-chips pa-date-chips';
    row.dataset.chipsFor = input.id;
    input.insertAdjacentElement('afterend', row);
    row.addEventListener('click', e => {
      const b = e.target.closest('.pa-chip');
      if (!b) return;
      input.value = b.dataset.v;
      fire(input);
      syncPostEasy();
    });
  }
  row.innerHTML = dateChoices().map(c =>
    `<button type="button" class="pa-chip" data-v="${c.ymd}">${c.label}</button>`).join('');
}

function buildSelectChips(sel) {
  const field = sel.closest('.pa-field');
  if (!field) return;
  let row = field.querySelector(':scope > .pa-chips[data-chips-for]');
  if (!row) {
    row = document.createElement('div');
    row.className = 'pa-chips pa-course-chips';
    row.dataset.chipsFor = sel.id;
    field.appendChild(row);
    row.addEventListener('click', e => {
      const b = e.target.closest('.pa-chip');
      if (!b) return;
      sel.value = b.dataset.v;
      fire(sel);
      syncPostEasy();
    });
  }
  const opts = Array.from(sel.options).filter(o => o.value);
  if (!opts.length) {
    // Nothing to pick: the dropdown itself shows why ("No classes on Thu")
    row.innerHTML = '';
    field.classList.remove('has-chips');
    return;
  }
  if (opts.length > MAX_CHIPS) { row.innerHTML = ''; field.classList.remove('has-chips'); return; }
  row.innerHTML = opts.map(o =>
    `<button type="button" class="pa-chip" data-v="${escapeHtml(o.value)}">${escapeHtml(o.textContent)}</button>`).join('');
  field.classList.add('has-chips');
}

/** Re-highlight chips and show optional fields that already hold a value. */
export function syncPostEasy() {
  if (!page) return;
  page.querySelectorAll('.pa-chips[data-chips-for]').forEach(row => {
    const el = $(row.dataset.chipsFor);
    if (!el) return;
    row.querySelectorAll('.pa-chip').forEach(b => {
      const on = b.dataset.v === el.value;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  });
  page.querySelectorAll('.pa-opt').forEach(f => {
    const el = f.querySelector('input, textarea, select');
    f.classList.toggle('has-value', !!(el && String(el.value || '').trim()));
  });
}

function applyMode() {
  if (!page) return;
  const m = getMode();
  page.classList.toggle('pa-easy', m === 'easy');
  page.querySelectorAll('#paModeSeg button').forEach(b => {
    const on = b.dataset.mode === m;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  syncPostEasy();
}

export function initPostEasy() {
  page = $('postAnnounceAppView');
  if (!page || page.dataset.easyInit) return;
  page.dataset.easyInit = '1';

  // Mode switch in the "Details" heading
  const title = page.querySelector('#paFields .pa-sec-title');
  if (title) {
    title.insertAdjacentHTML('beforeend', `<span class="pa-mode" id="paModeSeg" role="group" aria-label="Form mode">
      <button type="button" data-mode="easy">Simple</button><button type="button" data-mode="advanced">Advanced</button></span>`);
    title.querySelector('#paModeSeg').addEventListener('click', e => {
      const b = e.target.closest('button[data-mode]');
      if (b) setMode(b.dataset.mode);
    });
  }

  // Optional fields (label says "optional") hide in Simple mode while empty
  page.querySelectorAll('#paFields .pa-field').forEach(f => {
    const lbl = f.querySelector('.pa-label');
    if (lbl && /\(optional\)/i.test(lbl.textContent)) f.classList.add('pa-opt');
  });

  page.querySelectorAll('#paFields input[type="date"]').forEach(buildDateChips);

  CHIP_SELECTS.forEach(id => {
    const sel = $(id);
    if (!sel) return;
    buildSelectChips(sel);
    new MutationObserver(() => { buildSelectChips(sel); syncPostEasy(); }).observe(sel, { childList: true });
  });

  page.addEventListener('input', syncPostEasy);
  page.addEventListener('change', syncPostEasy);
  applyMode();
}

/** Called each time the form opens: refresh the day chips (the date may have changed). */
export function refreshPostEasy() {
  if (!page) return;
  page.querySelectorAll('#paFields input[type="date"]').forEach(buildDateChips);
  CHIP_SELECTS.forEach(id => { const s = $(id); if (s) buildSelectChips(s); });
  applyMode();
}
