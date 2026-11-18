/**
 * Community suggestions (data + API). Rendering lives in notices-view.js.
 *
 * Anyone can suggest a notice; students of the same section vote on it (department-wide ones:
 * everyone). Server rules: api/_lib/suggestion-rules.js. Design: NEXT_TASKS.md, item 17.
 *  - state 'listed'  : shown only in the Suggestions section, changes nothing
 *  - state 'applied' : 2+ net votes, also shown in the routine flagged "Not confirmed"
 *  - enough votes    : the server publishes it as a normal notice ("Community confirmed")
 * No accounts: a random device id per install identifies a voter.
 */
import { CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { fetchWithTimeout } from '../core/utils.js';
import { showToast } from '../toast/toast.js';

const API = () => `${CONFIG.apiBase || ''}/api/suggestions`;
const DEVICE_KEY = 'routine_device_id';
const VOTES_KEY = 'routine_suggestion_votes';
const CACHE_KEY = 'routine_suggestions_cache';

function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (id && /^[A-Za-z0-9_-]{8,64}$/.test(id)) return id;
    const bytes = new Uint8Array(18);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    id = 'd' + Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 30);
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch (e) {
    return 'dtemp' + Math.random().toString(36).slice(2, 14);
  }
}

function readVotes() {
  try { return JSON.parse(localStorage.getItem(VOTES_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function writeVotes(v) {
  try { localStorage.setItem(VOTES_KEY, JSON.stringify(v)); } catch (e) {}
}

async function readError(res, fallback) {
  try { const j = await res.json(); return j.error || fallback; } catch (e) { return fallback; }
}

async function post(body) {
  const res = await fetch(API(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = new Error(await readError(res, 'Request failed'));
    err.status = res.status;
    try { err.data = await res.clone().json(); } catch (e) {}
    throw err;
  }
  return res.json().catch(() => ({}));
}

export const Suggestions = {
  list: [],            // pending suggestions for my section + department-wide
  adminRows: null,     // everything pending (including hidden), only loaded in Manage mode
  expanded: false,
  _render: null,       // set by notices-view.js

  myVote(id) { return readVotes()[String(id)] || 0; },

  /** Suggestions that are also applied to the routine, shaped like announcement rows. */
  appliedRows() {
    return this.list.filter(s => s.state === 'applied').map(s => ({
      id: 's' + s.id, name: s.name, title: s.title, announcement: s.announcement, subject: s.subject, type: s.type,
      date_override: s.date_override, subject_override: s.subject_override, semester: s.semester, section: s.section,
      is_pinned: false, is_unconfirmed: true
    }));
  },

  loadCached() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (Array.isArray(c)) this.list = c;
    } catch (e) {}
  },

  async load() {
    const sem = Storage.getSemester() || '';
    const sec = Storage.getSection() || '';
    try {
      const res = await fetchWithTimeout(`${API()}?semester=${encodeURIComponent(sem)}&section=${encodeURIComponent(sec)}`);
      if (!res.ok) throw new Error('suggestions unavailable');
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error('bad payload');
      this.list = rows;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(rows)); } catch (e) {}
      // Votes on suggestions that are gone (approved or expired) are no longer needed
      const open = new Set(rows.map(r => String(r.id)));
      const mine = readVotes();
      let changed = false;
      Object.keys(mine).forEach(k => { if (!open.has(k)) { delete mine[k]; changed = true; } });
      if (changed) writeVotes(mine);
    } catch (e) {
      return false; // keep the cached list; the feature must never break the Notices page
    }
    this._afterChange();
    return true;
  },

  _afterChange() {
    const { Announcements } = this._ann || {};
    if (Announcements) Announcements._syncRoutine();
    if (typeof this._render === 'function') { try { this._render(); } catch (e) { console.error('Suggestions render failed:', e); } }
    if (typeof window.renderTimeline === 'function') window.renderTimeline(true);
  },

  /** Send a new suggestion. Returns { ok, duplicateId?, error? }. */
  async suggest(fields) {
    try {
      const row = await post({
        action: 'suggest', device: deviceId(), name: fields.name, title: fields.title, announcement: fields.announcement,
        type: fields.type || 'general', subject: fields.subject || '', date_override: fields.date_override || '',
        subject_override: fields.subject_override || '', semester: fields.semester || '', section: fields.section || ''
      });
      const votes = readVotes(); votes[String(row.id)] = 1; writeVotes(votes);
      await this.load();
      return { ok: true, id: row.id };
    } catch (err) {
      return { ok: false, duplicateId: err.data && err.data.duplicateId, error: err.message };
    }
  },

  /** value: 1 agree, -1 disagree. Tapping your own vote again removes it. */
  async vote(id, value) {
    const row = this.list.find(s => String(s.id) === String(id));
    if (!row) return false;
    const prev = this.myVote(id);
    const next = prev === value ? 0 : value;

    // Optimistic update
    const before = { up: row.up, down: row.down };
    if (prev === 1) row.up--; else if (prev === -1) row.down--;
    if (next === 1) row.up++; else if (next === -1) row.down++;
    const votes = readVotes();
    if (next) votes[String(id)] = next; else delete votes[String(id)];
    writeVotes(votes);
    this._afterChange();

    try {
      const r = await post({ action: 'vote', device: deviceId(), id: Number(id), value: next, semester: Storage.getSemester() || '', section: Storage.getSection() || '' });
      if (r.state === 'approved') {
        showToast('Confirmed by the community: now an official notice', 'success');
        const { Announcements } = this._ann || {};
        if (Announcements) await Announcements.fetchAll();
        return true;
      }
      row.up = r.up; row.down = r.down; row.state = r.state;
      this._afterChange();
      return true;
    } catch (err) {
      row.up = before.up; row.down = before.down;
      const v2 = readVotes();
      if (prev) v2[String(id)] = prev; else delete v2[String(id)];
      writeVotes(v2);
      this._afterChange();
      showToast(err.message || 'Could not save your vote', 'error');
      return false;
    }
  },

  /* ── Admin (announcement password, same as posting) ─────────────────── */
  async loadAdmin(password = State.sessionDeletePassword) {
    if (!password) return false;
    try {
      this.adminRows = await post({ action: 'admin_list', password });
    } catch (e) {
      this.adminRows = null;
      return false;
    }
    this._afterChange();
    return true;
  },

  async decide(id, action, password = State.sessionDeletePassword) {
    if (!password) { showToast('Password is required.', 'warning'); return false; }
    try {
      await post({ action, id: Number(id), password });
      showToast(action === 'approve' ? 'Published as a notice' : 'Suggestion rejected', 'success');
      this.list = this.list.filter(s => String(s.id) !== String(id));
      if (this.adminRows) this.adminRows = this.adminRows.filter(s => String(s.id) !== String(id));
      this._afterChange();
      const { Announcements } = this._ann || {};
      if (action === 'approve' && Announcements) await Announcements.fetchAll();
      return true;
    } catch (err) {
      showToast(err.message || 'Could not do that', 'error');
      return false;
    }
  }
};

/** announcements.js hands itself over (avoids a circular import at load time). */
export function attachAnnouncements(Announcements) {
  Suggestions._ann = { Announcements };
}
