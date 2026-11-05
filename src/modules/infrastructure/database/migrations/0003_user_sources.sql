CREATE TYPE "public"."source" AS ENUM('gitlab');--> statement-breakpoint
CREATE TABLE "user_sources" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "source" NOT NULL,
	"external_id" text NOT NULL,
	"username" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sources_user_id_source_unique" UNIQUE("user_id","source"),
	CONSTRAINT "user_sources_source_external_id_unique" UNIQUE("source","external_id"),
	CONSTRAINT "user_sources_external_id_length" CHECK (char_length("user_sources"."external_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_gitlab_user_id_unique";--> statement-breakpoint
ALTER TABLE "user_sources" ADD CONSTRAINT "user_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "user_sources" ("user_id", "source", "external_id", "username") SELECT "id", 'gitlab', "gitlab_user_id"::text, "gitlab_username" FROM "users";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "gitlab_user_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "gitlab_username";