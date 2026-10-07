/**
 * Source of randomness for game outcomes. Production uses `node:crypto` (see `cryptoRng` in
 * `@gachanime/core`); tests inject a seeded generator.
 */
export interface Rng {
  /** Uniform integer in `[0, maxExclusive)`. */
  nextInt(maxExclusive: number): number
}

const UINT32_RANGE = 2 ** 32

function assertRange(maxExclusive: number): void {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError(`maxExclusive must be an integer in [1, 2^32], got ${maxExclusive}`)
  }
}

/**
 * Deterministic generator (mulberry32) for tests and simulations. Not for production draws.
 * Integers are drawn by rejection sampling, so they are unbiased for any range.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
  return {
    nextInt(maxExclusive) {
      assertRange(maxExclusive)
      const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive)
      let value = nextUint32()
      while (value >= limit) value = nextUint32()
      return value % maxExclusive
    },
  }
}
