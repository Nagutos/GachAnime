import type { Database } from '@gachanime/db'
import type { Logger } from 'pino'

/** Name of the single BullMQ queue; jobs are dispatched by name. */
export const QUEUE_NAME = 'gachanime'

export interface JobContext {
  db: Database
  logger: Logger
}

export type JobHandler = (data: unknown, context: JobContext) => Promise<unknown>

/** Job registry. Later phases add: anilist.import, images.cache, achievements.recompute… */
export const jobHandlers: Record<string, JobHandler> = {
  'system.ping': async (_data, { logger }) => {
    logger.info('pong')
    return { pong: true }
  },
}

export async function runJob(name: string, data: unknown, context: JobContext): Promise<unknown> {
  const handler = jobHandlers[name]
  if (!handler) throw new Error(`Unknown job "${name}"`)
  return handler(data, context)
}
