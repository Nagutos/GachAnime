/**
 * Copies of a character that can be recycled: never the first copy, never locked copies
 * (market listings, pending trades). GAME_DESIGN §3.
 */
export function recyclableCopies(quantity: number, lockedQuantity: number): number {
  return Math.max(0, quantity - 1 - lockedQuantity)
}

/**
 * Gem price of `quantity` boosters of a paid tier, with an optional pack surcharge in percent
 * (themed packs, Phase 5). Rounded up per booster so a surcharge never makes a booster cheaper.
 */
export function boosterPrice(tierPrice: number, quantity: number, surchargePercent = 0): number {
  if (!Number.isInteger(tierPrice) || tierPrice < 0) throw new RangeError('Invalid tier price')
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError('Invalid quantity')
  const unit = Math.ceil((tierPrice * (100 + surchargePercent)) / 100)
  return unit * quantity
}
