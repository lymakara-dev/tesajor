CREATE TABLE "music_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"server_url" text NOT NULL,
	"username" text NOT NULL,
	"subsonic_salt" text NOT NULL,
	"subsonic_token" text NOT NULL,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "music_accounts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "province_playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"province_code" text NOT NULL,
	"playlist_id" text NOT NULL,
	"playlist_name" text NOT NULL,
	CONSTRAINT "province_playlists_user_id_province_code_unique" UNIQUE("user_id","province_code")
);
--> statement-breakpoint
ALTER TABLE "music_accounts" ADD CONSTRAINT "music_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "province_playlists" ADD CONSTRAINT "province_playlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;