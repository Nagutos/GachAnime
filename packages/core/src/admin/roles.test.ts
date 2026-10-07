import { describe, expect, it } from 'vitest'
import { parseAdminDiscordIds } from './roles'

describe('parseAdminDiscordIds', () => {
  it('accepts comma and space separated ids and ignores garbage', () => {
    expect([...parseAdminDiscordIds('123456789012345678, 223456789012345678  x,')]).toEqual([
      '123456789012345678',
      '223456789012345678',
    ])
    expect(parseAdminDiscordIds(undefined).size).toBe(0)
  })
})
