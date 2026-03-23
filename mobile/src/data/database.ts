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
      sent_at TEXT,
      status TEXT NOT NULL,
      repeat_interval_minutes INTEGER,
      max_alert_count INTEGER,
      sent_count INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      notification_request_id TEXT
    );
  `);

  const taskTicketColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(task_tickets)');
  if (taskTicketColumns.some((column) => column.name === 'dismissed_at')) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS task_tickets_new (
        id TEXT PRIMARY KEY NOT NULL,
        template_id TEXT NOT NULL,
        recurrence_rule_id TEXT NOT NULL,
        task_date TEXT NOT NULL,
        status TEXT NOT NULL,
        opened_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(recurrence_rule_id, task_date)
      );

      INSERT INTO task_tickets_new (
        id, template_id, recurrence_rule_id, task_date, status, opened_at, completed_at, created_at, updated_at
      )
      SELECT
        id, template_id, recurrence_rule_id, task_date, status, opened_at, completed_at, created_at, updated_at
      FROM task_tickets
      WHERE dismissed_at IS NULL OR dismissed_at = '';

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
  if (!reminderEventColumns.some((column) => column.name === 'max_alert_count')) {
    await db.execAsync(`
      ALTER TABLE reminder_events
      ADD COLUMN max_alert_count INTEGER;
    `);
  }
  if (!reminderEventColumns.some((column) => column.name === 'sent_count')) {
    await db.execAsync(`
      ALTER TABLE reminder_events
      ADD COLUMN sent_count INTEGER NOT NULL DEFAULT 0;
    `);
  }

}
