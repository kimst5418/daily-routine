import { getDatabase } from './database';
import { createId } from '../lib/id';
import type { ReminderRule } from '../domain/types';

type CreateReminderRuleInput = {
  templateId: string;
  delayMinutes: number;
  message: string;
  repeatIntervalMinutes?: number | null;
};

function mapRowToReminderRule(row: any): ReminderRule {
  return {
    id: row.id,
    templateId: row.template_id,
    delayMinutes: row.delay_minutes,
    message: row.message,
    repeatIntervalMinutes: row.repeat_interval_minutes,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listReminderRules() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM reminder_rules WHERE is_active = 1 ORDER BY created_at ASC'
  );

  return rows.map(mapRowToReminderRule);
}

export async function createReminderRule(input: CreateReminderRuleInput) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const existing = await db.getFirstAsync<any>(
    'SELECT id FROM reminder_rules WHERE template_id = ? AND is_active = 1',
    [input.templateId]
  );

  if (existing) {
    throw new Error('ONLY_ONE_REMINDER_RULE_PER_TASK');
  }

  const rule: ReminderRule = {
    id: createId('rule'),
    templateId: input.templateId,
    delayMinutes: input.delayMinutes,
    message: input.message.trim(),
    repeatIntervalMinutes: input.repeatIntervalMinutes ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `
      INSERT INTO reminder_rules (
        id,
        template_id,
        delay_minutes,
        message,
        repeat_interval_minutes,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      rule.id,
      rule.templateId,
      rule.delayMinutes,
      rule.message,
      rule.repeatIntervalMinutes ?? null,
      1,
      rule.createdAt,
      rule.updatedAt,
    ]
  );

  return rule;
}

export async function deactivateReminderRule(ruleId: string) {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE reminder_rules SET is_active = 0, updated_at = ? WHERE id = ?',
    [new Date().toISOString(), ruleId]
  );
}

export async function deactivateReminderRulesByTask(taskId: string) {
  const db = await getDatabase();
  const updatedAt = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE reminder_rules
      SET is_active = 0, updated_at = ?
      WHERE is_active = 1 AND template_id = ?
    `,
    [updatedAt, taskId]
  );
}
