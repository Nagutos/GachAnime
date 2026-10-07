import { AniListClient, AniListError } from '@gachanime/importer'
import { AppError } from '@gachanime/core'
import { logger } from './logger'
import { singleton } from './singleton'

/** AniList client for interactive admin searches (imports run in the worker). */
export function getAniListClient(): AniListClient {
  return singleton('anilist', () => new AniListClient({ logger, maxRetries: 1 }))
}

export async function callAniList<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof AniListError) {
      logger.warn({ err: error }, 'AniList request failed')
      throw new AppError('ANILIST_UNAVAILABLE', 'AniList request failed')
    }
    throw error
  }
}
