export const pad = num => String(num).padStart(2, '0');
export const toMinutes = time24h => { const [h, m] = time24h.split(':').map(Number); return h * 60 + m; };
export const toTimeString = mins => `${pad(Math.floor(mins / 60))}:${pad(Math.floor(mins % 60))}`;

export function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function parseTo24h(timeStr) {
  if (typeof timeStr !== 'string') return timeStr || '';
  const parts = timeStr.trim().split(' ');
  if (parts.length !== 2) return timeStr;
  let [hours, mins] = parts[0].split(':').map(Number);
  const period = parts[1].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${pad(hours)}:${pad(mins)}`;
}

export function format12h(time24h) {
  let [hours, mins] = time24h.split(':').map(Number);
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
