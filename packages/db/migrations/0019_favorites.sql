CREATE TABLE "favorite_items" (
	"user_id" text NOT NULL,
	"character_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_items_user_id_character_id_pk" PRIMARY KEY("user_id","character_id")
);
--> statement-breakpoint
ALTER TABLE "favorite_items" ADD CONSTRAINT "favorite_items_user_id_player_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."player_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_items" ADD CONSTRAINT "favorite_items_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorite_items_user_id_position_index" ON "favorite_items" USING btree ("user_id","position");