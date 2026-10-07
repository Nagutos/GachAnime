import type { Database } from '@gachanime/db'
import { rebuildAllThemePools, recomputeStateAchievementsForAll } from '@gachanime/core'
import { runImportJob, type AniListClient } from '@gachanime/importer'
import type { Logger } from 'pino'
import { z } from 'zod'

/** Name of the single BullMQ queue; jobs are dispatched by name. */
export const QUEUE_NAME = 'gachanime'

export interface JobContext {
  db: Database
  logger: Logger
  anilist: AniListClient
}

export type JobHandler = (data: unknown, context: JobContext) => Promise<unknown>

const importJobDataSchema = z.object({ importJobId: z.number().int().positive() })

/** BullMQ job id of an import: one queued job per import row. */
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

/** Job registry. Later phases add: images.cache… */
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
}

export async function runJob(name: string, data: unknown, context: JobContext): Promise<unknown> {
  const handler = jobHandlers[name]
  if (!handler) throw new Error(`Unknown job "${name}"`)
  return handler(data, context)
}
