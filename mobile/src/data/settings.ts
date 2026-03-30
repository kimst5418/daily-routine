import { getDatabase } from './database';
import type { ThemePreference } from '../theme';

const THEME_PREFERENCE_KEY = 'theme_preference';
const themePreferences: ThemePreference[] = ['SYSTEM', 'LIGHT', 'NAVY'];

export async function getThemePreference(): Promise<ThemePreference> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [THEME_PREFERENCE_KEY]
  );

  const value = row?.value ?? 'SYSTEM';

  return themePreferences.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : 'SYSTEM';
}

export async function setThemePreferenceSetting(preference: ThemePreference) {
  const db = await getDatabase();
  await db.runAsync(
    `
      INSERT INTO app_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    [THEME_PREFERENCE_KEY, preference]
  );
}
