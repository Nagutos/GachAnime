import { createImportJob } from '@gachanime/core'
import {
  characterMedia,
  characters,
  importJobs,
  media,
  mediaTags,
  rarities,
  series,
  seriesCharacters,
  type Database,
} from '@gachanime/db'
import { resetTestDatabase, setupTestDatabase, testDatabaseUrl } from '@gachanime/db/testing'
import { importParamsSchema } from '@gachanime/shared'
import { asc, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AniListError } from './anilist/client'
import { runImportJob } from './pipeline'
import { FakeAniList, fakeCharacter, type FakeMedia } from './test/fake-anilist'

const PLACEHOLDER = 'https://s4.anilist.co/file/anilistcdn/character/large/default.jpg'

function world(): FakeMedia[] {
  const titanCharacters = Array.from({ length: 30 }, (_, index) => {
    const id = index + 1
    const overrides =
      id === 1
        ? { favourites: 60_000 }
        : id === 2
          ? { favourites: 4_000 }
          : id === 5
            ? { image: { large: PLACEHOLDER } }
            : {}
    return {
      character: fakeCharacter(id, overrides),
      role: id <= 3 ? 'MAIN' : 'BACKGROUND',
    } as const
  })
  return [
    {
      id: 100,
      title: 'Titan Season 1',
      popularity: 1000,
      relations: [
        { id: 101, type: 'ANIME', relationType: 'SEQUEL' },
        { id: 900, type: 'MANGA', relationType: 'ADAPTATION' },
      ],
      characters: titanCharacters,
    },
    {
      id: 101,
      title: 'Titan Season 2',
      popularity: 800,
      relations: [
        { id: 100, type: 'ANIME', relationType: 'PREQUEL' },
        { id: 102, type: 'ANIME', relationType: 'SIDE_STORY' },
      ],
      characters: [
        ...titanCharacters.slice(0, 3),
        { character: fakeCharacter(31), role: 'SUPPORTING' },
      ],
    },
    {
      id: 102,
      title: 'Titan Movie',
      popularity: 300,
      format: 'MOVIE',
      relations: [{ id: 101, type: 'ANIME', relationType: 'PARENT' }],
      characters: [{ character: fakeCharacter(32), role: 'MAIN' }],
    },
    {
      id: 200,
      title: 'Solo Show',
      popularity: 900,
      relations: [{ id: 201, type: 'ANIME', relationType: 'ALTERNATIVE', isAdult: true }],
      characters: [
        { character: fakeCharacter(40), role: 'MAIN' },
        { character: fakeCharacter(41), role: 'MAIN' },
        { character: fakeCharacter(42, { gender: null }), role: 'SUPPORTING' },
      ],
    },
    { id: 201, title: 'Adult Show', popularity: 50, isAdult: true, characters: [] },
    { id: 300, title: 'Music Video', popularity: 700, format: 'MUSIC', characters: [] },
  ]
}

describe.skipIf(!testDatabaseUrl)('AniList import pipeline (integration)', () => {
  let db: Database
  let close: () => Promise<void>

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'importer'))
  })
  afterAll(async () => close())
  beforeEach(async () => resetTestDatabase(db))

  async function importTop(anilist: FakeAniList, top = 3) {
    const job = await createImportJob(db, {
      params: importParamsSchema.parse({ mode: 'top', top }),
      actorId: null,
    })
    const outcome = await runImportJob({ db, client: anilist.client() }, job.id)
    return { jobId: job.id, outcome }
  }

  const seriesRows = () =>
    db
      .select({
        id: series.id,
        slug: series.slug,
        title: series.title,
        popularity: series.popularity,
      })
      .from(series)
      .orderBy(asc(series.id))

  const rarityOf = async (anilistId: number) => {
    const [row] = await db
      .select({ key: rarities.key, overridden: characters.rarityOverridden })
      .from(characters)
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .where(eq(characters.anilistId, anilistId))
    return row
  }

  it('imports franchises as series with their characters', async () => {
    const anilist = new FakeAniList(world(), [100, 200, 300])
    const { jobId, outcome } = await importTop(anilist)
    expect(outcome).toBe('completed')

    expect(await seriesRows()).toEqual([
      expect.objectContaining({
        slug: 'titan-season-1',
        title: 'Titan Season 1',
        popularity: 1000,
      }),
      expect.objectContaining({ slug: 'solo-show', title: 'Solo Show', popularity: 900 }),
    ])
    const mediaRows = await db
      .select({ anilistId: media.anilistId, seriesId: media.seriesId })
      .from(media)
      .orderBy(asc(media.anilistId))
    expect(mediaRows.map((row) => row.anilistId)).toEqual([100, 101, 102, 200])
    expect(new Set(mediaRows.slice(0, 3).map((row) => row.seriesId)).size).toBe(1)

    // 30 Titan characters minus the one without picture, + 31, 32 → 31; Solo Show → 3.
    const [{ count }] = (
      await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM characters`)
    ).rows as [{ count: number }]
    expect(count).toBe(34)
    expect(await db.select().from(characters).where(eq(characters.anilistId, 5))).toHaveLength(0)

    const membership = await db.execute<{ slug: string; count: number }>(sql`
      SELECT s.slug, count(*)::int AS count FROM series_characters sc
      JOIN series s ON s.id = sc.series_id GROUP BY s.slug ORDER BY s.slug`)
    expect(membership.rows).toEqual([
      { slug: 'solo-show', count: 3 },
      { slug: 'titan-season-1', count: 31 },
    ])

    expect(await rarityOf(1)).toEqual({ key: 'mythic', overridden: false })
    expect(await rarityOf(2)).toEqual({ key: 'epic', overridden: false })
    expect(await rarityOf(3)).toEqual({ key: 'common', overridden: false })
    const [unclassified] = await db
      .select({ genderClass: characters.genderClass })
      .from(characters)
      .where(eq(characters.anilistId, 42))
    expect(unclassified?.genderClass).toBe('unclassified')
    expect(await db.select().from(mediaTags)).toHaveLength(4)

    // One top page, three discovery levels, then only the 30-character media needs extra pages.
    expect(anilist.count('TopMedia')).toBe(1)
    expect(anilist.count('MediaBatch')).toBe(3)
    expect(anilist.count('MediaCharacters')).toBe(2)

    const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId))
    expect(job).toMatchObject({ status: 'completed', error: null })
    expect(job?.progress).toMatchObject({
      phase: 'done',
      seedCount: 3,
      mediaTotal: 4,
      mediaCharactersDone: 4,
      seriesCreated: 2,
      requests: 6,
    })
  })

  it('is idempotent and keeps admin decisions on re-import', async () => {
    const anilist = new FakeAniList(world(), [100, 200, 300])
    await importTop(anilist)
    const [titan] = await seriesRows()

    // Admin decisions: rarity override on #3, the movie split into its own series.
    const mythic = await db
      .select({ id: rarities.id })
      .from(rarities)
      .where(eq(rarities.key, 'mythic'))
    await db
      .update(characters)
      .set({ rarityId: mythic[0]!.id, rarityOverridden: true })
      .where(eq(characters.anilistId, 3))
    const [split] = await db
      .insert(series)
      .values({ slug: 'titan-movie', kind: 'anime', source: 'anilist', title: 'Titan Movie' })
      .returning({ id: series.id })
    await db.update(media).set({ seriesId: split!.id }).where(eq(media.anilistId, 102))

    // AniList changes: #2 becomes very popular, #4 leaves Season 1, a new season appears.
    const changed = world()
    changed[0]!.characters[1]!.character.favourites = 20_000
    changed[0]!.characters = changed[0]!.characters.filter(({ character }) => character.id !== 4)
    changed[1]!.relations!.push({ id: 103, type: 'ANIME', relationType: 'SEQUEL' })
    changed.push({
      id: 103,
      title: 'Titan Season 3',
      popularity: 600,
      characters: [{ character: fakeCharacter(33), role: 'MAIN' }],
    })
    const second = new FakeAniList(changed, [100, 200, 300])
    expect((await importTop(second)).outcome).toBe('completed')

    const rows = await seriesRows()
    expect(rows.map((row) => row.slug)).toEqual(['titan-season-1', 'solo-show', 'titan-movie'])
    const [season3] = await db
      .select({ seriesId: media.seriesId })
      .from(media)
      .where(eq(media.anilistId, 103))
    expect(season3?.seriesId).toBe(titan!.id)
    const [movie] = await db
      .select({ seriesId: media.seriesId })
      .from(media)
      .where(eq(media.anilistId, 102))
    expect(movie?.seriesId).toBe(split!.id)

    expect(await rarityOf(2)).toEqual({ key: 'legendary', overridden: false })
    expect(await rarityOf(3)).toEqual({ key: 'mythic', overridden: true })

    // #4 is no longer listed in Season 1: appearance removed, character kept.
    const character4 = await db
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.anilistId, 4))
    expect(character4).toHaveLength(1)
    expect(
      await db
        .select()
        .from(characterMedia)
        .where(eq(characterMedia.characterId, character4[0]!.id)),
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(seriesCharacters)
        .where(eq(seriesCharacters.characterId, character4[0]!.id)),
    ).toHaveLength(0)

    const [{ count }] = (
      await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM characters`)
    ).rows as [{ count: number }]
    expect(count).toBe(35)
  })

  it('resumes a failed import without fetching the discovered media again', async () => {
    const anilist = new FakeAniList(world(), [100, 200, 300])
    let fail = true
    anilist.onRequest = (operation, variables) => {
      if (fail && operation === 'MediaCharacters' && variables.page === 2) {
        throw new AniListError('boom', 400)
      }
    }
    const job = await createImportJob(db, {
      params: importParamsSchema.parse({ mode: 'top', top: 3 }),
      actorId: null,
    })
    await expect(runImportJob({ db, client: anilist.client() }, job.id)).rejects.toThrow()
    const [failed] = await db.select().from(importJobs).where(eq(importJobs.id, job.id))
    expect(failed).toMatchObject({
      status: 'failed',
      progress: expect.objectContaining({ phase: 'characters' }),
    })

    fail = false
    anilist.calls.length = 0
    await db.update(importJobs).set({ status: 'queued' }).where(eq(importJobs.id, job.id))
    expect(await runImportJob({ db, client: anilist.client() }, job.id)).toBe('completed')
    expect(anilist.count('MediaBatch')).toBe(0)
    expect(anilist.count('TopMedia')).toBe(0)
    expect(anilist.count('MediaCharacters')).toBe(2)
    const [{ count }] = (
      await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM series_characters`)
    ).rows as [{ count: number }]
    expect(count).toBe(34)
  })

  it('stops when the job is cancelled', async () => {
    const anilist = new FakeAniList(world(), [100, 200, 300])
    let jobId = 0
    anilist.onRequest = async (operation) => {
      if (operation === 'MediaBatch') {
        await db.update(importJobs).set({ status: 'cancelled' }).where(eq(importJobs.id, jobId))
      }
    }
    const job = await createImportJob(db, {
      params: importParamsSchema.parse({ mode: 'top', top: 3 }),
      actorId: null,
    })
    jobId = job.id
    expect(await runImportJob({ db, client: anilist.client() }, job.id)).toBe('cancelled')
    expect(anilist.count('MediaBatch')).toBe(1)
    const [row] = await db.select().from(importJobs).where(eq(importJobs.id, job.id))
    expect(row?.status).toBe('cancelled')
  })

  it('imports explicit ids without following relations', async () => {
    const anilist = new FakeAniList(world(), [])
    const job = await createImportJob(db, {
      params: importParamsSchema.parse({ mode: 'ids', anilistIds: [101], expandFranchise: false }),
      actorId: null,
    })
    expect(await runImportJob({ db, client: anilist.client() }, job.id)).toBe('completed')
    const rows = await seriesRows()
    expect(rows.map((row) => row.slug)).toEqual(['titan-season-2'])
  })
})
