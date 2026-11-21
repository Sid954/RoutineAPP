/**
 * Notes (this phone only, DOM-free, tested in tests/test_notes_v2.js and test_home_stores.js).
 *
 * notes_v2: [{
 *   id, type: 'note' | 'list',          a note has a title + body, a list has checkable items
 *   title, body, items: [{ id, text, done }],
 *   subject,                            course code, '' = general
 *   tags: ['exam', 'lab'],              free labels, lowercase
 *   color: '' | 'red' | 'orange' | ...  card tint
 *   pinned, archived,
 *   trashedAt: 0 | ms,                  in Trash until emptied, or 30 days
 *   due: '' | 'YYYY-MM-DD', dueTime: '' | 'HH:MM',   both optional
 *   done,                               a plain note can be ticked off too (kept from the old to-do notes)
 *   createdAt, updatedAt
 * }]
 *
 * notes_v1 (the old to-do notes: { id, text, subject, date, done, createdAt }) is converted once into lists
 * of one item. addNote / updateNote / toggleNote / removeNote / listNotes / notesForSubject keep working for
 * old callers.
 */
const KEY = 'notes_v2';
const OLD_KEY = 'notes_v1';
const MAX_NOTES = 1000;
const TRASH_DAYS = 30;

export const NOTE_COLORS = ['', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];
export const SORTS = { edited: 'Last edited', created: 'Date created', title: 'Title', due: 'Due date' };

const parse = raw => { try { const v = JSON.parse(raw || 'null'); return Array.isArray(v) ? v : null; } catch (e) { return null; } };
const readRaw = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v.slice(-MAX_NOTES))); } catch (e) {} };
let _seq = 0;
export const newId = () => `n${Date.now().toString(36)}${(_seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Repairs one stored note (unknown fields dropped, bad values reset). */
export function normalizeNote(n) {
  if (!n || typeof n !== 'object') return null;
  const now = Date.now();
  const items = (Array.isArray(n.items) ? n.items : []).map(i => ({ id: String(i && i.id || newId()), text: String(i && i.text || '').slice(0, 300), done: !!(i && i.done) }));
  const type = n.type === 'list' ? 'list' : 'note';
  return {
    id: String(n.id || newId()),
    type,
    title: String(n.title || '').slice(0, 120),
    body: String(n.body || '').slice(0, 20000),
    items: type === 'list' ? items : [],
    subject: String(n.subject || '').trim().toUpperCase().slice(0, 40),
    tags: [...new Set((Array.isArray(n.tags) ? n.tags : []).map(cleanTag).filter(Boolean))].slice(0, 12),
    color: NOTE_COLORS.includes(n.color) ? n.color : '',
    pinned: !!n.pinned,
    archived: !!n.archived,
    trashedAt: Number(n.trashedAt) > 0 ? Number(n.trashedAt) : 0,
    due: DATE_RE.test(n.due || '') ? n.due : '',
    dueTime: DATE_RE.test(n.due || '') && TIME_RE.test(n.dueTime || '') ? n.dueTime : '',
    done: !!n.done,
    createdAt: Number(n.createdAt) || now,
    updatedAt: Number(n.updatedAt) || Number(n.createdAt) || now
  };
}
export const cleanTag = t => String(t || '').trim().toLowerCase().replace(/^#+/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 20);

/** The old to-do notes become one-item lists. */
function migrate(old) {
  return old.map(o => normalizeNote({
    id: o.id, type: 'list', title: '', items: [{ id: newId(), text: o.text, done: !!o.done }],
    subject: o.subject, due: o.date, done: !!o.done, createdAt: o.createdAt, updatedAt: o.createdAt
  })).filter(Boolean);
}

let _cache = null;
function all() {
  if (_cache) return _cache;
  let list = parse(readRaw(KEY));
  if (!list) {
    const old = parse(readRaw(OLD_KEY));
    list = old ? migrate(old) : [];
    if (old) { try { localStorage.setItem('notes_v1_backup', JSON.stringify(old)); } catch (e) {} write(list); }
  }
  _cache = list.map(normalizeNote).filter(Boolean);
  return _cache;
}
function save(list) { _cache = list; write(list); }
/** For tests and for a storage change from another tab. */
export function resetNotesCache() { _cache = null; }

/* ── Reading ──────────────────────────────────────────────────────────────── */
export const isTrashed = n => n.trashedAt > 0;
/** A list is done when every item is ticked; a note is done when ticked itself. */
export const isDone = n => (n.type === 'list' ? n.items.length > 0 && n.items.every(i => i.done) : !!n.done);
export const isOverdue = (n, today) => !!n.due && n.due < today && !isDone(n);

export function sortNotes(list, how = 'edited') {
  const by = {
    edited: (a, b) => b.updatedAt - a.updatedAt,
    created: (a, b) => b.createdAt - a.createdAt,
    title: (a, b) => (a.title || firstLine(a)).localeCompare(b.title || firstLine(b), undefined, { sensitivity: 'base' }),
    due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.updatedAt - a.updatedAt
  }[how] || ((a, b) => b.updatedAt - a.updatedAt);
  return list.slice().sort(by);
}
export function firstLine(n) {
  if (n.type === 'list') return (n.items[0] && n.items[0].text) || '';
  return String(n.body || '').split('\n')[0];
}

/** Full-text search over title, body, items, tags and subject. Every word has to match. */
export function searchNotes(list, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter(n => {
    const hay = [n.title, n.body, n.items.map(i => i.text).join(' '), n.tags.join(' '), n.subject].join(' ').toLowerCase();
    return words.every(w => hay.includes(w.replace(/^#/, '')));
  });
}

/**
 * @param view 'notes' (default: not archived, not trashed) | 'archive' | 'trash' | 'all' (everything not trashed)
 */
export function listNotes({ openOnly = false, view = 'all', sort = 'edited', query = '' } = {}) {
  let list = all().filter(n => {
    if (view === 'trash') return isTrashed(n);
    if (isTrashed(n)) return false;
    if (view === 'archive') return n.archived;
    if (view === 'notes') return !n.archived;
    return true;
  });
  if (openOnly) list = list.filter(n => !isDone(n));
  list = searchNotes(list, query);
  list = sortNotes(list, sort);
  // Pinned first (a stable partition keeps the chosen order inside each half)
  return [...list.filter(n => n.pinned), ...list.filter(n => !n.pinned)];
}
export function getNote(id) { return all().find(n => n.id === id) || null; }
export const allSubjects = () => [...new Set(all().filter(n => !isTrashed(n) && n.subject).map(n => n.subject))].sort();
export const allTags = () => [...new Set(all().filter(n => !isTrashed(n)).flatMap(n => n.tags))].sort();
export function counts() {
  const live = all().filter(n => !isTrashed(n));
  return { notes: live.filter(n => !n.archived).length, archive: live.filter(n => n.archived).length, trash: all().length - live.length, due: live.filter(n => !n.archived && n.due && !isDone(n)).length };
}
/** Open notes for a subject (shown on its class cards). */
export function notesForSubject(subject) {
  const s = String(subject || '').trim().toUpperCase();
  return all().filter(n => !isTrashed(n) && !n.archived && !isDone(n) && n.subject === s);
}

/* ── Writing ──────────────────────────────────────────────────────────────── */
/** Create. Old callers pass { text, subject, date }: that makes a one-item list. */
export function addNote(fields = {}) {
  const f = { ...fields };
  if (f.text !== undefined && f.type === undefined && f.body === undefined && f.items === undefined) {
    const t = String(f.text || '').trim();
    if (!t) return null;
    f.type = 'list'; f.items = [{ id: newId(), text: t.slice(0, 300), done: false }]; f.due = f.date || f.due || '';
  }
  const now = Date.now();
  const note = normalizeNote({ ...f, id: newId(), createdAt: now, updatedAt: now });
  if (isBlank(note)) return null;
  save(all().concat(note));
  return note;
}
export function isBlank(n) {
  return !n.title.trim() && !n.body.trim() && !n.items.some(i => i.text.trim());
}
/** Merge fields into a note and stamp it as edited. */
export function updateNote(id, patch, { touch = true } = {}) {
  const list = all().slice();
  const i = list.findIndex(x => x.id === id);
  if (i < 0) return null;
  const next = normalizeNote({ ...list[i], ...patch, id, createdAt: list[i].createdAt, updatedAt: touch ? Date.now() : list[i].updatedAt });
  list[i] = next;
  save(list);
  return next;
}
/** Old to-do toggle: ticks (or unticks) a one-item list, or a note. */
export function toggleNote(id) {
  const n = getNote(id);
  if (!n) return null;
  if (n.type === 'list') { const to = !isDone(n); return updateNote(id, { items: n.items.map(i => ({ ...i, done: to })) }); }
  return updateNote(id, { done: !n.done });
}
export function toggleItem(id, itemId) {
  const n = getNote(id);
  if (!n) return null;
  return updateNote(id, { items: n.items.map(i => (i.id === itemId ? { ...i, done: !i.done } : i)) });
}
export const pinNote = (id, on) => updateNote(id, { pinned: on }, { touch: false });
export const archiveNote = (id, on = true) => updateNote(id, { archived: on, pinned: on ? false : getNote(id).pinned }, { touch: false });
export const trashNote = (id) => updateNote(id, { trashedAt: Date.now(), pinned: false }, { touch: false });
export const restoreNote = (id) => updateNote(id, { trashedAt: 0 }, { touch: false });
/** Gone for good. */
export function removeNote(id) { save(all().filter(n => n.id !== id)); }
export function emptyTrash() { save(all().filter(n => !isTrashed(n))); }
/** Trash older than 30 days is deleted; returns how many went. */
export function purgeOldTrash(now = Date.now()) {
  const keep = all().filter(n => !(isTrashed(n) && now - n.trashedAt > TRASH_DAYS * 864e5));
  const gone = all().length - keep.length;
  if (gone) save(keep);
  return gone;
}
export function duplicateNote(id) {
  const n = getNote(id);
  if (!n) return null;
  const now = Date.now();
  const copy = normalizeNote({ ...n, id: newId(), title: n.title ? `${n.title} (copy)` : '', items: n.items.map(i => ({ ...i, id: newId() })), pinned: false, trashedAt: 0, createdAt: now, updatedAt: now });
  save(all().concat(copy));
  return copy;
}
/** Switch between a note and a checklist without losing the words. */
export function convertNote(id) {
  const n = getNote(id);
  if (!n) return null;
  if (n.type === 'note') {
    const lines = n.body.split('\n').map(s => s.trim()).filter(Boolean);
    return updateNote(id, { type: 'list', body: '', items: lines.map(t => ({ id: newId(), text: t, done: false })) });
  }
  return updateNote(id, { type: 'note', body: n.items.map(i => i.text).filter(Boolean).join('\n'), items: [] });
}

/* ── Plain text, backup ───────────────────────────────────────────────────── */
export function noteText(n) {
  const head = n.title ? `${n.title}\n\n` : '';
  const body = n.type === 'list' ? n.items.map(i => `${i.done ? '[x]' : '[ ]'} ${i.text}`).join('\n') : n.body;
  return `${head}${body}`.trim();
}
export function wordCount(n) {
  const text = [n.title, n.type === 'list' ? n.items.map(i => i.text).join(' ') : n.body].join(' ').trim();
  return text ? text.split(/\s+/).length : 0;
}
export function exportNotes() {
  return JSON.stringify({ app: 'routine-notes', version: 2, exportedAt: new Date().toISOString(), notes: all() }, null, 2);
}
/** Merge a backup: a note that exists keeps whichever copy was edited last. Returns how many notes were added or updated. */
export function importNotes(json) {
  let data;
  try { data = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return -1; }
  const incoming = (data && Array.isArray(data.notes) ? data.notes : Array.isArray(data) ? data : null);
  if (!incoming) return -1;
  const list = all().slice();
  let changed = 0;
  incoming.map(normalizeNote).filter(Boolean).forEach(n => {
    const i = list.findIndex(x => x.id === n.id);
    if (i < 0) { list.push(n); changed++; } else if (n.updatedAt > list[i].updatedAt) { list[i] = n; changed++; }
  });
  if (changed) save(list);
  return changed;
}
