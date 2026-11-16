import { DOM } from '../core/dom.js';
import { Storage } from '../storage/storage.js';
import { showToast } from '../toast/toast.js';
import { Notifications } from '../notifications/notifications.js';
import { NativePush } from '../notifications/native-push.js';

export function initNotifBanner() {
  document.getElementById('notifAllow').addEventListener('click', async () => {
    const granted = await Notifications.requestPermission();
    DOM.notifBanner.classList.remove('show');
    Storage.dismissBanner(Storage.BANNER_DISMISS_KEY);
    if (granted) {
      // Permission + push registration for announcements only. Class-start reminders
      // (Notifications.scheduleForToday) stay opt-in and unchanged: they are backlog #9
      // and need a redesign before being switched on from here.
      if (NativePush.isSupported()) {
        NativePush.init();
      }
      showToast('Announcement notifications enabled', 'success');
    } else {
      showToast('Permission denied — you can enable later in settings.', 'warning');
    }
  });

  document.getElementById('notifDismiss').addEventListener('click', () => {
    DOM.notifBanner.classList.remove('show');
    Storage.dismissBanner(Storage.BANNER_DISMISS_KEY);
  });
}
