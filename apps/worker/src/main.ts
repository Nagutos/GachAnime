import { createDatabase } from '@gachanime/db'
import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import pino from 'pino'
import { parseWorkerEnv } from './env'
import { QUEUE_NAME, runJob } from './jobs'

const env = parseWorkerEnv(process.env)
const logger = pino({ name: 'worker', level: env.LOG_LEVEL })
const { db, pool } = createDatabase(env.DATABASE_URL, { max: env.WORKER_CONCURRENCY + 1 })
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

const worker = new Worker(
  QUEUE_NAME,
  async (job) =>
    runJob(job.name, job.data, { db, logger: logger.child({ job: job.name, id: job.id }) }),
  { connection, concurrency: env.WORKER_CONCURRENCY },
)

worker.on('failed', (job, error) => logger.error({ err: error, job: job?.name }, 'job failed'))
worker.on('ready', () => logger.info({ queue: QUEUE_NAME }, 'worker ready'))

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down')
  await worker.close()
  await connection.quit()
  await pool.end()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))
