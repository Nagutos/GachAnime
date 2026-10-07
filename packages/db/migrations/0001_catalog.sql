CREATE TYPE "public"."catalog_source" AS ENUM('anilist', 'manual');--> statement-breakpoint
CREATE TYPE "public"."character_role" AS ENUM('MAIN', 'SUPPORTING', 'BACKGROUND');--> statement-breakpoint
CREATE TYPE "public"."gender_class" AS ENUM('female', 'male', 'unclassified');--> statement-breakpoint
CREATE TYPE "public"."import_job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."series_kind" AS ENUM('anime', 'game', 'other');--> statement-breakpoint
CREATE TABLE "anilist_tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "anilist_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"anilist_id" integer NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"is_adult" boolean DEFAULT false NOT NULL,
	CONSTRAINT "anilist_tags_anilistId_unique" UNIQUE("anilist_id")
);
--> statement-breakpoint
CREATE TABLE "character_media" (
	"character_id" bigint NOT NULL,
	"media_id" bigint NOT NULL,
	"role" character_role NOT NULL,
	CONSTRAINT "character_media_character_id_media_id_pk" PRIMARY KEY("character_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "characters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source" "catalog_source" NOT NULL,
	"anilist_id" integer,
	"manual_key" text,
	"name_full" text NOT NULL,
	"name_native" text,
	"name_alternatives" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"image_url" text,
	"image_path" text,
	"gender_raw" text,
	"gender_class" "gender_class" DEFAULT 'unclassified' NOT NULL,
	"gender_override" "gender_class",
	"favourites" integer,
	"rarity_id" bigint NOT NULL,
	"rarity_overridden" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_anilistId_unique" UNIQUE("anilist_id"),
	CONSTRAINT "characters_manualKey_unique" UNIQUE("manual_key"),
	CONSTRAINT "characters_source_key" CHECK (("characters"."source" = 'anilist') = ("characters"."anilist_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"requested_by" text,
	"params" jsonb NOT NULL,
	"status" "import_job_status" DEFAULT 'queued' NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"anilist_id" integer NOT NULL,
	"series_id" bigint,
	"format" text,
	"title_romaji" text NOT NULL,
	"title_english" text,
	"title_native" text,
	"description" text,
	"season_year" smallint,
	"popularity" integer DEFAULT 0 NOT NULL,
	"favourites" integer DEFAULT 0 NOT NULL,
	"is_adult" boolean DEFAULT false NOT NULL,
	"genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"cover_url" text,
	"site_url" text,
	"franchise_relations" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"characters_synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_anilistId_unique" UNIQUE("anilist_id")
);
--> statement-breakpoint
CREATE TABLE "media_tags" (
	"media_id" bigint NOT NULL,
	"tag_id" bigint NOT NULL,
	"rank" smallint NOT NULL,
	CONSTRAINT "media_tags_media_id_tag_id_pk" PRIMARY KEY("media_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "rarities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rarities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"sort_order" smallint NOT NULL,
	"name" jsonb NOT NULL,
	"color_token" text NOT NULL,
	"favourites_threshold" integer NOT NULL,
	CONSTRAINT "rarities_key_unique" UNIQUE("key"),
	CONSTRAINT "rarities_sortOrder_unique" UNIQUE("sort_order")
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "series_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"kind" "series_kind" NOT NULL,
	"source" "catalog_source" NOT NULL,
	"title" text NOT NULL,
	"title_english" text,
	"description" text,
	"cover_url" text,
	"cover_upload_path" text,
	"genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"primary_media_id" bigint,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "series_characters" (
	"series_id" bigint NOT NULL,
	"character_id" bigint NOT NULL,
	CONSTRAINT "series_characters_series_id_character_id_pk" PRIMARY KEY("series_id","character_id")
);
--> statement-breakpoint
ALTER TABLE "character_media" ADD CONSTRAINT "character_media_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_media" ADD CONSTRAINT "character_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_rarity_id_rarities_id_fk" FOREIGN KEY ("rarity_id") REFERENCES "public"."rarities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_tag_id_anilist_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."anilist_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_primary_media_id_media_id_fk" FOREIGN KEY ("primary_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_characters" ADD CONSTRAINT "series_characters_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_characters" ADD CONSTRAINT "series_characters_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_media_media_id_index" ON "character_media" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "characters_rarity_active_idx" ON "characters" USING btree ("rarity_id") WHERE "characters"."is_active";--> statement-breakpoint
CREATE INDEX "import_jobs_created_at_index" ON "import_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "media_series_id_index" ON "media" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "media_genres_gin" ON "media" USING gin ("genres");--> statement-breakpoint
CREATE INDEX "media_tags_tag_id_rank_index" ON "media_tags" USING btree ("tag_id","rank");--> statement-breakpoint
CREATE INDEX "series_is_active_index" ON "series" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "series_characters_character_id_index" ON "series_characters" USING btree ("character_id");