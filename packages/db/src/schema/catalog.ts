import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  primaryKey,
  smallint,
  text,
  timestamp,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import type { LocalizedText } from '@gachanime/shared'
import { users } from './auth'

export const seriesKind = pgEnum('series_kind', ['anime', 'game', 'other'])
export const catalogSource = pgEnum('catalog_source', ['anilist', 'manual'])
export const characterRole = pgEnum('character_role', ['MAIN', 'SUPPORTING', 'BACKGROUND'])
export const genderClass = pgEnum('gender_class', ['female', 'male', 'unclassified'])
export const importJobStatus = pgEnum('import_job_status', [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
])

const updatedAt = timestamp({ withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date())

/** Card rarities. The default rarity of an AniList character comes from `favouritesThreshold`. */
export const rarities = pgTable('rarities', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  key: text().notNull().unique(),
  sortOrder: smallint().notNull().unique(),
  name: jsonb().$type<LocalizedText>().notNull(),
  /** Design token suffix used by the web app (`rarity-<token>`). */
  colorToken: text().notNull(),
  /** Minimum AniList favourites for this rarity (absolute threshold, ADR-015). */
  favouritesThreshold: integer().notNull(),
  /** Gems earned by recycling one duplicate of this rarity. */
  recycleValue: integer().notNull().default(0),
  /** Market price bounds (Phase 6): the minimum defaults to the recycle value. */
  marketMinPrice: integer().notNull().default(0),
  marketMaxPrice: integer().notNull().default(0),
})

/**
 * A collectible series. AniList series group a whole franchise (ADR-014); manual series (games…)
 * have no media and their characters are linked directly through `series_characters`.
 */
export const series = pgTable(
  'series',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text().notNull().unique(),
    kind: seriesKind().notNull(),
    source: catalogSource().notNull(),
    title: text().notNull(),
    titleEnglish: text(),
    description: text(),
    coverUrl: text(),
    /** Uploaded cover (manual series), relative to the uploads directory. */
    coverUploadPath: text(),
    /** Manual series only; AniList genres live on `media`. */
    genres: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isActive: boolean().notNull().default(true),
    primaryMediaId: bigint({ mode: 'number' }).references((): AnyPgColumn => media.id, {
      onDelete: 'set null',
    }),
    popularity: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt,
  },
  (table) => [index().on(table.isActive)],
)

/** One AniList anime entry (a season, a movie, an OVA…). */
export const media = pgTable(
  'media',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    anilistId: integer().notNull().unique(),
    /** Null only between the discovery and grouping steps of an import. */
    seriesId: bigint({ mode: 'number' }).references(() => series.id, { onDelete: 'cascade' }),
    format: text(),
    titleRomaji: text().notNull(),
    titleEnglish: text(),
    titleNative: text(),
    description: text(),
    seasonYear: smallint(),
    popularity: integer().notNull().default(0),
    favourites: integer().notNull().default(0),
    isAdult: boolean().notNull().default(false),
    genres: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    coverUrl: text(),
    siteUrl: text(),
    /** AniList ids of anime linked by a franchise relation (sequel, prequel, side story…). */
    franchiseRelations: integer()
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    /** Last time the media itself was fetched from AniList. */
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Last time its full character list was imported (null = never completed). */
    charactersSyncedAt: timestamp({ withTimezone: true }),
    updatedAt,
  },
  (table) => [index().on(table.seriesId), index('media_genres_gin').using('gin', table.genres)],
)

export const anilistTags = pgTable('anilist_tags', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  anilistId: integer().notNull().unique(),
  name: text().notNull(),
  category: text(),
  isAdult: boolean().notNull().default(false),
})

export const mediaTags = pgTable(
  'media_tags',
  {
    mediaId: bigint({ mode: 'number' })
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    tagId: bigint({ mode: 'number' })
      .notNull()
      .references(() => anilistTags.id, { onDelete: 'cascade' }),
    /** AniList relevance, 0–100 (used by "tag ≥ 60" pack rules). */
    rank: smallint().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.mediaId, table.tagId] }),
    index().on(table.tagId, table.rank),
  ],
)

export const characters = pgTable(
  'characters',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    source: catalogSource().notNull(),
    /** Upsert key for AniList re-imports. */
    anilistId: integer().unique(),
    /** Upsert key for manual roster imports: `<series slug>/<roster key>`. */
    manualKey: text().unique(),
    nameFull: text().notNull(),
    nameNative: text(),
    nameAlternatives: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** AniList markdown, rendered sanitized. */
    description: text(),
    /** Remote image (AniList CDN, or a URL given in a roster import). */
    imageUrl: text(),
    /** Uploaded or cached image, relative to the uploads directory; wins over `imageUrl`. */
    imagePath: text(),
    genderRaw: text(),
    genderClass: genderClass().notNull().default('unclassified'),
    /** Admin decision, wins over `genderClass`. */
    genderOverride: genderClass(),
    /** AniList favourites (null for manual characters). */
    favourites: integer(),
    rarityId: bigint({ mode: 'number' })
      .notNull()
      .references(() => rarities.id),
    /** Re-imports never change the rarity when true. */
    rarityOverridden: boolean().notNull().default(false),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt,
  },
  (table) => [
    index('characters_rarity_active_idx')
      .on(table.rarityId)
      .where(sql`${table.isActive}`),
    check(
      'characters_source_key',
      sql`(${table.source} = 'anilist') = (${table.anilistId} IS NOT NULL)`,
    ),
  ],
)

/** Provenance: which AniList media a character appears in, with its role. */
export const characterMedia = pgTable(
  'character_media',
  {
    characterId: bigint({ mode: 'number' })
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    mediaId: bigint({ mode: 'number' })
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    role: characterRole().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.characterId, table.mediaId] }),
    index().on(table.mediaId),
  ],
)

/**
 * Canonical series membership: derived from `character_media` for AniList series, edited directly
 * for manual series.
 */
export const seriesCharacters = pgTable(
  'series_characters',
  {
    seriesId: bigint({ mode: 'number' })
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    characterId: bigint({ mode: 'number' })
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.seriesId, table.characterId] }),
    index().on(table.characterId),
  ],
)

/** A catalog import (AniList), with resumable progress. */
export const importJobs = pgTable(
  'import_jobs',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    requestedBy: text().references(() => users.id, { onDelete: 'set null' }),
    params: jsonb().notNull(),
    status: importJobStatus().notNull().default('queued'),
    progress: jsonb().notNull().default({}),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** First start; data fetched since then counts as fresh when the job resumes. */
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    updatedAt,
  },
  (table) => [index().on(table.createdAt)],
)

/** Characters that boosters can draw: active and linked to at least one active series. */
export const drawableCharacters = pgView('drawable_characters', {
  characterId: bigint({ mode: 'number' }).notNull(),
  rarityId: bigint({ mode: 'number' }).notNull(),
}).existing()
