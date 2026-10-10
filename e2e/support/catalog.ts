import { users, type Database } from '@gachanime/db'
import { importRoster, updateSetting } from '@gachanime/core'
import { rosterImportSchema } from '@gachanime/shared'

export const E2E_SERIES_TITLE = 'Starlight Academy'

const RARITIES = ['mythic', 'legendary', 'epic', 'epic', 'rare', 'rare', 'rare', 'rare']

/** A small manual series: 20 characters, so a first booster always leaves locked entries. */
export async function seedE2eCatalog(db: Database): Promise<void> {
  const roster = rosterImportSchema.parse({
    series: { slug: 'starlight-academy', title: E2E_SERIES_TITLE, kind: 'game' },
    characters: Array.from({ length: 20 }, (_, index) => ({
      key: `student-${index + 1}`,
      name: `Student ${String(index + 1).padStart(2, '0')}`,
      description: `Student number ${index + 1}.\n\n~!Secretly a star.!~`,
      gender: index % 2 === 0 ? 'female' : 'male',
      rarity: RARITIES[index] ?? 'common',
    })),
  })
  // The roster import is an admin action (audit log): it needs an acting user.
  await db
    .insert(users)
    .values({ id: 'e2e-admin', name: 'E2E admin', email: 'e2e-admin@example.test', role: 'admin' })
    .onConflictDoNothing()
  await importRoster(db, roster, { actorId: 'e2e-admin' })
  // The small catalog gets a weekly pack (its one series: no genre or tag to pick).
  await updateSetting(
    db,
    'boosters.weekly',
    { minCharacters: 5 },
    { actorId: 'e2e-admin', ip: null },
  )
}
