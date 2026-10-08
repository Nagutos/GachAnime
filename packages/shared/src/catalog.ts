import { z } from 'zod'

export const seriesKindSchema = z.enum(['anime', 'game', 'other'])
export type SeriesKind = z.infer<typeof seriesKindSchema>

export const catalogSourceSchema = z.enum(['anilist', 'manual', 'igdb'])
export type CatalogSource = z.infer<typeof catalogSourceSchema>

export const genderClassSchema = z.enum(['female', 'male', 'unclassified'])
export type GenderClassValue = z.infer<typeof genderClassSchema>

export const characterRoleSchema = z.enum(['MAIN', 'SUPPORTING', 'BACKGROUND'])
export type CharacterRole = z.infer<typeof characterRoleSchema>

export const rarityKeySchema = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/, 'Invalid rarity key')

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and dashes')
  .max(80)

/** Lowercase ASCII slug: `Shingeki no Kyojin: Season 2` → `shingeki-no-kyojin-season-2`. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

// ─── AniList import ──────────────────────────────────────────────────────────

export const IMPORT_TOP_DEFAULT = 500

export const IGDB_IMPORT_TOP_DEFAULT = 200

/** AniList genre or tag names (`Romance`, `Shoujo`…) restricting a top import. */
const anilistFilterSchema = z.array(z.string().trim().min(1).max(64)).max(20).default([])

/** AniList modes: `top`, `ids`. IGDB (video games, ADR-025) modes: `igdb_top`, `igdb_ids`. */
export const importParamsSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('top'),
    /** The N most popular anime (AniList popularity). */
    top: z.number().int().min(1).max(5000).default(IMPORT_TOP_DEFAULT),
    expandFranchise: z.boolean().default(true),
    /** Only anime with one of these genres, and one of these tags (empty = no restriction). */
    genres: anilistFilterSchema,
    tags: anilistFilterSchema,
  }),
  z.object({
    mode: z.literal('ids'),
    anilistIds: z.array(z.number().int().positive()).min(1).max(500),
    expandFranchise: z.boolean().default(true),
  }),
  z.object({
    mode: z.literal('igdb_top'),
    /** The N most rated main games on IGDB. */
    top: z.number().int().min(1).max(2000).default(IGDB_IMPORT_TOP_DEFAULT),
  }),
  z.object({
    mode: z.literal('igdb_ids'),
    igdbIds: z.array(z.number().int().positive()).min(1).max(500),
  }),
])
export type ImportParams = z.infer<typeof importParamsSchema>

/** Genres and tags a top import can be restricted to (from AniList). */
export const anilistFiltersSchema = z.object({
  genres: z.array(z.string()),
  tags: z.array(z.object({ name: z.string(), category: z.string() })),
})
export type AniListFilters = z.infer<typeof anilistFiltersSchema>

export type ImportSource = 'anilist' | 'igdb'

export function importSource(params: ImportParams): ImportSource {
  return params.mode === 'igdb_top' || params.mode === 'igdb_ids' ? 'igdb' : 'anilist'
}

export const importPhaseSchema = z.enum(['discover', 'group', 'characters', 'finalize', 'done'])
export type ImportPhase = z.infer<typeof importPhaseSchema>

export const importProgressSchema = z.object({
  phase: importPhaseSchema.default('discover'),
  /** AniList ids of every media reached by the discovery (seeds + franchises). */
  mediaAnilistIds: z.array(z.number().int()).default([]),
  /** IGDB imports: ids of the games to import (`media*` counters count games). */
  gameIgdbIds: z.array(z.number().int()).default([]),
  seedCount: z.number().int().default(0),
  mediaTotal: z.number().int().default(0),
  mediaCharactersDone: z.number().int().default(0),
  charactersUpserted: z.number().int().default(0),
  charactersSkippedNoImage: z.number().int().default(0),
  seriesCreated: z.number().int().default(0),
  requests: z.number().int().default(0),
})
export type ImportProgress = z.infer<typeof importProgressSchema>

export const importJobStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
])
export type ImportJobStatus = z.infer<typeof importJobStatusSchema>

// ─── Manual roster import (games…) ───────────────────────────────────────────

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional()
const httpUrl = z.url({ protocol: /^https?$/ }).max(2000)

export const rosterCharacterSchema = z.object({
  /** Stable key inside the series, used to update the character on re-import. */
  key: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Use lowercase letters, digits, dashes and underscores')
    .max(80),
  name: z.string().trim().min(1).max(200),
  nameNative: optionalText(200),
  alternativeNames: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  description: optionalText(10_000),
  imageUrl: httpUrl.optional(),
  gender: genderClassSchema.default('unclassified'),
  /** Rarity key; defaults to the lowest rarity. */
  rarity: rarityKeySchema.optional(),
})

export const rosterImportSchema = z.object({
  series: z.object({
    slug: slugSchema,
    title: z.string().trim().min(1).max(200),
    titleEnglish: optionalText(200),
    kind: z.enum(['game', 'other']).default('game'),
    description: optionalText(10_000),
    coverUrl: httpUrl.optional(),
    genres: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  }),
  characters: z
    .array(rosterCharacterSchema)
    .max(2000)
    .refine((items) => new Set(items.map((item) => item.key)).size === items.length, {
      message: 'Character keys must be unique',
    }),
})
export type RosterImport = z.infer<typeof rosterImportSchema>
export type RosterImportInput = z.input<typeof rosterImportSchema>

/** Accepted image uploads (characters, series covers). */
export const IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024
export const IMAGE_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
