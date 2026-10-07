import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  adminAuditLog,
  characterMedia,
  characters,
  media,
  series,
  seriesCharacters,
  type Database,
} from '@gachanime/db'
import { rosterImportSchema } from '@gachanime/shared'
import { asc, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { listAdminActions } from '../admin/audit'
import {
  insertDiscordUser,
  resetTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
} from '../test/database'
import {
  createManualCharacter,
  getCharacter,
  listCharacters,
  setCharacterImage,
  updateCharacter,
} from './admin-characters'
import {
  createManualSeries,
  deleteSeries,
  getSeriesDetail,
  listSeries,
  mergeSeries,
  splitSeries,
  updateSeries,
} from './admin-series'
import { deleteUploadedImage, storeUploadedImage } from './images'
import { RarityTable } from './rarities'
import { importRoster } from './roster'
import { rebuildSeriesCharacters, refreshAniListSeries } from './series-maintenance'
import { getCatalogStats } from './stats'

const actor = { actorId: 'admin', ip: '127.0.0.1' }
const listQuery = { page: 1, pageSize: 50 }
const characterQuery = { ...listQuery, sort: 'favourites' as const }

describe.skipIf(!testDatabaseUrl)('admin catalog services (integration)', () => {
  let db: Database
  let close: () => Promise<void>

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'core'))
  })
  afterAll(async () => close())
  beforeEach(async () => {
    await resetTestDatabase(db)
    await insertDiscordUser(db, { id: 'admin', name: 'Admin', discordId: '100000000000000001' })
  })

  /** One AniList series "Titan" (3 media) and one "Solo" (1 media), with characters. */
  async function seedAniList() {
    const table = await RarityTable.load(db)
    const [titan, solo] = await db
      .insert(series)
      .values([
        { slug: 'titan', kind: 'anime', source: 'anilist', title: 'Titan' },
        { slug: 'solo', kind: 'anime', source: 'anilist', title: 'Solo' },
      ])
      .returning()
    const mediaRows = await db
      .insert(media)
      .values([
        { anilistId: 1, seriesId: titan!.id, titleRomaji: 'Titan', popularity: 1000 },
        { anilistId: 2, seriesId: titan!.id, titleRomaji: 'Titan 2', popularity: 800 },
        { anilistId: 3, seriesId: titan!.id, titleRomaji: 'Titan Movie', popularity: 300 },
        { anilistId: 4, seriesId: solo!.id, titleRomaji: 'Solo', popularity: 900 },
      ])
      .returning()
    const people = await db
      .insert(characters)
      .values(
        [
          { anilistId: 10, nameFull: 'Eren', favourites: 60_000, genderClass: 'male' as const },
          { anilistId: 11, nameFull: 'Mikasa', favourites: 4_000, genderClass: 'female' as const },
          {
            anilistId: 12,
            nameFull: 'Movie Guy',
            favourites: 10,
            genderClass: 'unclassified' as const,
          },
          { anilistId: 13, nameFull: 'Solo Hero', favourites: 600, genderClass: 'male' as const },
        ].map((row) => ({
          ...row,
          source: 'anilist' as const,
          imageUrl: `https://img.test/${row.anilistId}.png`,
          rarityId: table.idForFavourites(row.favourites),
        })),
      )
      .returning()
    const [m1, m2, m3, m4] = mediaRows
    const [eren, mikasa, movieGuy, soloHero] = people
    await db.insert(characterMedia).values([
      { characterId: eren!.id, mediaId: m1!.id, role: 'MAIN' },
      { characterId: eren!.id, mediaId: m2!.id, role: 'MAIN' },
      { characterId: mikasa!.id, mediaId: m1!.id, role: 'MAIN' },
      { characterId: movieGuy!.id, mediaId: m3!.id, role: 'SUPPORTING' },
      { characterId: soloHero!.id, mediaId: m4!.id, role: 'MAIN' },
    ])
    await rebuildSeriesCharacters(db, [titan!.id, solo!.id])
    await refreshAniListSeries(db, [titan!.id, solo!.id])
    return {
      titan: titan!,
      solo: solo!,
      media: { m1: m1!, m2: m2!, m3: m3!, m4: m4! },
      eren: eren!,
      mikasa: mikasa!,
      movieGuy: movieGuy!,
      soloHero: soloHero!,
    }
  }

  const membersOf = async (seriesId: number) =>
    (
      await db
        .select({ name: characters.nameFull })
        .from(seriesCharacters)
        .innerJoin(characters, eq(characters.id, seriesCharacters.characterId))
        .where(eq(seriesCharacters.seriesId, seriesId))
        .orderBy(asc(characters.nameFull))
    ).map((row) => row.name)

  it('lists and searches series with counts', async () => {
    const { titan } = await seedAniList()
    const all = await listSeries(db, listQuery)
    expect(all.items.map((item) => [item.slug, item.mediaCount, item.characterCount])).toEqual([
      ['titan', 3, 3],
      ['solo', 1, 1],
    ])
    expect((await listSeries(db, { ...listQuery, search: 'SOL' })).items).toHaveLength(1)
    expect((await listSeries(db, { ...listQuery, search: '100%' })).items).toHaveLength(0)

    const detail = await getSeriesDetail(db, titan.id)
    expect(detail.media.map((item) => item.titleRomaji)).toEqual([
      'Titan',
      'Titan 2',
      'Titan Movie',
    ])
    expect(detail.rarityCounts).toEqual({ mythic: 1, epic: 1, common: 1 })
  })

  it('toggles a series and refuses content edits on AniList series', async () => {
    const { titan } = await seedAniList()
    await updateSeries(db, titan.id, { isActive: false }, actor)
    expect(
      (await listSeries(db, { ...listQuery, active: false })).items.map((item) => item.id),
    ).toEqual([titan.id])
    await expect(updateSeries(db, titan.id, { title: 'Nope' }, actor)).rejects.toMatchObject({
      code: 'NOT_MANUAL_ENTRY',
    })
    const audit = await db.select().from(adminAuditLog)
    expect(audit.map((row) => row.action)).toEqual(['series.deactivate'])
    expect(audit[0]).toMatchObject({
      actorId: 'admin',
      targetId: String(titan.id),
      ip: '127.0.0.1',
    })

    const stats = await getCatalogStats(db)
    expect(stats.totals).toMatchObject({ characters: 4, drawable: 1, series: 2, activeSeries: 1 })
    expect(stats.rarities.map((rarity) => [rarity.key, rarity.characterCount])).toEqual([
      ['common', 1],
      ['rare', 1],
      ['epic', 1],
      ['legendary', 0],
      ['mythic', 1],
    ])
  })

  it('splits then merges AniList series and rebuilds memberships', async () => {
    const { titan, media: m } = await seedAniList()
    const { id: movieSeries } = await splitSeries(db, titan.id, { mediaIds: [m.m3.id] }, actor)
    expect(await membersOf(titan.id)).toEqual(['Eren', 'Mikasa'])
    expect(await membersOf(movieSeries)).toEqual(['Movie Guy'])
    const [created] = await db.select().from(series).where(eq(series.id, movieSeries))
    expect(created).toMatchObject({
      slug: 'titan-movie',
      title: 'Titan Movie',
      primaryMediaId: m.m3.id,
    })

    await expect(
      splitSeries(db, titan.id, { mediaIds: [m.m1.id, m.m2.id] }, actor),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    await expect(splitSeries(db, titan.id, { mediaIds: [m.m4.id] }, actor)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })

    await mergeSeries(db, { targetId: titan.id, sourceIds: [movieSeries] }, actor)
    expect(await membersOf(titan.id)).toEqual(['Eren', 'Mikasa', 'Movie Guy'])
    expect(await db.select().from(series).where(eq(series.id, movieSeries))).toHaveLength(0)
  })

  it('refuses to merge series from different sources', async () => {
    const { titan } = await seedAniList()
    const { id } = await createManualSeries(
      db,
      { slug: 'genshin', title: 'Genshin', kind: 'game' },
      actor,
    )
    await expect(
      mergeSeries(db, { targetId: titan.id, sourceIds: [id] }, actor),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('deletes a series with its media but keeps characters', async () => {
    const { solo, soloHero } = await seedAniList()
    await deleteSeries(db, solo.id, actor)
    expect(await db.select().from(media).where(eq(media.seriesId, solo.id))).toHaveLength(0)
    expect(await db.select().from(characters).where(eq(characters.id, soloHero.id))).toHaveLength(1)
  })

  it('overrides and restores rarity and gender', async () => {
    const { mikasa, movieGuy } = await seedAniList()
    await updateCharacter(db, mikasa.id, { rarity: 'mythic' }, actor)
    expect(await getCharacter(db, mikasa.id)).toMatchObject({
      rarityKey: 'mythic',
      rarityOverridden: true,
      defaultRarityKey: 'epic',
    })
    await updateCharacter(db, mikasa.id, { rarity: null }, actor)
    expect(await getCharacter(db, mikasa.id)).toMatchObject({
      rarityKey: 'epic',
      rarityOverridden: false,
    })

    const unclassified = await listCharacters(db, { ...characterQuery, gender: 'unclassified' })
    expect(unclassified.items.map((item) => item.nameFull)).toEqual(['Movie Guy'])
    await updateCharacter(db, movieGuy.id, { genderOverride: 'male' }, actor)
    expect((await listCharacters(db, { ...characterQuery, gender: 'unclassified' })).total).toBe(0)

    await expect(updateCharacter(db, mikasa.id, { nameFull: 'X' }, actor)).rejects.toMatchObject({
      code: 'NOT_MANUAL_ENTRY',
    })
    const audit = await listAdminActions(db, { page: 1, pageSize: 10, targetType: 'character' })
    expect(audit.total).toBe(3)
    expect(audit.items[0]).toMatchObject({
      actorName: 'Admin',
      before: { genderOverride: null },
      after: { genderOverride: 'male' },
    })
  })

  it('filters characters by series, rarity and search', async () => {
    const { titan } = await seedAniList()
    const inTitan = await listCharacters(db, { ...characterQuery, seriesId: titan.id })
    expect(inTitan.items.map((item) => item.nameFull)).toEqual(['Eren', 'Mikasa', 'Movie Guy'])
    expect(inTitan.items[0]).toMatchObject({
      roles: ['MAIN'],
      series: [{ id: titan.id, title: 'Titan' }],
      imageUrl: 'https://img.test/10.png',
    })
    expect(
      (await listCharacters(db, { ...characterQuery, rarity: 'rare' })).items[0]?.nameFull,
    ).toBe('Solo Hero')
    expect((await listCharacters(db, { ...characterQuery, search: 'mika' })).total).toBe(1)
    expect(
      (
        await listCharacters(db, { ...characterQuery, sort: 'name', pageSize: 2, page: 2 })
      ).items.map((item) => item.nameFull),
    ).toEqual(['Movie Guy', 'Solo Hero'])
  })

  it('imports a roster idempotently', async () => {
    const roster = rosterImportSchema.parse({
      series: { slug: 'genshin-impact', title: 'Genshin Impact' },
      characters: [
        { key: 'lumine', name: 'Lumine', gender: 'female', rarity: 'legendary' },
        { key: 'paimon', name: 'Paimon' },
      ],
    })
    const first = await importRoster(db, roster, actor)
    expect(first).toMatchObject({ created: 2, updated: 0 })

    const [paimon] = await db
      .select()
      .from(characters)
      .where(eq(characters.manualKey, 'genshin-impact/paimon'))
    await updateCharacter(db, paimon!.id, { rarity: 'epic' }, actor)

    const second = await importRoster(
      db,
      rosterImportSchema.parse({
        ...roster,
        characters: [
          { key: 'lumine', name: 'Lumine (Traveler)', gender: 'female', rarity: 'mythic' },
          { key: 'paimon', name: 'Paimon' },
          { key: 'venti', name: 'Venti' },
        ],
      }),
      actor,
    )
    expect(second).toMatchObject({ seriesId: first.seriesId, created: 1, updated: 2 })
    const members = await listCharacters(db, {
      ...characterQuery,
      seriesId: first.seriesId,
      sort: 'name',
    })
    expect(
      members.items.map((item) => [item.nameFull, item.rarityKey, item.rarityOverridden]),
    ).toEqual([
      ['Lumine (Traveler)', 'mythic', false],
      ['Paimon', 'epic', false],
      ['Venti', 'common', false],
    ])
  })

  it('refuses a roster for an AniList slug or with an unknown rarity', async () => {
    await seedAniList()
    const onAniList = rosterImportSchema.parse({
      series: { slug: 'titan', title: 'T' },
      characters: [],
    })
    await expect(importRoster(db, onAniList, actor)).rejects.toMatchObject({
      code: 'NOT_MANUAL_ENTRY',
    })
    const badRarity = rosterImportSchema.parse({
      series: { slug: 'game', title: 'Game' },
      characters: [{ key: 'a', name: 'A', rarity: 'divine' }],
    })
    await expect(importRoster(db, badRarity, actor)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
  })

  it('creates manual characters only in manual series', async () => {
    const { titan } = await seedAniList()
    const { id: gameId } = await createManualSeries(
      db,
      { slug: 'game', title: 'Game', kind: 'game' },
      actor,
    )
    const { id } = await createManualCharacter(
      db,
      { seriesId: gameId, nameFull: 'Hero', gender: 'female', rarity: 'rare' },
      actor,
    )
    expect(await getCharacter(db, id)).toMatchObject({
      source: 'manual',
      rarityKey: 'rare',
      genderClass: 'female',
      defaultRarityKey: null,
      series: [{ id: gameId, title: 'Game' }],
    })
    await updateCharacter(
      db,
      id,
      { nameFull: 'Heroine', rarity: null, genderOverride: null },
      actor,
    )
    expect(await getCharacter(db, id)).toMatchObject({
      nameFull: 'Heroine',
      rarityKey: 'common',
      genderClass: 'unclassified',
    })
    await expect(
      createManualCharacter(db, { seriesId: titan.id, nameFull: 'X', gender: 'male' }, actor),
    ).rejects.toMatchObject({ code: 'NOT_MANUAL_ENTRY' })
    await expect(
      createManualSeries(db, { slug: 'game', title: 'Again', kind: 'game' }, actor),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('stores uploaded images as resized WebP files', async () => {
    const { eren } = await seedAniList()
    const uploads = await mkdtemp(join(tmpdir(), 'gachanime-uploads-'))
    try {
      const png = await sharp({
        create: { width: 1200, height: 1600, channels: 3, background: '#ff5d8f' },
      })
        .png()
        .toBuffer()
      const path = await storeUploadedImage(uploads, 'characters', eren.id, png)
      expect(path).toMatch(new RegExp(`^characters/${eren.id}-[0-9a-f]{8}\\.webp$`))
      const metadata = await sharp(await readFile(join(uploads, path))).metadata()
      expect(metadata).toMatchObject({ format: 'webp', width: 460 })

      expect(await setCharacterImage(db, eren.id, path, actor)).toEqual({ previousPath: null })
      expect((await getCharacter(db, eren.id)).imageUrl).toBe(`/media/${path}`)

      await deleteUploadedImage(uploads, path)
      await expect(stat(join(uploads, path))).rejects.toThrow()
      await expect(
        storeUploadedImage(uploads, 'characters', 1, new TextEncoder().encode('not an image')),
      ).rejects.toMatchObject({ code: 'INVALID_IMAGE' })
    } finally {
      await rm(uploads, { recursive: true, force: true })
    }
  })
})
