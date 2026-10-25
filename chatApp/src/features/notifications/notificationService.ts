import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { notificationsApi } from './notificationsApi';

// Guard expo-notifications behind a try/catch require() so the app doesn't
// crash in Expo Go where ExpoTopicSubscriptionModule is unavailable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: any = null;
let notificationsAvailable = false;

try {
  // Using require() inside try/catch — if the native module throws on load,
  // we catch it here instead of crashing the whole app.
  Notifications = require('expo-notifications');
  notificationsAvailable = true;
} catch {
  console.warn('[Elowa] expo-notifications unavailable — push notifications disabled.');
}

let registered = false;
let responseSub: { remove(): void } | null = null;
let receivedSub: { remove(): void } | null = null;
let handlerSet = false;

function ensureHandler(): void {
  if (handlerSet || !notificationsAvailable) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerSet = true;
  } catch {
    notificationsAvailable = false;
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !notificationsAvailable) return;
  try {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 150, 100, 150],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  } catch {
    /* channel setup failed — non-fatal */
  }
}

function navigateFromNotificationData(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const conversationId = (data as { conversationId?: unknown }).conversationId;
  if (typeof conversationId !== 'string') return;
  router.push(`/(main)/chat/${conversationId}`);
}

export const notificationService = {
  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice || !notificationsAvailable) return null;

    ensureHandler();
    await ensureAndroidChannel();

    try {
      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') return null;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants.easConfig as { projectId?: string } | undefined)?.projectId;

      const tokenResult = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      await notificationsApi.registerToken(tokenResult.data);
      return tokenResult.data;
    } catch {
      return null;
    }
  },

  attachListeners(): void {
    if (registered || !notificationsAvailable) return;

    ensureHandler();
    registered = true;

    try {
      receivedSub = Notifications.addNotificationReceivedListener(() => {
        /* in-app foreground: the handler above already shows the banner */
      });

      responseSub = Notifications.addNotificationResponseReceivedListener(
        (response: { notification: { request: { content: { data: unknown } } } }) => {
          navigateFromNotificationData(response.notification.request.content.data);
        },
      );

      Notifications.getLastNotificationResponseAsync().then(
        (response: { notification: { request: { content: { data: unknown } } } } | null) => {
          if (response) navigateFromNotificationData(response.notification.request.content.data);
        },
      );
    } catch {
      registered = false;
      notificationsAvailable = false;
    }
  },

  detachListeners(): void {
    receivedSub?.remove();
    responseSub?.remove();
    receivedSub = null;
    responseSub = null;
    registered = false;
  },

  async unregister(): Promise<void> {
    try {
      await notificationsApi.unregister();
    } catch {
      /* ignore */
    }
  },
};
