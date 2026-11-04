CREATE TYPE "public"."channel" AS ENUM('telegram', 'slack');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."job_role" AS ENUM('developer', 'qa', 'project_manager', 'system_analyst', 'devops');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('ru', 'en');--> statement-breakpoint
CREATE TYPE "public"."permission" AS ENUM('users', 'labels', 'broadcast', 'settings');--> statement-breakpoint
CREATE TYPE "public"."report_preset" AS ENUM('standard', 'qa', 'analyst');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'on_leave', 'blocked');--> statement-breakpoint
CREATE TABLE "user_channels" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"external_id" text NOT NULL,
	"reachable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_channels_user_id_channel_unique" UNIQUE("user_id","channel"),
	CONSTRAINT "user_channels_channel_external_id_unique" UNIQUE("channel","external_id"),
	CONSTRAINT "user_channels_external_id_length" CHECK (char_length("user_channels"."external_id") > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"gitlab_user_id" integer NOT NULL,
	"gitlab_username" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "job_role" NOT NULL,
	"gender" "gender" NOT NULL,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"on_leave_until" date,
	"language" "language",
	"timezone" text,
	"report_time" time(0) DEFAULT '18:00' NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"ai_data_opt_out" boolean DEFAULT false NOT NULL,
	"notify_empty" boolean DEFAULT true NOT NULL,
	"preset" "report_preset",
	"permissions" "permission"[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_gitlab_user_id_unique" UNIQUE("gitlab_user_id"),
	CONSTRAINT "users_display_name_length" CHECK (char_length("users"."display_name") between 1 and 255),
	CONSTRAINT "users_report_time_step" CHECK (extract(minute from "users"."report_time")::integer % 15 = 0)
);
--> statement-breakpoint
ALTER TABLE "user_channels" ADD CONSTRAINT "user_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;