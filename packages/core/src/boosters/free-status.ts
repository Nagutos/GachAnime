import { freeChargeState, type FreeChargeRules } from '@gachanime/game'
import type { FreeBoosterStatus } from '@gachanime/shared'

export function toFreeStatus(anchor: Date, now: Date, rules: FreeChargeRules): FreeBoosterStatus {
  const state = freeChargeState(anchor, now, rules)
  return {
    available: state.available,
    max: state.max,
    intervalSeconds: rules.intervalSeconds,
    nextChargeAt: state.nextChargeAt?.toISOString() ?? null,
    fullAt: state.fullAt?.toISOString() ?? null,
    serverTime: now.toISOString(),
  }
}
