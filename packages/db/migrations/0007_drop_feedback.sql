DROP TABLE "feedback" CASCADE;--> statement-breakpoint
-- The feedback feature was removed: its achievement and counters go too (claimed gems stay).
DELETE FROM "achievements" WHERE "metric" = 'feedback_submitted';--> statement-breakpoint
DELETE FROM "missions" WHERE "event_type" = 'feedback_submitted';--> statement-breakpoint
DELETE FROM "user_counters" WHERE "key" = 'feedback_submitted';
