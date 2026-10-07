import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { characters } from './catalog'
import { playerProfiles } from './players'

export const tradeStatus = pgEnum('trade_status', [
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'countered',
  'expired',
  'failed',
])
export const tradeSide = pgEnum('trade_side', ['proposer', 'recipient'])

/** A cards-for-cards offer. The proposer's offered copies are locked while pending. */
export const trades = pgTable(
  'trades',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    proposerId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    recipientId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    status: tradeStatus().notNull().default('pending'),
    /** The offer this one counters. */
    parentTradeId: bigint({ mode: 'number' }).references((): AnyPgColumn => trades.id, {
      onDelete: 'set null',
    }),
    message: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index().on(table.recipientId, table.status),
    index().on(table.proposerId, table.status),
    check('trades_not_self', sql`${table.proposerId} <> ${table.recipientId}`),
  ],
)

export const tradeItems = pgTable(
  'trade_items',
  {
    tradeId: bigint({ mode: 'number' })
      .notNull()
      .references(() => trades.id, { onDelete: 'cascade' }),
    /** `proposer`: given by the proposer; `recipient`: asked from the recipient. */
    side: tradeSide().notNull(),
    characterId: bigint({ mode: 'number' })
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    quantity: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tradeId, table.side, table.characterId] }),
    check('trade_items_quantity_positive', sql`${table.quantity} > 0`),
  ],
)

export const listingStatus = pgEnum('listing_status', ['active', 'sold', 'withdrawn', 'expired'])

/** One card for sale; the listed copy is locked until sold, withdrawn or expired. */
export const marketListings = pgTable(
  'market_listings',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    sellerId: text()
      .notNull()
      .references(() => playerProfiles.userId, { onDelete: 'cascade' }),
    characterId: bigint({ mode: 'number' })
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    price: bigint({ mode: 'number' }).notNull(),
    status: listingStatus().notNull().default('active'),
    buyerId: text().references(() => playerProfiles.userId, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index('market_listings_active_idx')
      .on(table.characterId, table.price)
      .where(sql`${table.status} = 'active'`),
    index().on(table.sellerId, table.status),
    index().on(table.buyerId, table.closedAt),
    index('market_listings_sales_idx')
      .on(table.sellerId, table.closedAt)
      .where(sql`${table.status} = 'sold'`),
    check('market_listings_price_positive', sql`${table.price} > 0`),
  ],
)
