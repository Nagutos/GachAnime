-- Local image cache: cached copies of remote images are stored in `characters.image_path` and
-- `series.cover_upload_path` under the `cache/` prefix. When the remote URL changes (AniList
-- import, roster import, admin edit), the cached copy is stale: these triggers drop it so the
-- new remote image shows and the worker caches it again. Uploaded images are never touched.
CREATE FUNCTION drop_stale_character_image_cache() RETURNS trigger AS $$
BEGIN
  IF NEW.image_url IS DISTINCT FROM OLD.image_url AND NEW.image_path LIKE 'cache/%' THEN
    NEW.image_path := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER characters_drop_stale_image_cache
  BEFORE UPDATE OF image_url ON characters
  FOR EACH ROW EXECUTE FUNCTION drop_stale_character_image_cache();
--> statement-breakpoint
CREATE FUNCTION drop_stale_series_cover_cache() RETURNS trigger AS $$
BEGIN
  IF NEW.cover_url IS DISTINCT FROM OLD.cover_url AND NEW.cover_upload_path LIKE 'cache/%' THEN
    NEW.cover_upload_path := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER series_drop_stale_cover_cache
  BEFORE UPDATE OF cover_url ON series
  FOR EACH ROW EXECUTE FUNCTION drop_stale_series_cover_cache();
