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

const taskItemSelectColumns = `
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
  tt.reminder_rule_id,
  tt.opened_at,
  tt.completed_at,
  tt.created_at AS ticket_created_at,
  tt.updated_at AS ticket_updated_at
`;

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
    reminderRuleId: (row.reminder_rule_id as string | null | undefined) ?? null,
    taskDate: row.task_date,
    status: row.ticket_status,
    openedAt: row.opened_at,
    completedAt: row.completed_at,
    createdAt: row.ticket_created_at,
    updatedAt: row.ticket_updated_at,
  };
}

function mapRowToTodayTaskItem(row: any): TodayTaskItem {
  // 화면에서는 템플릿/티켓/알림 종료 시각을 한 묶음으로 다루기 때문에 여기서 합쳐 둔다.
  return {
    task: mapRowToTask(row),
    ticket: mapRowToTicket(row),
    status: row.ticket_status as TaskTicketStatus,
    checkedAt: row.completed_at as string | null,
    reminderEndAt: (row.reminder_end_at as string | null | undefined) ?? null,
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
        rr.id AS reminder_rule_id,
        r.repeat_type,
        r.repeat_days,
        r.starts_on
      FROM task_templates t
      INNER JOIN recurrence_rules r ON r.template_id = t.id
      LEFT JOIN reminder_rules rr ON rr.template_id = t.id AND rr.is_active = 1
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
          id, template_id, recurrence_rule_id, reminder_rule_id, task_date, status, opened_at, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        createId('ticket'),
        row.template_id,
        row.recurrence_rule_id,
        row.reminder_rule_id ?? null,
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
        ${taskItemSelectColumns},
        NULL AS reminder_end_at
      FROM task_tickets tt
      INNER JOIN task_templates t ON t.id = tt.template_id
      INNER JOIN recurrence_rules r ON r.id = tt.recurrence_rule_id
      WHERE tt.task_date = ?
      ORDER BY tt.status ASC, t.title ASC
    `,
    [dateKey]
  );

  // 날짜 상세 화면에서는 바로 렌더링할 수 있는 형태로 변환해서 반환한다.
  return rows.map(mapRowToTodayTaskItem).sort(sortItems);
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
        ${taskItemSelectColumns}
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
    result[dateKey].push(mapRowToTodayTaskItem(row));
  }

  for (const dateKey of sortedDateKeys) {
    // 달력 셀과 상세 목록이 같은 정렬 기준을 쓰도록 날짜별로 다시 정렬한다.
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
    'SELECT id, status, opened_at, completed_at FROM task_tickets WHERE id = ?',
    [ticketId]
  );

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  // 시작 시각은 PENDING -> IN_PROGRESS 로 진입할 때만 기록한다.
  const openedAt =
    status === 'PENDING'
      ? null
      : existing.status === 'PENDING' && status === 'IN_PROGRESS'
        ? now
        : (existing.opened_at as string | null);
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

export async function deleteTaskTicket(ticketId: string) {
  const db = await getDatabase();

  await db.runAsync(
    'DELETE FROM task_tickets WHERE id = ?',
    [ticketId]
  );
}

export const getTodayTaskItems = getTaskItemsForDate;
