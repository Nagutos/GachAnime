import { z } from 'zod'

/**
 * Game settings stored in the `settings` table, one row per key. Each key has a schema with
 * defaults; the defaults are what the seed writes and what is used if a row is missing.
 */
export const settingsSchemas = {
  'boosters.free': z.object({
    intervalSeconds: z.number().int().min(10).default(600),
    maxCharges: z.number().int().min(1).max(1000).default(15),
  }),
  'missions.reset': z.object({
    hour: z.number().int().min(0).max(23).default(0),
    timeZone: z.string().min(1).default('Europe/Paris'),
  }),
} as const

export type SettingKey = keyof typeof settingsSchemas
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingsSchemas)[K]>

export function defaultSettingValue<K extends SettingKey>(key: K): SettingValue<K> {
  return settingsSchemas[key].parse({}) as SettingValue<K>
}

export function parseSettingValue<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  return settingsSchemas[key].parse(value) as SettingValue<K>
}
