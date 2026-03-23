import { getDatabase } from './database';
import { createId } from '../lib/id';
import { addDays, getMonthStart, isTaskScheduledForDate } from '../lib/date';
import type {
  Task,
  TaskCategory,
  TaskRepeatType,
  TaskTicket,
  TaskTicketStatus,
} from '../domain/types';

type CreateTaskInput = {
  title: string;
  category: TaskCategory;
  repeatType: TaskRepeatType;
  repeatDays?: number[];
  startDate: string;
  memo?: string | null;
};

type UpdateTaskInput = {
  title: string;
  category: TaskCategory;
  repeatType: TaskRepeatType;
  repeatDays?: number[];
  memo?: string | null;
};

export type TodayTaskItem = {
  task: Task;
  ticket: TaskTicket;
  status: TaskTicketStatus;
  checkedAt?: string | null;
  reminderEndAt?: string | null;
};

export type DateCompletionSummary = {
  date: string;
  total: number;
  done: number;
};

function mapRowToTask(row: any): Task {
  return {
    id: row.template_id,
    recurrenceRuleId: row.recurrence_rule_id,
    title: row.title,
    category: row.category,
    repeatType: row.repeat_type,
    repeatDays: JSON.parse(row.repeat_days ?? '[]'),
    startsOn: row.starts_on,
    isActive: Boolean(row.is_active),
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToTicket(row: any): TaskTicket {
  return {
    id: row.ticket_id,
    templateId: row.template_id,
    recurrenceRuleId: row.recurrence_rule_id,
    taskDate: row.task_date,
    status: row.ticket_status,
    openedAt: row.opened_at,
    completedAt: row.completed_at,
    createdAt: row.ticket_created_at,
    updatedAt: row.ticket_updated_at,
  };
}

export async function listTasks() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `
      SELECT
        t.id AS template_id,
        r.id AS recurrence_rule_id,
        t.title,
        t.category,
        r.repeat_type,
        r.repeat_days,
        r.starts_on,
        t.is_active,
        t.memo,
        t.created_at,
        t.updated_at
      FROM task_templates t
      INNER JOIN recurrence_rules r ON r.template_id = t.id
      WHERE t.is_active = 1 AND r.is_active = 1
      ORDER BY t.created_at ASC
    `
  );

  return rows.map(mapRowToTask);
}

export async function listActiveTasks() {
  return listTasks();
}

export async function createTask(input: CreateTaskInput) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const templateId = createId('template');
  const recurrenceRuleId = createId('rule');
  const repeatDays = input.repeatType === 'WEEKLY_DAYS' ? input.repeatDays ?? [] : [];

  await db.runAsync(
    `
      INSERT INTO task_templates (
        id, title, category, memo, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [templateId, input.title.trim(), input.category, input.memo ?? null, 1, now, now]
  );

  await db.runAsync(
    `
      INSERT INTO recurrence_rules (
        id, template_id, repeat_type, repeat_days, starts_on, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      recurrenceRuleId,
      templateId,
      input.repeatType,
      JSON.stringify(repeatDays),
      input.startDate,
      1,
      now,
      now,
    ]
  );

  return {
    id: templateId,
    recurrenceRuleId,
    title: input.title.trim(),
    category: input.category,
    repeatType: input.repeatType,
    repeatDays,
    startsOn: input.startDate,
    isActive: true,
    memo: input.memo ?? null,
    createdAt: now,
    updatedAt: now,
  } satisfies Task;
}

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const repeatDays = input.repeatType === 'WEEKLY_DAYS' ? input.repeatDays ?? [] : [];

  await db.runAsync(
    `
      UPDATE task_templates
      SET title = ?, category = ?, memo = ?, updated_at = ?
      WHERE id = ? AND is_active = 1
    `,
    [input.title.trim(), input.category, input.memo ?? null, now, taskId]
  );

  await db.runAsync(
    `
      UPDATE recurrence_rules
      SET repeat_type = ?, repeat_days = ?, updated_at = ?
      WHERE template_id = ? AND is_active = 1
    `,
    [input.repeatType, JSON.stringify(repeatDays), now, taskId]
  );
}

export async function deactivateTask(taskId: string) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    'UPDATE task_templates SET is_active = 0, updated_at = ? WHERE id = ?',
    [now, taskId]
  );

  await db.runAsync(
    'UPDATE recurrence_rules SET is_active = 0, updated_at = ? WHERE template_id = ?',
    [now, taskId]
  );
}

export async function ensureTodayTaskTickets(dateKey: string) {
  const db = await getDatabase();
  const rules = await db.getAllAsync<any>(
    `
      SELECT
        t.id AS template_id,
        r.id AS recurrence_rule_id,
        r.repeat_type,
        r.repeat_days,
        r.starts_on
      FROM task_templates t
      INNER JOIN recurrence_rules r ON r.template_id = t.id
      WHERE t.is_active = 1 AND r.is_active = 1
    `
  );
  const now = new Date().toISOString();

  for (const row of rules) {
    const repeatType = row.repeat_type as TaskRepeatType;
    const repeatDays = JSON.parse(row.repeat_days ?? '[]') as number[];
    const startsOn = row.starts_on as string;

    if (!isTaskScheduledForDate(repeatType, repeatDays, startsOn, dateKey)) {
      continue;
    }

    await db.runAsync(
      `
        INSERT OR IGNORE INTO task_tickets (
          id, template_id, recurrence_rule_id, task_date, status, opened_at, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        createId('ticket'),
        row.template_id,
        row.recurrence_rule_id,
        dateKey,
        'PENDING',
        null,
        null,
        now,
        now,
      ]
    );
  }
}

export async function seedSampleTasks(today: string) {
  const existing = await listTasks();
  if (existing.length > 0) {
    await ensureTodayTaskTickets(today);
    return existing;
  }

  await createTask({
    title: '출근 체크',
    category: '생활',
    repeatType: 'WEEKLY_DAYS',
    repeatDays: [1, 2, 3, 4, 5],
    startDate: today,
  });

  await createTask({
    title: '운동 30분',
    category: '운동',
    repeatType: 'DAILY',
    startDate: today,
  });

  await createTask({
    title: '영어 공부',
    category: '공부',
    repeatType: 'WEEKLY_DAYS',
    repeatDays: [1, 3, 5],
    startDate: today,
  });

  await ensureTodayTaskTickets(today);
  return listTasks();
}

function sortItems(left: TodayTaskItem, right: TodayTaskItem) {
  if (left.status !== right.status) {
    const order: Record<TaskTicketStatus, number> = {
      PENDING: 0,
      IN_PROGRESS: 1,
      DONE: 2,
    };

    return order[left.status] - order[right.status];
  }

  return left.task.title.localeCompare(right.task.title, 'ko');
}

export async function getTaskItemsForDate(dateKey: string): Promise<TodayTaskItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `
      SELECT
        t.id AS template_id,
        r.id AS recurrence_rule_id,
        t.title,
        t.category,
        r.repeat_type,
        r.repeat_days,
        r.starts_on,
        t.is_active,
        t.memo,
        t.created_at,
        t.updated_at,
        tt.id AS ticket_id,
        tt.task_date,
        tt.status AS ticket_status,
        tt.opened_at,
        tt.completed_at,
        tt.created_at AS ticket_created_at,
        tt.updated_at AS ticket_updated_at,
        MAX(CASE WHEN re.status = 'PENDING' THEN re.repeat_until ELSE NULL END) AS reminder_end_at
      FROM task_tickets tt
      INNER JOIN task_templates t ON t.id = tt.template_id
      INNER JOIN recurrence_rules r ON r.id = tt.recurrence_rule_id
      LEFT JOIN reminder_events re ON re.task_ticket_id = tt.id
      WHERE tt.task_date = ?
      GROUP BY tt.id
      ORDER BY tt.status ASC, t.title ASC
    `,
    [dateKey]
  );

  return rows
    .map((row) => ({
      task: mapRowToTask(row),
      ticket: mapRowToTicket(row),
      status: row.ticket_status as TaskTicketStatus,
      checkedAt: row.completed_at as string | null,
      reminderEndAt: row.reminder_end_at as string | null,
    }))
    .sort(sortItems);
}

export async function getTaskItemsForDates(dateKeys: string[]) {
  if (dateKeys.length === 0) {
    return {} as Record<string, TodayTaskItem[]>;
  }

  const db = await getDatabase();
  const sortedDateKeys = [...new Set(dateKeys)].sort();
  const startDate = sortedDateKeys[0];
  const endDate = sortedDateKeys[sortedDateKeys.length - 1];
  const rows = await db.getAllAsync<any>(
    `
      SELECT
        t.id AS template_id,
        r.id AS recurrence_rule_id,
        t.title,
        t.category,
        r.repeat_type,
        r.repeat_days,
        r.starts_on,
        t.is_active,
        t.memo,
        t.created_at,
        t.updated_at,
        tt.id AS ticket_id,
        tt.task_date,
        tt.status AS ticket_status,
        tt.opened_at,
        tt.completed_at,
        tt.created_at AS ticket_created_at,
        tt.updated_at AS ticket_updated_at
      FROM task_tickets tt
      INNER JOIN task_templates t ON t.id = tt.template_id
      INNER JOIN recurrence_rules r ON r.id = tt.recurrence_rule_id
      WHERE tt.task_date >= ? AND tt.task_date <= ?
      ORDER BY tt.task_date ASC, tt.status ASC, t.title ASC
    `,
    [startDate, endDate]
  );

  const result: Record<string, TodayTaskItem[]> = {};
  for (const dateKey of sortedDateKeys) {
    result[dateKey] = [];
  }

  for (const row of rows) {
    const dateKey = row.task_date as string;
    result[dateKey].push({
      task: mapRowToTask(row),
      ticket: mapRowToTicket(row),
      status: row.ticket_status as TaskTicketStatus,
      checkedAt: row.completed_at as string | null,
      reminderEndAt: null,
    });
  }

  for (const dateKey of sortedDateKeys) {
    result[dateKey].sort(sortItems);
  }

  return result;
}

export async function getMonthCompletionSummaries(
  monthDateKey: string
): Promise<Record<string, DateCompletionSummary>> {
  const db = await getDatabase();
  const monthStart = getMonthStart(monthDateKey);
  const monthEnd = addDays(monthStart, 41);
  const rows = await db.getAllAsync<any>(
    `
      SELECT task_date, status
      FROM task_tickets
      WHERE task_date >= ? AND task_date <= ?
      ORDER BY task_date ASC
    `,
    [monthStart, monthEnd]
  );

  const summaries: Record<string, DateCompletionSummary> = {};

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(monthStart, index);
    summaries[date] = {
      date,
      total: 0,
      done: 0,
    };
  }

  for (const row of rows) {
    const date = row.task_date as string;
    summaries[date].total += 1;
    if (row.status === 'DONE') {
      summaries[date].done += 1;
    }
  }

  return summaries;
}

export async function setTaskStatus(ticketId: string, status: TaskTicketStatus) {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<any>(
    'SELECT id, opened_at, completed_at FROM task_tickets WHERE id = ?',
    [ticketId]
  );

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const openedAt =
    status === 'PENDING' ? null : existing.opened_at ?? now;
  const completedAt = status === 'DONE' ? now : null;

  await db.runAsync(
    `
      UPDATE task_tickets
      SET status = ?, opened_at = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `,
    [status, openedAt, completedAt, now, ticketId]
  );

  return {
    id: existing.id as string,
    openedAt,
    completedAt,
  };
}

export const getTodayTaskItems = getTaskItemsForDate;
