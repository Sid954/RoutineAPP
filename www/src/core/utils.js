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
