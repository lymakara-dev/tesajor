CREATE TABLE "route_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_lat" double precision NOT NULL,
	"from_lng" double precision NOT NULL,
	"to_lat" double precision NOT NULL,
	"to_lng" double precision NOT NULL,
	"profile" text NOT NULL,
	"polyline" jsonb NOT NULL,
	"distance_meters" integer NOT NULL,
	"duration_sec" integer NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "route_cache_from_lat_from_lng_to_lat_to_lng_profile_unique" UNIQUE("from_lat","from_lng","to_lat","to_lng","profile")
);
