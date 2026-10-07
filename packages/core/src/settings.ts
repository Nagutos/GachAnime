import { settings, type Executor } from '@gachanime/db'
import {
  defaultSettingValue,
  parseSettingValue,
  type SettingKey,
  type SettingValue,
} from '@gachanime/shared'
import { eq } from 'drizzle-orm'

/** Reads a game setting; a missing row falls back to the schema defaults. */
export async function getSetting<K extends SettingKey>(
  db: Executor,
  key: K,
): Promise<SettingValue<K>> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
  return row ? parseSettingValue(key, row.value) : defaultSettingValue(key)
}
