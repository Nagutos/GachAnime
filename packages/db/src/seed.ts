import { defaultSettingValue, settingsSchemas, type SettingKey } from '@gachanime/shared'
import type { Executor } from './client'
import { rarities, settings } from './schema'

/** Default rarities (GAME_DESIGN §1). Thresholds are absolute AniList favourites (ADR-015). */
export const DEFAULT_RARITIES = [
  {
    key: 'common',
    sortOrder: 1,
    name: { en: 'Common', fr: 'Commune' },
    colorToken: 'common',
    favouritesThreshold: 0,
  },
  {
    key: 'rare',
    sortOrder: 2,
    name: { en: 'Rare', fr: 'Rare' },
    colorToken: 'rare',
    favouritesThreshold: 500,
  },
  {
    key: 'epic',
    sortOrder: 3,
    name: { en: 'Epic', fr: 'Épique' },
    colorToken: 'epic',
    favouritesThreshold: 3_000,
  },
  {
    key: 'legendary',
    sortOrder: 4,
    name: { en: 'Legendary', fr: 'Légendaire' },
    colorToken: 'legendary',
    favouritesThreshold: 15_000,
  },
  {
    key: 'mythic',
    sortOrder: 5,
    name: { en: 'Mythic', fr: 'Mythique' },
    colorToken: 'mythic',
    favouritesThreshold: 50_000,
  },
] as const

/** Idempotent seed: inserts missing default rows, never overwrites admin changes. */
export async function seed(db: Executor): Promise<void> {
  const keys = Object.keys(settingsSchemas) as SettingKey[]
  await db
    .insert(settings)
    .values(keys.map((key) => ({ key, value: defaultSettingValue(key) })))
    .onConflictDoNothing()
  await db
    .insert(rarities)
    .values(DEFAULT_RARITIES.map((rarity) => ({ ...rarity, name: { ...rarity.name } })))
    .onConflictDoNothing()
}
