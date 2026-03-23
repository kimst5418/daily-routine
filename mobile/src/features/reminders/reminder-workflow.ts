import {
  createReminderEvent,
  deleteReminderEventsByRelatedTask,
  deleteReminderEventsByTaskTicket,
} from '../../data/reminder-events';
import type { ReminderEvent, ReminderRule, TaskTicketStatus } from '../../domain/types';
import {
  cancelScheduledNotification,
  scheduleReminderNotification,
} from '../../lib/notifications';
import { addMinutes } from '../../lib/time';
import { getNextTaskStatus } from '../tasks/task-presentation';

type StatusChangeTicket = {
  id: string;
  openedAt?: string | null;
};

export async function cancelScheduledNotificationsForEvents(
  events: Array<Pick<ReminderEvent, 'notificationRequestIds'>>
) {
  await Promise.all(
    events.flatMap((event) =>
      event.notificationRequestIds.map((notificationRequestId) =>
        cancelScheduledNotification(notificationRequestId)
      )
    )
  );
}

export async function deleteReminderEventsForTaskTicket(ticketId: string) {
  const deletedEvents = await deleteReminderEventsByTaskTicket(ticketId);
  await cancelScheduledNotificationsForEvents(deletedEvents);
  return deletedEvents;
}

export async function deleteReminderEventsForTask(taskId: string) {
  const deletedEvents = await deleteReminderEventsByRelatedTask(taskId);
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
    const repeatIntervalMinutes = Math.min(10, Math.max(1, rule.repeatIntervalMinutes ?? 1));
    const maxAlertCount = Math.min(10, Math.max(1, rule.maxAlertCount));
    const scheduledAt = addMinutes(input.openedAt, rule.delayMinutes);
    const notificationRequestIds: string[] = [];

    for (let index = 0; index < maxAlertCount; index += 1) {
      const cycleScheduledAt =
        index === 0 ? scheduledAt : addMinutes(scheduledAt, repeatIntervalMinutes * index);
      const notificationRequestId = await scheduleReminderNotification({
        title: '루틴 체크 알림',
        body: rule.message,
        scheduledAt: cycleScheduledAt,
      });

      if (notificationRequestId) {
        notificationRequestIds.push(notificationRequestId);
      }
    }

    await createReminderEvent({
      ruleId: rule.id,
      taskTicketId: input.taskTicketId,
      scheduledAt,
      repeatIntervalMinutes,
      maxAlertCount,
      notificationRequestIds,
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
}
