import { randomInt } from 'node:crypto'
import type { Rng } from '@gachanime/game'

/** Production randomness for game outcomes (CLAUDE.md: `node:crypto` only). */
export const cryptoRng: Rng = {
  nextInt: (maxExclusive) => randomInt(0, maxExclusive),
}
