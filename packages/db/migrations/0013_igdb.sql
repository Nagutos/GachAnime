ALTER TYPE "public"."catalog_source" ADD VALUE 'igdb';--> statement-breakpoint
CREATE TABLE "character_games" (
	"character_id" bigint NOT NULL,
	"game_id" bigint NOT NULL,
	CONSTRAINT "character_games_character_id_game_id_pk" PRIMARY KEY("character_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "igdb_games" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "igdb_games_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"igdb_id" integer NOT NULL,
	"series_id" bigint NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"cover_url" text,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"themes" text[] DEFAULT '{}'::text[] NOT NULL,
	"release_year" smallint,
	"site_url" text,
	"characters_synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "igdb_games_igdbId_unique" UNIQUE("igdb_id")
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "igdb_id" integer;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "game_popularity" integer;--> statement-breakpoint
ALTER TABLE "rarities" ADD COLUMN "game_popularity_threshold" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "igdb_key" text;--> statement-breakpoint
ALTER TABLE "character_games" ADD CONSTRAINT "character_games_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_games" ADD CONSTRAINT "character_games_game_id_igdb_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."igdb_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "igdb_games" ADD CONSTRAINT "igdb_games_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_games_game_id_index" ON "character_games" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "igdb_games_series_id_index" ON "igdb_games" USING btree ("series_id");--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_igdbId_unique" UNIQUE("igdb_id");--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_igdbKey_unique" UNIQUE("igdb_key");--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_igdb_key" CHECK (("characters"."source"::text = 'igdb') = ("characters"."igdb_id" IS NOT NULL));--> statement-breakpoint
-- Default thresholds on the IGDB rating count of a character's most popular game (ADR-026);
-- tunable in Admin → Rarities.
UPDATE "rarities" SET "game_popularity_threshold" = CASE "key"
  WHEN 'rare' THEN 150
  WHEN 'epic' THEN 500
  WHEN 'legendary' THEN 1200
  WHEN 'mythic' THEN 2500
  ELSE 0
END;
