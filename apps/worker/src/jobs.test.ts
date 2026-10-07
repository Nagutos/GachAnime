import type { Database } from '@gachanime/db'
import pino from 'pino'
import { describe, expect, it } from 'vitest'
import { runJob } from './jobs'

const context = { db: {} as Database, logger: pino({ level: 'silent' }) }

describe('runJob', () => {
  it('dispatches by job name', async () => {
    expect(await runJob('system.ping', {}, context)).toEqual({ pong: true })
  })

  it('rejects unknown jobs', async () => {
    await expect(runJob('nope', {}, context)).rejects.toThrow('Unknown job "nope"')
  })
})
