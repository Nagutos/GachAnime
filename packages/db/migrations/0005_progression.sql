CREATE TYPE "public"."mission_kind" AS ENUM('daily', 'once');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "achievements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"metric" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target" bigint NOT NULL,
	"reward_gems" integer NOT NULL,
	"icon_token" text DEFAULT 'star' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_key_unique" UNIQUE("key"),
	CONSTRAINT "achievements_target_positive" CHECK ("achievements"."target" > 0),
	CONSTRAINT "achievements_reward_non_negative" CHECK ("achievements"."reward_gems" >= 0)
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_userId_unique" UNIQUE("user_id"),
	CONSTRAINT "feedback_rating_range" CHECK ("feedback"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "missions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"kind" "mission_kind" NOT NULL,
	"event_type" text NOT NULL,
	"filter" jsonb,
	"target" integer NOT NULL,
	"reward_gems" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "missions_key_unique" UNIQUE("key"),
	CONSTRAINT "missions_target_positive" CHECK ("missions"."target" > 0),
	CONSTRAINT "missions_reward_non_negative" CHECK ("missions"."reward_gems" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" text NOT NULL,
	"achievement_id" bigint NOT NULL,
	"progress" bigint DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "user_achievements_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "user_counters" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "user_counters_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "user_mission_dedup" (
	"user_id" text NOT NULL,
	"mission_id" bigint NOT NULL,
	"period_key" text NOT NULL,
	"subject_id" text NOT NULL,
	CONSTRAINT "user_mission_dedup_user_id_mission_id_period_key_subject_id_pk" PRIMARY KEY("user_id","mission_id","period_key","subject_id")
);
--> statement-breakpoint
CREATE TABLE "user_missions" (
	"user_id" text NOT NULL,
	"mission_id" bigint NOT NULL,
	"period_key" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "user_missions_user_id_mission_id_period_key_pk" PRIMARY KEY("user_id","mission_id","period_key")
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_counters" ADD CONSTRAINT "user_counters_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mission_dedup" ADD CONSTRAINT "user_mission_dedup_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mission_dedup" ADD CONSTRAINT "user_mission_dedup_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_achievements_incomplete_idx" ON "user_achievements" USING btree ("achievement_id") WHERE "user_achievements"."completed_at" IS NULL;--> statement-breakpoint
-- Counters of boosters opened and cards obtained before progression existed.
INSERT INTO "user_counters" ("user_id", "key", "value")
SELECT bo.user_id, 'boosters_opened', sum(bo.quantity) FROM booster_openings bo GROUP BY bo.user_id
UNION ALL
SELECT bo.user_id, 'boosters_opened:' || bt.key, sum(bo.quantity)
FROM booster_openings bo JOIN booster_tiers bt ON bt.id = bo.tier_id GROUP BY bo.user_id, bt.key
UNION ALL
SELECT bo.user_id, 'cards_obtained:' || r.key, count(*)
FROM booster_opening_cards boc
JOIN booster_openings bo ON bo.id = boc.opening_id
JOIN rarities r ON r.id = boc.rarity_id
GROUP BY bo.user_id, r.key;
