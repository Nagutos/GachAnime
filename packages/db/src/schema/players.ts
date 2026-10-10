import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { users } from './auth'

/**
 * Game-side profile, one per user. This row is the lock target (`SELECT … FOR UPDATE`) of every
 * operation touching the player's inventory or gems.
 */
export const playerProfiles = pgTable(
  'player_profiles',
  {
    userId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Public handle, lowercase, used in profile URLs. */
    username: text().notNull().unique(),
    /** Preferred UI locale; null until the client reports the detected one. */
    locale: text(),
    gemBalance: bigint({ mode: 'number' }).notNull().default(0),
    /**
     * Free booster timer anchor (GAME_DESIGN §2). The epoch default means a new player starts
     * with every free charge available.
     */
    freeBoosterAnchorAt: timestamp({ withTimezone: true })
      .notNull()
      .default(sql`'epoch'::timestamptz`),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check('player_profiles_gem_balance_non_negative', sql`${table.gemBalance} >= 0`),
    check('player_profiles_username_format', sql`${table.username} ~ '^[a-z0-9_]{3,32}$'`),
  ],
)

export const upgradeKey = pgEnum('upgrade_key', [
  'booster_storage',
  'booster_speed',
  'recycle_bonus',
])

/**
 * Upgrades a player bought with gems (GAME_DESIGN §9): one row per bought upgrade, its level.
 * The effects of each level live in the `upgrades.*` settings.
 */
export const playerUpgrades = pgTable(
  'player_upgrades',
  {
    userId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    key: upgradeKey().notNull(),
    level: smallint().notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.key] }),
    check('player_upgrades_level_positive', sql`${table.level} >= 1`),
  ],
)
