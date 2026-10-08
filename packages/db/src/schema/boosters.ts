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
import type { LocalizedText, ThemeRule } from '@gachanime/shared'
import { characters, rarities } from './catalog'
import { playerProfiles } from './players'

/**
 * A booster tier: per-card rate table and price (ADR-018: a booster = tier × pool).
 * `priceGems` null = free tier (consumes free charges).
 */
export const boosterTiers = pgTable(
  'booster_tiers',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    key: text().notNull().unique(),
    name: jsonb().$type<LocalizedText>().notNull(),
    description: jsonb().$type<LocalizedText>(),
    /** `{ rarityKey: ppm }`, summing to 1 000 000 (validated by Zod). */
    weights: jsonb().$type<Record<string, number>>().notNull(),
    priceGems: bigint({ mode: 'number' }),
    isActive: boolean().notNull().default(true),
    sortOrder: smallint().notNull().default(0),
    /** Design token of the pack art in the web app. */
    artToken: text().notNull().default('default'),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      'booster_tiers_price_non_negative',
      sql`${table.priceGems} IS NULL OR ${table.priceGems} >= 0`,
    ),
  ],
)

export const themeCategory = pgEnum('theme_category', [
  'demographic',
  'genre',
  'characters',
  'media_type',
  'custom',
])

/** A pack: rules selecting characters (GAME_DESIGN §5), opened with free boosters only. */
export const themes = pgTable(
  'themes',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    key: text().notNull().unique(),
    category: themeCategory().notNull(),
    name: jsonb().$type<LocalizedText>().notNull(),
    description: jsonb().$type<LocalizedText>(),
    rules: jsonb().$type<ThemeRule>().notNull(),
    artToken: text().notNull().default('default'),
    /** Kanji on the pack's seal (one or two characters). */
    seal: text().notNull().default('招'),
    isActive: boolean().notNull().default(true),
    sortOrder: smallint().notNull().default(0),
    /** Last rebuild of `theme_characters`; null = never built. */
    poolBuiltAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('themes_seal_length', sql`char_length(${table.seal}) BETWEEN 1 AND 2`)],
)

/** Materialized pack membership, rebuilt on pack save and after catalog changes. */
export const themeCharacters = pgTable(
  'theme_characters',
  {
    themeId: bigint({ mode: 'number' })
      .notNull()
      .references(() => themes.id, { onDelete: 'cascade' }),
    characterId: bigint({ mode: 'number' })
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.themeId, table.characterId] }),
    index().on(table.characterId),
  ],
)

/** One opening request (x1/x5/x10): reveal history and audit. */
export const boosterOpenings = pgTable(
  'booster_openings',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    tierId: bigint({ mode: 'number' })
      .notNull()
      .references(() => boosterTiers.id),
    /** Pack the boosters were drawn from; null = whole catalog. */
    themeId: bigint({ mode: 'number' }).references(() => themes.id, { onDelete: 'set null' }),
    /** Number of boosters opened by the request. */
    quantity: smallint().notNull(),
    gemsSpent: bigint({ mode: 'number' }).notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index().on(table.userId, table.createdAt.desc()),
    check('booster_openings_quantity_positive', sql`${table.quantity} > 0`),
  ],
)

export const boosterOpeningCards = pgTable(
  'booster_opening_cards',
  {
    openingId: bigint({ mode: 'number' })
      .notNull()
      .references(() => boosterOpenings.id, { onDelete: 'cascade' }),
    /** 0-based across the whole request: booster = floor(position / 5). */
    position: smallint().notNull(),
    characterId: bigint({ mode: 'number' })
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    /** Rarity at the time of the draw (an admin may change it later). */
    rarityId: bigint({ mode: 'number' })
      .notNull()
      .references(() => rarities.id),
    /** First copy ever obtained by the player (wiki unlock). */
    isNew: boolean().notNull(),
  },
  (table) => [primaryKey({ columns: [table.openingId, table.position] })],
)

/**
 * Inventory as stacks (ADR-008). The row is kept when `quantity` drops to 0: its existence is the
 * wiki unlock.
 */
export const userCards = pgTable(
  'user_cards',
  {
    userId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    characterId: bigint({ mode: 'number' })
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    quantity: integer().notNull(),
    /** Copies locked by market listings or pending trades. */
    lockedQuantity: integer().notNull().default(0),
    firstObtainedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastObtainedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.characterId] }),
    index('user_cards_owned_by_user_idx')
      .on(table.userId)
      .where(sql`${table.quantity} > 0`),
    index('user_cards_owners_idx')
      .on(table.characterId)
      .where(sql`${table.quantity} > 0`),
    check('user_cards_quantity_non_negative', sql`${table.quantity} >= 0`),
    check(
      'user_cards_locked_range',
      sql`${table.lockedQuantity} >= 0 AND ${table.lockedQuantity} <= ${table.quantity}`,
    ),
  ],
)

export const gemTransactionReason = pgEnum('gem_transaction_reason', [
  'booster_purchase',
  'recycle',
  'market_sale',
  'market_purchase',
  'mission_reward',
  'achievement_reward',
  'admin_adjustment',
])

/** Append-only gem ledger: per user, `sum(amount) = gem_balance`. */
export const gemTransactions = pgTable(
  'gem_transactions',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    amount: bigint({ mode: 'number' }).notNull(),
    balanceAfter: bigint({ mode: 'number' }).notNull(),
    reason: gemTransactionReason().notNull(),
    refType: text(),
    refId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index().on(table.userId, table.createdAt.desc()),
    check('gem_transactions_balance_non_negative', sql`${table.balanceAfter} >= 0`),
  ],
)

/** Characters a player wants (owned or not): collection filter, market and trade highlights. */
export const wishlistItems = pgTable(
  'wishlist_items',
  {
    userId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    characterId: bigint({ mode: 'number' })
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.characterId] }),
    index().on(table.characterId),
  ],
)
