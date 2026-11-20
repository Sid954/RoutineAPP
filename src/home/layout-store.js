/** Home card order and hidden cards (tested). home_layout_v1: { order: [id], hidden: [id] } */
export const CARDS = [
  { id: 'header', label: 'Clock and greeting', fixed: true },
  { id: 'now', label: 'Now / Next' },
  { id: 'changes', label: 'What changed' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'today', label: "Today's classes" },
  { id: 'due', label: 'Due soon' },
  { id: 'exams', label: 'Exam countdown' },
  { id: 'teachers', label: "Today's teachers" },
  { id: 'notices', label: 'Unread notices' },
  { id: 'suggestions', label: 'Suggestions to vote' },
  { id: 'notes', label: 'Notes' },
  { id: 'actions', label: 'Quick actions' }
];
const KEY = 'home_layout_v1';
const IDS = CARDS.map(c => c.id);

export function getLayout() {
  let r = {};
  try { r = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) {}
  const order = (Array.isArray(r.order) ? r.order : []).filter((id, i, a) => IDS.includes(id) && a.indexOf(id) === i && id !== 'header');
  IDS.forEach(id => { if (id !== 'header' && !order.includes(id)) order.push(id); }); // new cards land at the end
  const hidden = (Array.isArray(r.hidden) ? r.hidden : []).filter(id => IDS.includes(id) && id !== 'header');
  return { order: ['header', ...order], hidden };
}
export function saveLayout({ order, hidden }) {
  try { localStorage.setItem(KEY, JSON.stringify({ order: order.filter(id => id !== 'header'), hidden })); } catch (e) {}
  return getLayout();
}
export function resetLayout() { try { localStorage.removeItem(KEY); } catch (e) {} return getLayout(); }
