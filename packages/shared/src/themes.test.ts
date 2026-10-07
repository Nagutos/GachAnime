import { describe, expect, it } from 'vitest'
import { themeRootRuleSchema } from './themes'

describe('theme rules', () => {
  it('accepts nested groups of rules', () => {
    const rule = {
      type: 'group',
      mode: 'all',
      rules: [
        { type: 'tag', tag: 'Shounen', minRank: 60 },
        { type: 'group', mode: 'any', rules: [{ type: 'gender', gender: 'female' }] },
      ],
    }
    expect(themeRootRuleSchema.safeParse(rule).success).toBe(true)
  })

  it('requires a group at the root and bounded nesting', () => {
    expect(themeRootRuleSchema.safeParse({ type: 'genre', genre: 'Sports' }).success).toBe(false)
    let deep: unknown = { type: 'genre', genre: 'Sports' }
    for (let i = 0; i < 6; i++) deep = { type: 'group', mode: 'all', rules: [deep] }
    expect(themeRootRuleSchema.safeParse(deep).success).toBe(false)
  })

  it('refuses invalid rules', () => {
    const group = (rule: unknown) => ({ type: 'group', mode: 'all', rules: [rule] })
    expect(
      themeRootRuleSchema.safeParse(group({ type: 'tag', tag: 'X', minRank: 101 })).success,
    ).toBe(false)
    expect(themeRootRuleSchema.safeParse(group({ type: 'planet', name: 'Mars' })).success).toBe(
      false,
    )
    expect(themeRootRuleSchema.safeParse(group({ type: 'series', seriesIds: [] })).success).toBe(
      false,
    )
  })
})
