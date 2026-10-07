import { characters, series, seriesCharacters, type Database } from '@gachanime/db'
import type { RosterImport, RosterImportResult } from '@gachanime/shared'
import { eq, sql } from 'drizzle-orm'
import { recordAdminAction } from '../admin/audit'
import { AppError } from '../errors'
import type { AdminActor } from './admin-series'
import { RarityTable } from './rarities'

/**
 * Imports a manual series roster (e.g. a gacha game). Idempotent: the series is matched by slug,
 * characters by `<slug>/<key>`. Characters missing from the file are kept. A character without
 * `rarity` gets the lowest rarity on creation and keeps its rarity on update.
 */
export async function importRoster(
  database: Database,
  roster: RosterImport,
  actor: AdminActor,
): Promise<RosterImportResult> {
  return database.transaction(async (tx) => {
    const table = await RarityTable.load(tx)
    for (const character of roster.characters) {
      if (character.rarity) table.idForKey(character.rarity) // Fails early on unknown keys.
    }

    const [existing] = await tx
      .select()
      .from(series)
      .where(eq(series.slug, roster.series.slug))
      .for('update')
    if (existing && existing.source !== 'manual') {
      throw new AppError('NOT_MANUAL_ENTRY', `Series "${roster.series.slug}" comes from AniList`)
    }
    const values = {
      title: roster.series.title,
      titleEnglish: roster.series.titleEnglish ?? null,
      kind: roster.series.kind,
      description: roster.series.description ?? null,
      coverUrl: roster.series.coverUrl ?? null,
      genres: roster.series.genres,
    }
    const seriesId = existing
      ? (await tx.update(series).set(values).where(eq(series.id, existing.id)).returning())[0]!.id
      : (
          await tx
            .insert(series)
            .values({ ...values, slug: roster.series.slug, source: 'manual' })
            .returning()
        )[0]!.id

    let created = 0
    let updated = 0
    if (roster.characters.length > 0) {
      const rows = await tx
        .insert(characters)
        .values(
          roster.characters.map((character) => ({
            source: 'manual' as const,
            manualKey: `${roster.series.slug}/${character.key}`,
            nameFull: character.name,
            nameNative: character.nameNative ?? null,
            nameAlternatives: character.alternativeNames,
            description: character.description ?? null,
            imageUrl: character.imageUrl ?? null,
            genderClass: character.gender,
            rarityId: table.idForKey(character.rarity ?? table.lowest.key),
            // Marks rows whose rarity comes from the file (used by the update below).
            rarityOverridden: character.rarity !== undefined,
          })),
        )
        .onConflictDoUpdate({
          target: characters.manualKey,
          set: {
            nameFull: sql.raw('excluded.name_full'),
            nameNative: sql.raw('excluded.name_native'),
            nameAlternatives: sql.raw('excluded.name_alternatives'),
            description: sql.raw('excluded.description'),
            imageUrl: sql.raw('excluded.image_url'),
            genderClass: sql.raw('excluded.gender_class'),
            rarityId: sql`CASE WHEN excluded.rarity_overridden THEN excluded.rarity_id ELSE ${characters.rarityId} END`,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: characters.id, inserted: sql<boolean>`(xmax = 0)` })
      // The flag only carried "rarity given" for the upsert: manual rarities are never overrides.
      await tx.execute(sql`UPDATE characters SET rarity_overridden = false
        WHERE id IN ${rows.map((row) => row.id)} AND rarity_overridden`)
      await tx
        .insert(seriesCharacters)
        .values(rows.map((row) => ({ seriesId, characterId: row.id })))
        .onConflictDoNothing()
      created = rows.filter((row) => row.inserted).length
      updated = rows.length - created
    }

    await recordAdminAction(tx, {
      ...actor,
      action: 'series.roster_import',
      targetType: 'series',
      targetId: String(seriesId),
      after: { slug: roster.series.slug, created, updated },
    })
    return { seriesId, created, updated }
  })
}
