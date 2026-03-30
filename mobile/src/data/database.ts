import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('routine-check-v2.db');
  }

  return dbPromise;
}

export async function initializeDatabase() {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS task_templates (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      memo TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurrence_rules (
      id TEXT PRIMARY KEY NOT NULL,
      template_id TEXT NOT NULL,
      repeat_type TEXT NOT NULL,
      repeat_days TEXT NOT NULL,
      starts_on TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_tickets (
      id TEXT PRIMARY KEY NOT NULL,
      template_id TEXT NOT NULL,
      recurrence_rule_id TEXT NOT NULL,
      reminder_rule_id TEXT,
      task_date TEXT NOT NULL,
      status TEXT NOT NULL,
      opened_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(recurrence_rule_id, task_date)
    );

    CREATE TABLE IF NOT EXISTS reminder_rules (
      id TEXT PRIMARY KEY NOT NULL,
      template_id TEXT NOT NULL,
      delay_minutes INTEGER NOT NULL DEFAULT 60,
      message TEXT NOT NULL,
      repeat_interval_minutes INTEGER,
      max_alert_count INTEGER NOT NULL DEFAULT 5,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminder_events (
      id TEXT PRIMARY KEY NOT NULL,
      rule_id TEXT NOT NULL,
      task_ticket_id TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      repeat_interval_minutes INTEGER,
      max_alert_count INTEGER,
      notification_request_ids TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);

  const taskTicketColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(task_tickets)');
  const hasDismissedAt = taskTicketColumns.some((column) => column.name === 'dismissed_at');
  const hasReminderRuleId = taskTicketColumns.some((column) => column.name === 'reminder_rule_id');

  if (hasDismissedAt || !hasReminderRuleId) {
    const reminderRuleSource = hasReminderRuleId
      ? 'tt.reminder_rule_id'
      : `(SELECT rr.id FROM reminder_rules rr WHERE rr.template_id = tt.template_id AND rr.is_active = 1 LIMIT 1)`;
    const dismissedFilter = hasDismissedAt ? "WHERE tt.dismissed_at IS NULL OR tt.dismissed_at = ''" : '';

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS task_tickets_new (
        id TEXT PRIMARY KEY NOT NULL,
        template_id TEXT NOT NULL,
        recurrence_rule_id TEXT NOT NULL,
        reminder_rule_id TEXT,
        task_date TEXT NOT NULL,
        status TEXT NOT NULL,
        opened_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(recurrence_rule_id, task_date)
      );

      INSERT INTO task_tickets_new (
        id, template_id, recurrence_rule_id, reminder_rule_id, task_date, status, opened_at, completed_at, created_at, updated_at
      )
      SELECT
        tt.id,
        tt.template_id,
        tt.recurrence_rule_id,
        ${reminderRuleSource},
        tt.task_date,
        tt.status,
        tt.opened_at,
        tt.completed_at,
        tt.created_at,
        tt.updated_at
      FROM task_tickets tt
      ${dismissedFilter};

      DROP TABLE task_tickets;
      ALTER TABLE task_tickets_new RENAME TO task_tickets;
    `);
  }

  const reminderRuleColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(reminder_rules)'
  );
  if (!reminderRuleColumns.some((column) => column.name === 'max_alert_count')) {
    await db.execAsync(`
      ALTER TABLE reminder_rules
      ADD COLUMN max_alert_count INTEGER NOT NULL DEFAULT 5;
    `);
  }

  const reminderEventColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(reminder_events)'
  );
  const hasNotificationRequestIds = reminderEventColumns.some(
    (column) => column.name === 'notification_request_ids'
  );
  const hasLegacyReminderEventColumns =
    reminderEventColumns.some((column) => column.name === 'status') ||
    reminderEventColumns.some((column) => column.name === 'sent_at') ||
    reminderEventColumns.some((column) => column.name === 'sent_count') ||
    reminderEventColumns.some((column) => column.name === 'completed_at') ||
    reminderEventColumns.some((column) => column.name === 'notification_request_id');

  if (!hasNotificationRequestIds || hasLegacyReminderEventColumns) {
    const requestIdsSource = hasNotificationRequestIds
      ? 're.notification_request_ids'
      : `CASE
          WHEN re.notification_request_id IS NULL OR re.notification_request_id = '' THEN '[]'
          ELSE json_array(re.notification_request_id)
        END`;
    const maxAlertCountSource = reminderEventColumns.some((column) => column.name === 'max_alert_count')
      ? 're.max_alert_count'
      : 'NULL';

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS reminder_events_new (
        id TEXT PRIMARY KEY NOT NULL,
        rule_id TEXT NOT NULL,
        task_ticket_id TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        repeat_interval_minutes INTEGER,
        max_alert_count INTEGER,
        notification_request_ids TEXT NOT NULL DEFAULT '[]'
      );

      INSERT INTO reminder_events_new (
        id, rule_id, task_ticket_id, scheduled_at, repeat_interval_minutes, max_alert_count, notification_request_ids
      )
      SELECT
        re.id,
        re.rule_id,
        re.task_ticket_id,
        re.scheduled_at,
        re.repeat_interval_minutes,
        ${maxAlertCountSource},
        ${requestIdsSource}
      FROM reminder_events re;

      DROP TABLE reminder_events;
      ALTER TABLE reminder_events_new RENAME TO reminder_events;
    `);
  }

}
