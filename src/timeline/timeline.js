/**
 * The Home / Routine timeline moved to src/home/home-view.js (Nov 2026 redesign).
 * This module stays so existing importers (main.js, dashboard/update.js, calendar-picker.js,
 * day-switcher.js) keep working unchanged.
 */
export { renderTimeline, renderWeekStrip } from '../home/home-view.js';
