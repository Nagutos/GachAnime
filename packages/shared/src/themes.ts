import { z } from 'zod'
import { genderClassSchema, rarityKeySchema, seriesKindSchema } from './catalog'
import { localizedTextSchema } from './localized-text'

/**
 * Pack (theme) rules (GAME_DESIGN §5). Series-level rules (tag, genre, format, kind, series)
 * match a character when any active series it belongs to matches, through any of its media.
 */
export type ThemeRule =
  | { type: 'group'; mode: 'all' | 'any'; rules: ThemeRule[] }
  | { type: 'tag'; tag: string; minRank: number }
  | { type: 'genre'; genre: string }
  | { type: 'gender'; gender: 'female' | 'male' | 'unclassified' }
  | { type: 'series_kind'; kind: 'anime' | 'game' | 'other' }
  | { type: 'media_format'; format: string }
  | { type: 'series'; seriesIds: number[] }

export const THEME_RULE_TYPES = [
  'group',
  'tag',
  'genre',
  'gender',
  'series_kind',
  'media_format',
  'series',
] as const

const MAX_DEPTH = 4

export const themeRuleSchema: z.ZodType<ThemeRule> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('group'),
      mode: z.enum(['all', 'any']),
      rules: z.array(themeRuleSchema).max(30),
    }),
    z.object({
      type: z.literal('tag'),
      tag: z.string().trim().min(1).max(100),
      minRank: z.number().int().min(0).max(100),
    }),
    z.object({ type: z.literal('genre'), genre: z.string().trim().min(1).max(50) }),
    z.object({ type: z.literal('gender'), gender: genderClassSchema }),
    z.object({ type: z.literal('series_kind'), kind: seriesKindSchema }),
    z.object({ type: z.literal('media_format'), format: z.string().trim().min(1).max(30) }),
    z.object({
      type: z.literal('series'),
      seriesIds: z.array(z.number().int().positive()).min(1).max(500),
    }),
  ]),
)

function depth(rule: ThemeRule): number {
  return rule.type === 'group' ? 1 + Math.max(0, ...rule.rules.map(depth)) : 0
}

/** The root is always a group; nesting is bounded. */
export const themeRootRuleSchema = themeRuleSchema.refine(
  (rule) => rule.type === 'group' && depth(rule) <= MAX_DEPTH,
  { message: `The root rule must be a group nested at most ${MAX_DEPTH} levels deep` },
)

export const THEME_CATEGORIES = [
  'demographic',
  'genre',
  'characters',
  'media_type',
  'custom',
] as const
export type ThemeCategory = (typeof THEME_CATEGORIES)[number]

export const themeKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{1,63}$/, 'Use lowercase letters, digits, dashes and underscores')

/** A pack as offered in the shop. */
export const themeDtoSchema = z.object({
  key: themeKeySchema,
  name: localizedTextSchema,
  description: localizedTextSchema.nullable(),
  category: z.enum(THEME_CATEGORIES),
  artToken: z.string(),
  freeEnabled: z.boolean(),
  paidEnabled: z.boolean(),
  surchargePercent: z.number().int().min(0).max(1000),
  /** Drawable characters in the pack. */
  characterCount: z.number().int().nonnegative(),
  /** Price of one booster of each paid tier with this pack (surcharge included). */
  prices: z.record(z.string(), z.number().int().nonnegative()),
})
export type ThemeDto = z.infer<typeof themeDtoSchema>

// ─── Admin ───────────────────────────────────────────────────────────────────

export const adminThemeSchema = themeDtoSchema.extend({
  id: z.number().int().positive(),
  rules: themeRuleSchema,
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  poolBuiltAt: z.iso.datetime().nullable(),
})
export type AdminTheme = z.infer<typeof adminThemeSchema>
export const adminThemesResponseSchema = z.object({ themes: z.array(adminThemeSchema) })

const themeFields = {
  name: localizedTextSchema,
  description: localizedTextSchema.nullable().optional(),
  category: z.enum(THEME_CATEGORIES),
  rules: themeRootRuleSchema,
  freeEnabled: z.boolean(),
  paidEnabled: z.boolean(),
  surchargePercent: z.number().int().min(0).max(1000),
  artToken: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,31}$/)
    .default('default'),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
}

export const createThemeSchema = z.object({ key: themeKeySchema, ...themeFields })
export type CreateThemeRequest = z.infer<typeof createThemeSchema>
export const updateThemeSchema = z
  .object(themeFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })
export type UpdateThemeRequest = z.infer<typeof updateThemeSchema>

export const themePreviewRequestSchema = z.object({ rules: themeRootRuleSchema })

/** What a pack would contain with these rules. */
export const themePreviewSchema = z.object({
  total: z.number().int().nonnegative(),
  byRarity: z.array(z.object({ rarityKey: rarityKeySchema, count: z.number().int() })),
  /** Rarities with no character: draws fall back to the next lower, then higher rarity. */
  emptyRarities: z.array(rarityKeySchema),
  samples: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      imageUrl: z.string().nullable(),
      rarityKey: rarityKeySchema,
    }),
  ),
})
export type ThemePreview = z.infer<typeof themePreviewSchema>

/** Values offered by the rule builder. */
export const themeRuleOptionsSchema = z.object({
  tags: z.array(z.object({ name: z.string(), category: z.string().nullable(), media: z.number() })),
  genres: z.array(z.string()),
  formats: z.array(z.string()),
  series: z.array(z.object({ id: z.number().int(), title: z.string() })),
})
export type ThemeRuleOptions = z.infer<typeof themeRuleOptionsSchema>
