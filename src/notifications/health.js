/**
 * Notification health check: finds why notifications might not arrive and offers a fix.
 * Native (Android): permission, Android's per-app toggle, Firebase push in this build,
 * battery optimisation, exact alarms. Web: Notification.permission.
 * Shown in the Notifications popup (#notifHealth), on Notices (#ntHealth) and, for real
 * problems, as a launch warning at most every 3 days.
 */
import { showToast } from '../toast/toast.js';
import { escapeHtml } from '../core/utils.js';

const WARN_KEY = 'notif_health_warned_at';
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const P = () => (window.Capacitor && window.Capacitor.Plugins) || {};

/** @returns {Promise<{ ok: boolean, issues: Array<{id, level:'error'|'warn'|'info', title, detail, fix?}> }>} */
export async function checkNotificationHealth() {
  const issues = [];
  if (!isNative()) {
    if (typeof Notification === 'undefined') {
      issues.push({ id: 'unsupported', level: 'info', title: 'This browser has no notifications', detail: 'Install the Android app to get class and notice alerts.' });
    } else if (Notification.permission === 'denied') {
      issues.push({ id: 'denied', level: 'error', title: 'Notifications are blocked', detail: 'Allow notifications for this site in your browser settings.' });
    } else if (Notification.permission === 'default') {
      issues.push({ id: 'ask', level: 'warn', title: 'Notifications not allowed yet', detail: 'Allow them so you hear about cancellations and tests.', fix: { label: 'Allow', run: () => Notification.requestPermission().then(() => refreshHealthUI()) } });
    }
    return { ok: !issues.some(i => i.level !== 'info'), issues };
  }

  const { LocalNotifications, WidgetPlugin } = P();
  let sys = {};
  try { if (WidgetPlugin && WidgetPlugin.getSystemState) sys = await WidgetPlugin.getSystemState(); } catch (e) {}
  const openSettings = () => WidgetPlugin && WidgetPlugin.openNotificationSettings && WidgetPlugin.openNotificationSettings();

  let perm = 'granted';
  try { if (LocalNotifications) perm = (await LocalNotifications.checkPermissions()).display; } catch (e) {}
  if (perm !== 'granted' || sys.notificationsEnabled === false) {
    const canAsk = perm === 'prompt' || perm === 'prompt-with-rationale';
    issues.push({
      id: 'permission', level: 'error', title: 'Notifications are turned off',
      detail: canAsk ? 'Allow notifications so cancellations, tests and new notices reach you.' : 'They are blocked for this app in Android settings. Turn on "Allow notifications".',
      fix: canAsk
        ? { label: 'Allow', run: async () => { try { await LocalNotifications.requestPermissions(); } catch (e) {} refreshHealthUI(); } }
        : { label: 'Open settings', run: openSettings }
    });
  }

  let firebase = true;
  try { if (WidgetPlugin && WidgetPlugin.isFirebaseConfigured) firebase = !!(await WidgetPlugin.isFirebaseConfigured()).configured; } catch (e) {}
  if (!firebase) {
    issues.push({ id: 'push', level: 'warn', title: 'Push alerts are not set up in this build', detail: 'New notices only show up when you open the app. (The developer needs to add the Firebase config to the build.)' });
  }
  if (sys.batteryOptimized) {
    issues.push({ id: 'battery', level: 'warn', title: 'Battery saver may delay alerts', detail: 'Android may hold back reminders and widget updates for this app.', fix: { label: 'Allow', run: () => WidgetPlugin.requestIgnoreBatteryOptimizations() } });
  }
  if (sys.exactAlarms === false) {
    issues.push({ id: 'alarms', level: 'info', title: 'Precise timing is off', detail: 'Widgets can update a few minutes late. "Alarms & reminders" in app settings turns it on.', fix: { label: 'Open settings', run: openSettings } });
  }
  return { ok: !issues.some(i => i.level === 'error'), issues, system: sys };
}

function healthHtml(res) {
  if (!res.issues.length) {
    return `<div class="nh-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Notifications are working</span><button type="button" class="nh-test" data-nh-test>Send a test</button></div>`;
  }
  return res.issues.map((i, n) => `<div class="nh-item is-${i.level}">
      <div class="nh-text"><strong>${escapeHtml(i.title)}</strong><span>${escapeHtml(i.detail)}</span></div>
      ${i.fix ? `<button type="button" class="nh-fix" data-nh-fix="${n}">${escapeHtml(i.fix.label)}</button>` : ''}
    </div>`).join('') + (res.ok ? '<button type="button" class="nh-test is-inline" data-nh-test>Send a test notification</button>' : '');
}

let _last = null;
export async function refreshHealthUI() {
  const res = await checkNotificationHealth();
  _last = res;
  ['notifHealth', 'ntHealth'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // Notices page shows problems only; the popup shows everything
    if (id === 'ntHealth') {
      const serious = res.issues.filter(i => i.level === 'error');
      el.hidden = !serious.length;
      el.innerHTML = serious.length ? healthHtml({ ...res, issues: serious }) : '';
    } else {
      el.innerHTML = healthHtml(res);
    }
  });
  return res;
}

async function sendTest() {
  try {
    const { Notifications } = await import('./notifications.js');
    await Notifications.showInstant('Test notification', 'If you can read this, notifications work.', 'general');
    showToast('Test sent. Check your notification shade.', 'info');
  } catch (e) {
    showToast('Could not send a test notification.', 'error');
  }
}

export function initNotificationHealth() {
  document.addEventListener('click', e => {
    const fix = e.target.closest('[data-nh-fix]');
    if (fix && _last) {
      const issue = _last.issues[Number(fix.dataset.nhFix)];
      if (issue && issue.fix) Promise.resolve(issue.fix.run()).finally(() => setTimeout(refreshHealthUI, 800));
      return;
    }
    if (e.target.closest('[data-nh-test]')) sendTest();
  });
  // Re-check when coming back from Android settings
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshHealthUI(); });
  setTimeout(async () => {
    const res = await refreshHealthUI();
    const serious = res.issues.find(i => i.level === 'error');
    if (!serious) return;
    let last = 0;
    try { last = Number(localStorage.getItem(WARN_KEY) || 0); } catch (e) {}
    if (Date.now() - last < 3 * 864e5) return;
    try { localStorage.setItem(WARN_KEY, String(Date.now())); } catch (e) {}
    showToast(`${serious.title}. Fix it in Notices or Settings → Notifications.`, 'warning');
  }, 6000);
}
