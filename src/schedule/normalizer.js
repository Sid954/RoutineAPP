import { DAY_MAP, CONFIG } from '../core/config.js';
import { pad } from '../core/utils.js';

function parseTo24h(timeStr) {
  if (typeof timeStr !== 'string') return timeStr || '';
  const parts = timeStr.trim().split(' ');
  if (parts.length !== 2) return timeStr;
  let [hours, mins] = parts[0].split(':').map(Number);
  const period = parts[1].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${pad(hours)}:${pad(mins)}`;
}

export function normalizeSchedule(rawSchedule) {
  const normalized = {};
  for (const [dayName, entries] of Object.entries(rawSchedule)) {
    const idx = DAY_MAP[dayName];
    if (idx === undefined) continue;
    normalized[idx] = entries.map(item => {
      const [startStr, endStr] = item.time.split(' - ').map(t => t.trim());
      return {
        start: parseTo24h(startStr),
        end: parseTo24h(endStr),
        title: item.subject,
        room: item.room,
        instructor: item.instructor || '',
        type: item.type || 'Theory'
      };
    });
  }
  for (const dayIdx of CONFIG.activeDays) {
    if (!normalized[dayIdx]) normalized[dayIdx] = [];
  }
  return normalized;
}
