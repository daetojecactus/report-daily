UPDATE "users" SET "status" = 'active' WHERE "status" = 'on_leave';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."user_status";--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'blocked');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DATA TYPE "public"."user_status" USING "status"::"public"."user_status";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "on_leave_until";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "notify_empty";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "preset";--> statement-breakpoint
DROP TYPE "public"."report_preset";
