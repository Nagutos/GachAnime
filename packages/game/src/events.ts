/**
 * Domain events emitted by core services inside their transaction (ADR-010). Missions match them
 * by type and filter; achievements read the counters they update.
 */
export type GameEvent =
  | { type: 'account_created' }
  | { type: 'booster_opened'; tier: string; quantity: number }
  | { type: 'card_obtained'; rarity: string; count: number; newCount: number }
  | { type: 'card_recycled'; rarity: string; count: number }
  | { type: 'wishlist_added'; characterId: number }
  | { type: 'wiki_entry_viewed'; characterId: number }
  | { type: 'feedback_submitted' }
  | { type: 'card_listed' }
  | { type: 'card_sold'; rarity: string }
  | { type: 'card_bought' }
  | { type: 'trade_completed' }

export type GameEventType = GameEvent['type']

export const GAME_EVENT_TYPES = [
  'account_created',
  'booster_opened',
  'card_obtained',
  'card_recycled',
  'wishlist_added',
  'wiki_entry_viewed',
  'feedback_submitted',
  'card_listed',
  'card_sold',
  'card_bought',
  'trade_completed',
] as const satisfies readonly GameEventType[]

/** How much an event advances a mission (`count`/`quantity` when it carries one, else 1). */
export function eventAmount(event: GameEvent): number {
  if ('count' in event) return event.count
  if ('quantity' in event) return event.quantity
  return 1
}

/**
 * Subject counted at most once per mission period (e.g. re-adding the same character to the
 * wishlist on the same day counts once, GAME_DESIGN §8).
 */
export function eventSubject(event: GameEvent): string | null {
  if (event.type === 'wishlist_added' || event.type === 'wiki_entry_viewed') {
    return `character:${event.characterId}`
  }
  return null
}

/** A mission filter matches when every key equals the event field: `{ "tier": "divine" }`. */
export function matchesFilter(event: GameEvent, filter: Record<string, unknown> | null): boolean {
  if (!filter) return true
  const fields = event as Record<string, unknown>
  return Object.entries(filter).every(([key, value]) => fields[key] === value)
}

/** Lifetime counters (`user_counters`) updated by an event. */
export function counterIncrements(event: GameEvent): Record<string, number> {
  switch (event.type) {
    case 'booster_opened':
      return { boosters_opened: event.quantity, [`boosters_opened:${event.tier}`]: event.quantity }
    case 'card_obtained':
      return { [`cards_obtained:${event.rarity}`]: event.count }
    case 'card_recycled':
      return { [`cards_recycled:${event.rarity}`]: event.count }
    case 'card_sold':
      return { cards_sold: 1 }
    case 'trade_completed':
      return { trades_completed: 1 }
    case 'feedback_submitted':
      return { feedback_submitted: 1 }
    default:
      return {}
  }
}
