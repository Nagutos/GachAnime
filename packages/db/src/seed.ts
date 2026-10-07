import { defaultSettingValue, settingsSchemas, type SettingKey } from '@gachanime/shared'
import type { Executor } from './client'
import { settings } from './schema'

/** Idempotent seed: inserts missing default rows, never overwrites admin changes. */
export async function seed(db: Executor): Promise<void> {
  const keys = Object.keys(settingsSchemas) as SettingKey[]
  await db
    .insert(settings)
    .values(keys.map((key) => ({ key, value: defaultSettingValue(key) })))
    .onConflictDoNothing()
}
