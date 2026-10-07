import { listUnfinishedImportJobs } from '@gachanime/core'
import { createDatabase } from '@gachanime/db'
import { AniListClient } from '@gachanime/importer'
import { Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import pino from 'pino'
import { parseWorkerEnv } from './env'
import { QUEUE_NAME, importBullJobId, runJob } from './jobs'

const env = parseWorkerEnv(process.env)
const logger = pino({ name: 'worker', level: env.LOG_LEVEL })
const { db, pool } = createDatabase(env.DATABASE_URL, { max: env.WORKER_CONCURRENCY + 1 })
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
// One client per process: AniList's rate limit is per IP.
const anilist = new AniListClient({ logger: logger.child({ component: 'anilist' }) })

const worker = new Worker(
  QUEUE_NAME,
  async (job) =>
    runJob(job.name, job.data, {
      db,
      anilist,
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
      'anilist.import',
      { importJobId },
      { jobId: importBullJobId(importJobId), removeOnComplete: true, removeOnFail: true },
    )
    logger.info({ importJobId }, 'import job queued again')
  }
  await queue.close()
}
requeueUnfinishedImports().catch((error) => logger.error({ err: error }, 'requeue failed'))

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down')
  await worker.close()
  await connection.quit()
  await pool.end()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))
