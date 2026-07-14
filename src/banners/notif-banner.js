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
      const settings = Storage.getNotifSettings();
      settings.enabled = true;
      Storage.saveNotifSettings(settings);
      DOM.notifToggle.checked = true;
      Notifications.scheduleForToday();
      if (NativePush.isSupported()) {
        NativePush.init();
      }
      showToast('Notifications enabled!', 'success');
    } else {
      showToast('Permission denied — you can enable later in settings.', 'warning');
    }
  });

  document.getElementById('notifDismiss').addEventListener('click', () => {
    DOM.notifBanner.classList.remove('show');
    Storage.dismissBanner(Storage.BANNER_DISMISS_KEY);
  });
}
