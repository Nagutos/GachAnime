import { describe, expect, it } from 'vitest'
import { assignSeries, groupFranchises, type FranchiseNode } from './franchise'

const node = (
  anilistId: number,
  relations: number[],
  popularity = 0,
  seriesId: number | null = null,
): FranchiseNode => ({ anilistId, relations, popularity, seriesId })

const ids = (groups: FranchiseNode[][]) => groups.map((group) => group.map((n) => n.anilistId))

describe('groupFranchises', () => {
  it('groups media connected by relations, in either direction', () => {
    const groups = groupFranchises([
      node(1, [2]),
      node(2, []),
      node(3, [2]), // only 3 → 2 is declared
      node(4, []),
      node(5, [99]), // unknown relation is ignored
    ])
    expect(ids(groups)).toEqual([[1, 2, 3], [4], [5]])
  })

  it('handles long chains and cycles', () => {
    const chain = Array.from({ length: 200 }, (_, i) => node(i + 1, i === 0 ? [200] : [i]))
    expect(groupFranchises(chain)).toHaveLength(1)
  })
})

describe('assignSeries', () => {
  it('creates a series named after the most popular media', () => {
    expect(assignSeries([node(1, [], 10), node(2, [], 50)])).toEqual({
      seriesId: null,
      unassigned: [1, 2],
      primaryAnilistId: 2,
    })
  })

  it('attaches new media to the series of the most popular assigned media', () => {
    const group = [node(1, [], 10, 7), node(2, [], 90, 8), node(3, [], 5)]
    expect(assignSeries(group)).toMatchObject({ seriesId: 8, unassigned: [3] })
  })

  it('changes nothing when every media already has a series (admin splits survive)', () => {
    expect(assignSeries([node(1, [], 10, 7), node(2, [], 90, 8)])).toBeNull()
  })
})
