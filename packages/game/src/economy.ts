/**
 * Copies of a character that can be recycled: never the first copy, never locked copies
 * (market listings, pending trades). GAME_DESIGN §3.
 */
export function recyclableCopies(quantity: number, lockedQuantity: number): number {
  return Math.max(0, quantity - 1 - lockedQuantity)
}

/** Gem price of `quantity` boosters of a paid tier. */
export function boosterPrice(tierPrice: number, quantity: number): number {
  if (!Number.isInteger(tierPrice) || tierPrice < 0) throw new RangeError('Invalid tier price')
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError('Invalid quantity')
  return tierPrice * quantity
}

/** Whether a listing price respects a rarity's market bounds (a 0 maximum means no maximum). */
export function priceInRange(price: number, min: number, max: number): boolean {
  return Number.isInteger(price) && price >= Math.max(1, min) && (max === 0 || price <= max)
}
