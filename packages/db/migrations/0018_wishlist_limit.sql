-- Wishlists are limited (setting `wishlist.maxItems`, seeded at 20): the daily "add 3 characters
-- to your wishlist" mission would soon be impossible, so it is replaced by "Recycle 10 duplicates"
-- (inserted by the seed that runs after the migrations). Kept inactive for the claim history.
UPDATE "missions" SET "is_active" = false WHERE "key" = 'daily_wishlist';
