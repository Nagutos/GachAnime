import { resolve } from 'node:path'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
  /** Shared with the API (served under /media). Defaults to `<repository>/uploads` in dev. */
  UPLOADS_DIR: z.string().min(1).default(resolve(process.cwd(), '../../uploads')),
})

export type WorkerEnv = z.infer<typeof envSchema>

export function parseWorkerEnv(source: NodeJS.ProcessEnv): WorkerEnv {
  return envSchema.parse(source)
}
