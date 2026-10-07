import type { Database } from '@gachanime/db'
import { recomputeStateAchievementsForAll } from '@gachanime/core'
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

/** Job registry. Later phases add: images.cache, theme pools… */
export const jobHandlers: Record<string, JobHandler> = {
  'system.ping': async (_data, { logger }) => {
    logger.info('pong')
    return { pong: true }
  },
  'anilist.import': async (data, { db, logger, anilist }) => {
    const { importJobId } = importJobDataSchema.parse(data)
    const outcome = await runImportJob({ db, client: anilist, logger }, importJobId)
    // The catalog changed: series and catalog completion may have changed for every player.
    if (outcome === 'completed') await recomputeStateAchievementsForAll(db)
    return { outcome }
  },
  'progression.recompute': async (_data, { db, logger }) => {
    const result = await recomputeStateAchievementsForAll(db)
    logger.info(result, 'state achievements recomputed')
    return result
  },
}

export async function runJob(name: string, data: unknown, context: JobContext): Promise<unknown> {
  const handler = jobHandlers[name]
  if (!handler) throw new Error(`Unknown job "${name}"`)
  return handler(data, context)
}
