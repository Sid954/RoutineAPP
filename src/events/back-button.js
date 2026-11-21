/**
 * Android hardware / gesture back button (Capacitor App plugin). Without a listener the
 * WebView had no history to go back to, so back did nothing useful.
 *   1. Close the top-most open sheet / popup (same as tapping its backdrop or close button)
 *   2. Otherwise step back one page (post form -> Notices, Faculty/Rooms -> where you came from)
 *   3. On Home: leave the app
 */
const OVERLAYS = [
  '#appUpdateSheet.open',
  '.class-sheet-modal-overlay.open',
  '.rm-sheet-overlay.open',
  '#calendarPickerModal.open',
  '#npEditor',
  '.mo.open'
].join(',');

function zOf(el) {
  const z = parseInt(getComputedStyle(el).zIndex, 10);
  return isNaN(z) ? 0 : z;
}

/** Close the top-most overlay. Returns true if something was closed. */
export function closeTopOverlay() {
  const open = Array.from(document.querySelectorAll(OVERLAYS)).filter(el => el.offsetParent !== null || getComputedStyle(el).display !== 'none');
  if (!open.length) return false;
  const top = open.sort((a, b) => zOf(b) - zOf(a))[0];
  // Prefer an explicit close / back button inside it, else a backdrop click
  // .page-back-btn: full pages (Attendance, Notifications: back steps out of a sub page first);
  // .nt-sheet-close: the bottom sheets built on .nt-sheet (day bell, confirm info, notes, exams, set time)
  const btn = top.querySelector('#ecC, #vcC, .rm-icon-btn[aria-label="Close"], .fd-icon-btn[aria-label="Close"], #ntSheetClose, .up-close, .cls, #calendarPickerCloseBtn, [data-up="close"], .nt-sheet-close, [data-ed-close], .page-back-btn');
  if (btn) btn.click();
  else top.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  // Forced update sheet and similar refuse to close: report "handled" anyway so back doesn't exit
  return true;
}

const PARENT = { day: 'home', post_announcement: 'announcements', faculty: 'apps', free_rooms: 'apps', apps: 'home', announcements: 'home' };

export function handleBack() {
  if (closeTopOverlay()) return 'overlay';
  const view = window.__currentAppViewId || 'home';
  if (view !== 'home') {
    // Rooms remembers whether it was opened from Home or Apps via its own back button
    const own = view === 'free_rooms' ? document.getElementById('freeRoomsPageBackBtn')
      : view === 'faculty' ? document.getElementById('facultyPageBackBtn')
      : view === 'post_announcement' ? document.getElementById('postAnnounceBackBtn') : null;
    if (own) own.click();
    else if (window.switchAppView) window.switchAppView(PARENT[view] || 'home');
    return 'view';
  }
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App && App.exitApp) App.exitApp();
  return 'exit';
}

export function initBackButton() {
  window.__handleBack = handleBack;
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!App || !App.addListener) return;
  App.addListener('backButton', () => handleBack());
}
