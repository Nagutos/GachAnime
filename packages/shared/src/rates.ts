import { z } from 'zod'
import { rarityKeySchema } from './catalog'

/** Per-card rate tables are integers in parts per million and always sum to this total. */
export const RATE_TABLE_TOTAL = 1_000_000

/** `{ rarityKey: ppm }` summing to exactly `RATE_TABLE_TOTAL`. */
export const rateWeightsSchema = z
  .record(rarityKeySchema, z.number().int().nonnegative())
  .refine(
    (weights) => Object.values(weights).reduce((sum, value) => sum + value, 0) === RATE_TABLE_TOTAL,
    { message: `Weights must sum to ${RATE_TABLE_TOTAL}` },
  )
