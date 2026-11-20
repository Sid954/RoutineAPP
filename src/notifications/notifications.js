/**
 * Notifications (rebuilt Nov 2026). What the phone sends, and when:
 *   - Local, planned 7 days ahead by planner.js from the routine + announcements:
 *     class reminders, "starting now", morning summary, evening preview, test and deadline alerts.
 *     Re-planned whenever the routine, notices, settings, skips or pause change, and on resume.
 *     Android keeps them across restarts (LocalNotifications restore receiver).
 *   - Notices: pushed by the server (FCM, api/announcements.js) and, while the app is open,
 *     shown locally for new ones (showInstant). Both follow the notice type switches, pause and
 *     quiet hours (the server once the device's prefs are synced, see syncServerPrefs).
 * Controls live on the Notifications page (notif-center.js). Storage: notif-store.js.
 * Public surface kept for existing callers: init, initEvents, scheduleForToday, cancelAll,
 * requestPermission, getPermission, isSupported, updatePermissionUI, show, showInstant, maybeShowBanner.
 */
import { Storage } from '../storage/storage.js';
import { DOM } from '../core/dom.js';
import { CONFIG } from '../core/config.js';
import { getOverrideFor, getDeadlinesForDate, normalizeDate } from '../announcements/overrides.js';
import { getEffectiveClassesForDay } from '../schedule/queries.js';
import { planNotifications, noticeAllowed, parseTime } from './planner.js';
import {
  getPrefs, updatePrefs, getSkips, getPause, setPause, endOfToday, getDateOverrides,
  setClassSkipped, setDeadlineDone
} from './notif-store.js';

export let _nativePush = null;
export function setNativePush(np) { _nativePush = np; }

const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const LN = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
const HORIZON_DAYS = 7;
const TOKEN_KEY = 'fcm_token';
const SERVER_PREFS_KEY = 'notif_server_prefs'; // 'ok' | 'unsupported'

// Android channels: importance 4 = sound + heads-up, 3 = sound, 2 = silent
const CHANNELS = [
  { id: 'class_reminders', name: 'Class reminders', description: 'Before each class, and when it starts', importance: 4 },
  { id: 'daily_digest', name: 'Daily summary', description: 'Morning summary and tomorrow preview', importance: 3 },
  { id: 'deadlines', name: 'Tests and deadlines', description: 'Tests and assignment due times', importance: 4 },
  { id: 'announcements_channel', name: 'Announcements', description: 'Class cancellations, tests, assignments and other notices', importance: 5 },
  { id: 'notices_quiet', name: 'Notices (quiet hours)', description: 'Notices that arrive during your quiet hours, without sound', importance: 2 },
  // Notices the community confirmed by voting: their own short chime (android-custom/res/raw/suggestion_chime.wav)
  { id: 'suggestions_channel', name: 'Community confirmed', description: 'Suggestions your section confirmed by voting', importance: 5, sound: 'suggestion_chime.wav' }
];
// One channel per type and sound/vibration/lock-screen choice (Android fixes a channel's sound once it
// exists, so a new choice means a new channel). Ids stay [a-z0-9_] so the server can name the notice one.
const KIND_TYPE = { class: 'class', start: 'class', briefing: 'digest', preview: 'digest', attendance: 'digest', test: 'test', test_eve: 'test', deadline: 'deadline', deadline_day: 'deadline' };
const TYPE_NAME = { class: 'Class reminders', digest: 'Daily summary', test: 'Tests', deadline: 'Assignment deadlines', notice: 'Notices' };
export function channelSpec(type, prefs = getPrefs()) {
  const sound = prefs.sounds[type] || 'default';
  const vib = prefs.vibrate[type] ? 1 : 0;
  const hide = prefs.privacy.hideOnLock ? 1 : 0;
  return {
    id: `nf_${type}_${sound}_${vib}${hide}`,
    name: `${TYPE_NAME[type]}${sound === 'default' ? '' : ` (${sound})`}`,
    description: `${TYPE_NAME[type]} alerts`,
    importance: sound === 'silent' ? 2 : (type === 'digest' ? 3 : 4),
    visibility: hide ? 0 : 1,
    vibration: !!vib,
    ...(sound !== 'default' && sound !== 'silent' ? { sound: `nf_${sound}.wav` } : {})
  };
}
const COLORS = { class: '#38BDF8', start: '#38BDF8', briefing: '#38BDF8', preview: '#818CF8', test: '#F97316', test_eve: '#F97316', deadline: '#A855F7', deadline_day: '#A855F7' };
const NOTICE_COLORS = { class_test: '#F97316', online_class: '#10B981', cancellation: '#F43F5E', rescheduled: '#64748B', assignment: '#A855F7', holiday: '#F59E0B' };

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseJson = v => { if (v && typeof v === 'object') return v; try { return JSON.parse(v); } catch (e) { return {}; } };

/** Planner input for today .. today+HORIZON_DAYS from the routine and the user's announcements. */
export function collectDays(now = new Date(), count = HORIZON_DAYS + 1) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const date = ymd(d);
    let classes = [];
    try {
      classes = getEffectiveClassesForDay(d.getDay(), date).map(c => {
        const ov = getOverrideFor(date, c.title);
        let test = null;
        if (c.isExam || (ov && ov.type === 'class_test')) {
          const p = parseJson(ov && ov.announcement && ov.announcement.announcement);
          const topics = String(p.topics || c.examTopics || '').trim();
          test = { name: String(p.exam_name || 'Test').trim(), topics: topics && topics !== 'Not Specified' ? topics : '' };
        }
        return {
          title: c.title, start: c.start, end: c.end, room: c.room, instructor: c.instructor || c.teacher || '', type: c.type,
          cancelled: !!c.isCancelled, rescheduledAway: !!c.isRescheduled, online: !!(c.isOnline || c.isMovedOnline), test
        };
      });
    } catch (e) { classes = []; }
    let holiday = null;
    try {
      const h = getOverrideFor(date);
      if (h && h.type === 'holiday') holiday = { title: (h.announcement && (h.announcement.title || h.announcement.announcement)) || 'Holiday' };
    } catch (e) {}
    let deadlines = [];
    try {
      deadlines = getDeadlinesForDate(date).map(item => {
        const p = parseJson(item.announcement);
        const due = parseTime(String(p.due_time || '').trim());
        return { id: String(item.id), title: String(p.task_title || item.title || 'Assignment').trim(), subject: String(item.subject_override || item.subject || '').trim(), dueMin: due >= 0 ? due : 1439 };
      });
    } catch (e) {}
    days.push({ date, dayIdx: d.getDay(), holiday, deadlines, classes });
  }
  return days;
}

export const Notifications = {
  timeouts: [],
  _setupDone: false,
  _channels: new Set(),
  _schedTimer: null,
  _schedPromise: null,
  _lastPlan: [],

  /* ── Permission ─────────────────────────────────────────────────── */
  isSupported() {
    if (isNative()) return !!LN();
    return typeof Notification !== 'undefined';
  },

  async getPermission() {
    if (isNative()) {
      try {
        const status = await LN().checkPermissions();
        return status.display === 'granted' ? 'granted' : (status.display === 'denied' ? 'denied' : 'prompt');
      } catch (e) {
        return 'unsupported';
      }
    }
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  },

  async requestPermission() {
    let ok = false;
    if (isNative()) {
      try { ok = (await LN().requestPermissions()).display === 'granted'; } catch (e) { ok = false; }
    } else if (this.isSupported()) {
      ok = (await Notification.requestPermission()) === 'granted';
    }
    await this.updatePermissionUI();
    if (ok) this.scheduleForToday(true);
    return ok;
  },

  async updatePermissionUI() {
    const perm = await this.getPermission();
    const badges = {
      granted: { label: 'Allowed', cls: 'is-ok' },
      denied: { label: 'Blocked', cls: 'is-bad' },
      default: { label: 'Not allowed yet', cls: 'is-warn' },
      prompt: { label: 'Not allowed yet', cls: 'is-warn' },
      unsupported: { label: 'Not supported', cls: 'is-off' }
    };
    const b = badges[perm] || { label: perm, cls: 'is-off' };
    if (DOM.notifPermStatus) {
      DOM.notifPermStatus.textContent = b.label;
      DOM.notifPermStatus.className = `nf-perm ${b.cls}`;
    }
    return perm;
  },

  /* ── Planning + scheduling ──────────────────────────────────────── */

  /** The alerts that would be scheduled now (for the "Coming up" list and Settings). */
  getPlan({ ignoreSkips = false, now = Date.now() } = {}) {
    const skips = ignoreSkips ? {} : getSkips(new Date(now));
    return planNotifications({ days: collectDays(new Date(now)), prefs: getPrefs(), skips, dates: getDateOverrides(new Date(now)), pausedUntil: ignoreSkips ? 0 : getPause(now), now, horizonDays: HORIZON_DAYS });
  },

  /**
   * Re-plans and schedules every alert for the next 7 days. Name kept for existing callers
   * (routine edits, notices, resume, settings). Calls within 400 ms are coalesced.
   */
  scheduleForToday(force = false) {
    // TEMPORARY test clock: never schedule real reminders from a shifted clock
    if (window.__devTimeOffset) return Promise.resolve();
    clearTimeout(this._schedTimer);
    return new Promise(resolve => {
      this._schedTimer = setTimeout(() => {
        this._schedPromise = this._schedule().catch(e => console.warn('Scheduling notifications failed:', e)).finally(resolve);
      }, force ? 0 : 400);
    });
  },

  async _schedule() {
    if (!this.isSupported()) return;
    const perm = await this.getPermission();
    const plan = perm === 'granted' ? this.getPlan() : [];
    this._lastPlan = plan;
    if (isNative() && perm === 'granted') {
      // The notice channel must exist before a push names it; drop channels of sounds no longer chosen
      await this._setupNative();
      const spec = channelSpec('notice');
      if (this._noticeChan !== spec.id) { await this.ensureChannel(spec); this._noticeChan = spec.id; this.pruneChannels(); }
    }
    await this.cancelAll();
    if (!plan.length) return;

    if (isNative()) {
      await this._setupNative();
      const prefs = getPrefs();
      for (const type of new Set(plan.map(n => KIND_TYPE[n.kind] || 'class'))) await this.ensureChannel(channelSpec(type, prefs));
      const items = plan.map(n => ({
        id: n.id,
        title: n.title,
        body: n.body,
        largeBody: n.body,
        schedule: { at: new Date(n.at), allowWhileIdle: true },
        ...(() => { const id = channelSpec(KIND_TYPE[n.kind] || 'class', prefs).id; return this._channels.has(id) ? { channelId: id } : (this._channels.has(n.channel) ? { channelId: n.channel } : {}); })(),
        actionTypeId: n.actionType,
        iconColor: COLORS[n.kind] || '#38BDF8',
        extra: { kind: n.kind, date: n.date, classKey: n.classKey || '', deadlineId: n.deadlineId || '', key: n.key }
      }));
      try {
        await LN().schedule({ notifications: items });
      } catch (e) {
        // Older plugin builds reject unknown fields: retry with the basics
        await LN().schedule({ notifications: items.map(({ id, title, body, schedule, extra }) => ({ id, title, body, schedule: { at: schedule.at }, extra })) }).catch(() => {});
      }
    } else {
      // Browser: alerts can only fire while the page is open, so plan the next 24 hours
      const limit = Date.now() + 864e5;
      plan.filter(n => n.at < limit).forEach(n => {
        this.timeouts.push(setTimeout(() => this.show(n.title, n.body), n.at - Date.now()));
      });
    }
  },

  async _setupNative() {
    if (this._setupDone || !LN()) return;
    this._setupDone = true;
    const ln = LN();
    for (const ch of CHANNELS) {
      try {
        if (typeof ln.createChannel === 'function') {
          await ln.createChannel(Object.assign({ id: ch.id, name: ch.name, description: ch.description, importance: ch.importance, visibility: 1, vibration: ch.importance >= 3 }, ch.sound ? { sound: ch.sound } : {}));
          this._channels.add(ch.id);
        }
      } catch (e) {}
    }
    try {
      await ln.registerActionTypes({
        types: [
          { id: 'CLASS', actions: [{ id: 'skip', title: 'Skip this class' }, { id: 'mute', title: 'Mute today' }] },
          { id: 'DIGEST', actions: [{ id: 'mute', title: 'Mute today' }] },
          { id: 'DEADLINE', actions: [{ id: 'done', title: 'Done' }] }
        ]
      });
    } catch (e) {}
  },

  /** Creates an Android channel once (cheap to repeat) and removes this app's channels that are no longer in use. */
  async ensureChannel(spec) {
    const ln = LN();
    if (!ln || typeof ln.createChannel !== 'function' || this._channels.has(spec.id)) return;
    try { await ln.createChannel(spec); this._channels.add(spec.id); } catch (e) {}
  },
  async pruneChannels() {
    const ln = LN();
    if (!ln || typeof ln.listChannels !== 'function' || typeof ln.deleteChannel !== 'function') return;
    try {
      const prefs = getPrefs();
      const keep = new Set(['notice', 'class', 'digest', 'test', 'deadline'].map(t => channelSpec(t, prefs).id));
      const { channels = [] } = await ln.listChannels();
      for (const ch of channels) if (/^nf_/.test(ch.id) && !keep.has(ch.id)) await ln.deleteChannel({ id: ch.id });
    } catch (e) {}
  },

  async cancelAll() {
    this.timeouts.forEach(t => clearTimeout(t));
    this.timeouts = [];
    if (!isNative() || !LN()) return;
    try {
      const pending = await LN().getPending();
      if (pending && pending.notifications && pending.notifications.length) {
        await LN().cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }
    } catch (e) {
      console.warn('Failed to cancel scheduled notifications:', e);
    }
  },

  /* ── Quick controls (used by the page, the class sheet and notification buttons) ── */
  pause(until) { setPause(until); this.scheduleForToday(true); this.syncServerPrefs(); },
  resume() { setPause(0); this.scheduleForToday(true); this.syncServerPrefs(); },
  muteToday() { this.pause(endOfToday()); },
  skipClass(date, key, skipped = true) { setClassSkipped(date, key, skipped); this.scheduleForToday(true); },
  deadlineDone(id) { setDeadlineDone(id, true); this.scheduleForToday(true); },
  setEnabled(on) { updatePrefs({ enabled: !!on }); this.scheduleForToday(true); this.syncServerPrefs(); },

  /** "Send a test" on the sound page: one alert of this type through its own channel, a second from now. */
  async sendTest(type = 'class') {
    if ((await this.getPermission()) !== 'granted') return false;
    const title = `Test: ${TYPE_NAME[type] || 'Notification'}`;
    const body = 'This is how this alert sounds.';
    if (!isNative()) { this.show(title, body); return true; }
    try {
      await this._setupNative();
      const spec = channelSpec(type);
      await this.ensureChannel(spec);
      await LN().schedule({ notifications: [{ id: Math.floor(Math.random() * 900000) + 1, title, body, schedule: { at: new Date(Date.now() + 1200) }, ...(this._channels.has(spec.id) ? { channelId: spec.id } : {}), extra: { kind: 'test_alert' } }] });
      return true;
    } catch (e) { return false; }
  },

  /* ── Instant alerts (new notices while the app is open, tests) ───── */
  show(title, body) {
    if (isNative()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: `routine-${Date.now()}`, requireInteraction: false });
    } catch (e) {}
  },

  /**
   * @param {string} type notice type (filtered by the user's notice switches, pause and quiet hours)
   * @param {{force?: boolean}} opts force: ignore preferences (the "Send a test" button)
   */
  async showInstant(title, body, type = 'general', opts = {}) {
    if ((await this.getPermission()) !== 'granted') return;
    let quiet = false;
    if (!opts.force) {
      const gate = noticeAllowed(type, { prefs: getPrefs(), pausedUntil: getPause() });
      if (!gate.show) return;
      quiet = !!gate.quiet;
    }
    if (isNative()) {
      try {
        await this._setupNative();
        let channel = quiet ? 'notices_quiet' : 'announcements_channel';
        if (!quiet) { const spec = channelSpec('notice'); await this.ensureChannel(spec); if (this._channels.has(spec.id)) channel = spec.id; }
        await LN().schedule({
          notifications: [{
            title, body, largeBody: body,
            id: Math.floor(Math.random() * 900000) + 1,
            ...(this._channels.has(channel) ? { channelId: channel } : {}),
            iconColor: NOTICE_COLORS[type] || '#38BDF8',
            extra: { kind: 'notice', type }
          }]
        });
      } catch (e) {
        console.warn('Failed to show notification:', e);
      }
    } else if (!quiet) {
      this.show(title, body);
    }
  },

  /* ── Server-side notice preferences ─────────────────────────────── */
  /** Payload sent with the FCM token so the server can filter and quiet notice pushes. */
  serverPrefs() {
    const p = getPrefs();
    const pause = getPause();
    return {
      enabled: p.enabled && p.notices.on,
      types: p.notices.types,
      quiet: p.quiet,
      tz: -new Date().getTimezoneOffset(),
      noticeChannel: channelSpec('notice', p).id,
      mutedUntil: pause === -1 ? '9999-12-31T00:00:00Z' : (pause ? new Date(pause).toISOString() : null)
    };
  },
  rememberToken(token) { try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {} },
  serverPrefsStatus() { try { return localStorage.getItem(SERVER_PREFS_KEY) || ''; } catch (e) { return ''; } },
  _syncTimer: null,
  syncServerPrefs() {
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(async () => {
      let token = '';
      try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
      if (!token) return;
      try {
        const res = await fetch(`${CONFIG.apiBase || ''}/api/register-token`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, platform: 'android', semester: Storage.getSemester(), section: Storage.getSection(), prefs: this.serverPrefs() })
        });
        const j = await res.json().catch(() => ({}));
        try { localStorage.setItem(SERVER_PREFS_KEY, j.prefsSaved ? 'ok' : 'unsupported'); } catch (e) {}
      } catch (e) {}
    }, 1200);
  },

  /* ── Banner + boot ──────────────────────────────────────────────── */
  async maybeShowBanner() {
    try {
      if (!this.isSupported()) return;
      const perm = await this.getPermission();
      if (perm !== 'default' && perm !== 'prompt') return;
      if (Storage.isBannerDismissed(Storage.BANNER_DISMISS_KEY)) return;
      if (DOM.notifBanner) DOM.notifBanner.classList.add('show');
    } catch (e) {}
  },

  async init() {
    try {
      await this.updatePermissionUI();
      this.scheduleForToday(true);
      // Offer the "enable notifications" banner once the app has settled; skipped while the
      // first-launch welcome screen is open (it re-checks after onboarding's reload).
      setTimeout(() => {
        const welcome = document.getElementById('welcomeModal');
        if (welcome && welcome.classList.contains('open')) return;
        import('../banners/prompt-gate.js')
          .then(({ showWhenClear }) => showWhenClear('notifBanner', () => this.maybeShowBanner()))
          .catch(() => this.maybeShowBanner());
      }, 3000);
      // Re-plan after midnight even if the app stays open
      setInterval(() => { if (!document.hidden && new Date().getHours() === 0 && new Date().getMinutes() < 2) this.scheduleForToday(true); }, 60000);
    } catch (e) {
      console.warn('Notifications.init error:', e);
    }
  },

  /** Notification buttons and taps (Android). */
  initEvents() {
    if (!isNative() || !LN() || this._eventsBound) return;
    this._eventsBound = true;
    try {
      LN().addListener('localNotificationActionPerformed', ({ actionId, notification }) => handleAction(actionId, (notification && notification.extra) || {}));
    } catch (e) {}
  }
};

async function handleAction(actionId, extra) {
  const { showToast } = await import('../toast/toast.js').catch(() => ({ showToast: () => {} }));
  if (actionId === 'skip' && extra.date && extra.classKey) {
    Notifications.skipClass(extra.date, extra.classKey, true);
    showToast(`Reminders off for ${String(extra.classKey).split('@')[0]} on that day`, 'info');
    return;
  }
  if (actionId === 'mute') {
    Notifications.muteToday();
    showToast('Notifications muted until tomorrow', 'info');
    return;
  }
  if (actionId === 'done' && extra.deadlineId) {
    Notifications.deadlineDone(extra.deadlineId);
    showToast('Marked as done. No more reminders for it.', 'success');
    return;
  }
  // Plain tap: open the right place
  if (extra.kind === 'attendance') {
    if (window.__openAttendance) window.__openAttendance(extra.date);
    return;
  }
  if (extra.kind === 'notice' || extra.kind === 'deadline' || extra.kind === 'deadline_day') {
    if (window.switchAppView) window.switchAppView('announcements');
    return;
  }
  if (extra.date) {
    if (window.switchAppView) window.switchAppView('day');
    const d = normalizeDate(extra.date);
    if (d && d !== ymd(new Date()) && typeof window.__pickCalendarDate === 'function') {
      const [y, m, day] = d.split('-').map(Number);
      try { window.__pickCalendarDate(y, m - 1, day); } catch (e) {}
    }
  }
}
