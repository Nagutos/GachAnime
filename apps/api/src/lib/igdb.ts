import { AppError } from '@gachanime/core'
import { IgdbClient, IgdbError } from '@gachanime/importer'
import { getEnv } from './env'
import { logger } from './logger'
import { singleton } from './singleton'

/** IGDB credentials are set: video game imports and searches are available. */
export function isIgdbConfigured(): boolean {
  const env = getEnv()
  return Boolean(env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET)
}

/** IGDB client for interactive admin searches (imports run in the worker). */
export function getIgdbClient(): IgdbClient {
  if (!isIgdbConfigured()) {
    throw new AppError('IGDB_NOT_CONFIGURED', 'IGDB_CLIENT_ID and IGDB_CLIENT_SECRET are not set')
  }
  const env = getEnv()
  return singleton(
    'igdb',
    () =>
      new IgdbClient(
        { clientId: env.IGDB_CLIENT_ID!, clientSecret: env.IGDB_CLIENT_SECRET! },
        { logger, maxRetries: 1 },
      ),
  )
}

export async function callIgdb<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof IgdbError) {
      logger.warn({ err: error }, 'IGDB request failed')
      throw new AppError('IGDB_UNAVAILABLE', 'IGDB request failed')
    }
    throw error
  }
}
