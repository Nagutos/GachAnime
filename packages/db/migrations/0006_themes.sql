CREATE TYPE "public"."theme_category" AS ENUM('demographic', 'genre', 'characters', 'media_type', 'custom');--> statement-breakpoint
CREATE TABLE "theme_characters" (
	"theme_id" bigint NOT NULL,
	"character_id" bigint NOT NULL,
	CONSTRAINT "theme_characters_theme_id_character_id_pk" PRIMARY KEY("theme_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "themes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"category" "theme_category" NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"rules" jsonb NOT NULL,
	"free_enabled" boolean DEFAULT true NOT NULL,
	"paid_enabled" boolean DEFAULT true NOT NULL,
	"surcharge_percent" smallint DEFAULT 20 NOT NULL,
	"art_token" text DEFAULT 'default' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"pool_built_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "themes_key_unique" UNIQUE("key"),
	CONSTRAINT "themes_surcharge_range" CHECK ("themes"."surcharge_percent" BETWEEN 0 AND 1000)
);
--> statement-breakpoint
ALTER TABLE "booster_openings" ADD COLUMN "theme_id" bigint;--> statement-breakpoint
ALTER TABLE "theme_characters" ADD CONSTRAINT "theme_characters_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_characters" ADD CONSTRAINT "theme_characters_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "theme_characters_character_id_index" ON "theme_characters" USING btree ("character_id");--> statement-breakpoint
ALTER TABLE "booster_openings" ADD CONSTRAINT "booster_openings_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;