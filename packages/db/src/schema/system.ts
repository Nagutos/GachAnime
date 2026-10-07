import { bigint, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
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
