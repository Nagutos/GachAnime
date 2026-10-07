import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
})

export type WorkerEnv = z.infer<typeof envSchema>

export function parseWorkerEnv(source: NodeJS.ProcessEnv): WorkerEnv {
  return envSchema.parse(source)
}
