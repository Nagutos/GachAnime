-- Packs now only apply to free boosters (paid tiers always draw from the whole catalog).
-- A pack an admin had disabled for free boosters (paid-only) is deactivated, not made free.
UPDATE "themes" SET "is_active" = false WHERE NOT "free_enabled";--> statement-breakpoint
ALTER TABLE "themes" DROP CONSTRAINT "themes_surcharge_range";--> statement-breakpoint
ALTER TABLE "themes" DROP COLUMN "free_enabled";--> statement-breakpoint
ALTER TABLE "themes" DROP COLUMN "paid_enabled";--> statement-breakpoint
ALTER TABLE "themes" DROP COLUMN "surcharge_percent";