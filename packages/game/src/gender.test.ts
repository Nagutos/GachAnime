import { describe, expect, it } from 'vitest'
import { effectiveGender, genderClassFromAniList } from './gender'

describe('genderClassFromAniList', () => {
  it.each([
    ['Female', 'female'],
    ['female', 'female'],
    [' Male ', 'male'],
    ['Non-binary', 'unclassified'],
    ['Male, Female', 'unclassified'],
    ['', 'unclassified'],
    [null, 'unclassified'],
    [undefined, 'unclassified'],
  ] as const)('%j → %s', (gender, expected) => {
    expect(genderClassFromAniList(gender)).toBe(expected)
  })
})

describe('effectiveGender', () => {
  it('prefers the admin override', () => {
    expect(effectiveGender('unclassified', 'female')).toBe('female')
    expect(effectiveGender('male', null)).toBe('male')
  })
})
