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

    try {
      const { PushNotifications } = window.Capacitor.Plugins;

      // Request permissions
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
      }

      // On success, save the token to the database
      PushNotifications.addListener('registration', async token => {
        console.log('Push registration success, token: ' + token.value);
        try {
          await fetch(`${CONFIG.apiBase || ''}/api/register-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: token.value,
              platform: window.Capacitor.getPlatform()
            })
          });
        } catch (err) {
          console.error('Failed to register device token on server:', err);
        }
      });

      // On error
      PushNotifications.addListener('registrationError', error => {
        console.error('Push registration error: ', error);
      });

      // Handle receiving push notifications while app is in foreground
      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('Push notification received in foreground: ', notification);
        showToast(`${notification.title}: ${notification.body}`, 'info');
        Announcements.fetchAll();
      });

      // Handle actions when push notification is clicked/tapped
      PushNotifications.addListener('pushNotificationActionPerformed', notification => {
        console.log('Push notification action performed: ', notification);
        openModal(DOM.announceModal);
        Announcements.markAsRead();
      });
    } catch (err) {
      console.error('Error initializing Capacitor Push Notifications plugin:', err);
    }
  }
};

// Register self with Notifications to break the circular dependency
setNativePush(NativePush);
