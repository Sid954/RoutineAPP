/**
 * Notes app (#notesPage, a full page like Attendance). A local notes app for this phone:
 *   - notes (title + text) and checklists, colours, labels (class + free tags), pin, archive, Trash (30 days)
 *   - full-text search, sort, grid / list view, filter chips (due, class, tag, archive, trash)
 *   - an optional date (and time) on any note; overdue ones turn red
 *   - the editor saves as you type; empty notes are dropped; delete and archive can be undone
 *   - share a note, duplicate it, turn a note into a checklist and back, export / import a backup file
 * Storage and rules: notes-store.js (tested). Nothing here leaves the phone unless you share or export.
 */
import { State } from '../core/state.js';
import { DAY_NAMES, MONTHS } from '../core/config.js';
import { escapeHtml } from '../core/utils.js';
import { openModal, closeModal } from '../modals/modal.js';
import { showToast } from '../toast/toast.js';
import * as S from './notes-store.js';

const $ = id => document.getElementById(id);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const svg = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const EASE = 'cubic-bezier(0.2, 0, 0, 1)';
const motionOn = () => document.documentElement.dataset.motion !== 'off';
const lsGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

const IC = {
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  checklist: '<polyline points="3 6 5 8 9 4"/><polyline points="3 14 5 16 9 12"/><line x1="12" y1="6" x2="21" y2="6"/><line x1="12" y1="14" x2="21" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 7 4 3v2H6v-2l4-3z"/>',
  archive: '<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><line x1="10" y1="13" x2="14" y2="13"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  back: '<polyline points="15 18 9 12 15 6"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  restore: '<polyline points="1 4 1 10 7 10"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'
};

/* ── View state ───────────────────────────────────────────────────────────── */
let _viewMode = lsGet('np_view', 'grid');          // grid | list
let _sort = lsGet('np_sort', 'edited');
let _filter = { k: 'all', v: '' };                 // all | due | subject | tag | archive | trash
let _q = '';
let _pop = null;

function dueLabel(n) {
  if (!n.due) return '';
  const today = ymd(new Date());
  const diff = Math.round((fromYmd(n.due) - fromYmd(today)) / 864e5);
  const d = fromYmd(n.due);
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : `${DAY_NAMES[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return n.dueTime ? `${day} ${fmtTime(n.dueTime)}` : day;
}
function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
function subjects() {
  const set = new Set();
  Object.values(State.schedule || {}).forEach(day => (day || []).forEach(c => c && c.title && set.add(String(c.title).trim().toUpperCase())));
  return [...set].sort();
}

/* ── List page ────────────────────────────────────────────────────────────── */
function visibleNotes() {
  const base = { sort: _sort, query: _q };
  switch (_filter.k) {
    case 'archive': return S.listNotes({ ...base, view: 'archive' });
    case 'trash': return S.listNotes({ ...base, view: 'trash' });
    case 'due': return S.listNotes({ ...base, view: 'notes', openOnly: true, sort: 'due' }).filter(n => n.due);
    case 'subject': return S.listNotes({ ...base, view: 'notes' }).filter(n => n.subject === _filter.v);
    case 'tag': return S.listNotes({ ...base, view: 'notes' }).filter(n => n.tags.includes(_filter.v));
    default: return S.listNotes({ ...base, view: 'notes' });
  }
}

function cardHtml(n) {
  const today = ymd(new Date());
  const done = S.isDone(n);
  const late = S.isOverdue(n, today);
  const inTrash = S.isTrashed(n);
  const meta = [
    n.subject ? `<span class="np-chip is-subj"><i class="np-dot"></i>${escapeHtml(n.subject)}</span>` : '',
    n.due ? `<span class="np-chip${late ? ' is-late' : ''}${done ? ' is-done' : ''}">${svg(IC.clock)}${escapeHtml(dueLabel(n))}</span>` : '',
    ...n.tags.slice(0, 3).map(t => `<span class="np-chip is-tag">#${escapeHtml(t)}</span>`)
  ].filter(Boolean).join('');
  let body = '';
  if (n.type === 'list') {
    const open = n.items.filter(i => !i.done), shut = n.items.filter(i => i.done);
    const rows = open.slice(0, 5).concat(open.length < 5 ? shut.slice(0, 5 - open.length) : []);
    body = `<ul class="np-items">${rows.map(i => `<li class="${i.done ? 'is-done' : ''}"><button type="button" class="np-ck${i.done ? ' is-on' : ''}" data-ck="${escapeHtml(n.id)}|${escapeHtml(i.id)}" aria-label="${i.done ? 'Untick' : 'Tick'}: ${escapeHtml(i.text)}">${svg(IC.check, 3.2)}</button><span>${escapeHtml(i.text)}</span></li>`).join('')}</ul>${n.items.length > rows.length ? `<p class="np-more">+${n.items.length - rows.length} more</p>` : ''}${n.items.length ? `<p class="np-prog">${shut.length}/${n.items.length} done</p>` : ''}`;
  } else if (n.body.trim()) {
    body = `<p class="np-prev">${escapeHtml(n.body.trim().slice(0, 320))}</p>`;
  }
  const actions = inTrash
    ? `<div class="np-card-acts"><button type="button" data-restore="${escapeHtml(n.id)}">${svg(IC.restore)}Restore</button><button type="button" class="is-danger" data-purge="${escapeHtml(n.id)}">${svg(IC.trash)}Delete forever</button></div>`
    : (n.archived ? `<div class="np-card-acts"><button type="button" data-unarchive="${escapeHtml(n.id)}">${svg(IC.archive)}Unarchive</button></div>` : '');
  return `<article class="np-card${n.color ? ` np-c-${n.color}` : ''}${done ? ' is-finished' : ''}${n.pinned ? ' is-pinned' : ''}" data-open="${escapeHtml(n.id)}" tabindex="0">
      ${n.pinned ? `<span class="np-pinned" aria-label="Pinned">${svg(IC.pin, 2)}</span>` : ''}
      ${n.title ? `<h3>${escapeHtml(n.title)}</h3>` : ''}
      ${body}
      ${meta ? `<div class="np-meta">${meta}</div>` : ''}
      ${actions}
    </article>`;
}

/** Guess how tall a card is (title lines, text lines or list rows, chips) so columns stay level. */
function cardHeight(n) {
  let h = 34;
  if (n.title) h += Math.ceil(n.title.length / 16) * 22;
  if (n.type === 'list') h += Math.min(5, n.items.length) * 26 + (n.items.length ? 18 : 0);
  else h += Math.min(7, Math.ceil(n.body.length / 20)) * 21;
  if (n.subject || n.due || n.tags.length) h += 34;
  return h;
}
function cardsHtml(list) {
  const cols = _viewMode === 'list' ? 1 : (window.innerWidth >= 640 ? 3 : 2);
  if (cols === 1) return `<div class="np-cards" style="--cols:1"><div class="np-col">${list.map(cardHtml).join('')}</div></div>`;
  const cs = Array.from({ length: cols }, () => ({ h: 0, html: '' }));
  list.forEach(n => { const c = cs.reduce((a, b) => (b.h < a.h ? b : a)); c.h += cardHeight(n) + 10; c.html += cardHtml(n); });
  return `<div class="np-cards" style="--cols:${cols}">${cs.map(c => `<div class="np-col">${c.html}</div>`).join('')}</div>`;
}

function paint() {
  const page = $('notesPage');
  if (!page || !$('npResults')) return;
  const c = S.counts();
  // A filter that no longer has anything behind it (Trash just emptied, the last tagged note gone) goes back to All
  if ((_filter.k === 'trash' && !c.trash) || (_filter.k === 'archive' && !c.archive) || (_filter.k === 'due' && !c.due)
    || (_filter.k === 'subject' && !S.allSubjects().includes(_filter.v)) || (_filter.k === 'tag' && !S.allTags().includes(_filter.v))) _filter = { k: 'all', v: '' };
  // chips
  const subj = S.allSubjects(), tags = S.allTags();
  const chip = (k, v, label, n, icon) => `<button type="button" class="np-fchip${_filter.k === k && _filter.v === v ? ' active' : ''}" data-f="${k}" data-v="${escapeHtml(v)}">${icon ? svg(icon) : ''}${escapeHtml(label)}${n ? `<b>${n}</b>` : ''}</button>`;
  const chipHtml = [
    chip('all', '', 'All', c.notes),
    c.due ? chip('due', '', 'Due', c.due, IC.clock) : '',
    ...subj.map(s => chip('subject', s, s, 0)),
    ...tags.map(t => chip('tag', t, `#${t}`, 0)),
    c.archive ? chip('archive', '', 'Archive', c.archive, IC.archive) : '',
    c.trash ? chip('trash', '', 'Trash', c.trash, IC.trash) : ''
  ].filter(Boolean);
  $('npChips').innerHTML = chipHtml.join('');
  $('npChips').hidden = chipHtml.length < 2;
  // results
  const list = visibleNotes();
  const res = $('npResults');
  res.className = `np-results is-${_viewMode}`;
  let html = '';
  if (_filter.k === 'trash' && c.trash) html += `<div class="np-banner"><span>Notes in Trash are deleted after 30 days.</span><button type="button" data-empty-trash="1">Empty Trash</button></div>`;
  if (!list.length) {
    const msg = _q ? ['No matches', `Nothing found for "${_q}".`]
      : _filter.k === 'trash' ? ['Trash is empty', 'Deleted notes wait here for 30 days.']
        : _filter.k === 'archive' ? ['Nothing archived', 'Archive notes you want out of the way but not deleted.']
          : _filter.k === 'due' ? ['Nothing due', 'Notes with a date show up here.']
            : _filter.k !== 'all' ? ['Nothing here', 'No notes match this filter.']
              : ['Your notes live here', 'Take a note, make a checklist, tag it with a class. It stays on this phone.'];
    html += `<div class="np-empty">${svg(IC.pen, 1.6)}<strong>${msg[0]}</strong><span>${msg[1]}</span></div>`;
  } else {
    const pinned = list.filter(n => n.pinned);
    if (_filter.k === 'all' && pinned.length && pinned.length < list.length && !_q) {
      html += `<h4 class="np-sec">Pinned</h4>${cardsHtml(pinned)}<h4 class="np-sec">Others</h4>${cardsHtml(list.filter(n => !n.pinned))}`;
    } else html += cardsHtml(list);
  }
  res.innerHTML = html;
  const viewBtn = $('npView');
  if (viewBtn) { viewBtn.innerHTML = svg(_viewMode === 'grid' ? IC.list : IC.grid); viewBtn.setAttribute('aria-label', _viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'); }
  const sub = document.querySelector('#notesPage .page-subtitle');
  if (sub) sub.textContent = c.notes ? `${c.notes} note${c.notes === 1 ? '' : 's'}${c.due ? ` · ${c.due} due` : ''}` : 'Nothing yet';
}

function build() {
  $('npBody').innerHTML = `
    <div class="np-top">
      <label class="np-search">${svg(IC.search)}<input type="search" id="npSearch" placeholder="Search notes" autocomplete="off" aria-label="Search notes"></label>
      <button type="button" class="np-round" id="npView"></button>
      <button type="button" class="np-round" id="npMenu" aria-label="More">${svg(IC.more)}</button>
    </div>
    <div class="np-capture">
      <button type="button" class="np-cap-main" data-new="note">${svg(IC.pen)}<span>Take a note</span></button>
      <button type="button" class="np-cap-ico" data-new="list" aria-label="New checklist">${svg(IC.checklist)}</button>
    </div>
    <div class="np-chips" id="npChips" role="tablist"></div>
    <div id="npResults"></div>
    <input type="file" id="npImport" accept="application/json,.json" hidden>`;
  $('npSearch').value = _q;
}

/* ── Popover menus (the same small popup as the week strip's) ─────────────── */
function closePop() {
  if (_pop) { _pop.remove(); _pop = null; }
  document.removeEventListener('pointerdown', onPopOutside, true);
  document.removeEventListener('keydown', onPopKey, true);
}
const onPopOutside = e => { if (_pop && !_pop.contains(e.target) && !(e.target.closest && e.target.closest('[data-keep-pop]'))) closePop(); };
const onPopKey = e => { if (e.key === 'Escape') closePop(); };
function openPop(anchor, html, onPick, { z = 100200 } = {}) {
  closePop();
  const pop = document.createElement('div');
  pop.className = 'day-pop np-pop';
  pop.style.zIndex = String(z);
  pop.innerHTML = html;
  document.body.appendChild(pop);
  pop.addEventListener('click', e => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    closePop();
    onPick(b.dataset.pick);
  });
  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.right - w));
  const above = r.bottom + 8 + h > window.innerHeight - 12 && r.top - 8 - h > 12;
  pop.style.left = `${left}px`;
  pop.style.top = `${above ? r.top - 8 - h : r.bottom + 8}px`;
  pop.classList.toggle('is-above', above);
  pop.style.setProperty('--arrow-x', `${Math.max(14, Math.min(w - 14, r.left + r.width / 2 - left))}px`);
  _pop = pop;
  document.addEventListener('pointerdown', onPopOutside, true);
  document.addEventListener('keydown', onPopKey, true);
}
const popRow = (pick, icon, label, on = false) => `<button type="button" class="day-pop-row np-pop-row" data-pick="${pick}"><span class="np-pop-ico">${svg(icon)}</span><span class="day-pop-text"><strong>${label}</strong></span>${on ? `<span class="np-pop-on">${svg(IC.check, 3)}</span>` : ''}</button>`;

function openMainMenu(anchor) {
  openPop(anchor,
    `<div class="day-pop-head">Sort by</div>${Object.entries(S.SORTS).map(([k, label]) => popRow(`sort:${k}`, IC.swap, label, _sort === k)).join('')}
     <div class="day-pop-head">Backup</div>${popRow('export', IC.download, 'Export notes')}${popRow('import', IC.upload, 'Import notes')}`,
    pick => {
      if (pick.startsWith('sort:')) { _sort = pick.slice(5); lsSet('np_sort', _sort); paint(); return; }
      if (pick === 'export') exportFile();
      if (pick === 'import') $('npImport').click();
    });
}

function exportFile() {
  const json = S.exportNotes();
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `routine-notes-${ymd(new Date())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    showToast('Notes exported', 'success');
  } catch (e) {
    if (navigator.clipboard) navigator.clipboard.writeText(json).then(() => showToast('Backup copied to the clipboard', 'success'), () => showToast('Could not export', 'error'));
    else showToast('Could not export', 'error');
  }
}

/* ── Editor ───────────────────────────────────────────────────────────────── */
let _ed = null; // { id, draft, el, timer }
const COLOR_HEX = { '': 'transparent', red: '#F43F5E', orange: '#F97316', yellow: '#EAB308', green: '#10B981', teal: '#14B8A6', blue: '#3B82F6', purple: '#A855F7', pink: '#EC4899' };

function draftFrom(n, type) {
  if (n) return { type: n.type, title: n.title, body: n.body, items: n.items.map(i => ({ ...i })), subject: n.subject, tags: n.tags.slice(), color: n.color, pinned: n.pinned, archived: n.archived, due: n.due, dueTime: n.dueTime };
  return { type, title: '', body: '', items: type === 'list' ? [{ id: S.newId(), text: '', done: false }] : [], subject: '', tags: [], color: '', pinned: false, archived: false, due: '', dueTime: '' };
}
const draftBlank = d => !d.title.trim() && !d.body.trim() && !d.items.some(i => i.text.trim());

function setStatus(text) { const s = $('npEdStatus'); if (s) s.textContent = text; }
function persist() {
  if (!_ed) return;
  clearTimeout(_ed.timer);
  const d = _ed.draft;
  const fields = { type: d.type, title: d.title, body: d.body, items: d.items.filter(i => i.text.trim() || d.items.length === 1), subject: d.subject, tags: d.tags, color: d.color, pinned: d.pinned, archived: d.archived, due: d.due, dueTime: d.dueTime };
  if (!_ed.id) {
    if (draftBlank(d)) return;
    const n = S.addNote(fields);
    if (n) _ed.id = n.id;
  } else {
    S.updateNote(_ed.id, fields);
  }
  setStatus('Saved');
  updateFoot();
}
function scheduleSave() { if (!_ed) return; setStatus('Saving…'); clearTimeout(_ed.timer); _ed.timer = setTimeout(persist, 350); }
function updateFoot() {
  const f = $('npEdFoot');
  if (!f || !_ed) return;
  const n = _ed.id ? S.getNote(_ed.id) : null;
  const d = _ed.draft;
  f.textContent = `${n ? `Edited ${ago(n.updatedAt)} · ` : ''}${S.wordCount({ ...d, items: d.items }) } word${S.wordCount(d) === 1 ? '' : 's'}`;
}

function itemsHtml(d) {
  const open = d.items.filter(i => !i.done), shut = d.items.filter(i => i.done);
  const row = i => `<div class="np-irow${i.done ? ' is-done' : ''}" data-iid="${escapeHtml(i.id)}">
      <button type="button" class="np-ck${i.done ? ' is-on' : ''}" data-ed-ck="${escapeHtml(i.id)}" aria-label="${i.done ? 'Untick' : 'Tick'}">${svg(IC.check, 3.2)}</button>
      <input type="text" class="np-itext" value="${escapeHtml(i.text)}" data-itext="${escapeHtml(i.id)}" placeholder="List item" maxlength="300" aria-label="List item">
      <button type="button" class="np-idel" data-ed-del="${escapeHtml(i.id)}" aria-label="Remove item">${svg(IC.x, 2.4)}</button>
    </div>`;
  return `${open.map(row).join('')}
    <button type="button" class="np-iadd" data-ed-add="1">${svg(IC.plus, 2.4)}List item</button>
    ${shut.length ? `<div class="np-done-h">Completed · ${shut.length}</div>${shut.map(row).join('')}` : ''}`;
}

function metaHtml(d) {
  const subs = subjects();
  return `<div class="np-meta-grid">
      <label class="np-field"><span>Class</span><select id="npSubj"><option value="">General</option>${subs.map(s => `<option value="${escapeHtml(s)}"${s === d.subject ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('')}${d.subject && !subs.includes(d.subject) ? `<option value="${escapeHtml(d.subject)}" selected>${escapeHtml(d.subject)}</option>` : ''}</select></label>
      <label class="np-field"><span>Date <i>(optional)</i></span><span class="np-datewrap"><input type="date" id="npDue" value="${escapeHtml(d.due)}">${d.due ? `<button type="button" class="np-clear" data-ed-cleardate="1" aria-label="Remove date">${svg(IC.x, 2.4)}</button>` : ''}</span></label>
      ${d.due ? `<label class="np-field"><span>Time <i>(optional)</i></span><span class="np-datewrap"><input type="time" id="npTime" value="${escapeHtml(d.dueTime)}">${d.dueTime ? `<button type="button" class="np-clear" data-ed-cleartime="1" aria-label="Remove time">${svg(IC.x, 2.4)}</button>` : ''}</span></label>` : ''}
    </div>
    <div class="np-tags"><span class="np-tags-ico">${svg(IC.tag)}</span>${d.tags.map(t => `<span class="np-tag">#${escapeHtml(t)}<button type="button" data-ed-rmtag="${escapeHtml(t)}" aria-label="Remove tag ${escapeHtml(t)}">${svg(IC.x, 2.6)}</button></span>`).join('')}<input type="text" id="npTagIn" placeholder="${d.tags.length ? 'Add tag' : 'Add a tag'}" maxlength="22" list="npTagList" autocomplete="off"><datalist id="npTagList">${S.allTags().filter(t => !d.tags.includes(t)).map(t => `<option value="${escapeHtml(t)}">`).join('')}</datalist></div>
    <div class="np-colors" role="radiogroup" aria-label="Colour">${S.NOTE_COLORS.map(c => `<button type="button" class="np-sw${d.color === c ? ' is-on' : ''}${c ? '' : ' is-none'}" style="--sw:${COLOR_HEX[c]}" data-ed-color="${c}" role="radio" aria-checked="${d.color === c}" aria-label="${c || 'No colour'}"></button>`).join('')}</div>`;
}

function editorHtml(d) {
  return `<div class="np-ed-card${d.color ? ` np-c-${d.color}` : ''}" role="dialog" aria-modal="true" aria-label="Edit note">
      <header class="np-ed-bar">
        <button type="button" class="np-round" data-ed-close="1" aria-label="Done">${svg(IC.back, 2.4)}</button>
        <span class="np-ed-status" id="npEdStatus" aria-live="polite">Saved</span>
        <button type="button" class="np-round${d.pinned ? ' is-on' : ''}" data-ed-pin="1" aria-pressed="${d.pinned}" aria-label="Pin">${svg(IC.pin)}</button>
        <button type="button" class="np-round${d.archived ? ' is-on' : ''}" data-ed-archive="1" aria-pressed="${d.archived}" aria-label="Archive">${svg(IC.archive)}</button>
        <button type="button" class="np-round" data-ed-more="1" data-keep-pop="1" aria-label="More">${svg(IC.more)}</button>
      </header>
      <div class="np-ed-scroll">
        <textarea id="npTitle" class="np-title" rows="1" placeholder="Title" maxlength="120" aria-label="Title">${escapeHtml(d.title)}</textarea>
        <div id="npContent">${d.type === 'list' ? `<div id="npItems">${itemsHtml(d)}</div>` : `<textarea id="npBodyIn" class="np-bodyin" placeholder="Write something…" aria-label="Note text">${escapeHtml(d.body)}</textarea>`}</div>
        <div id="npMeta">${metaHtml(d)}</div>
      </div>
      <footer class="np-ed-foot" id="npEdFoot"></footer>
    </div>`;
}

function autosize(t, min = 180) { if (!t) return; t.style.height = 'auto'; t.style.height = `${Math.max(min, t.scrollHeight)}px`; }

function openEditor(id, type = 'note') {
  closePop();
  const n = id ? S.getNote(id) : null;
  if (id && !n) return;
  if (n && S.isTrashed(n)) { showToast('Restore it first to edit', 'info'); return; }
  const el = document.createElement('div');
  el.className = 'np-ed';
  el.id = 'npEditor';
  _ed = { id: n ? n.id : '', draft: draftFrom(n, type), el, timer: null };
  el.innerHTML = editorHtml(_ed.draft);
  document.body.appendChild(el);
  updateFoot();
  if (motionOn() && el.animate) el.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE });
  autosize($('npTitle'), 40);
  autosize($('npBodyIn'));
  // new notes start with the cursor in the text; lists in the first item
  if (!n) setTimeout(() => { const f = _ed && _ed.el.querySelector(type === 'list' ? '.np-itext' : '#npBodyIn'); if (f) f.focus(); }, 60);
  el.addEventListener('click', onEditorClick);
  el.addEventListener('input', onEditorInput);
  el.addEventListener('change', onEditorChange);
  el.addEventListener('keydown', onEditorKey);
}

function closeEditor() {
  if (!_ed) return;
  closePop();
  persist();
  const { id, draft, el } = _ed;
  // An empty note is not kept
  if (id && draftBlank(draft)) S.removeNote(id);
  _ed = null;
  const done = () => { el.remove(); paint(); refreshHome(); };
  if (motionOn() && el.animate) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE }).onfinish = done; else done();
  setTimeout(() => { if (el.isConnected) done(); }, 260);
}

function redrawItems(focusId = '') {
  const box = $('npItems');
  if (!box) return;
  box.innerHTML = itemsHtml(_ed.draft);
  if (focusId) { const inp = box.querySelector(`[data-itext="${CSS.escape(focusId)}"]`); if (inp) { inp.focus(); const l = inp.value.length; inp.setSelectionRange(l, l); } }
}
function redrawMeta() { $('npMeta').innerHTML = metaHtml(_ed.draft); }
function paintEditorColor() { const c = _ed.el.querySelector('.np-ed-card'); c.className = `np-ed-card${_ed.draft.color ? ` np-c-${_ed.draft.color}` : ''}`; }

function onEditorInput(e) {
  const d = _ed.draft;
  if (e.target.id === 'npTitle') { d.title = e.target.value.replace(/\n/g, ' '); autosize(e.target, 40); }
  else if (e.target.id === 'npBodyIn') { d.body = e.target.value; autosize(e.target); }
  else if (e.target.dataset && e.target.dataset.itext) { const it = d.items.find(i => i.id === e.target.dataset.itext); if (it) it.text = e.target.value; }
  else return;
  scheduleSave();
}

function onEditorChange(e) {
  const d = _ed.draft;
  if (e.target.id === 'npSubj') d.subject = e.target.value;
  else if (e.target.id === 'npDue') { d.due = e.target.value; if (!d.due) d.dueTime = ''; redrawMeta(); }
  else if (e.target.id === 'npTime') { d.dueTime = e.target.value; redrawMeta(); }
  else return;
  scheduleSave();
}

function addTag(raw) {
  const t = S.cleanTag(raw);
  if (t && !_ed.draft.tags.includes(t) && _ed.draft.tags.length < 12) _ed.draft.tags.push(t);
  redrawMeta();
  const inp = $('npTagIn'); if (inp) inp.focus();
  scheduleSave();
}

function onEditorKey(e) {
  const d = _ed.draft;
  if (e.target.id === 'npTitle' && e.key === 'Enter') { e.preventDefault(); const next = $('npBodyIn') || _ed.el.querySelector('.np-itext'); if (next) next.focus(); return; }
  if (e.target.id === 'npTagIn' && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); addTag(e.target.value); return; }
  if (e.target.id === 'npTagIn' && e.key === 'Backspace' && !e.target.value && d.tags.length) { d.tags.pop(); redrawMeta(); $('npTagIn').focus(); scheduleSave(); return; }
  const iid = e.target.dataset && e.target.dataset.itext;
  if (!iid) return;
  const idx = d.items.findIndex(i => i.id === iid);
  if (e.key === 'Enter') {
    e.preventDefault();
    const item = { id: S.newId(), text: '', done: false };
    d.items.splice(idx + 1, 0, item);
    redrawItems(item.id); scheduleSave();
  } else if (e.key === 'Backspace' && !e.target.value && d.items.length > 1) {
    e.preventDefault();
    d.items.splice(idx, 1);
    const prev = d.items[Math.max(0, idx - 1)];
    redrawItems(prev && prev.id); scheduleSave();
  }
}

function onEditorClick(e) {
  const d = _ed.draft;
  const t = e.target;
  const q = sel => t.closest(sel);
  if (q('[data-ed-close]')) { closeEditor(); return; }
  if (q('[data-ed-pin]')) { d.pinned = !d.pinned; if (d.pinned) d.archived = false; _ed.el.querySelector('[data-ed-pin]').classList.toggle('is-on', d.pinned); _ed.el.querySelector('[data-ed-archive]').classList.toggle('is-on', d.archived); persist(); showToast(d.pinned ? 'Pinned' : 'Unpinned', 'info'); return; }
  if (q('[data-ed-archive]')) { archiveFromEditor(); return; }
  if (q('[data-ed-more]')) { openEditorMenu(q('[data-ed-more]')); return; }
  const ck = q('[data-ed-ck]');
  if (ck) { const it = d.items.find(i => i.id === ck.dataset.edCk); if (it) { it.done = !it.done; redrawItems(); scheduleSave(); } return; }
  const del = q('[data-ed-del]');
  if (del) { d.items = d.items.filter(i => i.id !== del.dataset.edDel); if (!d.items.length) d.items.push({ id: S.newId(), text: '', done: false }); redrawItems(); scheduleSave(); return; }
  if (q('[data-ed-add]')) { const item = { id: S.newId(), text: '', done: false }; d.items.push(item); redrawItems(item.id); scheduleSave(); return; }
  if (q('[data-ed-cleardate]')) { d.due = ''; d.dueTime = ''; redrawMeta(); scheduleSave(); return; }
  if (q('[data-ed-cleartime]')) { d.dueTime = ''; redrawMeta(); scheduleSave(); return; }
  const rm = q('[data-ed-rmtag]');
  if (rm) { d.tags = d.tags.filter(x => x !== rm.dataset.edRmtag); redrawMeta(); scheduleSave(); return; }
  const col = q('[data-ed-color]');
  if (col) { d.color = col.dataset.edColor; paintEditorColor(); redrawMeta(); scheduleSave(); return; }
}

function archiveFromEditor() {
  const d = _ed.draft;
  persist();
  if (!_ed.id) { closeEditor(); return; }
  const id = _ed.id;
  const on = !d.archived;
  d.archived = on; d.pinned = false;
  S.updateNote(id, { archived: on, pinned: false }, { touch: false });
  closeEditorQuiet();
  showToast(on ? 'Archived' : 'Unarchived', 'info', () => { S.archiveNote(id, !on); paint(); });
}
function trashFromEditor() {
  persist();
  const id = _ed.id;
  if (!id) { closeEditor(); return; }
  S.trashNote(id);
  closeEditorQuiet();
  showToast('Moved to Trash', 'info', () => { S.restoreNote(id); paint(); refreshHome(); });
}
/** Close without the save step (the caller just saved). */
function closeEditorQuiet() {
  if (!_ed) return;
  clearTimeout(_ed.timer);
  const el = _ed.el;
  _ed = null;
  el.remove();
  paint();
  refreshHome();
}

async function shareNote() {
  persist();
  const n = _ed && _ed.id ? S.getNote(_ed.id) : null;
  if (!n) return;
  const text = S.noteText(n);
  try { if (navigator.share) { await navigator.share({ title: n.title || 'Note', text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); showToast('Copied to the clipboard', 'success'); } catch (e) { showToast('Could not share', 'error'); }
}

function openEditorMenu(anchor) {
  const d = _ed.draft;
  openPop(anchor,
    `${popRow('share', IC.share, 'Share')}${popRow('copy', IC.copy, 'Copy text')}${popRow('duplicate', IC.copy, 'Make a copy')}${popRow('convert', IC.swap, d.type === 'list' ? 'Turn into a note' : 'Turn into a checklist')}${popRow('trash', IC.trash, 'Move to Trash')}`,
    async pick => {
      if (!_ed) return;
      if (pick === 'share') return shareNote();
      if (pick === 'copy') { persist(); const n = _ed.id && S.getNote(_ed.id); if (n) { try { await navigator.clipboard.writeText(S.noteText(n)); showToast('Copied', 'success'); } catch (e) { showToast('Could not copy', 'error'); } } return; }
      if (pick === 'duplicate') { persist(); if (!_ed.id) return; const c = S.duplicateNote(_ed.id); closeEditorQuiet(); showToast('Copy made', 'success'); if (c) openEditor(c.id); return; }
      if (pick === 'convert') {
        persist();
        if (!_ed.id) { d.type = d.type === 'list' ? 'note' : 'list'; if (d.type === 'list' && !d.items.length) d.items.push({ id: S.newId(), text: '', done: false }); }
        else { S.convertNote(_ed.id); }
        const id = _ed.id; const keep = _ed.draft;
        if (id) { const fresh = S.getNote(id); _ed.draft = draftFrom(fresh); _ed.el.innerHTML = editorHtml(_ed.draft); autosize($('npTitle'), 40); autosize($('npBodyIn')); updateFoot(); }
        else { _ed.el.innerHTML = editorHtml(keep); autosize($('npTitle'), 40); autosize($('npBodyIn')); updateFoot(); }
        return;
      }
      if (pick === 'trash') return trashFromEditor();
    });
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
const refreshHome = () => { if (window.__renderHome) window.__renderHome(); };

function ensure() {
  if ($('notesPage')) return $('notesPage');
  const page = document.createElement('div');
  page.className = 'mo mo-page st-page np-page';
  page.id = 'notesPage';
  page.innerHTML = `<div class="md md-wide view-md st-md">
      <div class="md-h page-style-header st-header">
        <button class="page-back-btn" id="npBack" title="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="15 18 9 12 15 6"></polyline></svg><span>Back</span></button>
        <div class="page-title-group"><h2 class="page-title">Notes</h2><span class="page-subtitle"></span></div>
      </div>
      <div class="st-body"><div id="npBody"></div></div>
    </div>`;
  document.body.appendChild(page);

  page.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#npBack')) { closeModal(page); return; }
    if (t.closest('[data-new]')) { openEditor('', t.closest('[data-new]').dataset.new); return; }
    if (t.closest('#npView')) { _viewMode = _viewMode === 'grid' ? 'list' : 'grid'; lsSet('np_view', _viewMode); paint(); return; }
    if (t.closest('#npMenu')) { openMainMenu(t.closest('#npMenu')); return; }
    const f = t.closest('[data-f]');
    if (f) { _filter = { k: f.dataset.f, v: f.dataset.v || '' }; paint(); const r = $('npResults'); if (r && r.animate && motionOn()) r.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 220, easing: EASE }); return; }
    const ck = t.closest('[data-ck]');
    if (ck) { const [nid, iid] = ck.dataset.ck.split('|'); S.toggleItem(nid, iid); paint(); refreshHome(); return; }
    const rs = t.closest('[data-restore]');
    if (rs) { S.restoreNote(rs.dataset.restore); paint(); showToast('Restored', 'success'); return; }
    const pg = t.closest('[data-purge]');
    if (pg) { const id = pg.dataset.purge; const n = S.getNote(id); S.removeNote(id); paint(); showToast('Deleted forever', 'info'); return; }
    const ua = t.closest('[data-unarchive]');
    if (ua) { S.archiveNote(ua.dataset.unarchive, false); paint(); return; }
    if (t.closest('[data-empty-trash]')) { S.emptyTrash(); _filter = { k: 'all', v: '' }; paint(); showToast('Trash emptied', 'info'); return; }
    const card = t.closest('[data-open]');
    if (card) openEditor(card.dataset.open);
  });
  page.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.np-card') && e.target.dataset.open) { e.preventDefault(); openEditor(e.target.dataset.open); }
  });
  let st = null;
  page.addEventListener('input', e => {
    if (e.target.id !== 'npSearch') return;
    clearTimeout(st);
    st = setTimeout(() => { _q = e.target.value.trim(); paint(); }, 120);
  });
  page.addEventListener('change', e => {
    if (e.target.id !== 'npImport') return;
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      const n = S.importNotes(String(rd.result || ''));
      if (n < 0) showToast('That file is not a notes backup', 'error');
      else { showToast(n ? `Imported ${n} note${n === 1 ? '' : 's'}` : 'Nothing new in that file', n ? 'success' : 'info'); paint(); refreshHome(); }
      e.target.value = '';
    };
    rd.readAsText(file);
  });
  return page;
}

export function openNotes() {
  const page = ensure();
  S.purgeOldTrash();
  _filter = { k: 'all', v: '' };
  _q = '';
  build();
  paint();
  openModal(page);
  const md = page.querySelector('.md');
  if (md) md.scrollTop = 0;
}

/** Open the editor on a new note straight away (Home's quick actions). */
export function newNote(type = 'note') { openNotes(); openEditor('', type); }

export function initNotesPage() {
  ensure();
  window.__openNotes = openNotes;
  window.__newNote = newNote;
}
