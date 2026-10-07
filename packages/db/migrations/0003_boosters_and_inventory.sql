CREATE TYPE "public"."gem_transaction_reason" AS ENUM('booster_purchase', 'recycle', 'market_sale', 'market_purchase', 'mission_reward', 'achievement_reward', 'admin_adjustment');--> statement-breakpoint
CREATE TABLE "booster_opening_cards" (
	"opening_id" bigint NOT NULL,
	"position" smallint NOT NULL,
	"character_id" bigint NOT NULL,
	"rarity_id" bigint NOT NULL,
	"is_new" boolean NOT NULL,
	CONSTRAINT "booster_opening_cards_opening_id_position_pk" PRIMARY KEY("opening_id","position")
);
--> statement-breakpoint
CREATE TABLE "booster_openings" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "booster_openings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"tier_id" bigint NOT NULL,
	"quantity" smallint NOT NULL,
	"gems_spent" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booster_openings_quantity_positive" CHECK ("booster_openings"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "booster_tiers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "booster_tiers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"weights" jsonb NOT NULL,
	"price_gems" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"art_token" text DEFAULT 'default' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booster_tiers_key_unique" UNIQUE("key"),
	CONSTRAINT "booster_tiers_price_non_negative" CHECK ("booster_tiers"."price_gems" IS NULL OR "booster_tiers"."price_gems" >= 0)
);
--> statement-breakpoint
CREATE TABLE "gem_transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "gem_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"reason" "gem_transaction_reason" NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gem_transactions_balance_non_negative" CHECK ("gem_transactions"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_cards" (
	"user_id" text NOT NULL,
	"character_id" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"locked_quantity" integer DEFAULT 0 NOT NULL,
	"first_obtained_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_obtained_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_cards_user_id_character_id_pk" PRIMARY KEY("user_id","character_id"),
	CONSTRAINT "user_cards_quantity_non_negative" CHECK ("user_cards"."quantity" >= 0),
	CONSTRAINT "user_cards_locked_range" CHECK ("user_cards"."locked_quantity" >= 0 AND "user_cards"."locked_quantity" <= "user_cards"."quantity")
);
--> statement-breakpoint
ALTER TABLE "player_profiles" ADD COLUMN "free_booster_anchor_at" timestamp with time zone DEFAULT 'epoch'::timestamptz NOT NULL;--> statement-breakpoint
ALTER TABLE "booster_opening_cards" ADD CONSTRAINT "booster_opening_cards_opening_id_booster_openings_id_fk" FOREIGN KEY ("opening_id") REFERENCES "public"."booster_openings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booster_opening_cards" ADD CONSTRAINT "booster_opening_cards_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booster_opening_cards" ADD CONSTRAINT "booster_opening_cards_rarity_id_rarities_id_fk" FOREIGN KEY ("rarity_id") REFERENCES "public"."rarities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booster_openings" ADD CONSTRAINT "booster_openings_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booster_openings" ADD CONSTRAINT "booster_openings_tier_id_booster_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."booster_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gem_transactions" ADD CONSTRAINT "gem_transactions_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booster_openings_user_id_created_at_index" ON "booster_openings" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "gem_transactions_user_id_created_at_index" ON "gem_transactions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_cards_owned_by_user_idx" ON "user_cards" USING btree ("user_id") WHERE "user_cards"."quantity" > 0;--> statement-breakpoint
CREATE INDEX "user_cards_owners_idx" ON "user_cards" USING btree ("character_id") WHERE "user_cards"."quantity" > 0;