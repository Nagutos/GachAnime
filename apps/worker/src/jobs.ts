import type { Database } from '@gachanime/db'
import {
  cacheRemoteImages,
  expireListings,
  expireTrades,
  rebuildAllThemePools,
  recomputeStateAchievementsForAll,
} from '@gachanime/core'
import { runImportJob, type AniListClient } from '@gachanime/importer'
import type { Logger } from 'pino'
import { z } from 'zod'

/** Name of the single BullMQ queue; jobs are dispatched by name. */
export const QUEUE_NAME = 'gachanime'

export interface JobContext {
  db: Database
  logger: Logger
  anilist: AniListClient
  uploadsDir: string
}

export type JobHandler = (data: unknown, context: JobContext) => Promise<unknown>

const importJobDataSchema = z.object({ importJobId: z.number().int().positive() })

/** BullMQ job id of an import: one queued job per import row. */
/** Every 5 minutes. */
export const SWEEP_INTERVAL_MS = 5 * 60_000

/** Every 15 minutes (each run stops after a few minutes; the next one continues). */
export const IMAGE_CACHE_INTERVAL_MS = 15 * 60_000

export const importBullJobId = (importJobId: number) => `anilist-import-${importJobId}`

/**
 * After a catalog change: pack pools are rebuilt, then series and catalog completion are
 * recomputed for every player.
 */
async function refreshCatalog(db: Database, logger: Logger) {
  const themes = await rebuildAllThemePools(db)
  const achievements = await recomputeStateAchievementsForAll(db)
  logger.info({ themes, ...achievements }, 'catalog refreshed')
  return { themes, ...achievements }
}

/** Job registry. */
export const jobHandlers: Record<string, JobHandler> = {
  'system.ping': async (_data, { logger }) => {
    logger.info('pong')
    return { pong: true }
  },
  'anilist.import': async (data, { db, logger, anilist }) => {
    const { importJobId } = importJobDataSchema.parse(data)
    const outcome = await runImportJob({ db, client: anilist, logger }, importJobId)
    if (outcome === 'completed') await refreshCatalog(db, logger)
    return { outcome }
  },
  'catalog.refresh': async (_data, { db, logger }) => refreshCatalog(db, logger),
  /** Repeated every few minutes: expired listings and trade offers release their cards. */
  'market.sweep': async (_data, { db, logger }) => {
    const result = { listings: await expireListings(db), trades: await expireTrades(db) }
    if (result.listings || result.trades) logger.info(result, 'expired listings and trades')
    return result
  },
  /** Repeated: downloads remote catalog images when the `images.cache` setting is on. */
  'images.cache': async (_data, { db, logger, uploadsDir }) => {
    const result = await cacheRemoteImages(db, {
      uploadsDir,
      onError: (error, item) => logger.debug({ err: error, ...item }, 'image could not be cached'),
    })
    if (result.cached || result.failed) logger.info(result, 'catalog images cached')
    return result
  },
}

export async function runJob(name: string, data: unknown, context: JobContext): Promise<unknown> {
  const handler = jobHandlers[name]
  if (!handler) throw new Error(`Unknown job "${name}"`)
  return handler(data, context)
}
