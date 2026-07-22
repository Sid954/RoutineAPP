import { CONFIG } from '../core/config.js';
import { DOM } from '../core/dom.js';
import { showToast } from '../toast/toast.js';
import { Notifications, setNativePush } from '../notifications/notifications.js';
import { Storage } from '../storage/storage.js';
import { Announcements } from '../announcements/announcements.js';
import { openModal } from '../modals/modal.js';

export const NativePush = {
  isSupported() {
    return window.Capacitor && window.Capacitor.isNativePlatform();
  },

  async init() {
    if (!this.isSupported()) return;
    // PushNotifications.register() requires Firebase google-services.json on Android.
    // Since Firebase is not configured in this build, we skip PushNotifications.register()
    // to prevent native IllegalStateException / app process crash.
    // LocalNotifications will handle all class reminders & announcement alerts locally.
    console.log('NativePush initialized in LocalNotifications mode (PushNotifications skipped to prevent Firebase crash).');
  }
};

// Register self with Notifications to break the circular dependency
setNativePush(NativePush);
