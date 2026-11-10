UPDATE "users" SET "permissions" = array_remove("permissions", 'broadcast');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "permissions" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."permission" RENAME TO "permission_old";--> statement-breakpoint
CREATE TYPE "public"."permission" AS ENUM('users', 'traits', 'settings', 'templates');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "permissions" SET DATA TYPE "public"."permission"[] USING "permissions"::text[]::"public"."permission"[];--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "permissions" SET DEFAULT '{}';--> statement-breakpoint
DROP TYPE "public"."permission_old";
