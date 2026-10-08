import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'

/** Tunable game settings, one JSON value per key, validated by `settingsSchemas` (shared). */
export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  updatedBy: text().references(() => users.id, { onDelete: 'set null' }),
})

/** Every admin mutation: who, what, when, with before/after snapshots. */
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    actorId: text().references(() => users.id, { onDelete: 'set null' }),
    action: text().notNull(),
    targetType: text().notNull(),
    targetId: text(),
    before: jsonb(),
    after: jsonb(),
    ip: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.createdAt), index().on(table.targetType, table.targetId)],
)

/**
 * Single row whose `version` changes (database triggers, migration 0010) whenever the set of
 * drawable characters or a pack pool may have changed. Processes cache booster pools per version.
 */
export const catalogState = pgTable(
  'catalog_state',
  {
    id: smallint().primaryKey().default(1),
    version: uuid().notNull().defaultRandom(),
  },
  (table) => [check('catalog_state_single_row', sql`${table.id} = 1`)],
)
