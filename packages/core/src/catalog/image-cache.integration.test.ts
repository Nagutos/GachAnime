import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { characters, series, settings, type Database } from '@gachanime/db'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  insertDiscordUser,
  resetTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
} from '../test/database'
import { createManualCharacter, getCharacter, updateCharacter } from './admin-characters'
import { createManualSeries } from './admin-series'
import { cacheRemoteImages, type ImageFetcher } from './image-cache'

const actor = { actorId: 'admin', ip: null }

describe.skipIf(!testDatabaseUrl)('image cache (integration)', () => {
  let db: Database
  let close: () => Promise<void>
  let uploads: string
  let png: Uint8Array
  const fetched: string[] = []
  const fetchImage: ImageFetcher = async (url) => {
    fetched.push(url)
    if (url.includes('broken')) throw new Error('HTTP 404')
    return png
  }

  async function enableCache(enabled: boolean): Promise<void> {
    await db
      .insert(settings)
      .values({ key: 'images.cache', value: { enabled } })
      .onConflictDoUpdate({ target: settings.key, set: { value: { enabled } } })
  }

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'core'))
    png = await sharp({ create: { width: 600, height: 800, channels: 3, background: '#4060ff' } })
      .png()
      .toBuffer()
  })
  afterAll(async () => close())
  beforeEach(async () => {
    await resetTestDatabase(db)
    await insertDiscordUser(db, { id: 'admin', name: 'Admin', discordId: '100000000000000001' })
    uploads = await mkdtemp(join(tmpdir(), 'gachanime-cache-'))
    fetched.length = 0
  })
  afterEach(async () => rm(uploads, { recursive: true, force: true }))

  async function seedCatalog() {
    const { id: seriesId } = await createManualSeries(
      db,
      { slug: 'game', title: 'Game', kind: 'game', coverUrl: 'https://img.example/cover.png' },
      actor,
    )
    const ids: number[] = []
    for (const [name, imageUrl] of [
      ['Alpha', 'https://img.example/a.png'],
      ['Beta', 'https://img.example/broken.png'],
      ['Gamma', 'https://img.example/c.png'],
    ] as const) {
      const { id } = await createManualCharacter(
        db,
        { seriesId, nameFull: name, gender: 'female', imageUrl },
        actor,
      )
      ids.push(id)
    }
    return { seriesId, ids: ids as [number, number, number] }
  }

  it('does nothing while the setting is off', async () => {
    await seedCatalog()
    const result = await cacheRemoteImages(db, { uploadsDir: uploads, fetchImage })
    expect(result).toEqual({ enabled: false, cached: 0, failed: 0, partial: false })
    expect(fetched).toEqual([])
  })

  it('caches missing images, skips failures and serves the local copy', async () => {
    const { seriesId, ids } = await seedCatalog()
    await enableCache(true)
    const result = await cacheRemoteImages(db, {
      uploadsDir: uploads,
      fetchImage,
      batchSize: 2,
      concurrency: 2,
    })
    expect(result).toEqual({ enabled: true, cached: 3, failed: 1, partial: false })

    const alpha = await getCharacter(db, ids[0])
    expect(alpha.imageUrl).toMatch(new RegExp(`^/media/cache/characters/${ids[0]}-\\w+\\.webp$`))
    expect((await getCharacter(db, ids[1])).imageUrl).toBe('https://img.example/broken.png')
    const [cover] = await db.select().from(series).where(eq(series.id, seriesId))
    expect(cover?.coverUploadPath).toMatch(/^cache\/series\//)
    expect(await readdir(join(uploads, 'cache/characters'))).toHaveLength(2)

    // A second run only retries what is still missing.
    fetched.length = 0
    await cacheRemoteImages(db, { uploadsDir: uploads, fetchImage })
    expect(fetched).toEqual(['https://img.example/broken.png'])
  })

  it('drops a cached copy when the remote URL changes, never an uploaded image', async () => {
    const { ids } = await seedCatalog()
    await enableCache(true)
    await cacheRemoteImages(db, { uploadsDir: uploads, fetchImage })

    await updateCharacter(db, ids[0], { imageUrl: 'https://img.example/new.png' }, actor)
    expect((await getCharacter(db, ids[0])).imageUrl).toBe('https://img.example/new.png')

    await db
      .update(characters)
      .set({ imagePath: 'characters/uploaded.webp' })
      .where(eq(characters.id, ids[2]))
    await updateCharacter(db, ids[2], { imageUrl: 'https://img.example/other.png' }, actor)
    expect((await getCharacter(db, ids[2])).imageUrl).toBe('/media/characters/uploaded.webp')
  })

  it('stops at the time budget and reports a partial run', async () => {
    await seedCatalog()
    await enableCache(true)
    let clock = 0
    const result = await cacheRemoteImages(db, {
      uploadsDir: uploads,
      fetchImage,
      batchSize: 1,
      timeBudgetMs: 2,
      now: () => clock++,
    })
    expect(result.partial).toBe(true)
    expect(result.cached).toBeLessThan(3)
  })
})
