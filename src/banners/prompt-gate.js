/**
 * Prompt gate: only one prompt on screen at a time.
 * On a first browser visit the notification banner, the "Use the Android App" dialog and the
 * install banner could all appear together (plus the welcome screen on first launch).
 * Each prompt now waits until none of the others is visible, then shows.
 */
function isVisible(el) {
  if (!el) return false;
  if (el.classList.contains('open') || el.classList.contains('show')) return true;
  return getComputedStyle(el).display !== 'none' && el.id === 'androidAppModal';
}

export function isAnyPromptVisible(exceptId) {
  return ['welcomeModal', 'androidAppModal', 'notifBanner', 'installBanner']
    .filter(id => id !== exceptId)
    .some(id => isVisible(document.getElementById(id)));
}

/**
 * Calls show() once no other prompt is visible (checked every 1.5s, gives up after timeoutMs).
 */
export function showWhenClear(exceptId, show, timeoutMs = 120000) {
  const started = Date.now();
  const attempt = () => {
    if (!isAnyPromptVisible(exceptId)) { show(); return; }
    if (Date.now() - started < timeoutMs) setTimeout(attempt, 1500);
  };
  attempt();
}
