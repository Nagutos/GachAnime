ALTER TABLE "themes" ADD COLUMN "color" text DEFAULT '#ff5d8f' NOT NULL;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_color_hex" CHECK ("themes"."color" ~ '^#[0-9a-f]{6}$');--> statement-breakpoint
-- Packs keep the color of their former CSS art token.
UPDATE "themes" SET "color" = CASE "art_token"
  WHEN 'shonen' THEN '#ff8a3d'
  WHEN 'shojo' THEN '#ff8fc7'
  WHEN 'seinen' THEN '#4f7dff'
  WHEN 'sports' THEN '#2fc48d'
  WHEN 'ecchi' THEN '#e2487d'
  WHEN 'waifus' THEN '#ff6fae'
  WHEN 'husbandos' THEN '#3fb6e8'
  WHEN 'anime' THEN '#b06bff'
  WHEN 'games' THEN '#36d1c4'
  ELSE "color"
END;
