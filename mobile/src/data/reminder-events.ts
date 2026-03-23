import { getDatabase } from './database';
import { createId } from '../lib/id';
import type { ReminderEvent } from '../domain/types';

type CreateReminderEventInput = {
  ruleId: string;
  taskTicketId: string;
  scheduledAt: string;
  repeatIntervalMinutes?: number | null;
  maxAlertCount?: number | null;
  notificationRequestIds?: string[];
};

function mapRowToReminderEvent(row: any): ReminderEvent {
  return {
    id: row.id,
    ruleId: row.rule_id,
    taskTicketId: row.task_ticket_id,
    scheduledAt: row.scheduled_at,
    repeatIntervalMinutes: row.repeat_interval_minutes,
    maxAlertCount: row.max_alert_count,
    notificationRequestIds: JSON.parse((row.notification_request_ids as string | null) ?? '[]'),
  };
}

export async function listReminderEvents() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM reminder_events ORDER BY scheduled_at DESC LIMIT 20'
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
    repeatIntervalMinutes: input.repeatIntervalMinutes ?? null,
    maxAlertCount: input.maxAlertCount ?? null,
    notificationRequestIds: input.notificationRequestIds ?? [],
  };

  await db.runAsync(
    `
      INSERT INTO reminder_events (
        id,
        rule_id,
        task_ticket_id,
        scheduled_at,
        repeat_interval_minutes,
        max_alert_count,
        notification_request_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      event.id,
      event.ruleId,
      event.taskTicketId,
      event.scheduledAt,
      event.repeatIntervalMinutes ?? null,
      event.maxAlertCount ?? null,
      JSON.stringify(event.notificationRequestIds),
    ]
  );

  return event;
}

export async function deleteReminderEventsByRelatedTask(taskId: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `
      SELECT e.*
      FROM reminder_events e
      INNER JOIN reminder_rules r ON r.id = e.rule_id
      WHERE r.template_id = ?
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
    `DELETE FROM reminder_events WHERE id IN (${placeholders})`,
    eventIds
  );

  return events;
}

export async function deleteReminderEventsByTaskTicket(ticketId: string) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `
      SELECT *
      FROM reminder_events
      WHERE task_ticket_id = ?
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
    `DELETE FROM reminder_events WHERE id IN (${placeholders})`,
    eventIds
  );

  return events;
}
