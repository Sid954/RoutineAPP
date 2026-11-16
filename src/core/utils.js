export const pad = num => String(num).padStart(2, '0');

/**
 * Converts any 12h (e.g. "09:45 AM", "1:30 PM", "11:50 AM") or 24h (e.g. "09:45", "13:30")
 * time string into total minutes since midnight (0..1439). Returns -1 on invalid input.
 */
export function toMinutes(timeStr) {
  if (timeStr === null || timeStr === undefined) return -1;
  if (typeof timeStr === 'number') return timeStr;
  const clean = String(timeStr).trim();
  if (!clean) return -1;

  // Match 12h format: "09:45 AM", "9:45am", "1:30 PM", "12:15 pm"
  const match12 = clean.match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = parseInt(match12[2], 10);
    const period = match12[3] ? match12[3].toUpperCase() : null;

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + mins;
  }

  // Fallback 24h format: "09:45", "14:30"
  const parts = clean.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
  }

  return -1;
}

export const toTimeString = mins => `${pad(Math.floor(mins / 60))}:${pad(Math.floor(mins % 60))}`;

export function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function parseTo24h(timeStr) {
  if (typeof timeStr !== 'string') return timeStr || '';
  const m = toMinutes(timeStr);
  if (m < 0) return timeStr;
  return toTimeString(m);
}

export function format12h(timeStr) {
  if (timeStr === null || timeStr === undefined) return '';
  const clean = String(timeStr).trim();
  if (!clean) return '';

  const m = toMinutes(clean);
  if (m < 0) return clean;
  let hours = Math.floor(m / 60);
  const mins = m % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${pad(hours)}:${pad(mins)} ${period}`;
}

export function formatRoom(roomStr) {
  if (!roomStr) return '';
  return roomStr.replace(/^Rm\s*/i, '');
}

export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function truncateText(str, maxLen = 10) {
  if (!str) return '';
  const cleanStr = String(str).trim();
  if (cleanStr.length <= maxLen) return cleanStr;
  return cleanStr.substring(0, maxLen) + '...';
}

/**
 * fetch() with a timeout. Plain fetch can hang for minutes on captive portals or very
 * weak signal, which delays the bundled/cached offline fallbacks. Rejects on timeout
 * like a network error, so existing `.catch(() => null)` fallbacks keep working.
 */
export function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  if (typeof AbortController === 'undefined') return fetch(url, options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Local-timezone YYYY-MM-DD. Use instead of toISOString(), which is UTC (wrong date 00:00–06:00 in BD, UTC+6). */
export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "LAB" badge label with an inline SVG star (UI rule: SVG icons only, no emoji/glyph icons). */
export const LAB_LABEL_HTML = '<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-1px;margin-right:3px"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>LAB';
