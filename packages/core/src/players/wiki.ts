import {
  characterMedia,
  favoriteItems,
  characters,
  media,
  rarities,
  series,
  seriesCharacters,
  userCards,
  wishlistItems,
  type Executor,
} from '@gachanime/db'
import { recyclableCopies, recycleValuePerCopy } from '@gachanime/game'
import type {
  Paginated,
  ProgressionUpdate,
  WikiCharacter,
  WikiCharactersQuery,
  WikiEntrySummary,
  WikiSeriesDetail,
  WikiSeriesItem,
  WikiSeriesQuery,
} from '@gachanime/shared'
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { containsPattern } from '../catalog/admin-series'
import { publicImageUrl } from '../catalog/images'
import { AppError } from '../errors'
import { emitEvents } from '../progression/engine'
import { getPlayerRecycleFactor } from './upgrades'
import { activeSeriesList } from './cards'

/**
 * Wiki rules (GAME_DESIGN §6): an entry unlocks when the character is first obtained and stays
 * unlocked (the `user_cards` row is kept at quantity 0). Locked entries show only the character.
 */

/**
 * Active series with at least one active character and the player's progress, as a subquery.
 * The progress is aggregated in one pass over `series_characters` (filters on the series id are
 * pushed down into the aggregate by Postgres).
 */
function seriesWithProgress(db: Executor, userId: string) {
  const progress = db
    .select({
      seriesId: seriesCharacters.seriesId,
      characterCount: sql<number>`count(*)::int`.as('character_count'),
      unlockedCount: sql<number>`count(${userCards.characterId})::int`.as('unlocked_count'),
      ownedCount: sql<number>`(count(${userCards.characterId})
        FILTER (WHERE ${userCards.quantity} > 0))::int`.as('owned_count'),
    })
    .from(seriesCharacters)
    .innerJoin(
      characters,
      and(eq(characters.id, seriesCharacters.characterId), eq(characters.isActive, true)),
    )
    .leftJoin(
      userCards,
      and(eq(userCards.characterId, characters.id), eq(userCards.userId, userId)),
    )
    .groupBy(seriesCharacters.seriesId)
    .as('series_progress')
  return db
    .select({
      id: series.id,
      slug: series.slug,
      kind: series.kind,
      source: series.source,
      title: series.title,
      titleEnglish: series.titleEnglish,
      description: series.description,
      coverUrl: series.coverUrl,
      coverUploadPath: series.coverUploadPath,
      popularity: series.popularity,
      // AniList genres live on the primary media; manual and IGDB series hold their own.
      genres: sql<string[]>`CASE WHEN "series"."source" <> 'anilist' THEN "series"."genres"
        ELSE coalesce((SELECT m.genres FROM media m WHERE m.id = "series"."primary_media_id"), '{}')
        END`.as('wiki_genres'),
      siteUrl: sql<string | null>`coalesce(
        (SELECT m.site_url FROM media m WHERE m.id = "series"."primary_media_id"),
        (SELECT g.site_url FROM igdb_games g WHERE g.series_id = "series"."id"
          ORDER BY g.rating_count DESC, g.igdb_id LIMIT 1))`.as('wiki_site_url'),
      characterCount: progress.characterCount,
      unlockedCount: progress.unlockedCount,
      ownedCount: progress.ownedCount,
    })
    .from(series)
    .innerJoin(progress, eq(progress.seriesId, series.id))
    .where(eq(series.isActive, true))
    .as('wiki_series')
}

type SeriesProgressRow = {
  id: number
  slug: string
  kind: WikiSeriesItem['kind']
  title: string
  titleEnglish: string | null
  coverUrl: string | null
  coverUploadPath: string | null
  characterCount: number
  unlockedCount: number
  ownedCount: number
}

function toSeriesItem(row: SeriesProgressRow): WikiSeriesItem {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    titleEnglish: row.titleEnglish,
    coverUrl: publicImageUrl(row.coverUploadPath, row.coverUrl),
    characterCount: row.characterCount,
    unlockedCount: row.unlockedCount,
    ownedCount: row.ownedCount,
  }
}

export async function listWikiSeries(
  db: Executor,
  userId: string,
  query: WikiSeriesQuery,
): Promise<Paginated<WikiSeriesItem>> {
  const ws = seriesWithProgress(db, userId)
  const conditions: SQL[] = [gt(ws.characterCount, 0)]
  if (query.search) {
    const pattern = containsPattern(query.search)
    conditions.push(or(ilike(ws.title, pattern), ilike(ws.titleEnglish, pattern))!)
  }
  if (query.status === 'complete') conditions.push(sql`${ws.ownedCount} = ${ws.characterCount}`)
  if (query.status === 'incomplete') conditions.push(sql`${ws.ownedCount} < ${ws.characterCount}`)
  if (query.status === 'started') conditions.push(gt(ws.ownedCount, 0))
  const where = and(...conditions)
  const order = {
    popularity: [desc(ws.popularity), asc(ws.id)],
    title: [asc(ws.title), asc(ws.id)],
    progress: [
      sql`${ws.ownedCount}::float / ${ws.characterCount} DESC`,
      desc(ws.ownedCount),
      desc(ws.popularity),
      asc(ws.id),
    ],
  }[query.sort]

  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(ws)
      .where(where)
      .orderBy(...order)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(ws).where(where),
  ])
  return {
    items: rows.map(toSeriesItem),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export async function getWikiSeries(
  db: Executor,
  userId: string,
  id: number,
): Promise<WikiSeriesDetail> {
  const ws = seriesWithProgress(db, userId)
  const [row] = await db.select().from(ws).where(eq(ws.id, id))
  if (!row || row.characterCount === 0) throw new AppError('NOT_FOUND', `Series #${id} not found`)
  return {
    ...toSeriesItem(row),
    description: row.description,
    genres: row.genres,
    source: row.source,
    siteUrl: row.siteUrl,
  }
}

/** Entries of an active series; locked ones are shown greyed by the client. */
export async function listWikiSeriesCharacters(
  db: Executor,
  userId: string,
  seriesId: number,
  query: WikiCharactersQuery,
): Promise<Paginated<WikiEntrySummary>> {
  const [target] = await db
    .select({ id: series.id })
    .from(series)
    .where(and(eq(series.id, seriesId), eq(series.isActive, true)))
  if (!target) throw new AppError('NOT_FOUND', `Series #${seriesId} not found`)

  const conditions: SQL[] = [eq(seriesCharacters.seriesId, seriesId)]
  if (query.unlocked === true) conditions.push(isNotNull(userCards.userId))
  if (query.unlocked === false) conditions.push(isNull(userCards.userId))
  const where = and(...conditions)

  const from = () =>
    db
      .select({
        id: characters.id,
        name: characters.nameFull,
        imageUrl: characters.imageUrl,
        imagePath: characters.imagePath,
        rarityKey: rarities.key,
        unlocked: sql<boolean>`${userCards.userId} IS NOT NULL`,
        quantity: sql<number>`coalesce(${userCards.quantity}, 0)`,
        wishlisted: sql<boolean>`${wishlistItems.userId} IS NOT NULL`,
      })
      .from(seriesCharacters)
      .innerJoin(
        characters,
        and(eq(characters.id, seriesCharacters.characterId), eq(characters.isActive, true)),
      )
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .leftJoin(
        userCards,
        and(eq(userCards.characterId, characters.id), eq(userCards.userId, userId)),
      )
      .leftJoin(
        wishlistItems,
        and(eq(wishlistItems.characterId, characters.id), eq(wishlistItems.userId, userId)),
      )

  const [rows, [total]] = await Promise.all([
    from()
      .where(where)
      .orderBy(
        desc(rarities.sortOrder),
        sql`${characters.favourites} DESC NULLS LAST`,
        asc(characters.id),
      )
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ value: count() })
      .from(seriesCharacters)
      .innerJoin(
        characters,
        and(eq(characters.id, seriesCharacters.characterId), eq(characters.isActive, true)),
      )
      .leftJoin(
        userCards,
        and(eq(userCards.characterId, characters.id), eq(userCards.userId, userId)),
      )
      .where(where),
  ])

  return {
    items: rows.map((row): WikiEntrySummary => {
      const card = {
        id: row.id,
        rarityKey: row.rarityKey,
        name: row.name,
        imageUrl: publicImageUrl(row.imagePath, row.imageUrl),
        wishlisted: row.wishlisted,
      }
      return row.unlocked
        ? { ...card, locked: false, quantity: row.quantity }
        : { ...card, locked: true }
    }),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}

/**
 * One wiki entry. Visible when drawable (active, in an active series) or already unlocked by the
 * player: a character disabled later stays readable for those who obtained it.
 */
export async function getWikiCharacter(
  db: Executor,
  userId: string,
  id: number,
): Promise<WikiCharacter> {
  const [row] = await db
    .select({
      id: characters.id,
      source: characters.source,
      anilistId: characters.anilistId,
      siteUrl: characters.siteUrl,
      name: characters.nameFull,
      nameNative: characters.nameNative,
      nameAlternatives: characters.nameAlternatives,
      description: characters.description,
      imageUrl: characters.imageUrl,
      imagePath: characters.imagePath,
      isActive: characters.isActive,
      rarityKey: rarities.key,
      series: activeSeriesList,
      recycleValue: rarities.recycleValue,
      ownerId: userCards.userId,
      quantity: userCards.quantity,
      lockedQuantity: userCards.lockedQuantity,
      firstObtainedAt: userCards.firstObtainedAt,
      wishlisted: sql<boolean>`${wishlistItems.userId} IS NOT NULL`,
      favorite: sql<boolean>`${favoriteItems.userId} IS NOT NULL`,
    })
    .from(characters)
    .innerJoin(rarities, eq(rarities.id, characters.rarityId))
    .leftJoin(
      userCards,
      and(eq(userCards.characterId, characters.id), eq(userCards.userId, userId)),
    )
    .leftJoin(
      wishlistItems,
      and(eq(wishlistItems.characterId, characters.id), eq(wishlistItems.userId, userId)),
    )
    .leftJoin(
      favoriteItems,
      and(eq(favoriteItems.characterId, characters.id), eq(favoriteItems.userId, userId)),
    )
    .where(eq(characters.id, id))

  const unlocked = Boolean(row?.ownerId)
  const drawable = Boolean(row?.isActive && row.series.length > 0)
  if (!row || (!unlocked && !drawable)) {
    throw new AppError('NOT_FOUND', `Character #${id} not found`)
  }
  if (!unlocked || !row.firstObtainedAt) {
    return {
      locked: true,
      id: row.id,
      rarityKey: row.rarityKey,
      series: row.series,
      name: row.name,
      imageUrl: publicImageUrl(row.imagePath, row.imageUrl),
      wishlisted: row.wishlisted,
    }
  }

  const appearances = await db
    .select({
      title: media.titleRomaji,
      format: media.format,
      seasonYear: media.seasonYear,
      role: characterMedia.role,
    })
    .from(characterMedia)
    .innerJoin(media, eq(media.id, characterMedia.mediaId))
    .where(eq(characterMedia.characterId, id))
    .orderBy(sql`${media.seasonYear} ASC NULLS LAST`, asc(media.id))

  return {
    locked: false,
    id: row.id,
    rarityKey: row.rarityKey,
    series: row.series,
    name: row.name,
    nameNative: row.nameNative,
    nameAlternatives: row.nameAlternatives,
    description: row.description,
    imageUrl: publicImageUrl(row.imagePath, row.imageUrl),
    source: row.source,
    sourceUrl: row.anilistId ? `https://anilist.co/character/${row.anilistId}` : row.siteUrl,
    appearances,
    quantity: row.quantity ?? 0,
    lockedQuantity: row.lockedQuantity ?? 0,
    recyclable: recyclableCopies(row.quantity ?? 0, row.lockedQuantity ?? 0),
    recycleValue: recycleValuePerCopy(row.recycleValue, await getPlayerRecycleFactor(db, userId)),
    wishlisted: row.wishlisted,
    favorite: row.favorite,
    firstObtainedAt: row.firstObtainedAt.toISOString(),
  }
}

/** A player read an unlocked entry (daily wiki mission). Locked entries do not count. */
export async function recordWikiView(
  db: Executor,
  userId: string,
  characterId: number,
): Promise<ProgressionUpdate> {
  return emitEvents(db, userId, [{ type: 'wiki_entry_viewed', characterId }])
}
