CREATE TYPE "public"."weekly_slot" AS ENUM('genre', 'tag', 'series');--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "weekly_slot" "weekly_slot";--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "weekly_from" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "themes_weekly_unique" ON "themes" USING btree ("weekly_slot","weekly_from");--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_weekly_both" CHECK (("themes"."weekly_slot" IS NULL) = ("themes"."weekly_from" IS NULL));