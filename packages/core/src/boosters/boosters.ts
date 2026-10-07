import {
  boosterOpeningCards,
  boosterOpenings,
  boosterTiers,
  drawableCharacters,
  playerProfiles,
  themeCharacters,
  themes,
  userCards,
  type Database,
  type Executor,
} from '@gachanime/db'
import {
  boosterPrice,
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
import { changeGems, lockPlayer } from '../players/gems'
import { cryptoRng } from '../random'
import { emitEvents } from '../progression/engine'
import { themePoolSize } from '../themes/admin'
import { ensureThemePools, rebuildThemePool } from '../themes/pools'
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

async function loadProfile(db: Executor, userId: string) {
  const [row] = await db
    .select({ anchor: playerProfiles.freeBoosterAnchorAt, gemBalance: playerProfiles.gemBalance })
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId))
  if (!row) throw new AppError('NOT_FOUND', 'Player profile not found')
  return row
}

export async function getFreeBoosterStatus(
  db: Executor,
  userId: string,
  now = new Date(),
): Promise<FreeBoosterStatus> {
  const [profile, rules] = await Promise.all([
    loadProfile(db, userId),
    getSetting(db, 'boosters.free'),
  ])
  return toFreeStatus(profile.anchor, now, rules)
}

/** Active booster tiers (with their rates, shown to players), free charges and gem balance. */
export async function listBoosters(
  db: Database,
  userId: string,
  now = new Date(),
): Promise<BoostersResponse> {
  await ensureThemePools(db)
  const [tiers, free, profile, themeRows] = await Promise.all([
    db
      .select()
      .from(boosterTiers)
      .where(eq(boosterTiers.isActive, true))
      .orderBy(asc(boosterTiers.sortOrder), asc(boosterTiers.id)),
    getFreeBoosterStatus(db, userId, now),
    loadProfile(db, userId),
    db
      .select({ theme: themes, characterCount: themePoolSize })
      .from(themes)
      .where(eq(themes.isActive, true))
      .orderBy(asc(themes.sortOrder), asc(themes.id)),
  ])
  const paidTiers = tiers.filter((tier) => tier.priceGems !== null)
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
    gemBalance: profile.gemBalance,
    themes: themeRows
      .filter((row) => row.characterCount > 0 && (row.theme.freeEnabled || row.theme.paidEnabled))
      .map(({ theme, characterCount }) => ({
        key: theme.key,
        name: localizedTextSchema.parse(theme.name),
        description: theme.description ? localizedTextSchema.parse(theme.description) : null,
        category: theme.category,
        artToken: theme.artToken,
        freeEnabled: theme.freeEnabled,
        paidEnabled: theme.paidEnabled,
        surchargePercent: theme.surchargePercent,
        characterCount,
        prices: Object.fromEntries(
          paidTiers.map((tier) => [
            tier.key,
            boosterPrice(tier.priceGems!, 1, theme.surchargePercent),
          ]),
        ),
      })),
  }
}

/**
 * Drawable character ids per rarity id, sorted (the draw picks an index in each list), limited
 * to a pack's materialized pool when one is given.
 */
async function loadPool(db: Executor, themeId: number | null): Promise<Map<number, number[]>> {
  const base = db
    .select({
      rarityId: drawableCharacters.rarityId,
      ids: sql<
        string[]
      >`array_agg(${drawableCharacters.characterId} ORDER BY ${drawableCharacters.characterId})`,
    })
    .from(drawableCharacters)
  const rows = await (
    themeId === null
      ? base
      : base.innerJoin(
          themeCharacters,
          and(
            eq(themeCharacters.characterId, drawableCharacters.characterId),
            eq(themeCharacters.themeId, themeId),
          ),
        )
  ).groupBy(drawableCharacters.rarityId)
  // array_agg of bigint comes back as strings.
  return new Map(rows.map((row) => [row.rarityId, row.ids.map(Number)]))
}

/**
 * Opens `quantity` boosters of a tier in one transaction: consumes free charges (free tier) or
 * gems (paid tiers), draws `quantity × 5` cards, adds them to the inventory and records the
 * opening. The player profile row is locked, so concurrent openings never exceed the available
 * charges or gems.
 */
export async function openBoosters(
  database: Database,
  userId: string,
  input: OpenBoostersRequest,
  clock: GameClock = {},
): Promise<OpenBoostersResponse> {
  const rng = clock.rng ?? cryptoRng
  return database.transaction(async (tx) => {
    const player = await lockPlayer(tx, userId)
    const now = clock.now ?? new Date()

    const [tier] = await tx
      .select()
      .from(boosterTiers)
      .where(and(eq(boosterTiers.key, input.tier), eq(boosterTiers.isActive, true)))
    if (!tier) throw new AppError('BOOSTER_UNAVAILABLE', `Booster "${input.tier}" is not available`)
    const isFree = tier.priceGems === null

    let theme: typeof themes.$inferSelect | null = null
    if (input.theme) {
      ;[theme = null] = await tx
        .select()
        .from(themes)
        .where(and(eq(themes.key, input.theme), eq(themes.isActive, true)))
      if (!theme || !(isFree ? theme.freeEnabled : theme.paidEnabled)) {
        throw new AppError('THEME_UNAVAILABLE', `Pack "${input.theme}" is not available here`)
      }
      if (!theme.poolBuiltAt) await rebuildThemePool(tx, theme.id)
    }

    const rules = await getSetting(tx, 'boosters.free')
    const gemsSpent = isFree
      ? 0
      : boosterPrice(tier.priceGems!, input.quantity, theme?.surchargePercent ?? 0)
    let nextAnchor = player.freeBoosterAnchorAt
    if (isFree) {
      const before = freeChargeState(player.freeBoosterAnchorAt, now, rules)
      if (before.available < input.quantity) {
        throw new AppError('NOT_ENOUGH_CHARGES', 'Not enough free boosters', {
          available: before.available,
        })
      }
      nextAnchor = consumeFreeCharges(player.freeBoosterAnchorAt, now, rules, input.quantity)
    } else if (player.gemBalance < gemsSpent) {
      throw new AppError('NOT_ENOUGH_GEMS', 'Not enough gems', { required: gemsSpent })
    }

    const [rarityRows, pool] = await Promise.all([
      loadRarities(tx),
      loadPool(tx, theme?.id ?? null),
    ])
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

    if (isFree) {
      await tx
        .update(playerProfiles)
        .set({ freeBoosterAnchorAt: nextAnchor })
        .where(eq(playerProfiles.userId, userId))
    }

    const [opening] = await tx
      .insert(boosterOpenings)
      .values({
        userId,
        tierId: tier.id,
        themeId: theme?.id ?? null,
        quantity: input.quantity,
        gemsSpent,
        createdAt: now,
      })
      .returning({ id: boosterOpenings.id })
    const gemBalance = isFree
      ? player.gemBalance
      : await changeGems(tx, {
          userId,
          amount: -gemsSpent,
          reason: 'booster_purchase',
          refType: 'booster_opening',
          refId: opening!.id,
        })
    await tx.insert(boosterOpeningCards).values(
      withNew.map((card, position) => ({
        openingId: opening!.id,
        position,
        characterId: card.characterId,
        rarityId: card.rarityId,
        isNew: card.isNew,
      })),
    )

    const obtained = new Map<string, { count: number; newCount: number }>()
    for (const card of withNew) {
      const key = keyById.get(card.rarityId)!
      const entry = obtained.get(key) ?? { count: 0, newCount: 0 }
      entry.count++
      if (card.isNew) entry.newCount++
      obtained.set(key, entry)
    }
    const progression = await emitEvents(
      tx,
      userId,
      [
        { type: 'booster_opened', tier: tier.key, quantity: input.quantity },
        ...[...obtained].map(([rarity, entry]) => ({
          type: 'card_obtained' as const,
          rarity,
          ...entry,
        })),
      ],
      now,
    )

    const details = await loadCharacterCards(tx, distinctIds)
    return {
      openingId: opening!.id,
      tier: tier.key,
      theme: theme?.key ?? null,
      quantity: input.quantity,
      cardsPerBooster: CARDS_PER_BOOSTER,
      cards: withNew.map((card, position) => ({
        position,
        isNew: card.isNew,
        // The rarity of the draw, even if an admin changes the character's rarity later.
        character: { ...details.get(card.characterId)!, rarityKey: keyById.get(card.rarityId)! },
      })),
      free: toFreeStatus(nextAnchor, now, rules),
      gemsSpent,
      gemBalance,
      progression,
    }
  })
}
