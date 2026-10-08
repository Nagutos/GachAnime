import type { Database } from '@gachanime/db'
import { AniListClient } from '@gachanime/importer'
import pino from 'pino'
import { describe, expect, it } from 'vitest'
import { runJob } from './jobs'

const context = {
  db: {} as Database,
  logger: pino({ level: 'silent' }),
  anilist: new AniListClient(),
  igdb: null,
  uploadsDir: '/tmp/unused',
}

describe('runJob', () => {
  it('dispatches by job name', async () => {
    expect(await runJob('system.ping', {}, context)).toEqual({ pong: true })
  })

  it('rejects unknown jobs', async () => {
    await expect(runJob('nope', {}, context)).rejects.toThrow('Unknown job "nope"')
  })
})

describe('catalog.import', () => {
  it('validates its payload', async () => {
    await expect(runJob('catalog.import', { importJobId: 'x' }, context)).rejects.toThrow()
  })
})
