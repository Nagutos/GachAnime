import {
  characters,
  rarities,
  series,
  seriesCharacters,
  type Database,
  type Executor,
} from '@gachanime/db'
import type {
  AdminCharacter,
  AdminCharacterDetail,
  AdminCharactersQuery,
  CharacterRole,
  CreateManualCharacterRequest,
  GenderClassValue,
  Paginated,
  UpdateCharacterRequest,
} from '@gachanime/shared'
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { recordAdminAction } from '../admin/audit'
import { AppError } from '../errors'
import { containsPattern, type AdminActor } from './admin-series'
import { publicImageUrl } from './images'
import { RarityTable } from './rarities'

const effectiveGender = sql<GenderClassValue>`coalesce(${characters.genderOverride}, ${characters.genderClass})`

const characterColumns = {
  id: characters.id,
  source: characters.source,
  anilistId: characters.anilistId,
  manualKey: characters.manualKey,
  nameFull: characters.nameFull,
  nameNative: characters.nameNative,
  nameAlternatives: characters.nameAlternatives,
  description: characters.description,
  imageUrl: characters.imageUrl,
  imagePath: characters.imagePath,
  genderRaw: characters.genderRaw,
  genderClass: characters.genderClass,
  genderOverride: characters.genderOverride,
  favourites: characters.favourites,
  rarityKey: rarities.key,
  rarityOverridden: characters.rarityOverridden,
  isActive: characters.isActive,
  series: sql<{ id: number; title: string }[]>`coalesce((
    SELECT json_agg(json_build_object('id', s.id, 'title', s.title) ORDER BY s.popularity DESC, s.id)
    FROM series_characters sc JOIN series s ON s.id = sc.series_id
    WHERE sc.character_id = "characters"."id"), '[]'::json)`,
  roles: sql<CharacterRole[]>`coalesce((
    SELECT json_agg(DISTINCT cm.role) FROM character_media cm
    WHERE cm.character_id = "characters"."id"), '[]'::json)`,
}

const selectCharacters = (db: Executor) =>
  db
    .select(characterColumns)
    .from(characters)
    .innerJoin(rarities, eq(rarities.id, characters.rarityId))
type CharacterRow = Awaited<ReturnType<typeof selectCharacters>>[number]

function toAdminCharacter(row: CharacterRow, table: RarityTable): AdminCharacter {
  return {
    id: row.id,
    source: row.source,
    anilistId: row.anilistId,
    nameFull: row.nameFull,
    nameNative: row.nameNative,
    imageUrl: publicImageUrl(row.imagePath, row.imageUrl),
    genderRaw: row.genderRaw,
    genderClass: row.genderClass,
    genderOverride: row.genderOverride,
    favourites: row.favourites,
    rarityKey: row.rarityKey,
    rarityOverridden: row.rarityOverridden,
    defaultRarityKey: row.source === 'anilist' ? table.keyForFavourites(row.favourites) : null,
    isActive: row.isActive,
    series: row.series,
    roles: row.roles,
  }
}

export async function listCharacters(
  db: Executor,
  query: AdminCharactersQuery,
): Promise<Paginated<AdminCharacter>> {
  const conditions: SQL[] = []
  if (query.search) {
    const pattern = containsPattern(query.search)
    conditions.push(or(ilike(characters.nameFull, pattern), ilike(characters.nameNative, pattern))!)
  }
  if (query.seriesId) {
    conditions.push(sql`EXISTS (SELECT 1 FROM series_characters sc
      WHERE sc.character_id = "characters"."id" AND sc.series_id = ${query.seriesId})`)
  }
  if (query.rarity) conditions.push(eq(rarities.key, query.rarity))
  if (query.gender) conditions.push(sql`${effectiveGender} = ${query.gender}`)
  if (query.source) conditions.push(eq(characters.source, query.source))
  if (query.active !== undefined) conditions.push(eq(characters.isActive, query.active))
  if (query.overridden !== undefined) {
    conditions.push(eq(characters.rarityOverridden, query.overridden))
  }
  const where = conditions.length ? and(...conditions) : undefined
  const order =
    query.sort === 'name'
      ? [asc(characters.nameFull), asc(characters.id)]
      : query.sort === 'recent'
        ? [desc(characters.createdAt), desc(characters.id)]
        : [sql`${characters.favourites} DESC NULLS LAST`, asc(characters.id)]

  const [table, rows, [total]] = await Promise.all([
    RarityTable.load(db),
    selectCharacters(db)
      .where(where)
      .orderBy(...order)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ value: count() })
      .from(characters)
      .innerJoin(rarities, eq(rarities.id, characters.rarityId))
      .where(where),
  ])
  return {
    items: rows.map((row) => toAdminCharacter(row, table)),
    total: total?.value ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export async function getCharacter(db: Executor, id: number): Promise<AdminCharacterDetail> {
  const [table, [row]] = await Promise.all([
    RarityTable.load(db),
    selectCharacters(db).where(eq(characters.id, id)),
  ])
  if (!row) throw new AppError('NOT_FOUND', `Character #${id} not found`)
  return {
    ...toAdminCharacter(row, table),
    description: row.description,
    nameAlternatives: row.nameAlternatives,
    manualKey: row.manualKey,
  }
}

async function lockCharacter(db: Executor, id: number) {
  const [row] = await db.select().from(characters).where(eq(characters.id, id)).for('update')
  if (!row) throw new AppError('NOT_FOUND', `Character #${id} not found`)
  return row
}

export async function updateCharacter(
  database: Database,
  id: number,
  input: UpdateCharacterRequest,
  actor: AdminActor,
): Promise<void> {
  await database.transaction(async (tx) => {
    const before = await lockCharacter(tx, id)
    const table = await RarityTable.load(tx)
    const editsContent = [input.nameFull, input.nameNative, input.description, input.imageUrl].some(
      (value) => value !== undefined,
    )
    if (editsContent && before.source !== 'manual') {
      throw new AppError('NOT_MANUAL_ENTRY', 'AniList characters are edited on AniList')
    }

    const changes: Partial<typeof characters.$inferInsert> = {}
    if (input.rarity !== undefined) {
      if (input.rarity !== null) {
        changes.rarityId = table.idForKey(input.rarity)
        // Manual characters have no favourites: their rarity is always the admin's choice.
        changes.rarityOverridden = before.source === 'anilist'
      } else if (before.source === 'anilist') {
        changes.rarityId = table.idForFavourites(before.favourites)
        changes.rarityOverridden = false
      } else {
        changes.rarityId = table.lowest.id
      }
    }
    if (input.genderOverride !== undefined) {
      if (before.source === 'manual') {
        // A manual character has no imported gender: edit the class itself.
        changes.genderClass = input.genderOverride ?? 'unclassified'
      } else {
        changes.genderOverride = input.genderOverride
      }
    }
    if (input.isActive !== undefined) changes.isActive = input.isActive
    if (input.nameFull !== undefined) changes.nameFull = input.nameFull
    if (input.nameNative !== undefined) changes.nameNative = input.nameNative
    if (input.description !== undefined) changes.description = input.description
    if (input.imageUrl !== undefined) changes.imageUrl = input.imageUrl

    const [after] = await tx
      .update(characters)
      .set(changes)
      .where(eq(characters.id, id))
      .returning()
    await recordAdminAction(tx, {
      ...actor,
      action: 'character.update',
      targetType: 'character',
      targetId: String(id),
      before: pick(before, Object.keys(changes)),
      after: pick(after!, Object.keys(changes)),
    })
  })
}

function pick(row: object, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((key) => [key, (row as Record<string, unknown>)[key]]))
}

export async function createManualCharacter(
  database: Database,
  input: CreateManualCharacterRequest,
  actor: AdminActor,
): Promise<{ id: number }> {
  return database.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(series)
      .where(eq(series.id, input.seriesId))
      .for('update')
    if (!target) throw new AppError('NOT_FOUND', `Series #${input.seriesId} not found`)
    if (target.source !== 'manual') {
      throw new AppError('NOT_MANUAL_ENTRY', 'Characters can only be added to manual series')
    }
    const table = await RarityTable.load(tx)
    const [created] = await tx
      .insert(characters)
      .values({
        source: 'manual',
        nameFull: input.nameFull,
        nameNative: input.nameNative ?? null,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        genderClass: input.gender,
        rarityId: input.rarity ? table.idForKey(input.rarity) : table.lowest.id,
      })
      .returning()
    await tx.insert(seriesCharacters).values({ seriesId: target.id, characterId: created!.id })
    await recordAdminAction(tx, {
      ...actor,
      action: 'character.create',
      targetType: 'character',
      targetId: String(created!.id),
      after: { ...created, seriesId: target.id },
    })
    return { id: created!.id }
  })
}

/** Stores an uploaded image path on a character; returns the previous path to delete. */
export async function setCharacterImage(
  database: Database,
  id: number,
  imagePath: string,
  actor: AdminActor,
): Promise<{ previousPath: string | null }> {
  return database.transaction(async (tx) => {
    const before = await lockCharacter(tx, id)
    await tx.update(characters).set({ imagePath }).where(eq(characters.id, id))
    await recordAdminAction(tx, {
      ...actor,
      action: 'character.image',
      targetType: 'character',
      targetId: String(id),
      before: { imagePath: before.imagePath },
      after: { imagePath },
    })
    return { previousPath: before.imagePath }
  })
}
