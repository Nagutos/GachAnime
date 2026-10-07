/*
 * Franchise grouping (ADR-014): anime connected by franchise relations form one series.
 * Pure functions, unit-tested.
 */

export interface FranchiseNode {
  anilistId: number
  /** AniList ids linked by a franchise relation (may include unknown ids, ignored). */
  relations: readonly number[]
  popularity: number
  /** Series the media already belongs to (previous import or admin decision), if any. */
  seriesId: number | null
}

/** Connected components of the relation graph (relations are treated as undirected). */
export function groupFranchises(nodes: readonly FranchiseNode[]): FranchiseNode[][] {
  const parent = new Map<number, number>()
  const find = (id: number): number => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)!
    // Path compression.
    let current = id
    while (current !== root) {
      const next = parent.get(current)!
      parent.set(current, root)
      current = next
    }
    return root
  }

  for (const node of nodes) parent.set(node.anilistId, node.anilistId)
  for (const node of nodes) {
    for (const related of node.relations) {
      if (!parent.has(related)) continue
      const a = find(node.anilistId)
      const b = find(related)
      if (a !== b) parent.set(Math.max(a, b), Math.min(a, b))
    }
  }

  const groups = new Map<number, FranchiseNode[]>()
  for (const node of nodes) {
    const root = find(node.anilistId)
    const group = groups.get(root) ?? []
    group.push(node)
    groups.set(root, group)
  }
  return [...groups.values()].sort((a, b) => a[0]!.anilistId - b[0]!.anilistId)
}

const byPopularity = (a: FranchiseNode, b: FranchiseNode) =>
  b.popularity - a.popularity || a.anilistId - b.anilistId

export interface SeriesAssignment {
  /** Existing series to use, or null to create one. */
  seriesId: number | null
  /** Media of this group without a series yet, to attach to `seriesId`. */
  unassigned: number[]
  /** Most popular media of the group: gives the title and cover of a new series. */
  primaryAnilistId: number
}

/**
 * Decides which series receives the media of a franchise group that have no series yet.
 * Existing assignments are never changed, so admin merges and splits survive re-imports:
 * new media join the series of the most popular already-assigned media of their group.
 */
export function assignSeries(group: readonly FranchiseNode[]): SeriesAssignment | null {
  const unassigned = group.filter((node) => node.seriesId === null)
  if (unassigned.length === 0) return null
  const assigned = group.filter((node) => node.seriesId !== null).sort(byPopularity)
  const primary = [...group].sort(byPopularity)[0]!
  return {
    seriesId: assigned[0]?.seriesId ?? null,
    unassigned: unassigned.map((node) => node.anilistId).sort((a, b) => a - b),
    primaryAnilistId: primary.anilistId,
  }
}
