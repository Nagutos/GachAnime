import { describe, expect, it } from 'vitest'
import { pageItems, parsePageInput } from './pagination'

describe('pageItems', () => {
  it('lists every page when there are few', () => {
    expect(pageItems(1, 1)).toEqual([1])
    expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps the first, last and neighbour pages with gaps between them', () => {
    expect(pageItems(1, 20)).toEqual([1, 2, null, 20])
    expect(pageItems(10, 20)).toEqual([1, null, 9, 10, 11, null, 20])
    expect(pageItems(20, 20)).toEqual([1, null, 19, 20])
  })

  it('shows a single hidden page instead of a gap', () => {
    expect(pageItems(4, 20)).toEqual([1, 2, 3, 4, 5, null, 20])
  })
})

describe('parsePageInput', () => {
  it('clamps a typed page between the first and the last', () => {
    expect(parsePageInput('7', 20)).toBe(7)
    expect(parsePageInput(' 0 ', 20)).toBe(1)
    expect(parsePageInput('99', 20)).toBe(20)
  })

  it('ignores anything that is not a number', () => {
    expect(parsePageInput('', 20)).toBeNull()
    expect(parsePageInput('abc', 20)).toBeNull()
  })
})
