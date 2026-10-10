import {
  boosterOpeningCards,
  boosterOpenings,
  boosterTiers,
  playerProfiles,
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
  type Rng,
  wishChance,
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
import { loadDrawablePool, loadThemePoolSizes } from '../catalog/drawable-pool'
import { loadRarities } from '../catalog/rarities'
import { AppError } from '../errors'
import { loadCharacterCards } from '../players/cards'
import { changeGems, lockPlayer } from '../players/gems'
import { cryptoRng } from '../random'
import { loadWishedInPool } from '../players/wishlist'
import { emitEvents } from '../progression/engine'
import { ensureThemePools, rebuildThemePool } from '../themes/pools'
import { getSetting } from '../settings'
import { getPlayerFreeRules } from '../players/upgrades'
import { toFreeStatus } from './free-status'

export interface GameClock {
  /** Defaults to `cryptoRng`. */
  rng?: Rng
  /** Defaults to the current time. */
  now?: Date
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
    getPlayerFreeRules(db, userId),
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
  const [tiers, free, profile, themeRows, poolSizes] = await Promise.all([
    db
      .select()
      .from(boosterTiers)
      .where(eq(boosterTiers.isActive, true))
      .orderBy(asc(boosterTiers.sortOrder), asc(boosterTiers.id)),
    getFreeBoosterStatus(db, userId, now),
    loadProfile(db, userId),
    db
      .select()
      .from(themes)
      .where(eq(themes.isActive, true))
      .orderBy(asc(themes.sortOrder), asc(themes.id)),
    loadThemePoolSizes(db),
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
    gemBalance: profile.gemBalance,
    themes: themeRows
      .map((theme) => ({ theme, characterCount: poolSizes.get(theme.id) ?? 0 }))
      .filter((row) => row.characterCount > 0)
      .map(({ theme, characterCount }) => ({
        key: theme.key,
        name: localizedTextSchema.parse(theme.name),
        description: theme.description ? localizedTextSchema.parse(theme.description) : null,
        category: theme.category,
        color: theme.color,
        seal: theme.seal,
        characterCount,
      })),
  }
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

    // Packs only apply to free boosters; paid tiers always draw from the whole catalog.
    let theme: typeof themes.$inferSelect | null = null
    if (input.theme) {
      if (!isFree) {
        throw new AppError('THEME_UNAVAILABLE', 'Packs can only be opened with free boosters')
      }
      ;[theme = null] = await tx
        .select()
        .from(themes)
        .where(and(eq(themes.key, input.theme), eq(themes.isActive, true)))
      if (!theme) {
        throw new AppError('THEME_UNAVAILABLE', `Pack "${input.theme}" is not available`)
      }
      if (!theme.poolBuiltAt) await rebuildThemePool(tx, theme.id)
    }

    const rules = await getPlayerFreeRules(tx, userId)
    const gemsSpent = isFree ? 0 : boosterPrice(tier.priceGems!, input.quantity)
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

    const rarityRows = await loadRarities(tx)
    const pool = await loadDrawablePool(tx, theme?.id ?? null)
    const { boostPercent } = await getSetting(tx, 'wishlist')
    const wishedPool = await loadWishedInPool(tx, userId, pool)
    const keyById = new Map(rarityRows.map((rarity) => [rarity.id, rarity.key]))
    const idByKey = new Map(rarityRows.map((rarity) => [rarity.key, rarity.id]))
    const poolSizes: Record<string, number> = {}
    for (const [rarityId, ids] of pool) {
      const key = keyById.get(rarityId)
      if (key) poolSizes[key] = ids.length
    }
    const wishedSizes: Record<string, number> = {}
    for (const [rarityId, ids] of wishedPool) {
      const key = keyById.get(rarityId)
      if (key) wishedSizes[key] = ids.length
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
      wished: wishedSizes,
      wishChance: wishChance(boostPercent),
    })
    const cards = drawn.map((card) => {
      const rarityId = idByKey.get(card.rarityKey)!
      const source = card.wished ? wishedPool : pool
      return { rarityId, characterId: source.get(rarityId)![card.index]! }
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
