-- Economy rebalance (GAME_DESIGN §3): higher mission rewards and recycle values.
-- Only rows still at their previous default are changed, so admin edits are kept. The new daily
-- missions (open 10 / 25 boosters) are inserted by the seed that runs after the migrations.
UPDATE "missions" SET "reward_gems" = 30 WHERE "key" = 'daily_open_booster' AND "reward_gems" = 20;--> statement-breakpoint
UPDATE "missions" SET "reward_gems" = 30 WHERE "key" = 'daily_recycle' AND "reward_gems" = 20;--> statement-breakpoint
UPDATE "missions" SET "reward_gems" = 300 WHERE "key" = 'welcome' AND "reward_gems" = 30;--> statement-breakpoint
UPDATE "missions" SET "sort_order" = CASE "key"
  WHEN 'daily_recycle' THEN 4
  WHEN 'daily_wishlist' THEN 5
  WHEN 'daily_wiki' THEN 6
END
WHERE ("key", "sort_order") IN (('daily_recycle', 2), ('daily_wishlist', 3), ('daily_wiki', 4));--> statement-breakpoint
-- The market minimum price follows the recycle value (GAME_DESIGN §4).
UPDATE "rarities" SET
  "recycle_value" = v."new_value",
  "market_min_price" = CASE WHEN "market_min_price" = v."old_value" THEN v."new_value" ELSE "market_min_price" END
FROM (VALUES
  ('common', 1, 2),
  ('rare', 2, 5),
  ('epic', 10, 25),
  ('legendary', 50, 100),
  ('mythic', 250, 500)
) AS v("key", "old_value", "new_value")
WHERE "rarities"."key" = v."key" AND "rarities"."recycle_value" = v."old_value";
