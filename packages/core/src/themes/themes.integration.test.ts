import {
  anilistTags,
  boosterOpenings,
  characterMedia,
  characters,
  media,
  mediaTags,
  series,
  seriesCharacters,
  themeCharacters,
  themes,
  type Database,
} from '@gachanime/db'
import { seededRng } from '@gachanime/game'
import { collectionQuerySchema, type ThemeRule } from '@gachanime/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { listBoosters, openBoosters } from '../boosters/boosters'
import { RarityTable } from '../catalog/rarities'
import { adjustGems } from '../players/gems'
import { listCollection } from '../players/collection'
import { ensurePlayerProfile } from '../players/profile'
import {
  insertDiscordUser,
  resetTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
} from '../test/database'
import { createTheme, deleteTheme, listAdminThemes, updateTheme } from './admin'
import { previewTheme, rebuildThemePool } from './pools'

const actor = { actorId: 'admin', ip: null }
const NOW = new Date('2026-10-07T12:00:00Z')
const group = (...rules: ThemeRule[]): ThemeRule => ({ type: 'group', mode: 'all', rules })
const any = (...rules: ThemeRule[]): ThemeRule => ({ type: 'group', mode: 'any', rules })

describe.skipIf(!testDatabaseUrl)('themed packs (integration)', () => {
  let db: Database
  let close: () => Promise<void>
  const ids: Record<string, number> = {}
  const seriesIds: Record<string, number> = {}

  async function addSeries(input: {
    slug: string
    kind?: 'anime' | 'game'
    genres?: string[]
    isActive?: boolean
    media?: { anilistId: number; format: string; genres: string[]; tags: [string, number][] }
    members: { name: string; rarity: string; gender: 'female' | 'male' | 'unclassified' }[]
  }) {
    const table = await RarityTable.load(db)
    const [row] = await db
      .insert(series)
      .values({
        slug: input.slug,
        title: input.slug,
        kind: input.kind ?? 'anime',
        source: input.media ? 'anilist' : 'manual',
        genres: input.genres ?? [],
        isActive: input.isActive ?? true,
      })
      .returning({ id: series.id })
    seriesIds[input.slug] = row!.id
    let mediaId: number | null = null
    if (input.media) {
      const [m] = await db
        .insert(media)
        .values({
          anilistId: input.media.anilistId,
          seriesId: row!.id,
          titleRomaji: input.slug,
          format: input.media.format,
          genres: input.media.genres,
        })
        .returning({ id: media.id })
      mediaId = m!.id
      for (const [tag, rank] of input.media.tags) {
        const [t] = await db
          .insert(anilistTags)
          .values({ anilistId: 1000 + tag.length * 7 + rank, name: tag })
          .onConflictDoNothing()
          .returning({ id: anilistTags.id })
        const tagId =
          t?.id ?? (await db.query.anilistTags.findFirst({ where: eq(anilistTags.name, tag) }))!.id
        await db.insert(mediaTags).values({ mediaId, tagId, rank })
      }
    }
    for (const member of input.members) {
      const [c] = await db
        .insert(characters)
        .values({
          source: 'manual',
          manualKey: `${input.slug}/${member.name}`,
          nameFull: member.name,
          rarityId: table.idForKey(member.rarity),
          genderClass: member.gender,
        })
        .returning({ id: characters.id })
      ids[member.name] = c!.id
      await db.insert(seriesCharacters).values({ seriesId: row!.id, characterId: c!.id })
      if (mediaId) {
        await db.insert(characterMedia).values({ characterId: c!.id, mediaId, role: 'MAIN' })
      }
    }
  }

  async function poolNames(rules: ThemeRule): Promise<string[]> {
    const [theme] = await db
      .insert(themes)
      .values({
        key: `t${Date.now()}${Math.random()}`.replace('.', ''),
        category: 'custom',
        name: { en: 'T' },
        rules,
      })
      .returning({ id: themes.id })
    await db.transaction((tx) => rebuildThemePool(tx, theme!.id))
    const rows = await db
      .select({ name: characters.nameFull })
      .from(themeCharacters)
      .innerJoin(characters, eq(characters.id, themeCharacters.characterId))
      .where(eq(themeCharacters.themeId, theme!.id))
    return rows.map((row) => row.name).sort()
  }

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'core'))
  })
  afterAll(async () => close())
  beforeEach(async () => {
    await resetTestDatabase(db)
    await insertDiscordUser(db, { id: 'admin', name: 'Admin', discordId: '500000000000000001' })
    await insertDiscordUser(db, { id: 'p1', name: 'Player', discordId: '500000000000000002' })
    await ensurePlayerProfile(db, { userId: 'p1', displayName: 'Player' })
    await addSeries({
      slug: 'hero-academy',
      media: { anilistId: 1, format: 'TV', genres: ['Action'], tags: [['Shounen', 80]] },
      members: [
        { name: 'Hero', rarity: 'epic', gender: 'male' },
        { name: 'Heroine', rarity: 'rare', gender: 'female' },
      ],
    })
    await addSeries({
      slug: 'court-kings',
      media: { anilistId: 2, format: 'MOVIE', genres: ['Sports'], tags: [['Shounen', 40]] },
      members: [{ name: 'Captain', rarity: 'common', gender: 'male' }],
    })
    await addSeries({
      slug: 'tennis-game',
      kind: 'game',
      genres: ['Sports'],
      members: [{ name: 'Ace', rarity: 'legendary', gender: 'female' }],
    })
    await addSeries({
      slug: 'hidden',
      isActive: false,
      genres: ['Sports'],
      members: [{ name: 'Ghost', rarity: 'common', gender: 'female' }],
    })
  })

  it('evaluates each rule type on drawable characters only', async () => {
    expect(await poolNames(group({ type: 'tag', tag: 'shounen', minRank: 60 }))).toEqual([
      'Hero',
      'Heroine',
    ])
    expect(await poolNames(group({ type: 'genre', genre: 'Sports' }))).toEqual(['Ace', 'Captain'])
    expect(await poolNames(group({ type: 'gender', gender: 'female' }))).toEqual(['Ace', 'Heroine'])
    expect(await poolNames(group({ type: 'series_kind', kind: 'game' }))).toEqual(['Ace'])
    expect(await poolNames(group({ type: 'media_format', format: 'MOVIE' }))).toEqual(['Captain'])
    expect(
      await poolNames(group({ type: 'series', seriesIds: [seriesIds['court-kings']!] })),
    ).toEqual(['Captain'])
    expect(
      await poolNames(
        group({ type: 'gender', gender: 'female' }, { type: 'genre', genre: 'Sports' }),
      ),
    ).toEqual(['Ace'])
    expect(
      await poolNames(
        any({ type: 'tag', tag: 'Shounen', minRank: 60 }, { type: 'series_kind', kind: 'game' }),
      ),
    ).toEqual(['Ace', 'Hero', 'Heroine'])
    expect(await poolNames(group())).toEqual(['Ace', 'Captain', 'Hero', 'Heroine'])
    expect(await poolNames(any())).toEqual([])
  })

  it('previews a pack with its empty rarities', async () => {
    const preview = await previewTheme(db, group({ type: 'genre', genre: 'Sports' }))
    expect(preview.total).toBe(2)
    expect(preview.byRarity.find((row) => row.rarityKey === 'legendary')?.count).toBe(1)
    expect(preview.emptyRarities).toEqual(['rare', 'epic', 'mythic'])
    expect(preview.samples.map((sample) => sample.name)).toEqual(['Ace', 'Captain'])
  })

  it('draws only from the pack with free boosters; paid tiers ignore packs', async () => {
    const { id } = await createTheme(
      db,
      {
        key: 'sports-test',
        name: { en: 'Sports test' },
        category: 'genre',
        rules: group({ type: 'genre', genre: 'Sports' }),
        artToken: 'sports',
        seal: '競',
        isActive: true,
        sortOrder: 0,
      },
      actor,
    )
    const free = await openBoosters(
      db,
      'p1',
      { tier: 'free', quantity: 10, theme: 'sports-test' },
      { now: NOW, rng: seededRng(4) },
    )
    expect(free.theme).toBe('sports-test')
    expect(new Set(free.cards.map((card) => card.character.name))).toEqual(
      new Set(['Ace', 'Captain']),
    )

    const openings = await db.select().from(boosterOpenings)
    expect(openings.every((opening) => opening.themeId === id)).toBe(true)

    // Paid tiers: no pack, no surcharge.
    await adjustGems(db, { userId: 'p1', amount: 500, note: 'test' }, actor)
    await expect(
      openBoosters(
        db,
        'p1',
        { tier: 'legendary', quantity: 1, theme: 'sports-test' },
        { now: NOW },
      ),
    ).rejects.toMatchObject({ code: 'THEME_UNAVAILABLE' })
    const paid = await openBoosters(db, 'p1', { tier: 'legendary', quantity: 1 }, { now: NOW })
    expect(paid).toMatchObject({ gemsSpent: 500, gemBalance: 0, theme: null })

    const shop = await listBoosters(db, 'p1', NOW)
    expect(shop.themes.find((theme) => theme.key === 'sports-test')).toMatchObject({
      characterCount: 2,
      seal: '競',
    })

    await updateTheme(db, id, { isActive: false }, actor)
    await expect(
      openBoosters(db, 'p1', { tier: 'free', quantity: 1, theme: 'sports-test' }, { now: NOW }),
    ).rejects.toMatchObject({ code: 'THEME_UNAVAILABLE' })
    await expect(
      openBoosters(db, 'p1', { tier: 'free', quantity: 1, theme: 'nope' }, { now: NOW }),
    ).rejects.toMatchObject({ code: 'THEME_UNAVAILABLE' })

    const collection = await listCollection(
      db,
      'p1',
      collectionQuerySchema.parse({ theme: 'sports-test', sort: 'name' }),
    )
    expect(
      collection.items.every((item) => !item.locked && ['Ace', 'Captain'].includes(item.name)),
    ).toBe(true)

    await deleteTheme(db, id, actor)
    expect(
      (await db.select().from(boosterOpenings)).every((opening) => opening.themeId === null),
    ).toBe(true)
  })

  it('builds the seeded packs on first listing and rebuilds a pack when its rules change', async () => {
    const shop = await listBoosters(db, 'p1', NOW)
    expect(shop.themes.map((theme) => theme.key)).toEqual(
      expect.arrayContaining(['shonen', 'sports', 'waifus', 'husbandos']),
    )
    expect(shop.themes.find((theme) => theme.key === 'shonen')?.characterCount).toBe(2)
    // No seeded pack is left unbuilt, empty ones (shōjo…) are just hidden from the shop.
    expect((await listAdminThemes(db)).every((theme) => theme.poolBuiltAt !== null)).toBe(true)

    const shonen = (await listAdminThemes(db)).find((theme) => theme.key === 'shonen')!
    await updateTheme(
      db,
      shonen.id,
      { rules: group({ type: 'tag', tag: 'Shounen', minRank: 30 }) },
      actor,
    )
    expect(
      (await listAdminThemes(db)).find((theme) => theme.key === 'shonen')?.characterCount,
    ).toBe(3)

    await expect(
      createTheme(
        db,
        {
          key: 'shonen',
          name: { en: 'Again' },
          category: 'custom',
          rules: group(),
          artToken: 'default',
          seal: '招',
          isActive: true,
          sortOrder: 0,
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
