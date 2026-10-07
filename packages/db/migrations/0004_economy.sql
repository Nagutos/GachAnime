CREATE TABLE "wishlist_items" (
	"user_id" text NOT NULL,
	"character_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_user_id_character_id_pk" PRIMARY KEY("user_id","character_id")
);
--> statement-breakpoint
ALTER TABLE "rarities" ADD COLUMN "recycle_value" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rarities" ADD COLUMN "market_min_price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rarities" ADD COLUMN "market_max_price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wishlist_items_character_id_index" ON "wishlist_items" USING btree ("character_id");--> statement-breakpoint
-- Default economy values for the seeded rarities (GAME_DESIGN §3, §4); admins tune them later.
UPDATE "rarities" SET "recycle_value" = v.recycle, "market_min_price" = v.recycle, "market_max_price" = v.max_price
FROM (VALUES ('common', 1, 100), ('rare', 2, 200), ('epic', 10, 1000), ('legendary', 50, 5000), ('mythic', 250, 20000))
  AS v(key, recycle, max_price)
WHERE "rarities"."key" = v.key;
