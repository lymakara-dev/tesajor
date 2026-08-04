CREATE TABLE "voice_reminder_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agenda_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "voice_reminder_sends_agenda_item_id_user_id_unique" UNIQUE("agenda_item_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "voice_reminder_sends" ADD CONSTRAINT "voice_reminder_sends_agenda_item_id_agenda_items_id_fk" FOREIGN KEY ("agenda_item_id") REFERENCES "public"."agenda_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_reminder_sends" ADD CONSTRAINT "voice_reminder_sends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;