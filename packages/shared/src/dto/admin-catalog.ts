import { z } from 'zod'
import {
  catalogSourceSchema,
  characterRoleSchema,
  genderClassSchema,
  importJobStatusSchema,
  importParamsSchema,
  importProgressSchema,
  rarityKeySchema,
  seriesKindSchema,
  slugSchema,
} from '../catalog'
import { localizedTextSchema } from '../localized-text'
import { booleanQuery, paginatedSchema, paginationQuerySchema } from './pagination'

const idSchema = z.number().int().positive()

// ─── Rarities ────────────────────────────────────────────────────────────────

export const rarityDtoSchema = z.object({
  id: z.number().int(),
  key: rarityKeySchema,
  sortOrder: z.number().int(),
  name: localizedTextSchema,
  colorToken: z.string(),
  favouritesThreshold: z.number().int(),
})
export type RarityDto = z.infer<typeof rarityDtoSchema>

export const adminRarityStatsSchema = z.object({
  rarities: z.array(
    rarityDtoSchema.extend({
      /** Active characters of this rarity. */
      characterCount: z.number().int(),
      /** Characters whose rarity was set by an admin. */
      overriddenCount: z.number().int(),
    }),
  ),
  totals: z.object({
    characters: z.number().int(),
    drawable: z.number().int(),
    unclassifiedGender: z.number().int(),
    series: z.number().int(),
    activeSeries: z.number().int(),
  }),
})
export type AdminRarityStats = z.infer<typeof adminRarityStatsSchema>

// ─── Series ──────────────────────────────────────────────────────────────────

export const adminSeriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  kind: seriesKindSchema.optional(),
  source: catalogSourceSchema.optional(),
  active: booleanQuery,
})
export type AdminSeriesQuery = z.infer<typeof adminSeriesQuerySchema>

export const adminSeriesItemSchema = z.object({
  id: idSchema,
  slug: z.string(),
  kind: seriesKindSchema,
  source: catalogSourceSchema,
  title: z.string(),
  titleEnglish: z.string().nullable(),
  coverUrl: z.string().nullable(),
  isActive: z.boolean(),
  popularity: z.number().int(),
  mediaCount: z.number().int(),
  characterCount: z.number().int(),
})
export type AdminSeriesItem = z.infer<typeof adminSeriesItemSchema>

export const adminSeriesListSchema = paginatedSchema(adminSeriesItemSchema)

export const adminMediaSchema = z.object({
  id: idSchema,
  anilistId: z.number().int(),
  format: z.string().nullable(),
  titleRomaji: z.string(),
  titleEnglish: z.string().nullable(),
  seasonYear: z.number().int().nullable(),
  popularity: z.number().int(),
  coverUrl: z.string().nullable(),
  siteUrl: z.string().nullable(),
  characterCount: z.number().int(),
  charactersSyncedAt: z.iso.datetime().nullable(),
})
export type AdminMedia = z.infer<typeof adminMediaSchema>

export const adminSeriesDetailSchema = adminSeriesItemSchema.extend({
  description: z.string().nullable(),
  genres: z.array(z.string()),
  primaryMediaId: z.number().int().nullable(),
  media: z.array(adminMediaSchema),
  rarityCounts: z.record(z.string(), z.number().int()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export type AdminSeriesDetail = z.infer<typeof adminSeriesDetailSchema>

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null))

export const createManualSeriesSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(200),
  titleEnglish: nullableText(200).optional(),
  kind: z.enum(['game', 'other']),
  description: nullableText(10_000).optional(),
  coverUrl: z
    .url({ protocol: /^https?$/ })
    .max(2000)
    .nullable()
    .optional(),
  genres: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
})
export type CreateManualSeriesRequest = z.infer<typeof createManualSeriesSchema>

/** `isActive` applies to every series; the other fields only to manual series. */
export const updateSeriesSchema = createManualSeriesSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })
export type UpdateSeriesRequest = z.infer<typeof updateSeriesSchema>

export const mergeSeriesSchema = z.object({
  targetId: idSchema,
  sourceIds: z.array(idSchema).min(1).max(50),
})
export type MergeSeriesRequest = z.infer<typeof mergeSeriesSchema>

export const splitSeriesSchema = z.object({
  /** Media moved to a new series. */
  mediaIds: z.array(idSchema).min(1).max(500),
})
export type SplitSeriesRequest = z.infer<typeof splitSeriesSchema>

export const idResponseSchema = z.object({ id: idSchema })

// ─── Characters ──────────────────────────────────────────────────────────────

export const adminCharactersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  seriesId: z.coerce.number().int().positive().optional(),
  rarity: rarityKeySchema.optional(),
  /** Effective gender (override, else imported class). */
  gender: genderClassSchema.optional(),
  source: catalogSourceSchema.optional(),
  active: booleanQuery,
  overridden: booleanQuery,
  sort: z.enum(['favourites', 'name', 'recent']).default('favourites'),
})
export type AdminCharactersQuery = z.infer<typeof adminCharactersQuerySchema>

export const adminCharacterSchema = z.object({
  id: idSchema,
  source: catalogSourceSchema,
  anilistId: z.number().int().nullable(),
  igdbId: z.number().int().nullable(),
  nameFull: z.string(),
  nameNative: z.string().nullable(),
  /** Best image to display: uploaded file (`/media/…`) or remote URL. */
  imageUrl: z.string().nullable(),
  genderRaw: z.string().nullable(),
  genderClass: genderClassSchema,
  genderOverride: genderClassSchema.nullable(),
  favourites: z.number().int().nullable(),
  /** IGDB characters: rating count of their most popular game (ADR-026). */
  gamePopularity: z.number().int().nullable(),
  rarityKey: rarityKeySchema,
  rarityOverridden: z.boolean(),
  /** Rarity the thresholds would give (favourites or game popularity; null for manual ones). */
  defaultRarityKey: rarityKeySchema.nullable(),
  isActive: z.boolean(),
  series: z.array(z.object({ id: idSchema, title: z.string() })),
  roles: z.array(characterRoleSchema),
})
export type AdminCharacter = z.infer<typeof adminCharacterSchema>

export const adminCharacterListSchema = paginatedSchema(adminCharacterSchema)

export const adminCharacterDetailSchema = adminCharacterSchema.extend({
  description: z.string().nullable(),
  nameAlternatives: z.array(z.string()),
  manualKey: z.string().nullable(),
})
export type AdminCharacterDetail = z.infer<typeof adminCharacterDetailSchema>

export const updateCharacterSchema = z
  .object({
    /** A rarity key sets an override; null restores the favourites-based rarity. */
    rarity: rarityKeySchema.nullable().optional(),
    /** null removes the override. */
    genderOverride: genderClassSchema.nullable().optional(),
    isActive: z.boolean().optional(),
    // Manual characters only:
    nameFull: z.string().trim().min(1).max(200).optional(),
    nameNative: nullableText(200).optional(),
    description: nullableText(10_000).optional(),
    imageUrl: z
      .url({ protocol: /^https?$/ })
      .max(2000)
      .nullable()
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })
export type UpdateCharacterRequest = z.infer<typeof updateCharacterSchema>

export const createManualCharacterSchema = z.object({
  seriesId: idSchema,
  nameFull: z.string().trim().min(1).max(200),
  nameNative: nullableText(200).optional(),
  description: nullableText(10_000).optional(),
  imageUrl: z
    .url({ protocol: /^https?$/ })
    .max(2000)
    .nullable()
    .optional(),
  gender: genderClassSchema.default('unclassified'),
  rarity: rarityKeySchema.optional(),
})
export type CreateManualCharacterRequest = z.infer<typeof createManualCharacterSchema>

export const rosterImportResultSchema = z.object({
  seriesId: idSchema,
  created: z.number().int(),
  updated: z.number().int(),
})
export type RosterImportResult = z.infer<typeof rosterImportResultSchema>

export const imageUploadResultSchema = z.object({ imageUrl: z.string() })

// ─── AniList search & imports ────────────────────────────────────────────────

export const anilistSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
})

export const anilistSearchResultSchema = z.object({
  anilistId: z.number().int(),
  title: z.string(),
  titleEnglish: z.string().nullable(),
  format: z.string().nullable(),
  seasonYear: z.number().int().nullable(),
  popularity: z.number().int(),
  coverUrl: z.string().nullable(),
  /** Series already containing this media, if imported. */
  importedSeriesId: z.number().int().nullable(),
})
export type AniListSearchResult = z.infer<typeof anilistSearchResultSchema>

export const anilistSearchResponseSchema = z.object({
  results: z.array(anilistSearchResultSchema),
})

// ─── IGDB search (video games) ───────────────────────────────────────────────

export const igdbSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
})

export const igdbSearchResultSchema = z.object({
  igdbId: z.number().int(),
  name: z.string(),
  releaseYear: z.number().int().nullable(),
  ratingCount: z.number().int(),
  coverUrl: z.string().nullable(),
  siteUrl: z.string().nullable(),
  /** Series already containing this game, if imported. */
  importedSeriesId: z.number().int().nullable(),
})
export type IgdbSearchResult = z.infer<typeof igdbSearchResultSchema>

export const igdbSearchResponseSchema = z.object({
  results: z.array(igdbSearchResultSchema),
})

export const createImportSchema = importParamsSchema
export type CreateImportRequest = z.input<typeof createImportSchema>

export const importJobDtoSchema = z.object({
  id: idSchema,
  params: importParamsSchema,
  status: importJobStatusSchema,
  progress: importProgressSchema.omit({ mediaAnilistIds: true, gameIgdbIds: true }),
  error: z.string().nullable(),
  requestedBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
})
export type ImportJobDto = z.infer<typeof importJobDtoSchema>

export const importJobListSchema = z.object({
  items: z.array(importJobDtoSchema),
  /** IGDB credentials are set on this instance (video game imports available). */
  igdbConfigured: z.boolean(),
})

// ─── Audit log ───────────────────────────────────────────────────────────────

export const auditLogQuerySchema = paginationQuerySchema.extend({
  targetType: z.string().max(50).optional(),
})

export const auditLogEntrySchema = z.object({
  id: idSchema,
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  before: z.unknown(),
  after: z.unknown(),
  createdAt: z.iso.datetime(),
})
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>

export const auditLogListSchema = paginatedSchema(auditLogEntrySchema)
