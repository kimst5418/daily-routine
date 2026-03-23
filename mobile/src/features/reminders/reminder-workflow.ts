import {
  cancelPendingReminderEventsByRelatedTask,
  cancelPendingReminderEventsByTaskTicket,
  completeReminderEventCycle,
  createReminderEvent,
  listDueReminderEvents,
} from '../../data/reminder-events';
import type { ReminderEvent, ReminderRule, TaskTicketStatus } from '../../domain/types';
import {
  calculateRepeatUntil,
  cancelScheduledNotification,
  scheduleReminderNotification,
} from '../../lib/notifications';
import { addMinutes } from '../../lib/time';
import { getNextTaskStatus } from '../tasks/task-presentation';
import { listReminderRules } from '../../data/reminders';

type StatusChangeTicket = {
  id: string;
  openedAt?: string | null;
};

export async function cancelScheduledNotificationsForEvents(
  events: Array<Pick<ReminderEvent, 'notificationRequestId'>>
) {
  await Promise.all(
    events.map((event) =>
      event.notificationRequestId
        ? cancelScheduledNotification(event.notificationRequestId)
        : Promise.resolve()
    )
  );
}

export async function expireReminderEventsForTaskTicket(ticketId: string) {
  // 상태가 바뀌면 기존 pending 알림은 더 이상 유효하지 않으므로 함께 정리한다.
  const canceledEvents = await cancelPendingReminderEventsByTaskTicket(ticketId);
  await cancelScheduledNotificationsForEvents(canceledEvents);
  return canceledEvents;
}

export async function expireReminderEventsForTask(taskId: string) {
  const canceledEvents = await cancelPendingReminderEventsByRelatedTask(taskId);
  await cancelScheduledNotificationsForEvents(canceledEvents);
  return canceledEvents;
}

export async function scheduleReminderEventsForTaskStart(input: {
  taskTicketId: string;
  templateId: string;
  openedAt: string;
  rules: ReminderRule[];
}) {
  // 같은 템플릿에 연결된 활성 규칙들만 찾아 시작 시점 기준으로 첫 알림을 예약한다.
  const matchedRules = input.rules.filter(
    (rule) => rule.isActive && rule.templateId === input.templateId
  );

  for (const rule of matchedRules) {
    const scheduledAt = addMinutes(input.openedAt, rule.delayMinutes);
    const notificationRequestId = await scheduleReminderNotification({
      title: '루틴 체크 알림',
      body: rule.message,
      scheduledAt,
    });

    await createReminderEvent({
      ruleId: rule.id,
      taskTicketId: input.taskTicketId,
      scheduledAt,
      repeatIntervalMinutes: rule.repeatIntervalMinutes ?? null,
      repeatUntil: calculateRepeatUntil(input.openedAt, rule.delayMinutes),
      notificationRequestId,
    });
  }
}

export async function handleReminderEventsAfterTaskStatusChange(input: {
  ticketId: string;
  templateId: string;
  currentStatus: TaskTicketStatus;
  nextStatus?: TaskTicketStatus;
  ticket: StatusChangeTicket | null;
  rules: ReminderRule[];
}) {
  // 티켓 상태 변경 직후 필요한 알림 후속 처리만 모아서 실행한다.
  const hasLinkedRules = input.rules.some(
    (rule) => rule.isActive && rule.templateId === input.templateId
  );
  const nextStatus = input.nextStatus ?? getNextTaskStatus(input.currentStatus, hasLinkedRules);

  if (input.currentStatus === 'IN_PROGRESS' || input.currentStatus === 'DONE') {
    await expireReminderEventsForTaskTicket(input.ticketId);
  }

  if (nextStatus === 'IN_PROGRESS' && input.ticket?.openedAt) {
    await scheduleReminderEventsForTaskStart({
      taskTicketId: input.ticket.id,
      templateId: input.templateId,
      openedAt: input.ticket.openedAt,
      rules: input.rules,
    });
    return;
  }

  await rescheduleDueReminderEvents();
}

export async function rescheduleDueReminderEvents() {
  const nowIso = new Date().toISOString();
  const [dueEvents, allRules] = await Promise.all([
    listDueReminderEvents(nowIso),
    listReminderRules(),
  ]);

  if (dueEvents.length === 0) {
    return;
  }

  const ruleMap = new Map(allRules.map((rule) => [rule.id, rule]));

  for (const event of dueEvents) {
    // 앱이 다시 열렸을 때도 "지금 시각 이후의 다음 반복 시점"으로 밀어준다.
    const rule = ruleMap.get(event.ruleId);
    const intervalMinutes = event.repeatIntervalMinutes ?? rule?.repeatIntervalMinutes ?? null;

    if (!rule || !intervalMinutes || intervalMinutes <= 0) {
      await completeReminderEventCycle({
        eventId: event.id,
        sentAt: nowIso,
      });
      continue;
    }

    let nextScheduledAt = addMinutes(event.scheduledAt, intervalMinutes);
    while (nextScheduledAt <= nowIso) {
      nextScheduledAt = addMinutes(nextScheduledAt, intervalMinutes);
    }

    if (event.repeatUntil && nextScheduledAt > event.repeatUntil) {
      await completeReminderEventCycle({
        eventId: event.id,
        sentAt: nowIso,
      });
      continue;
    }

    const notificationRequestId = await scheduleReminderNotification({
      title: '루틴 체크 알림',
      body: rule.message,
      scheduledAt: nextScheduledAt,
    });

    await completeReminderEventCycle({
      eventId: event.id,
      sentAt: nowIso,
      nextScheduledAt,
      notificationRequestId,
    });
  }
}
