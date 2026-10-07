import {
  boosterOpeningCards,
  boosterOpenings,
  boosterTiers,
  drawableCharacters,
  playerProfiles,
  userCards,
  type Database,
  type Executor,
} from '@gachanime/db'
import {
  CARDS_PER_BOOSTER,
  consumeFreeCharges,
  drawCards,
  freeChargeState,
  type FreeChargeRules,
  type Rng,
} from '@gachanime/game'
import {
  localizedTextSchema,
  rateWeightsSchema,
  type BoostersResponse,
  type FreeBoosterStatus,
  type OpenBoostersRequest,
  type OpenBoostersResponse,
} from '@gachanime/shared'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { loadRarities } from '../catalog/rarities'
import { AppError } from '../errors'
import { loadCharacterCards } from '../players/cards'
import { cryptoRng } from '../random'
import { getSetting } from '../settings'

export interface GameClock {
  /** Defaults to `cryptoRng`. */
  rng?: Rng
  /** Defaults to the current time. */
  now?: Date
}

function toFreeStatus(anchor: Date, now: Date, rules: FreeChargeRules): FreeBoosterStatus {
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

async function loadAnchor(db: Executor, userId: string, forUpdate: boolean): Promise<Date> {
  const query = db
    .select({ anchor: playerProfiles.freeBoosterAnchorAt })
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId))
  const [row] = forUpdate ? await query.for('update') : await query
  if (!row) throw new AppError('NOT_FOUND', 'Player profile not found')
  return row.anchor
}

export async function getFreeBoosterStatus(
  db: Executor,
  userId: string,
  now = new Date(),
): Promise<FreeBoosterStatus> {
  const [anchor, rules] = await Promise.all([
    loadAnchor(db, userId, false),
    getSetting(db, 'boosters.free'),
  ])
  return toFreeStatus(anchor, now, rules)
}

/** Active booster tiers (with their rates, shown to players) and the free charges. */
export async function listBoosters(
  db: Executor,
  userId: string,
  now = new Date(),
): Promise<BoostersResponse> {
  const [tiers, free] = await Promise.all([
    db
      .select()
      .from(boosterTiers)
      .where(eq(boosterTiers.isActive, true))
      .orderBy(asc(boosterTiers.sortOrder), asc(boosterTiers.id)),
    getFreeBoosterStatus(db, userId, now),
  ])
  return {
    tiers: tiers.map((tier) => ({
      key: tier.key,
      name: localizedTextSchema.parse(tier.name),
      description: tier.description ? localizedTextSchema.parse(tier.description) : null,
      priceGems: tier.priceGems,
      artToken: tier.artToken,
      weights: rateWeightsSchema.parse(tier.weights),
    })),
    free,
    cardsPerBooster: CARDS_PER_BOOSTER,
  }
}

/** Drawable character ids per rarity id, sorted (the draw picks an index in each list). */
async function loadPool(db: Executor): Promise<Map<number, number[]>> {
  const rows = await db
    .select({
      rarityId: drawableCharacters.rarityId,
      ids: sql<
        string[]
      >`array_agg(${drawableCharacters.characterId} ORDER BY ${drawableCharacters.characterId})`,
    })
    .from(drawableCharacters)
    .groupBy(drawableCharacters.rarityId)
  // array_agg of bigint comes back as strings.
  return new Map(rows.map((row) => [row.rarityId, row.ids.map(Number)]))
}

/**
 * Opens `quantity` boosters of a tier in one transaction: checks and consumes the free charges,
 * draws `quantity × 5` cards, adds them to the inventory and records the opening.
 * The player profile row is locked, so concurrent openings never exceed the available charges.
 */
export async function openBoosters(
  database: Database,
  userId: string,
  input: OpenBoostersRequest,
  clock: GameClock = {},
): Promise<OpenBoostersResponse> {
  const rng = clock.rng ?? cryptoRng
  return database.transaction(async (tx) => {
    const anchor = await loadAnchor(tx, userId, true)
    const now = clock.now ?? new Date()

    const [tier] = await tx
      .select()
      .from(boosterTiers)
      .where(and(eq(boosterTiers.key, input.tier), eq(boosterTiers.isActive, true)))
    if (!tier) throw new AppError('BOOSTER_UNAVAILABLE', `Booster "${input.tier}" is not available`)
    if (tier.priceGems !== null) {
      // Paid tiers arrive with the economy (Phase 3).
      throw new AppError('BOOSTER_UNAVAILABLE', 'Paid boosters are not available yet')
    }

    const rules = await getSetting(tx, 'boosters.free')
    const before = freeChargeState(anchor, now, rules)
    if (before.available < input.quantity) {
      throw new AppError('NOT_ENOUGH_CHARGES', 'Not enough free boosters', {
        available: before.available,
      })
    }
    const nextAnchor = consumeFreeCharges(anchor, now, rules, input.quantity)

    const [rarityRows, pool] = await Promise.all([loadRarities(tx), loadPool(tx)])
    const keyById = new Map(rarityRows.map((rarity) => [rarity.id, rarity.key]))
    const idByKey = new Map(rarityRows.map((rarity) => [rarity.key, rarity.id]))
    const poolSizes: Record<string, number> = {}
    for (const [rarityId, ids] of pool) {
      const key = keyById.get(rarityId)
      if (key) poolSizes[key] = ids.length
    }
    if (Object.keys(poolSizes).length === 0) {
      throw new AppError('EMPTY_POOL', 'There is no character to draw yet')
    }

    const drawn = drawCards({
      rarityOrder: rarityRows.map((rarity) => rarity.key),
      weights: rateWeightsSchema.parse(tier.weights),
      poolSizes,
      count: input.quantity * CARDS_PER_BOOSTER,
      rng,
    })
    const cards = drawn.map((card) => {
      const rarityId = idByKey.get(card.rarityKey)!
      return { rarityId, characterId: pool.get(rarityId)![card.index]! }
    })

    // A card is new when the player never had this character, only for its first occurrence.
    const distinctIds = [...new Set(cards.map((card) => card.characterId))]
    const known = await tx
      .select({ characterId: userCards.characterId })
      .from(userCards)
      .where(and(eq(userCards.userId, userId), inArray(userCards.characterId, distinctIds)))
    const seen = new Set(known.map((row) => row.characterId))
    const withNew = cards.map((card) => {
      const isNew = !seen.has(card.characterId)
      seen.add(card.characterId)
      return { ...card, isNew }
    })

    const copies = new Map<number, number>()
    for (const card of cards) copies.set(card.characterId, (copies.get(card.characterId) ?? 0) + 1)
    await tx
      .insert(userCards)
      .values(
        [...copies].map(([characterId, quantity]) => ({
          userId,
          characterId,
          quantity,
          firstObtainedAt: now,
          lastObtainedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [userCards.userId, userCards.characterId],
        set: {
          quantity: sql`${userCards.quantity} + excluded.quantity`,
          lastObtainedAt: sql`excluded.last_obtained_at`,
        },
      })

    await tx
      .update(playerProfiles)
      .set({ freeBoosterAnchorAt: nextAnchor })
      .where(eq(playerProfiles.userId, userId))

    const [opening] = await tx
      .insert(boosterOpenings)
      .values({ userId, tierId: tier.id, quantity: input.quantity, createdAt: now })
      .returning({ id: boosterOpenings.id })
    await tx.insert(boosterOpeningCards).values(
      withNew.map((card, position) => ({
        openingId: opening!.id,
        position,
        characterId: card.characterId,
        rarityId: card.rarityId,
        isNew: card.isNew,
      })),
    )

    const details = await loadCharacterCards(tx, distinctIds)
    return {
      openingId: opening!.id,
      tier: tier.key,
      quantity: input.quantity,
      cardsPerBooster: CARDS_PER_BOOSTER,
      cards: withNew.map((card, position) => ({
        position,
        isNew: card.isNew,
        // The rarity of the draw, even if an admin changes the character's rarity later.
        character: { ...details.get(card.characterId)!, rarityKey: keyById.get(card.rarityId)! },
      })),
      free: toFreeStatus(nextAnchor, now, rules),
    }
  })
}
