import { characters, series, type Database } from '@gachanime/db'
import { IMAGE_UPLOAD_MAX_BYTES } from '@gachanime/shared'
import { and, asc, eq, gt, isNotNull, isNull } from 'drizzle-orm'
import { getSetting } from '../settings'
import { deleteUploadedImage, storeUploadedImage, type ImageKind } from './images'

/** Cached copies live under this prefix of the uploads directory (see migration 0009). */
export const IMAGE_CACHE_PREFIX = 'cache/'

export type ImageFetcher = (url: string) => Promise<Uint8Array>

/** Downloads a remote image with a timeout and the upload size limit. */
export const fetchRemoteImage: ImageFetcher = async (url) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { 'user-agent': 'GachAnime image cache' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > IMAGE_UPLOAD_MAX_BYTES) throw new Error('Image too large')
  return new Uint8Array(await response.arrayBuffer())
}

export interface ImageCacheOptions {
  uploadsDir: string
  fetchImage?: ImageFetcher
  /** Rows fetched per query. */
  batchSize?: number
  /** Parallel downloads (kept low: AniList's CDN is a shared resource). */
  concurrency?: number
  /** The run stops after this long; the next scheduled run continues. */
  timeBudgetMs?: number
  now?: () => number
  onError?: (error: unknown, item: { kind: ImageKind; id: number; url: string }) => void
}

export interface ImageCacheResult {
  enabled: boolean
  cached: number
  failed: number
  /** True when the time budget ran out before every image was handled. */
  partial: boolean
}

interface PendingImage {
  id: number
  url: string
}

/** Per kind: how to find images still missing locally and how to record a cached copy. */
const TARGETS = {
  characters: {
    async pending(db: Database, afterId: number, limit: number): Promise<PendingImage[]> {
      const rows = await db
        .select({ id: characters.id, url: characters.imageUrl })
        .from(characters)
        .where(
          and(
            gt(characters.id, afterId),
            isNull(characters.imagePath),
            isNotNull(characters.imageUrl),
            eq(characters.isActive, true),
          ),
        )
        .orderBy(asc(characters.id))
        .limit(limit)
      return rows.flatMap((row) => (row.url ? [{ id: row.id, url: row.url }] : []))
    },
    /** Only if nothing changed meanwhile (admin upload, new remote URL). */
    async record(db: Database, item: PendingImage, path: string): Promise<boolean> {
      const updated = await db
        .update(characters)
        .set({ imagePath: path })
        .where(
          and(
            eq(characters.id, item.id),
            isNull(characters.imagePath),
            eq(characters.imageUrl, item.url),
          ),
        )
        .returning({ id: characters.id })
      return updated.length > 0
    },
  },
  series: {
    async pending(db: Database, afterId: number, limit: number): Promise<PendingImage[]> {
      const rows = await db
        .select({ id: series.id, url: series.coverUrl })
        .from(series)
        .where(
          and(gt(series.id, afterId), isNull(series.coverUploadPath), isNotNull(series.coverUrl)),
        )
        .orderBy(asc(series.id))
        .limit(limit)
      return rows.flatMap((row) => (row.url ? [{ id: row.id, url: row.url }] : []))
    },
    async record(db: Database, item: PendingImage, path: string): Promise<boolean> {
      const updated = await db
        .update(series)
        .set({ coverUploadPath: path })
        .where(
          and(
            eq(series.id, item.id),
            isNull(series.coverUploadPath),
            eq(series.coverUrl, item.url),
          ),
        )
        .returning({ id: series.id })
      return updated.length > 0
    },
  },
} satisfies Record<ImageKind, unknown>

/**
 * Downloads remote catalog images that have no local copy yet (when the `images.cache` setting
 * is on). Idempotent and resumable: each run walks the rows by id until the time budget is spent.
 * Failed downloads are skipped and retried on the next run.
 */
export async function cacheRemoteImages(
  db: Database,
  options: ImageCacheOptions,
): Promise<ImageCacheResult> {
  const { enabled } = await getSetting(db, 'images.cache')
  const result: ImageCacheResult = { enabled, cached: 0, failed: 0, partial: false }
  if (!enabled) return result

  const fetchImage = options.fetchImage ?? fetchRemoteImage
  const batchSize = options.batchSize ?? 100
  const concurrency = options.concurrency ?? 4
  const now = options.now ?? Date.now
  const deadline = now() + (options.timeBudgetMs ?? 4 * 60_000)

  async function cacheOne(kind: ImageKind, item: PendingImage): Promise<void> {
    try {
      const data = await fetchImage(item.url)
      const path = await storeUploadedImage(
        options.uploadsDir,
        kind,
        item.id,
        data,
        IMAGE_CACHE_PREFIX,
      )
      if (await TARGETS[kind].record(db, item, path)) result.cached++
      else await deleteUploadedImage(options.uploadsDir, path)
    } catch (error) {
      result.failed++
      options.onError?.(error, { kind, ...item })
    }
  }

  for (const kind of ['series', 'characters'] as const) {
    let afterId = 0
    for (;;) {
      if (now() >= deadline) {
        result.partial = true
        return result
      }
      const batch = await TARGETS[kind].pending(db, afterId, batchSize)
      if (batch.length === 0) break
      afterId = batch.at(-1)!.id
      for (let start = 0; start < batch.length; start += concurrency) {
        await Promise.all(
          batch.slice(start, start + concurrency).map((item) => cacheOne(kind, item)),
        )
      }
    }
  }
  return result
}
