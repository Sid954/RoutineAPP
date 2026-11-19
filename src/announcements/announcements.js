/**
 * Notices: data + API (redesigned Nov 2026). Rendering lives in notices-view.js, which
 * registers itself as the renderer; the public surface used by init.js is unchanged
 * (fetchAll, loadCached, checkBadge, list).
 *
 * Audience: semester+section = one section; semester only = whole semester; neither =
 * everyone in the department. The API already stores empty values as NULL.
 */
import { CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { showToast } from '../toast/toast.js';
import { fetchWithTimeout } from '../core/utils.js';
import { Notifications } from '../notifications/notifications.js';
import { isPastAnnouncement } from './overrides.js';
import { toNotice, notifCopy, isPinned } from './notice-model.js';
import { Suggestions, attachAnnouncements } from './suggestions.js';

const API = () => `${CONFIG.apiBase || ''}/api/announcements`;

function mySemSec() {
  return {
    sem: String(Storage.getSemester() || '').toLowerCase(),
    sec: String(Storage.getSection() || '').toLowerCase()
  };
}

/** True when a row is for the user's own section (directly, or via semester/department). */
export function isForMe(item, sem = mySemSec().sem, sec = mySemSec().sec) {
  const s = String(item.semester || '').toLowerCase();
  const c = String(item.section || '').toLowerCase();
  return (!s || s === sem) && (!c || c === sec);
}

async function readError(res, fallback) {
  try { const j = await res.json(); return j.error || fallback; } catch (e) { return fallback; }
}

export const Announcements = {
  list: [],               // rows for my section (incl. semester/department-wide)
  activeFilter: 'all',
  scope: 'mine',          // 'mine' | 'dept'
  query: '',
  showPast: false,
  isAdminMode: false,
  tab: 'notices',          // 'notices' | 'suggestions'
  CACHE_KEY: 'routine_announcements_cache',
  DEPT_CACHE_KEY: 'routine_announcements_dept_cache',
  PINNED_KEY: 'routine_pinned_announcements',
  READ_KEY: 'routine_read_announcements',
  _render: null,          // set by notices-view.js

  /* ── Local state: pins + read ─────────────────────────────────────────── */
  getPinnedIds() {
    try { return new Set((JSON.parse(localStorage.getItem(this.PINNED_KEY) || '[]')).map(String)); } catch (e) { return new Set(); }
  },
  savePinnedIds(set) {
    try { localStorage.setItem(this.PINNED_KEY, JSON.stringify(Array.from(set))); } catch (e) {}
  },
  getReadIds() {
    try {
      const saved = localStorage.getItem(this.READ_KEY);
      if (saved) return new Set(JSON.parse(saved).map(String));
      const legacy = parseInt(localStorage.getItem('last_viewed_announcement_id') || '', 10);
      if (!isNaN(legacy)) {
        const set = new Set(this.list.filter(i => parseInt(i.id, 10) <= legacy).map(i => String(i.id)));
        this.saveReadIds(set);
        return set;
      }
    } catch (e) {}
    return new Set();
  },
  saveReadIds(set) {
    try { localStorage.setItem(this.READ_KEY, JSON.stringify(Array.from(set))); } catch (e) {}
  },
  isRead(id) { return this.getReadIds().has(String(id)); },
  markItemAsRead(id) {
    const set = this.getReadIds();
    if (set.has(String(id))) return;
    set.add(String(id));
    this.saveReadIds(set);
    this.checkBadge();
  },
  markAllRead() {
    const set = this.getReadIds();
    this.list.forEach(i => set.add(String(i.id)));
    (State.allAnnouncementsList || []).forEach(i => set.add(String(i.id)));
    this.saveReadIds(set);
    this.checkBadge();
    this.renderFeed();
  },
  unreadCount() {
    const read = this.getReadIds();
    return this.list.filter(i => !read.has(String(i.id)) && !isPastAnnouncement(i)).length;
  },
  ensureReadStateInitialized() {
    const read = this.getReadIds();
    this.list.forEach(i => { i.is_read = read.has(String(i.id)); });
  },

  /** Rows the routine reads: official notices plus applied community suggestions (flagged "Not confirmed"). */
  _syncRoutine() {
    State.announcementsList = this.list.concat(Suggestions.appliedRows());
  },

  _applyPins(rows, pinnedSet) {
    return rows.map(item => {
      const server = item.is_pinned === true || item.is_pinned === 'true' || item.is_pinned === 1;
      if (server) pinnedSet.add(String(item.id));
      item.is_pinned = server || pinnedSet.has(String(item.id));
      return item;
    });
  },

  /** Rows for the current scope, newest data. */
  rowsForScope() {
    if (this.scope === 'dept') {
      const all = State.allAnnouncementsList && State.allAnnouncementsList.length ? State.allAnnouncementsList : this.list;
      return all;
    }
    return this.list;
  },

  /** Normalised notices for the current scope. */
  notices() {
    const { sem, sec } = mySemSec();
    const ctx = { semester: sem, section: sec };
    return this.rowsForScope().map(r => toNotice(r, ctx));
  },

  /* ── Load / fetch ─────────────────────────────────────────────────────── */
  loadCached() {
    Suggestions.loadCached();
    try {
      const dept = JSON.parse(localStorage.getItem(this.DEPT_CACHE_KEY) || 'null');
      if (Array.isArray(dept)) State.allAnnouncementsList = dept;
      const mine = JSON.parse(localStorage.getItem(this.CACHE_KEY) || 'null');
      if (Array.isArray(mine) && mine.length) {
        const pins = this.getPinnedIds();
        this.list = this._applyPins(mine, pins);
        this._syncRoutine();
        this.ensureReadStateInitialized();
        this.renderFeed();
        this.checkBadge();
        return true;
      }
    } catch (e) {
      console.warn('Could not load cached announcements:', e);
    }
    return false;
  },

  async fetchAll() {
    let cachedIds = null;
    try {
      const saved = JSON.parse(localStorage.getItem(this.CACHE_KEY) || 'null');
      if (Array.isArray(saved)) cachedIds = new Set(saved.map(i => String(i.id)));
    } catch (e) {}

    try {
      const res = await fetchWithTimeout(API());
      if (!res.ok) throw new Error('Failed to fetch');
      const raw = await res.json();
      const rows = Array.isArray(raw) ? raw : [];
      // The 30s poll mostly finds nothing new. Re-rendering the feed AND the whole timeline for the
      // same data made every poll a visible hitch (taps in that moment are lost), so skip it.
      const sig = JSON.stringify(rows);
      if (sig === this._lastSig && !this._loadError) {
        Suggestions.load();
        return true;
      }
      this._lastSig = sig;
      this._loadError = false;
      const pins = this.getPinnedIds();

      State.allAnnouncementsList = this._applyPins(rows, pins);
      try { localStorage.setItem(this.DEPT_CACHE_KEY, JSON.stringify(State.allAnnouncementsList)); } catch (e) {}

      const { sem, sec } = mySemSec();
      this.list = State.allAnnouncementsList.filter(i => isForMe(i, sem, sec));
      this.savePinnedIds(pins);
      this._syncRoutine();
      try { localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.list)); } catch (e) {}

      // Local alert for notices that arrived since the last fetch (push covers the closed app)
      if (cachedIds && cachedIds.size) {
        this.list.filter(i => !cachedIds.has(String(i.id))).forEach(i => {
          const c = notifCopy(toNotice(i, { semester: sem, section: sec }));
          Notifications.showInstant(c.title, c.body, i.type);
        });
      }

      this.ensureReadStateInitialized();
      this.renderFeed();
      this.checkBadge();
      if (typeof window.renderTimeline === 'function') window.renderTimeline(true);
      Suggestions.load(); // community suggestions: never blocks or breaks the notices
      return true;
    } catch (err) {
      console.error('Error fetching announcements:', err);
      this._loadError = true;
      this.renderFeed();
      return false;
    }
  },

  renderFeed() {
    if (typeof this._render === 'function') {
      try { this._render(); } catch (e) { console.error('Notices render failed:', e); }
    }
  },

  /** Dock badge: unread notices plus suggestions this phone has not shown yet. */
  checkBadge() {
    const n = (this.list && this.list.length ? this.unreadCount() : 0) + Suggestions.unseenCount();
    const text = n > 9 ? '9+' : String(n);
    const badge = document.getElementById('announceBadge');
    const dot = document.getElementById('dockAnnounceDot');
    if (badge) {
      badge.style.display = n > 0 ? 'flex' : 'none';
      if (n > 0) badge.textContent = text;
    }
    if (dot) {
      dot.style.display = n > 0 ? 'flex' : 'none';
      dot.classList.add('is-count');
      if (dot.textContent !== (n > 0 ? text : '')) dot.textContent = n > 0 ? text : '';
      dot.setAttribute('aria-label', n > 0 ? `${n} new` : '');
    }
  },

  markAsRead() { /* kept for old callers; read state is per item */ },

  /* ── Writes ───────────────────────────────────────────────────────────── */
  async _post(body) {
    const res = await fetch(API(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await readError(res, 'Request failed'));
    return res.json().catch(() => ({}));
  },

  async checkPassword(password) {
    await this._post({ password, checkPasswordOnly: true });
    State.sessionDeletePassword = password;
    return true;
  },

  /**
   * Publish one notice.
   * extras: { type, subject, date_override, subject_override, is_pinned,
   *           semester, section  (omit both = my section; '' = wider audience),
   *           quiet (no toast / refetch, for batches) }
   */
  async publish(name, title, announcement, password, extras = {}) {
    const hasAudience = Object.prototype.hasOwnProperty.call(extras, 'semester');
    try {
      const created = await this._post({
        name, title, announcement, password,
        subject: extras.subject || '',
        type: extras.type || 'general',
        date_override: extras.date_override || '',
        subject_override: extras.subject_override || '',
        semester: hasAudience ? (extras.semester || '') : Storage.getSemester(),
        section: hasAudience ? (extras.section || '') : Storage.getSection(),
        is_pinned: extras.is_pinned === true
      });
      State.sessionDeletePassword = password;
      if (!extras.quiet) {
        showToast('Notice published', 'success');
        Notifications.scheduleForToday();
        await this.fetchAll();
      }
      return created || true;
    } catch (err) {
      if (!extras.quiet) showToast(err.message || 'Could not publish', 'error');
      if (extras.quiet) throw err;
      return false;
    }
  },

  /** Update keeps the notice's own audience unless extras.semester/section are given. */
  async update(id, name, title, announcement, password, extras = {}) {
    const existing = (State.allAnnouncementsList || []).concat(this.list).find(a => String(a.id) === String(id)) || {};
    const hasAudience = Object.prototype.hasOwnProperty.call(extras, 'semester');
    try {
      const updated = await this._post({
        id, isUpdate: true, action: 'update',
        name, title, announcement, password,
        subject: extras.subject || '',
        type: extras.type || 'general',
        date_override: extras.date_override || '',
        subject_override: extras.subject_override || '',
        semester: hasAudience ? (extras.semester || '') : (existing.semester || ''),
        section: hasAudience ? (extras.section || '') : (existing.section || ''),
        is_pinned: extras.is_pinned === true
      });
      State.sessionDeletePassword = password;
      showToast('Notice updated', 'success');
      await this.fetchAll();
      return updated || true;
    } catch (err) {
      showToast(err.message || 'Could not update', 'error');
      return false;
    }
  },

  async delete(id, password) {
    if (!password) { showToast('Password is required.', 'warning'); return false; }
    try {
      const res = await fetch(API(), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, password }) });
      if (!res.ok) throw new Error(await readError(res, 'Failed to delete'));
      State.sessionDeletePassword = password;
      const drop = a => String(a.id) !== String(id);
      this.list = this.list.filter(drop);
      this._syncRoutine();
      State.allAnnouncementsList = (State.allAnnouncementsList || []).filter(drop);
      try {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.list));
        localStorage.setItem(this.DEPT_CACHE_KEY, JSON.stringify(State.allAnnouncementsList));
      } catch (e) {}
      this.renderFeed();
      this.checkBadge();
      if (typeof window.renderTimeline === 'function') window.renderTimeline(true);
      showToast('Notice deleted', 'success');
      return true;
    } catch (err) {
      showToast(err.message || 'Could not delete', 'error');
      return false;
    }
  },

  /** Pin/unpin (admin). Needs the session password; caller prompts for it. */
  async togglePin(id, password = State.sessionDeletePassword) {
    const item = (State.allAnnouncementsList || []).concat(this.list).find(a => String(a.id) === String(id));
    if (!item || !password) return false;
    const next = !isPinned(item);
    const pins = this.getPinnedIds();
    const apply = v => {
      [this.list, State.allAnnouncementsList || []].forEach(arr => arr.forEach(a => { if (String(a.id) === String(id)) a.is_pinned = v; }));
      if (v) pins.add(String(id)); else pins.delete(String(id));
      this.savePinnedIds(pins);
    };
    apply(next);
    this.renderFeed();
    try {
      await this._post({
        id, isUpdate: true, action: 'update',
        name: item.name, title: item.title, announcement: item.announcement, password,
        subject: item.subject || '', type: item.type || 'general',
        date_override: item.date_override || '', subject_override: item.subject_override || '',
        semester: item.semester || '', section: item.section || '',
        is_pinned: next
      });
      State.sessionDeletePassword = password;
      showToast(next ? 'Pinned for everyone' : 'Unpinned', 'success');
      return true;
    } catch (err) {
      apply(!next);
      this.renderFeed();
      showToast(err.message || 'Could not change the pin', 'error');
      return false;
    }
  }
};

attachAnnouncements(Announcements);

export { initAnnouncementEvents } from './notices-view.js';
