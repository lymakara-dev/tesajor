CREATE TABLE "place_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cell" text NOT NULL,
	"category" text NOT NULL,
	"results_json" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "place_cache_cell_category_unique" UNIQUE("cell","category")
);
