ALTER TABLE "themes" ADD COLUMN "seal" text DEFAULT '招' NOT NULL;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_seal_length" CHECK (char_length("themes"."seal") BETWEEN 1 AND 2);--> statement-breakpoint
-- Kanji of the default packs (admins can change them).
UPDATE "themes" SET "seal" = CASE "key"
  WHEN 'shonen' THEN '少'
  WHEN 'shojo' THEN '姫'
  WHEN 'seinen' THEN '青'
  WHEN 'sports' THEN '競'
  WHEN 'ecchi' THEN '艶'
  WHEN 'waifus' THEN '女'
  WHEN 'husbandos' THEN '男'
  ELSE "seal"
END;
