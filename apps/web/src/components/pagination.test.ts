import { describe, expect, it } from 'vitest'
import { pageItems } from './pagination'

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
