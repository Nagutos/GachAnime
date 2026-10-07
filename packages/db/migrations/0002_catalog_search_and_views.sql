-- Name search on characters and series (admin catalog, wiki, trades).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "characters_name_full_trgm" ON "characters" USING gin ("name_full" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "series_title_trgm" ON "series" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
-- A character is drawable when it is active and belongs to at least one active series.
CREATE VIEW "drawable_characters" AS
  SELECT c.id AS character_id, c.rarity_id
  FROM characters c
  WHERE c.is_active
    AND EXISTS (
      SELECT 1 FROM series_characters sc
      JOIN series s ON s.id = sc.series_id
      WHERE sc.character_id = c.id AND s.is_active
    );
