import { listUnfinishedImportJobs } from '@gachanime/core'
import { createDatabase } from '@gachanime/db'
import { AniListClient, IgdbClient } from '@gachanime/importer'
import { Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import pino from 'pino'
import { parseWorkerEnv } from './env'
import {
  IMAGE_CACHE_INTERVAL_MS,
  QUEUE_NAME,
  SWEEP_INTERVAL_MS,
  importBullJobId,
  runJob,
} from './jobs'

const env = parseWorkerEnv(process.env)
const logger = pino({ name: 'worker', level: env.LOG_LEVEL })
const { db, pool } = createDatabase(env.DATABASE_URL, { max: env.WORKER_CONCURRENCY + 1 })
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
// One client per process: AniList's rate limit is per IP.
const anilist = new AniListClient({ logger: logger.child({ component: 'anilist' }) })
const igdb =
  env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET
    ? new IgdbClient(
        { clientId: env.IGDB_CLIENT_ID, clientSecret: env.IGDB_CLIENT_SECRET },
        { logger: logger.child({ component: 'igdb' }) },
      )
    : null

const worker = new Worker(
  QUEUE_NAME,
  async (job) =>
    runJob(job.name, job.data, {
      db,
      anilist,
      igdb,
      uploadsDir: env.UPLOADS_DIR,
      logger: logger.child({ job: job.name, id: job.id }),
    }),
  { connection, concurrency: env.WORKER_CONCURRENCY },
)

worker.on('failed', (job, error) => logger.error({ err: error, job: job?.name }, 'job failed'))
worker.on('ready', () => logger.info({ queue: QUEUE_NAME }, 'worker ready'))

/** Imports interrupted by a restart (or queued while Redis was flushed) are queued again. */
async function requeueUnfinishedImports(): Promise<void> {
  const queue = new Queue(QUEUE_NAME, { connection })
  for (const importJobId of await listUnfinishedImportJobs(db)) {
    await queue.add(
      'catalog.import',
      { importJobId },
      { jobId: importBullJobId(importJobId), removeOnComplete: true, removeOnFail: true },
    )
    logger.info({ importJobId }, 'import job queued again')
  }
  await queue.close()
}
requeueUnfinishedImports().catch((error) => logger.error({ err: error }, 'requeue failed'))

/** Repeated jobs (idempotent: upserting a scheduler keeps a single one). */
async function scheduleRepeatedJobs(): Promise<void> {
  const queue = new Queue(QUEUE_NAME, { connection })
  await queue.upsertJobScheduler(
    'market-sweep',
    { every: SWEEP_INTERVAL_MS },
    { name: 'market.sweep', data: {}, opts: { removeOnComplete: true, removeOnFail: true } },
  )
  await queue.upsertJobScheduler(
    'images-cache',
    { every: IMAGE_CACHE_INTERVAL_MS },
    { name: 'images.cache', data: {}, opts: { removeOnComplete: true, removeOnFail: true } },
  )
  await queue.close()
}
scheduleRepeatedJobs().catch((error) => logger.error({ err: error }, 'scheduling failed'))

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down')
  await worker.close()
  await connection.quit()
  await pool.end()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))
