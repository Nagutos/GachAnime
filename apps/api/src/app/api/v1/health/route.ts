import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { errorResponse, route } from '@/lib/http'
import { logger } from '@/lib/logger'
import { getRedis } from '@/lib/redis'

export const GET = route(async () => {
  try {
    await getDb().execute(sql`select 1`)
    await getRedis().ping()
    return Response.json({ status: 'ok' })
  } catch (error) {
    logger.error({ err: error }, 'health check failed')
    return errorResponse('INTERNAL_ERROR', 'Dependency unavailable')
  }
})
