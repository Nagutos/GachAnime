/**
 * Outline of a booster pack as two CSS `clip-path` polygons (percentages, so any size works):
 * serrated top and bottom edges, and a ragged tear line near the top. The top strip and the body
 * share the exact same tear points, so before opening they look like a single pack.
 */
/** Duration of the tear animation of a pack. */
export const PACK_TEAR_MS = 850

export interface PackShape {
  /** Strip above the tear line, torn away when opening. */
  strip: string
  /** Rest of the pack. */
  body: string
  /** Vertical position of the tear line, in % of the pack height. */
  tearAt: number
}

export interface PackShapeOptions {
  /** Teeth along the top and bottom edges. */
  teeth?: number
  /** Teeth depth, in % of the height. */
  toothDepth?: number
  tearAt?: number
  /** Points along the tear line and their maximum vertical jitter (% of the height). */
  tearPoints?: number
  tearJitter?: number
}

const round = (value: number) => Math.round(value * 100) / 100
const point = (x: number, y: number) => `${round(x)}% ${round(y)}%`

/** Small deterministic pseudo-random sequence in [-1, 1]: the same shape on every render. */
function jitter(count: number): number[] {
  let seed = 7
  return Array.from({ length: count }, () => {
    seed = (seed * 9301 + 49297) % 233280
    return (seed / 233280) * 2 - 1
  })
}

export function packShape(options: PackShapeOptions = {}): PackShape {
  const teeth = options.teeth ?? 16
  const depth = options.toothDepth ?? 2.2
  const tearAt = options.tearAt ?? 13
  const tearPoints = options.tearPoints ?? 22
  const tearJitter = options.tearJitter ?? 0.9

  const step = 100 / teeth
  const tear = jitter(tearPoints + 1).map((offset, index) => ({
    x: (index * 100) / tearPoints,
    y: tearAt + offset * tearJitter,
  }))

  const top: string[] = []
  for (let index = 0; index < teeth; index++) {
    top.push(point(index * step, depth), point(index * step + step / 2, 0))
  }
  top.push(point(100, depth))

  const bottom: string[] = []
  for (let index = teeth; index > 0; index--) {
    bottom.push(point(index * step, 100 - depth), point(index * step - step / 2, 100))
  }
  bottom.push(point(0, 100 - depth))

  const tearLeftToRight = tear.map(({ x, y }) => point(x, y))
  const tearRightToLeft = [...tearLeftToRight].reverse()

  return {
    strip: `polygon(${[...top, ...tearRightToLeft].join(', ')})`,
    body: `polygon(${[...tearLeftToRight, ...bottom].join(', ')})`,
    tearAt,
  }
}
