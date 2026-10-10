CREATE TYPE "public"."upgrade_key" AS ENUM('booster_storage', 'booster_speed', 'recycle_bonus');--> statement-breakpoint
ALTER TYPE "public"."gem_transaction_reason" ADD VALUE 'upgrade_purchase';--> statement-breakpoint
CREATE TABLE "player_upgrades" (
	"user_id" text NOT NULL,
	"key" "upgrade_key" NOT NULL,
	"level" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_upgrades_user_id_key_pk" PRIMARY KEY("user_id","key"),
	CONSTRAINT "player_upgrades_level_positive" CHECK ("player_upgrades"."level" >= 1)
);
--> statement-breakpoint
ALTER TABLE "player_upgrades" ADD CONSTRAINT "player_upgrades_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;