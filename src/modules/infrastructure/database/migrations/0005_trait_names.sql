CREATE TABLE "trait_names" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"source" "source" NOT NULL,
	"source_name" text NOT NULL,
	"source_key" text NOT NULL,
	"ignored" boolean DEFAULT false NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trait_names_source_source_key_unique" UNIQUE("source","source_key"),
	CONSTRAINT "trait_names_source_name_length" CHECK (char_length("trait_names"."source_name") between 1 and 255)
);
