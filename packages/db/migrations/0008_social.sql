CREATE TYPE "public"."listing_status" AS ENUM('active', 'sold', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('proposer', 'recipient');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled', 'countered', 'expired', 'failed');--> statement-breakpoint
CREATE TABLE "market_listings" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "market_listings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"seller_id" text NOT NULL,
	"character_id" bigint NOT NULL,
	"price" bigint NOT NULL,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"buyer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "market_listings_price_positive" CHECK ("market_listings"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "trade_items" (
	"trade_id" bigint NOT NULL,
	"side" "trade_side" NOT NULL,
	"character_id" bigint NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "trade_items_trade_id_side_character_id_pk" PRIMARY KEY("trade_id","side","character_id"),
	CONSTRAINT "trade_items_quantity_positive" CHECK ("trade_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trades_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"proposer_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"status" "trade_status" DEFAULT 'pending' NOT NULL,
	"parent_trade_id" bigint,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "trades_not_self" CHECK ("trades"."proposer_id" <> "trades"."recipient_id")
);
--> statement-breakpoint
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_seller_id_player_profiles_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_buyer_id_player_profiles_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_proposer_id_player_profiles_user_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_recipient_id_player_profiles_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_parent_trade_id_trades_id_fk" FOREIGN KEY ("parent_trade_id") REFERENCES "public"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "market_listings_active_idx" ON "market_listings" USING btree ("character_id","price") WHERE "market_listings"."status" = 'active';--> statement-breakpoint
CREATE INDEX "market_listings_seller_id_status_index" ON "market_listings" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "market_listings_buyer_id_closed_at_index" ON "market_listings" USING btree ("buyer_id","closed_at");--> statement-breakpoint
CREATE INDEX "market_listings_sales_idx" ON "market_listings" USING btree ("seller_id","closed_at") WHERE "market_listings"."status" = 'sold';--> statement-breakpoint
CREATE INDEX "trades_recipient_id_status_index" ON "trades" USING btree ("recipient_id","status");--> statement-breakpoint
CREATE INDEX "trades_proposer_id_status_index" ON "trades" USING btree ("proposer_id","status");--> statement-breakpoint
-- The market and trades exist now: their achievements become active.
UPDATE "achievements" SET "is_active" = true WHERE "metric" IN ('cards_sold', 'trades_completed');
