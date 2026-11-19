/**
 * Per-device notice push preferences (device_tokens.prefs, jsonb). Sent by the app with its FCM
 * token (src/notifications/notifications.js serverPrefs) and used by api/announcements.js to skip
 * or quiet pushes. Everything is sanitised: only known fields, bounded values.
 */
const NOTICE_TYPES = ['cancellation', 'holiday', 'class_test', 'online_class', 'rescheduled', 'assignment', 'general'];

const int = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);

/** @returns {object|null} a clean prefs object, or null when nothing usable was sent */
function sanitizePrefs(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const types = {};
  NOTICE_TYPES.forEach(t => { types[t] = !(raw.types && raw.types[t] === false); });
  const q = raw.quiet && typeof raw.quiet === 'object' ? raw.quiet : {};
  let mutedUntil = null;
  if (typeof raw.mutedUntil === 'string' && !Number.isNaN(Date.parse(raw.mutedUntil))) mutedUntil = new Date(Date.parse(raw.mutedUntil)).toISOString();
  return {
    enabled: raw.enabled !== false,
    types,
    quiet: { on: q.on === true, from: int(q.from, 0, 1439, 1380), to: int(q.to, 0, 1439, 420) },
    tz: int(raw.tz, -720, 840, 360), // minutes east of UTC (Bangladesh = 360)
    mutedUntil,
    // The device's own notice channel (carries its chosen sound); only a well-formed id is kept
    ...(typeof raw.noticeChannel === 'string' && /^nf_notice_[a-z0-9_]{1,40}$/.test(raw.noticeChannel) ? { noticeChannel: raw.noticeChannel } : {})
  };
}

/** The channel id this device created for notice sounds, or '' (older apps use the default channel). */
function noticeChannel(prefs) {
  return prefs && typeof prefs.noticeChannel === 'string' && /^nf_notice_[a-z0-9_]{1,40}$/.test(prefs.noticeChannel) ? prefs.noticeChannel : '';
}

function inQuiet(mins, quiet) {
  if (!quiet || !quiet.on || quiet.from === quiet.to) return false;
  return quiet.from < quiet.to ? (mins >= quiet.from && mins < quiet.to) : (mins >= quiet.from || mins < quiet.to);
}

/**
 * Should this device get a push for a notice of `type` right now, and quietly?
 * Devices without prefs (older apps, or before the prefs column existed) always get it.
 */
function pushDecision(prefs, type, nowMs = Date.now()) {
  if (!prefs || typeof prefs !== 'object') return { send: true, quiet: false };
  if (prefs.enabled === false) return { send: false, quiet: false };
  if (prefs.types && prefs.types[type] === false) return { send: false, quiet: false };
  if (prefs.mutedUntil && Date.parse(prefs.mutedUntil) > nowMs) return { send: false, quiet: false };
  const local = new Date(nowMs + (Number(prefs.tz) || 0) * 60000);
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  return { send: true, quiet: inQuiet(mins, prefs.quiet) };
}

/** Plain titles for pushes (no emoji: UI rule). */
const TYPE_LABEL = {
  cancellation: 'Cancelled', holiday: 'Holiday', class_test: 'Test', online_class: 'Online class',
  rescheduled: 'Moved', assignment: 'Assignment', general: 'Notice'
};
function pushTitle(type, title) {
  const t = String(title || '').trim();
  const label = TYPE_LABEL[type] || 'Notice';
  if (!t) return label;
  return new RegExp(`^${label}\\b`, 'i').test(t) ? t : `${label}: ${t}`;
}

module.exports = { NOTICE_TYPES, sanitizePrefs, pushDecision, pushTitle, noticeChannel };
