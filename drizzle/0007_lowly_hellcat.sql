CREATE TABLE "voice_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agenda_item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"locale" text NOT NULL,
	"text_hash" text NOT NULL,
	"audio_url" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "voice_clips_agenda_item_id_kind_locale_text_hash_unique" UNIQUE("agenda_item_id","kind","locale","text_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "voice_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "voice_locale" text DEFAULT 'km' NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_clips" ADD CONSTRAINT "voice_clips_agenda_item_id_agenda_items_id_fk" FOREIGN KEY ("agenda_item_id") REFERENCES "public"."agenda_items"("id") ON DELETE cascade ON UPDATE no action;