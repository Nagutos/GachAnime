import { createImportJob } from '@gachanime/core'
import {
  characterGames,
  characters,
  igdbGames,
  importJobs,
  rarities,
  series,
  seriesCharacters,
  type Database,
} from '@gachanime/db'
import { resetTestDatabase, setupTestDatabase, testDatabaseUrl } from '@gachanime/db/testing'
import { importParamsSchema } from '@gachanime/shared'
import { asc, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AniListClient } from '../anilist/client'
import { runImportJob } from '../pipeline'
import { FakeIgdb, fakeGame, fakeGameCharacter } from '../test/fake-igdb'

const HYRULE = { id: 7, name: 'Hyrule Saga' }

function world(): FakeIgdb {
  const games = [
    fakeGame(10, { name: 'Hyrule I', total_rating_count: 3000, collections: [HYRULE] }),
    fakeGame(11, { name: 'Hyrule II', total_rating_count: 600, collections: [HYRULE] }),
    fakeGame(12, {
      name: 'Solo Racer',
      total_rating_count: 200,
      genres: [{ id: 3, name: 'Sport' }],
      themes: [{ id: 4, name: 'Science fiction' }],
    }),
    fakeGame(13, { total_rating_count: 5000, themes: [{ id: 5, name: 'Erotic' }] }),
  ]
  const characters = [
    fakeGameCharacter(1, [10, 11]),
    fakeGameCharacter(2, [11]),
    fakeGameCharacter(3, [12], { character_gender: undefined, gender: 1 }),
    fakeGameCharacter(4, [12], { mug_shot: undefined }),
    fakeGameCharacter(5, [13]),
    fakeGameCharacter(6, [10, 999]),
    // More than one page (500) of characters for one game.
    ...Array.from({ length: 501 }, (_, index) => fakeGameCharacter(1000 + index, [12])),
  ]
  return new FakeIgdb(games, characters)
}

describe.skipIf(!testDatabaseUrl)('IGDB import (integration)', () => {
  let db: Database
  let close: () => Promise<void>

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'importer'))
  })
  afterAll(async () => close())
  beforeEach(async () => resetTestDatabase(db))

  async function runJob(params: object, fake: FakeIgdb | null) {
    const job = await createImportJob(db, {
      params: importParamsSchema.parse(params),
      actorId: null,
    })
    const outcome = await runImportJob(
      { db, client: new AniListClient(), igdb: fake?.client() ?? null },
      job.id,
    )
    const [row] = await db.select().from(importJobs).where(eq(importJobs.id, job.id))
    return { outcome, row: row! }
  }

  const rarityOf = async (igdbId: number) => {
    const [row] = await db
      .select({ key: rarities.key, popularity: characters.gamePopularity })
      .from(characters)
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .where(eq(characters.igdbId, igdbId))
    return row
  }

  it('imports the top games into series with their characters and rarities', async () => {
    const fake = world()
    const { outcome, row } = await runJob({ mode: 'igdb_top', top: 10 }, fake)
    expect(outcome).toBe('completed')
    expect(row.progress).toMatchObject({ phase: 'done', mediaTotal: 3, seriesCreated: 2 })

    const allSeries = await db.select().from(series).orderBy(asc(series.title))
    expect(allSeries.map((item) => [item.title, item.igdbKey, item.kind, item.source])).toEqual([
      ['Hyrule Saga', 'collection:7', 'game', 'igdb'],
      ['Solo Racer', 'game:12', 'game', 'igdb'],
    ])
    const hyrule = allSeries[0]!
    expect(hyrule).toMatchObject({ popularity: 3000, coverUrl: expect.stringContaining('cover10') })
    // IGDB names are aligned with AniList ones for genre packs.
    expect(allSeries[1]!.genres).toEqual(['Sci-Fi', 'Sports'])

    // Adult games and characters without a portrait are not imported.
    expect(await db.select().from(igdbGames)).toHaveLength(3)
    const imported = await db.select().from(characters)
    expect(imported.map((item) => item.igdbId)).not.toContain(4)
    expect(imported.map((item) => item.igdbId)).not.toContain(5)
    expect(imported).toHaveLength(4 + 501)

    expect(await rarityOf(1)).toEqual({ key: 'mythic', popularity: 3000 })
    expect(await rarityOf(2)).toEqual({ key: 'epic', popularity: 600 })
    expect(await rarityOf(3)).toEqual({ key: 'rare', popularity: 200 })

    const [heroine] = await db.select().from(characters).where(eq(characters.igdbId, 3))
    expect(heroine).toMatchObject({
      genderRaw: 'Female',
      genderClass: 'female',
      imageUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/mug3.jpg',
      siteUrl: 'https://www.igdb.com/characters/hero-3',
    })

    // Character 1 appears in both Hyrule games, 6 only in the imported one.
    const [{ links }] = (
      await db.execute<{ links: number }>(sql`SELECT count(*)::int AS links FROM character_games`)
    ).rows as [{ links: number }]
    expect(links).toBe(1 + 1 + 1 + 1 + 1 + 501)
    const members = await db
      .select()
      .from(seriesCharacters)
      .where(eq(seriesCharacters.seriesId, hyrule.id))
    expect(members).toHaveLength(3)
  })

  it('re-imports idempotently and keeps rarities set by hand', async () => {
    const fake = world()
    await runJob({ mode: 'igdb_ids', igdbIds: [10, 11] }, fake)
    const common = await db.select().from(rarities).where(eq(rarities.key, 'common'))
    await db
      .update(characters)
      .set({ rarityId: common[0]!.id, rarityOverridden: true })
      .where(eq(characters.igdbId, 1))

    const { outcome } = await runJob({ mode: 'igdb_ids', igdbIds: [10, 11] }, fake)
    expect(outcome).toBe('completed')
    expect(await db.select().from(characters)).toHaveLength(3)
    expect(await db.select().from(series)).toHaveLength(1)
    expect((await rarityOf(1))?.key).toBe('common')
    expect(await db.select().from(characterGames)).toHaveLength(4)
  })

  it('fails with a clear error without IGDB credentials', async () => {
    await expect(runJob({ mode: 'igdb_top', top: 5 }, null)).rejects.toThrow(/IGDB_CLIENT_ID/)
    const [job] = await db.select().from(importJobs)
    expect(job).toMatchObject({ status: 'failed' })
  })
})
