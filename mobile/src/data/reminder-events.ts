import { getDatabase } from './database';
import { createId } from '../lib/id';
import type { ReminderEvent } from '../domain/types';

type CreateReminderEventInput = {
  ruleId: string;
  taskTicketId: string;
  scheduledAt: string;
  repeatIntervalMinutes?: number | null;
  repeatUntil?: string | null;
  notificationRequestId?: string | null;
};

function mapRowToReminderEvent(row: any): ReminderEvent {
  return {
    id: row.id,
    ruleId: row.rule_id,
    taskTicketId: row.task_ticket_id,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    status: row.status,
    repeatIntervalMinutes: row.repeat_interval_minutes,
    repeatUntil: row.repeat_until,
    completedAt: row.completed_at,
    notificationRequestId: row.notification_request_id,
  };
}

export async function listReminderEvents() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM reminder_events ORDER BY scheduled_at DESC LIMIT 20'
  );

  return rows.map(mapRowToReminderEvent);
}

export async function listDueReminderEvents(nowIso: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `
      SELECT *
      FROM reminder_events
      WHERE status = 'PENDING' AND scheduled_at <= ?
      ORDER BY scheduled_at ASC
    `,
    [nowIso]
  );

  return rows.map(mapRowToReminderEvent);
}

export async function createReminderEvent(input: CreateReminderEventInput) {
  const db = await getDatabase();
  const event: ReminderEvent = {
    id: createId('event'),
    ruleId: input.ruleId,
    taskTicketId: input.taskTicketId,
    scheduledAt: input.scheduledAt,
    sentAt: null,
    status: 'PENDING',
    repeatIntervalMinutes: input.repeatIntervalMinutes ?? null,
    repeatUntil: input.repeatUntil ?? null,
    completedAt: null,
    notificationRequestId: input.notificationRequestId ?? null,
  };

  await db.runAsync(
    `
      INSERT INTO reminder_events (
        id,
        rule_id,
        task_ticket_id,
        scheduled_at,
        sent_at,
        status,
        repeat_interval_minutes,
        repeat_until,
        completed_at,
        notification_request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      event.id,
      event.ruleId,
      event.taskTicketId,
      event.scheduledAt,
      event.sentAt ?? null,
      event.status,
      event.repeatIntervalMinutes ?? null,
      event.repeatUntil ?? null,
      event.completedAt ?? null,
      event.notificationRequestId ?? null,
    ]
  );

  return event;
}

export async function dismissReminderEvent(eventId: string) {
  const db = await getDatabase();
  const completedAt = new Date().toISOString();
  const existing = await db.getFirstAsync<any>(
    'SELECT task_ticket_id FROM reminder_events WHERE id = ?',
    [eventId]
  );

  await db.runAsync(
    `
      UPDATE reminder_events
      SET status = 'COMPLETED', completed_at = ?
      WHERE id = ? AND status = 'PENDING'
    `,
    [completedAt, eventId]
  );

  return {
    taskTicketId: (existing?.task_ticket_id as string | undefined) ?? null,
    completedAt,
  };
}

export async function completeReminderEventCycle(input: {
  eventId: string;
  sentAt: string;
  nextScheduledAt?: string | null;
  notificationRequestId?: string | null;
}) {
  const db = await getDatabase();

  if (input.nextScheduledAt) {
    await db.runAsync(
      `
        UPDATE reminder_events
        SET sent_at = ?, scheduled_at = ?, notification_request_id = ?, status = 'PENDING'
        WHERE id = ? AND status = 'PENDING'
      `,
      [
        input.sentAt,
        input.nextScheduledAt,
        input.notificationRequestId ?? null,
        input.eventId,
      ]
    );
    return;
  }

  await db.runAsync(
    `
      UPDATE reminder_events
      SET sent_at = ?, notification_request_id = NULL, status = 'EXPIRED'
      WHERE id = ? AND status = 'PENDING'
    `,
    [input.sentAt, input.eventId]
  );
}

export async function cancelPendingReminderEventsByRelatedTask(taskId: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `
      SELECT e.*
      FROM reminder_events e
      INNER JOIN reminder_rules r ON r.id = e.rule_id
      WHERE r.template_id = ? AND e.status = 'PENDING'
      ORDER BY e.scheduled_at DESC
    `,
    [taskId]
  );

  if (rows.length === 0) {
    return [];
  }

  const events = rows.map(mapRowToReminderEvent);
  const eventIds = events.map((event) => event.id);
  const placeholders = eventIds.map(() => '?').join(', ');

  await db.runAsync(
    `UPDATE reminder_events SET status = 'EXPIRED' WHERE id IN (${placeholders})`,
    eventIds
  );

  return events;
}

export async function cancelPendingReminderEventsByTaskTicket(ticketId: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `
      SELECT *
      FROM reminder_events
      WHERE task_ticket_id = ? AND status = 'PENDING'
      ORDER BY scheduled_at DESC
    `,
    [ticketId]
  );

  if (rows.length === 0) {
    return [];
  }

  const events = rows.map(mapRowToReminderEvent);
  const eventIds = events.map((event) => event.id);
  const placeholders = eventIds.map(() => '?').join(', ');

  await db.runAsync(
    `UPDATE reminder_events SET status = 'EXPIRED' WHERE id IN (${placeholders})`,
    eventIds
  );

  return events;
}
