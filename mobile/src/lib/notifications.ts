import Constants from 'expo-constants';

export const REMINDER_NOTIFICATION_CATEGORY_ID = 'routine-reminder-actions';
export const REMINDER_COMPLETE_ACTION_ID = 'complete-ticket';

type ReminderNotificationData = {
  ticketId?: string;
  templateId?: string;
};

export function isExpoGo() {
  return Constants.executionEnvironment === 'storeClient';
}

let notificationsModulePromise: Promise<typeof import('expo-notifications')> | null = null;
let handlerInitialized = false;
let channelInitialized = false;
let categoryInitialized = false;

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
  });

  channelInitialized = true;
}

async function ensureReminderCategory() {
  if (isExpoGo() || categoryInitialized) {
    return;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  await Notifications.setNotificationCategoryAsync(REMINDER_NOTIFICATION_CATEGORY_ID, [
    {
      identifier: REMINDER_COMPLETE_ACTION_ID,
      buttonTitle: '완료',
      options: {
        opensAppToForeground: true,
      },
    },
  ]);

  categoryInitialized = true;
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
  await ensureReminderCategory();

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
  await ensureReminderCategory();
  return Notifications.getPermissionsAsync();
}

export async function scheduleReminderNotification(input: {
  title: string;
  body: string;
  scheduledAt: string;
  data?: ReminderNotificationData;
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
  await ensureReminderCategory();

  const secondsUntil = Math.max(
    1,
    Math.floor((new Date(input.scheduledAt).getTime() - Date.now()) / 1000)
  );

  return Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: true,
      categoryIdentifier: REMINDER_NOTIFICATION_CATEGORY_ID,
      data: input.data,
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

export async function addReminderNotificationResponseListener(
  onComplete: (payload: { ticketId: string; templateId?: string | null }) => void | Promise<void>
) {
  if (isExpoGo()) {
    return () => {};
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return () => {};
  }

  await ensureReminderCategory();

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.actionIdentifier !== REMINDER_COMPLETE_ACTION_ID) {
      return;
    }

    const data = (response.notification.request.content.data ?? {}) as ReminderNotificationData;
    const ticketId = typeof data.ticketId === 'string' ? data.ticketId : null;
    const templateId = typeof data.templateId === 'string' ? data.templateId : null;

    if (!ticketId) {
      return;
    }

    void onComplete({ ticketId, templateId });
  });

  return () => {
    subscription.remove();
  };
}
