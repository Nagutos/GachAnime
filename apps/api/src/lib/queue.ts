import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { getEnv } from './env'
import { singleton } from './singleton'

/** Same queue name and job names as `apps/worker`. */
export const QUEUE_NAME = 'gachanime'

function getQueue(): Queue {
  return singleton('queue', () => {
    const connection = new Redis(getEnv().REDIS_URL, { maxRetriesPerRequest: null })
    return new Queue(QUEUE_NAME, { connection })
  })
}

/** Queues an import job for the worker; the BullMQ job id deduplicates repeated requests. */
export async function enqueueImportJob(importJobId: number): Promise<void> {
  await getQueue().add(
    'anilist.import',
    { importJobId },
    { jobId: `anilist-import-${importJobId}`, removeOnComplete: true, removeOnFail: true },
  )
}
