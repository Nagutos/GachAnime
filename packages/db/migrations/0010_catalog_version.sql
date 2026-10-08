CREATE TABLE "catalog_state" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"version" uuid DEFAULT gen_random_uuid() NOT NULL,
	CONSTRAINT "catalog_state_single_row" CHECK ("catalog_state"."id" = 1)
);
--> statement-breakpoint
INSERT INTO "catalog_state" ("id") VALUES (1);
--> statement-breakpoint
-- A new version whenever drawability (drawable_characters view) or a pack pool may change.
-- Statement-level: an import touching thousands of rows changes the version once per statement.
CREATE FUNCTION bump_catalog_version() RETURNS trigger AS $$
BEGIN
  UPDATE catalog_state SET version = gen_random_uuid() WHERE id = 1;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER characters_bump_catalog_version
  AFTER INSERT OR DELETE OR UPDATE OF is_active, rarity_id ON characters
  FOR EACH STATEMENT EXECUTE FUNCTION bump_catalog_version();
--> statement-breakpoint
CREATE TRIGGER characters_truncate_bump_catalog_version
  AFTER TRUNCATE ON characters
  FOR EACH STATEMENT EXECUTE FUNCTION bump_catalog_version();
--> statement-breakpoint
CREATE TRIGGER series_bump_catalog_version
  AFTER DELETE OR UPDATE OF is_active ON series
  FOR EACH STATEMENT EXECUTE FUNCTION bump_catalog_version();
--> statement-breakpoint
CREATE TRIGGER series_characters_bump_catalog_version
  AFTER INSERT OR UPDATE OR DELETE ON series_characters
  FOR EACH STATEMENT EXECUTE FUNCTION bump_catalog_version();
--> statement-breakpoint
CREATE TRIGGER theme_characters_bump_catalog_version
  AFTER INSERT OR UPDATE OR DELETE ON theme_characters
  FOR EACH STATEMENT EXECUTE FUNCTION bump_catalog_version();
