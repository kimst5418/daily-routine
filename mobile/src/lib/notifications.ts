import Constants from 'expo-constants';
export function isExpoGo() {
  return Constants.executionEnvironment === 'storeClient';
}

let notificationsModulePromise: Promise<typeof import('expo-notifications')> | null = null;
let handlerInitialized = false;
let channelInitialized = false;

async function getNotificationsModule() {
  if (isExpoGo()) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications');
  }

  const Notifications = await notificationsModulePromise;

  if (!handlerInitialized) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerInitialized = true;
  }

  return Notifications;
}

async function ensureDefaultChannel() {
  if (isExpoGo() || channelInitialized) {
    return;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  await Notifications.setNotificationChannelAsync('default', {
    name: '기본 알림',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#f59e0b',
    sound: 'default',
  });

  channelInitialized = true;
}

export async function ensureNotificationPermissions() {
  if (isExpoGo()) {
    return {
      granted: false,
      canAskAgain: false,
      expires: 'never',
      status: 'denied',
    };
  }

  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return {
      granted: false,
      canAskAgain: false,
      expires: 'never',
      status: 'denied',
    };
  }

  await ensureDefaultChannel();

  const current = await Notifications.getPermissionsAsync();

  if (current.granted) {
    return current;
  }

  return Notifications.requestPermissionsAsync();
}

export async function getNotificationPermissions() {
  if (isExpoGo()) {
    return {
      granted: false,
      canAskAgain: false,
      expires: 'never',
      status: 'denied',
    };
  }

  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return {
      granted: false,
      canAskAgain: false,
      expires: 'never',
      status: 'denied',
    };
  }

  await ensureDefaultChannel();
  return Notifications.getPermissionsAsync();
}

export async function scheduleReminderNotification(input: {
  title: string;
  body: string;
  scheduledAt: string;
}) {
  if (isExpoGo()) {
    return null;
  }

  const permission = await ensureNotificationPermissions();
  if (!permission.granted) {
    return null;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  await ensureDefaultChannel();

  const secondsUntil = Math.max(
    1,
    Math.floor((new Date(input.scheduledAt).getTime() - Date.now()) / 1000)
  );

  return Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      channelId: 'default',
      seconds: secondsUntil,
    },
  });
}

export async function cancelScheduledNotification(notificationRequestId: string) {
  if (isExpoGo()) {
    return;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationRequestId);
}
