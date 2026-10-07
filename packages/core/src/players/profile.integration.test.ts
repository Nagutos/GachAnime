import { adminAuditLog, type Database } from '@gachanime/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { promoteAdminByDiscordId } from '../admin/roles'
import {
  insertDiscordUser,
  resetTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
} from '../test/database'
import { ensurePlayerProfile, getMe, updatePlayerLocale } from './profile'

describe.skipIf(!testDatabaseUrl)('player profiles (integration)', () => {
  let db: Database
  let close: () => Promise<void>

  beforeAll(async () => {
    ;({ db, close } = await setupTestDatabase(testDatabaseUrl as string, 'core'))
  })
  afterAll(async () => close())
  beforeEach(async () => resetTestDatabase(db))

  it('creates one profile with a unique username, even when called concurrently', async () => {
    await insertDiscordUser(db, { id: 'u1', name: 'Nagi', discordId: '100000000000000001' })
    await insertDiscordUser(db, { id: 'u2', name: 'nagi', discordId: '100000000000000002' })

    await Promise.all([
      ensurePlayerProfile(db, { userId: 'u1', displayName: 'Nagi' }),
      ensurePlayerProfile(db, { userId: 'u1', displayName: 'Nagi' }),
    ])
    await ensurePlayerProfile(db, { userId: 'u2', displayName: 'nagi' })

    const me1 = await getMe(db, 'u1')
    const me2 = await getMe(db, 'u2')
    expect(me1).toMatchObject({ username: 'nagi', gemBalance: 0, role: 'user', locale: null })
    expect(me2.username).toBe('nagi_2')
  })

  it('stores the locale', async () => {
    await insertDiscordUser(db, { id: 'u1', name: 'Nagi', discordId: '100000000000000001' })
    await ensurePlayerProfile(db, { userId: 'u1', displayName: 'Nagi' })
    await updatePlayerLocale(db, 'u1', 'fr')
    expect((await getMe(db, 'u1')).locale).toBe('fr')
  })

  it('promotes an admin by Discord id once and audits it', async () => {
    await insertDiscordUser(db, { id: 'u1', name: 'Nagi', discordId: '100000000000000001' })
    await ensurePlayerProfile(db, { userId: 'u1', displayName: 'Nagi' })

    const input = { discordId: '100000000000000001', actorId: null, reason: 'test' }
    expect(await promoteAdminByDiscordId(db, input)).toBe(true)
    expect(await promoteAdminByDiscordId(db, input)).toBe(false)
    expect((await getMe(db, 'u1')).role).toBe('admin')
    expect(await db.select().from(adminAuditLog)).toHaveLength(1)
  })

  it('refuses to promote an unknown Discord id', async () => {
    await expect(
      promoteAdminByDiscordId(db, { discordId: '999999999999', actorId: null, reason: 'test' }),
    ).rejects.toThrow(/No user signed in/)
  })
})
