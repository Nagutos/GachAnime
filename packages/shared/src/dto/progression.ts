import { z } from 'zod'
import { localizedTextSchema } from '../localized-text'
import { paginatedSchema, paginationQuerySchema } from './pagination'

const idSchema = z.number().int().positive()

/** Event types missions can listen to (emitted by core services). */
export const GAME_EVENT_TYPES = [
  'account_created',
  'booster_opened',
  'card_obtained',
  'card_recycled',
  'wishlist_added',
  'wiki_entry_viewed',
  'feedback_submitted',
  'card_listed',
  'card_sold',
  'card_bought',
  'trade_completed',
] as const
export type GameEventTypeName = (typeof GAME_EVENT_TYPES)[number]

/** Achievement metrics implemented in code (`@gachanime/game` registry). */
export const METRIC_KEYS = [
  'boosters_opened',
  'cards_obtained',
  'cards_recycled',
  'cards_sold',
  'trades_completed',
  'feedback_submitted',
  'distinct_characters_owned',
  'series_completed',
  'catalog_completion',
] as const
export type MetricKeyName = (typeof METRIC_KEYS)[number]

// ─── Completions (toasts) ────────────────────────────────────────────────────

export const completedObjectiveSchema = z.object({
  kind: z.enum(['mission', 'achievement']),
  id: idSchema,
  name: localizedTextSchema,
  rewardGems: z.number().int().nonnegative(),
})
export type CompletedObjective = z.infer<typeof completedObjectiveSchema>

/** Missions and achievements an action just completed. */
export const progressionUpdateSchema = z.object({ completed: z.array(completedObjectiveSchema) })
export type ProgressionUpdate = z.infer<typeof progressionUpdateSchema>

// ─── Missions ────────────────────────────────────────────────────────────────

export const missionDtoSchema = z.object({
  id: idSchema,
  key: z.string(),
  name: localizedTextSchema,
  description: localizedTextSchema.nullable(),
  kind: z.enum(['daily', 'once']),
  target: z.number().int().positive(),
  rewardGems: z.number().int().nonnegative(),
  progress: z.number().int().nonnegative(),
  periodKey: z.string(),
  completed: z.boolean(),
  claimed: z.boolean(),
})
export type MissionDto = z.infer<typeof missionDtoSchema>

export const missionsResponseSchema = z.object({
  daily: z.array(missionDtoSchema),
  once: z.array(missionDtoSchema),
  periodKey: z.string(),
  nextResetAt: z.iso.datetime(),
  serverTime: z.iso.datetime(),
})
export type MissionsResponse = z.infer<typeof missionsResponseSchema>

export const claimMissionRequestSchema = z.object({
  missionId: idSchema,
  periodKey: z.string().regex(/^(\d{4}-\d{2}-\d{2}|once)$/),
})
export type ClaimMissionRequest = z.infer<typeof claimMissionRequestSchema>

export const claimResultSchema = z.object({
  rewardGems: z.number().int().nonnegative(),
  gemBalance: z.number().int().nonnegative(),
})
export type ClaimResult = z.infer<typeof claimResultSchema>

// ─── Achievements ────────────────────────────────────────────────────────────

export const achievementsQuerySchema = z.object({
  status: z.enum(['all', 'todo', 'completed']).default('all'),
})

export const achievementDtoSchema = z.object({
  id: idSchema,
  key: z.string(),
  name: localizedTextSchema,
  description: localizedTextSchema.nullable(),
  metric: z.enum(METRIC_KEYS),
  target: z.number().int().positive(),
  rewardGems: z.number().int().nonnegative(),
  iconToken: z.string(),
  progress: z.number().int().nonnegative(),
  completedAt: z.iso.datetime().nullable(),
  claimedAt: z.iso.datetime().nullable(),
})
export type AchievementDto = z.infer<typeof achievementDtoSchema>

export const achievementsResponseSchema = z.object({
  items: z.array(achievementDtoSchema),
  completed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
})
export type AchievementsResponse = z.infer<typeof achievementsResponseSchema>

/** Rewards waiting to be claimed (navigation badge). */
export const progressionSummarySchema = z.object({
  claimableMissions: z.number().int().nonnegative(),
  claimableAchievements: z.number().int().nonnegative(),
})
export type ProgressionSummary = z.infer<typeof progressionSummarySchema>

// ─── Feedback ────────────────────────────────────────────────────────────────

export const FEEDBACK_COMMENT_MAX = 2000

export const feedbackRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(FEEDBACK_COMMENT_MAX)
    .nullable()
    .optional()
    .transform((value) => value || null),
})
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>

export const feedbackDtoSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export const myFeedbackResponseSchema = z.object({ feedback: feedbackDtoSchema.nullable() })
export const submitFeedbackResponseSchema = myFeedbackResponseSchema.extend({
  progression: progressionUpdateSchema,
})

export const adminFeedbackItemSchema = feedbackDtoSchema.extend({
  id: idSchema,
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
})
export const adminFeedbackListSchema = paginatedSchema(adminFeedbackItemSchema).extend({
  average: z.number().nullable(),
  /** Count per rating, index 0 = 1 star. */
  distribution: z.array(z.number().int().nonnegative()).length(5),
})
export type AdminFeedbackList = z.infer<typeof adminFeedbackListSchema>
export const adminFeedbackQuerySchema = paginationQuerySchema

// ─── Admin: missions and achievements ────────────────────────────────────────

const objectiveBase = {
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/, 'Use lowercase letters, digits and underscores'),
  name: localizedTextSchema,
  description: localizedTextSchema.nullable().optional(),
  rewardGems: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
}

export const adminMissionSchema = z.object({
  id: idSchema,
  key: z.string(),
  name: localizedTextSchema,
  description: localizedTextSchema.nullable(),
  kind: z.enum(['daily', 'once']),
  eventType: z.enum(GAME_EVENT_TYPES),
  filter: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).nullable(),
  target: z.number().int().positive(),
  rewardGems: z.number().int().nonnegative(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
})
export type AdminMission = z.infer<typeof adminMissionSchema>
export const adminMissionsResponseSchema = z.object({ missions: z.array(adminMissionSchema) })

export const createMissionSchema = z.object({
  ...objectiveBase,
  kind: z.enum(['daily', 'once']),
  eventType: z.enum(GAME_EVENT_TYPES),
  filter: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .nullable()
    .optional(),
  target: z.number().int().min(1).max(1_000_000),
})
export type CreateMissionRequest = z.infer<typeof createMissionSchema>
export const updateMissionSchema = createMissionSchema
  .omit({ key: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })
export type UpdateMissionRequest = z.infer<typeof updateMissionSchema>

export const adminAchievementSchema = z.object({
  id: idSchema,
  key: z.string(),
  name: localizedTextSchema,
  description: localizedTextSchema.nullable(),
  metric: z.enum(METRIC_KEYS),
  params: z.record(z.string(), z.unknown()),
  target: z.number().int().positive(),
  rewardGems: z.number().int().nonnegative(),
  iconToken: z.string(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  /** Players who completed it. */
  completions: z.number().int().nonnegative(),
})
export type AdminAchievement = z.infer<typeof adminAchievementSchema>
export const adminAchievementsResponseSchema = z.object({
  achievements: z.array(adminAchievementSchema),
})

export const createAchievementSchema = z.object({
  ...objectiveBase,
  metric: z.enum(METRIC_KEYS),
  /** Validated against the metric's params schema by the service. */
  params: z.record(z.string(), z.unknown()).default({}),
  target: z.number().int().min(1).max(1_000_000_000),
  iconToken: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,31}$/)
    .default('star'),
})
export type CreateAchievementRequest = z.infer<typeof createAchievementSchema>
export const updateAchievementSchema = createAchievementSchema
  .omit({ key: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })
export type UpdateAchievementRequest = z.infer<typeof updateAchievementSchema>
