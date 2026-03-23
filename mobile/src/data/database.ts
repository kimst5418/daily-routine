import * as SQLite from 'expo-sqlite';
import { addMinutes } from '../lib/time';

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
      repeat_until TEXT,
      completed_at TEXT,
      notification_request_id TEXT
    );
  `);

  const pendingReminderEvents = await db.getAllAsync<{
    id: string;
    scheduled_at: string;
  }>(
    `
      SELECT id, scheduled_at
      FROM reminder_events
      WHERE status = 'PENDING'
    `
  );

  for (const event of pendingReminderEvents) {
    await db.runAsync(
      `
        UPDATE reminder_events
        SET repeat_until = ?
        WHERE id = ?
      `,
      [addMinutes(event.scheduled_at, 24 * 60), event.id]
    );
  }
}
