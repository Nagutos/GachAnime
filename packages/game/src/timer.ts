/**
 * Free booster charges, stored as one anchor timestamp per player (GAME_DESIGN §2):
 *
 *   available = min(cap, floor((now − anchor) / interval))
 *   consuming n: anchor = max(anchor, now − cap × interval) + n × interval
 *
 * No cron and no stored counter: the anchor alone gives the state at any time.
 */
export interface FreeChargeRules {
  intervalSeconds: number
  maxCharges: number
}

export interface FreeChargeState {
  available: number
  max: number
  /** When the next charge arrives; null when the cap is reached. */
  nextChargeAt: Date | null
  /** When the cap is reached; null when it already is. */
  fullAt: Date | null
}

/** The anchor never lags more than `cap` intervals behind `now`: older time is wasted. */
function effectiveAnchorMs(anchor: Date, now: Date, rules: FreeChargeRules): number {
  const intervalMs = rules.intervalSeconds * 1000
  return Math.max(anchor.getTime(), now.getTime() - rules.maxCharges * intervalMs)
}

export function freeChargeState(anchor: Date, now: Date, rules: FreeChargeRules): FreeChargeState {
  const intervalMs = rules.intervalSeconds * 1000
  const anchorMs = effectiveAnchorMs(anchor, now, rules)
  const elapsed = now.getTime() - anchorMs
  const available = Math.max(0, Math.min(rules.maxCharges, Math.floor(elapsed / intervalMs)))
  if (available >= rules.maxCharges) {
    return { available, max: rules.maxCharges, nextChargeAt: null, fullAt: null }
  }
  return {
    available,
    max: rules.maxCharges,
    nextChargeAt: new Date(anchorMs + (available + 1) * intervalMs),
    fullAt: new Date(anchorMs + rules.maxCharges * intervalMs),
  }
}

/** New anchor after consuming `count` charges; throws when fewer are available. */
export function consumeFreeCharges(
  anchor: Date,
  now: Date,
  rules: FreeChargeRules,
  count: number,
): Date {
  if (!Number.isInteger(count) || count < 1)
    throw new RangeError('count must be a positive integer')
  const { available } = freeChargeState(anchor, now, rules)
  if (available < count) throw new RangeError(`Only ${available} free charges available`)
  return new Date(effectiveAnchorMs(anchor, now, rules) + count * rules.intervalSeconds * 1000)
}
