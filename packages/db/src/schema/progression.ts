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
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import type { LocalizedText } from '@gachanime/shared'
import { playerProfiles } from './players'

const updatedAt = timestamp({ withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date())

/** Lifetime counters per player (`boosters_opened`, `cards_obtained:epic`…). */
export const userCounters = pgTable(
  'user_counters',
  {
    userId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    key: text().notNull(),
    value: bigint({ mode: 'number' }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })],
)

export const missionKind = pgEnum('mission_kind', ['daily', 'once'])

/** A mission: an event type (+ optional filter) to reach `target` times per period. */
export const missions = pgTable(
  'missions',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    key: text().notNull().unique(),
    name: jsonb().$type<LocalizedText>().notNull(),
    description: jsonb().$type<LocalizedText>(),
    kind: missionKind().notNull(),
    eventType: text().notNull(),
    /** Event fields to match, e.g. `{ "tier": "divine" }`. */
    filter: jsonb().$type<Record<string, unknown>>(),
    target: integer().notNull(),
    rewardGems: integer().notNull(),
    isActive: boolean().notNull().default(true),
    sortOrder: smallint().notNull().default(0),
    updatedAt,
  },
  (table) => [
    check('missions_target_positive', sql`${table.target} > 0`),
    check('missions_reward_non_negative', sql`${table.rewardGems} >= 0`),
  ],
)

/** Progress of a player on a mission for one period (`YYYY-MM-DD` or `once`). */
export const userMissions = pgTable(
  'user_missions',
  {
    userId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    missionId: bigint({ mode: 'number' })
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    periodKey: text().notNull(),
    progress: integer().notNull().default(0),
    completedAt: timestamp({ withTimezone: true }),
    claimedAt: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.missionId, table.periodKey] })],
)

/** Subjects already counted for a mission period (a wishlisted character counts once a day). */
export const userMissionDedup = pgTable(
  'user_mission_dedup',
  {
    userId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    missionId: bigint({ mode: 'number' })
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    periodKey: text().notNull(),
    subjectId: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.missionId, table.periodKey, table.subjectId] }),
  ],
)

/** An achievement: a metric (code registry) with params and a target. */
export const achievements = pgTable(
  'achievements',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    key: text().notNull().unique(),
    name: jsonb().$type<LocalizedText>().notNull(),
    description: jsonb().$type<LocalizedText>(),
    metric: text().notNull(),
    params: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    target: bigint({ mode: 'number' }).notNull(),
    rewardGems: integer().notNull(),
    iconToken: text().notNull().default('star'),
    isActive: boolean().notNull().default(true),
    sortOrder: smallint().notNull().default(0),
    updatedAt,
  },
  (table) => [
    check('achievements_target_positive', sql`${table.target} > 0`),
    check('achievements_reward_non_negative', sql`${table.rewardGems} >= 0`),
  ],
)

/** Completion is sticky: `completed_at` is never cleared (GAME_DESIGN §8). */
export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    achievementId: bigint({ mode: 'number' })
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    progress: bigint({ mode: 'number' }).notNull().default(0),
    completedAt: timestamp({ withTimezone: true }),
    claimedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.achievementId] }),
    index('user_achievements_incomplete_idx')
      .on(table.achievementId)
      .where(sql`${table.completedAt} IS NULL`),
  ],
)

/** One feedback per player, editable. */
export const feedback = pgTable(
  'feedback',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text()
      .notNull()
      .unique()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    rating: smallint().notNull(),
    comment: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt,
  },
  (table) => [check('feedback_rating_range', sql`${table.rating} BETWEEN 1 AND 5`)],
)
