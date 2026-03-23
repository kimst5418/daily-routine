import {
  completePendingReminderEventsByTaskTicket,
  deletePendingReminderEventsByRelatedTask,
  deletePendingReminderEventsByTaskTicket,
  completeReminderEventCycle,
  createReminderEvent,
  listDueReminderEvents,
} from '../../data/reminder-events';
import type { ReminderEvent, ReminderRule, TaskTicketStatus } from '../../domain/types';
import {
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

export async function deleteReminderEventsForTaskTicket(ticketId: string) {
  // 상태가 바뀌면 기존 pending 알림은 더 이상 유효하지 않으므로 함께 삭제한다.
  const deletedEvents = await deletePendingReminderEventsByTaskTicket(ticketId);
  await cancelScheduledNotificationsForEvents(deletedEvents);
  return deletedEvents;
}

export async function completeReminderEventsForTaskTicket(ticketId: string) {
  const completedEvents = await completePendingReminderEventsByTaskTicket(ticketId);
  await cancelScheduledNotificationsForEvents(completedEvents);
  return completedEvents;
}

export async function deleteReminderEventsForTask(taskId: string) {
  const deletedEvents = await deletePendingReminderEventsByRelatedTask(taskId);
  await cancelScheduledNotificationsForEvents(deletedEvents);
  return deletedEvents;
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
      maxAlertCount: rule.maxAlertCount,
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

  if (input.currentStatus === 'IN_PROGRESS' && nextStatus === 'DONE') {
    await completeReminderEventsForTaskTicket(input.ticketId);
  } else if (input.currentStatus === 'IN_PROGRESS' || input.currentStatus === 'DONE') {
    await deleteReminderEventsForTaskTicket(input.ticketId);
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
    const nextSentCount = (event.sentCount ?? 0) + 1;
    const maxAlertCount = event.maxAlertCount ?? rule?.maxAlertCount ?? null;

    if (!rule || !intervalMinutes || intervalMinutes <= 0) {
      await completeReminderEventCycle({
        eventId: event.id,
        sentAt: nowIso,
        sentCount: nextSentCount,
      });
      continue;
    }

    let nextScheduledAt = addMinutes(event.scheduledAt, intervalMinutes);
    while (nextScheduledAt <= nowIso) {
      nextScheduledAt = addMinutes(nextScheduledAt, intervalMinutes);
    }

    if (maxAlertCount && nextSentCount >= maxAlertCount) {
      await completeReminderEventCycle({
        eventId: event.id,
        sentAt: nowIso,
        sentCount: nextSentCount,
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
      sentCount: nextSentCount,
      nextScheduledAt,
      notificationRequestId,
    });
  }
}
