import { alias } from 'drizzle-orm/pg-core'
import {
  achievements,
  characters,
  favoriteItems,
  playerProfiles,
  rarities,
  userAchievements,
  userCards,
  users,
  wishlistItems,
  type Executor,
} from '@gachanime/db'
import {
  localizedTextSchema,
  type Paginated,
  type PlayerCard,
  type PlayerCardsQuery,
  type PlayerProfile,
  PROFILE_SHOWCASE_SIZE,
  type CharacterCard,
  type PlayerSummary,
  type PlayerWishlistResponse,
} from '@gachanime/shared'
import { and, asc, count, desc, eq, gt, ilike, isNotNull, or, sql, type SQL } from 'drizzle-orm'
import { containsPattern } from '../catalog/admin-series'
import { AppError } from '../errors'
import { characterCardColumns, toCharacterCard } from '../players/cards'
import { loadFavoriteCards } from '../players/favorites'
import { loadDrawableIds } from '../catalog/drawable-pool'
import { getSetting } from '../settings'

export interface PlayerRecord extends PlayerSummary {
  userId: string
  banned: boolean
}

export async function findPlayer(db: Executor, username: string): Promise<PlayerRecord> {
  const [row] = await db
    .select({
      userId: playerProfiles.userId,
      username: playerProfiles.username,
      displayName: users.name,
      avatarUrl: users.image,
      banned: users.banned,
    })
    .from(playerProfiles)
    .innerJoin(users, eq(users.id, playerProfiles.userId))
    .where(eq(playerProfiles.username, username.toLowerCase()))
  if (!row) throw new AppError('NOT_FOUND', `Player "${username}" not found`)
  return row
}

export async function listPlayers(
  db: Executor,
  query: { page: number; pageSize: number; search?: string },
): Promise<Paginated<PlayerSummary & { owned: number; featured: CharacterCard | null }>> {
  const conditions: SQL[] = [eq(users.banned, false)]
  if (query.search) {
    const pattern = containsPattern(query.search)
    conditions.push(or(ilike(playerProfiles.username, pattern), ilike(users.name, pattern))!)
  }
  const where = and(...conditions)
  const owned = sql<number>`(SELECT count(*)::int FROM user_cards uc
    WHERE uc.user_id = "player_profiles"."user_id" AND uc.quantity > 0)`
  const [rows, [total]] = await Promise.all([
    db
      .select({
        userId: playerProfiles.userId,
        username: playerProfiles.username,
        displayName: users.name,
        avatarUrl: users.image,
        owned,
      })
      .from(playerProfiles)
      .innerJoin(users, eq(users.id, playerProfiles.userId))
      .where(where)
      .orderBy(desc(owned), asc(playerProfiles.username))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ value: count() })
      .from(playerProfiles)
      .innerJoin(users, eq(users.id, playerProfiles.userId))
      .where(where),
  ])
  const featured = await loadFavoriteCards(
    db,
    rows.map((row) => row.userId),
  )
  return {
    items: rows.map(({ userId, ...row }) => ({
      ...row,
      featured: featured.get(userId)?.[0] ?? null,
    })),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}

/** Public profile: stats and completed achievements (achievements are sticky, never revoked). */
export async function getPlayerProfile(
  db: Executor,
  viewerId: string,
  username: string,
): Promise<PlayerProfile> {
  const player = await findPlayer(db, username)
  const [[profile], [cards], [catalog], completed, [totalAchievements], seriesRows, showcase] =
    await Promise.all([
      db
        .select({ createdAt: playerProfiles.createdAt })
        .from(playerProfiles)
        .where(eq(playerProfiles.userId, player.userId)),
      db
        .select({
          owned: count(),
          cards: sql<number>`coalesce(sum(${userCards.quantity}), 0)::int`,
        })
        .from(userCards)
        .where(and(eq(userCards.userId, player.userId), gt(userCards.quantity, 0))),
      loadDrawableIds(db).then((ids) => [{ value: ids.size }]),
      db
        .select({
          key: achievements.key,
          name: achievements.name,
          completedAt: userAchievements.completedAt,
        })
        .from(userAchievements)
        .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
        .where(
          and(
            eq(userAchievements.userId, player.userId),
            isNotNull(userAchievements.completedAt),
            eq(achievements.isActive, true),
          ),
        )
        .orderBy(desc(userAchievements.completedAt)),
      db.select({ value: count() }).from(achievements).where(eq(achievements.isActive, true)),
      db.execute<{ value: number }>(sql`
        SELECT count(*)::int AS value FROM series s
        WHERE s.is_active
          AND EXISTS (SELECT 1 FROM series_characters sc JOIN characters c ON c.id = sc.character_id
            WHERE sc.series_id = s.id AND c.is_active)
          AND NOT EXISTS (SELECT 1 FROM series_characters sc JOIN characters c ON c.id = sc.character_id
            WHERE sc.series_id = s.id AND c.is_active AND NOT EXISTS (SELECT 1 FROM user_cards uc
              WHERE uc.user_id = ${player.userId} AND uc.character_id = c.id AND uc.quantity > 0))`),
      loadFavoriteCards(db, [player.userId], PROFILE_SHOWCASE_SIZE),
    ])
  return {
    username: player.username,
    displayName: player.displayName,
    avatarUrl: player.avatarUrl,
    memberSince: profile!.createdAt.toISOString(),
    showcase: showcase.get(player.userId) ?? [],
    stats: {
      owned: cards?.owned ?? 0,
      cards: cards?.cards ?? 0,
      catalog: catalog?.value ?? 0,
      seriesCompleted: Number(seriesRows.rows[0]?.value ?? 0),
      achievementsCompleted: completed.length,
      achievementsTotal: totalAchievements?.value ?? 0,
    },
    achievements: completed.map((row) => ({
      key: row.key,
      name: localizedTextSchema.parse(row.name),
      completedAt: row.completedAt!.toISOString(),
    })),
    isMe: player.userId === viewerId,
  }
}

/**
 * Cards a player owns, as seen by a viewer: profile pages and both sides of the trade composer
 * (which cards the viewer wants, which the owner wants more of).
 */
export async function listPlayerCards(
  db: Executor,
  ownerId: string,
  viewerId: string,
  query: PlayerCardsQuery,
): Promise<Paginated<PlayerCard>> {
  const viewerWish = alias(wishlistItems, 'viewer_wish')
  const ownerWish = alias(wishlistItems, 'owner_wish')
  const tradable = sql<number>`(${userCards.quantity} - ${userCards.lockedQuantity})`
  const conditions: SQL[] = [eq(userCards.userId, ownerId), gt(userCards.quantity, 0)]
  if (query.search) {
    const pattern = containsPattern(query.search)
    conditions.push(or(ilike(characters.nameFull, pattern), ilike(characters.nameNative, pattern))!)
  }
  if (query.rarity) conditions.push(eq(rarities.key, query.rarity))
  if (query.tradable) conditions.push(sql`${tradable} > 0`)
  if (query.viewerWishlist) conditions.push(isNotNull(viewerWish.userId))
  const where = and(...conditions)
  const order = {
    rarity: [desc(rarities.sortOrder), asc(characters.nameFull), asc(characters.id)],
    name: [asc(characters.nameFull), asc(characters.id)],
    recent: [desc(userCards.lastObtainedAt), asc(characters.id)],
  }[query.sort]

  const viewerJoin = and(eq(viewerWish.characterId, characters.id), eq(viewerWish.userId, viewerId))
  const ownerJoin = and(eq(ownerWish.characterId, characters.id), eq(ownerWish.userId, ownerId))
  const [rows, [total]] = await Promise.all([
    db
      .select({
        ...characterCardColumns,
        quantity: userCards.quantity,
        tradable,
        inViewerWishlist: sql<boolean>`${viewerWish.userId} IS NOT NULL`,
        inOwnerWishlist: sql<boolean>`${ownerWish.userId} IS NOT NULL`,
        ownerFavorite: sql<boolean>`${favoriteItems.userId} IS NOT NULL`,
      })
      .from(userCards)
      .innerJoin(characters, eq(characters.id, userCards.characterId))
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .leftJoin(viewerWish, viewerJoin)
      .leftJoin(ownerWish, ownerJoin)
      .leftJoin(
        favoriteItems,
        and(eq(favoriteItems.characterId, characters.id), eq(favoriteItems.userId, ownerId)),
      )
      .where(where)
      .orderBy(...order)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ value: count() })
      .from(userCards)
      .innerJoin(characters, eq(characters.id, userCards.characterId))
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .leftJoin(viewerWish, viewerJoin)
      .where(where),
  ])
  return {
    items: rows.map((row) => ({
      ...toCharacterCard(row),
      quantity: row.quantity,
      tradable: Number(row.tradable),
      inViewerWishlist: row.inViewerWishlist,
      inOwnerWishlist: row.inOwnerWishlist,
      ownerFavorite: row.ownerFavorite,
    })),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}

/**
 * A player's wishlist, public like the profile (newest first): whether the owner has each
 * character, and how many copies the viewer could offer in a trade.
 */
export async function getPlayerWishlist(
  db: Executor,
  ownerId: string,
  viewerId: string,
): Promise<PlayerWishlistResponse> {
  const ownerCard = alias(userCards, 'owner_card')
  const viewerCard = alias(userCards, 'viewer_card')
  const [rows, { maxItems }] = await Promise.all([
    db
      .select({
        ...characterCardColumns,
        ownerQuantity: ownerCard.quantity,
        viewerQuantity: viewerCard.quantity,
        viewerLocked: viewerCard.lockedQuantity,
      })
      .from(wishlistItems)
      .innerJoin(characters, eq(characters.id, wishlistItems.characterId))
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .leftJoin(
        ownerCard,
        and(eq(ownerCard.characterId, characters.id), eq(ownerCard.userId, ownerId)),
      )
      .leftJoin(
        viewerCard,
        and(eq(viewerCard.characterId, characters.id), eq(viewerCard.userId, viewerId)),
      )
      .where(eq(wishlistItems.userId, ownerId))
      .orderBy(desc(wishlistItems.createdAt), desc(characters.id)),
    getSetting(db, 'wishlist'),
  ])
  return {
    items: rows.map((row) => ({
      ...toCharacterCard(row),
      ownerOwns: (row.ownerQuantity ?? 0) > 0,
      viewerTradable: Math.max(0, (row.viewerQuantity ?? 0) - (row.viewerLocked ?? 0)),
    })),
    maxItems,
  }
}
