CREATE TYPE "public"."delivery_kind" AS ENUM('report', 'broadcast');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'generating', 'ready', 'delivered', 'empty', 'failed');--> statement-breakpoint
CREATE TYPE "public"."trait_dimension" AS ENUM('workflow_state', 'task_kind', 'priority', 'severity', 'area', 'flag');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('telegram', 'slack');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('gitlab');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."job_role" AS ENUM('developer', 'qa', 'project_manager', 'system_analyst', 'devops');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('ru', 'en');--> statement-breakpoint
CREATE TYPE "public"."permission" AS ENUM('users', 'traits', 'settings', 'templates');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'blocked');--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"kind" "delivery_kind" NOT NULL,
	"report_id" uuid,
	"status" "delivery_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"redirected" boolean DEFAULT false NOT NULL,
	"external_message_id" text,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"report_date" date NOT NULL,
	"status" "report_status" NOT NULL,
	"scheduled_at" timestamp with time zone,
	"snapshot" jsonb,
	"content" text,
	"template_id" uuid,
	"ai_used" boolean DEFAULT false NOT NULL,
	"ai_model" text,
	"error" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_user_id_report_date_unique" UNIQUE("user_id","report_date")
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_templates_name_length" CHECK (char_length("report_templates"."name") between 1 and 64),
	CONSTRAINT "report_templates_body_length" CHECK (char_length("report_templates"."body") between 1 and 4000)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"reports_paused" boolean DEFAULT false NOT NULL,
	"reports_paused_until" date,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"ai_send_commits" boolean DEFAULT true NOT NULL,
	"ai_send_comments" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "trait_mappings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"source" "source" NOT NULL,
	"source_name" text NOT NULL,
	"source_key" text NOT NULL,
	"role" "job_role",
	"dimension" "trait_dimension" NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trait_mappings_source_source_key_dimension_role_unique" UNIQUE NULLS NOT DISTINCT("source","source_key","dimension","role"),
	CONSTRAINT "trait_mappings_source_name_length" CHECK (char_length("trait_mappings"."source_name") between 1 and 255),
	CONSTRAINT "trait_mappings_dimension_value" CHECK (("trait_mappings"."dimension" = 'workflow_state' and "trait_mappings"."value" in ('backlog', 'planned', 'analysis', 'design', 'in_progress', 'review', 'changes_requested', 'ready_for_qa', 'testing', 'qa_passed', 'ready_for_release', 'staging', 'released', 'done', 'cancelled', 'blocked', 'needs_info', 'handoff')) or ("trait_mappings"."dimension" = 'task_kind' and "trait_mappings"."value" in ('hotfix', 'incident', 'bug', 'feature', 'improvement', 'maintenance', 'dependency', 'epic', 'qa_internal', 'test_automation', 'documentation', 'requirements', 'research', 'support', 'release', 'task')) or ("trait_mappings"."dimension" = 'priority' and "trait_mappings"."value" in ('critical', 'high', 'medium', 'low')) or ("trait_mappings"."dimension" = 'severity' and "trait_mappings"."value" in ('blocker', 'critical', 'major', 'minor')) or ("trait_mappings"."dimension" = 'area' and "trait_mappings"."value" in ('frontend', 'backend', 'mobile', 'api', 'database', 'data', 'infrastructure', 'ci_cd', 'security', 'performance', 'accessibility', 'design')) or ("trait_mappings"."dimension" = 'flag' and "trait_mappings"."value" in ('exclude_from_report', 'returned_from_qa', 'e2e_required', 'unit_tests_required', 'needs_rebase', 'regression', 'flaky_test', 'draft', 'breaking_change', 'customer_request')))
);
--> statement-breakpoint
CREATE TABLE "user_channels" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"external_id" text NOT NULL,
	"reachable" boolean DEFAULT true NOT NULL,
	"receives" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_channels_user_id_channel_unique" UNIQUE("user_id","channel"),
	CONSTRAINT "user_channels_channel_external_id_unique" UNIQUE("channel","external_id"),
	CONSTRAINT "user_channels_external_id_length" CHECK (char_length("user_channels"."external_id") > 0)
);
--> statement-breakpoint
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
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"display_name" text NOT NULL,
	"role" "job_role" NOT NULL,
	"gender" "gender" NOT NULL,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"language" "language",
	"timezone" text,
	"report_time" time(0) DEFAULT '18:00' NOT NULL,
	"schedule_enabled" boolean DEFAULT true NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"ai_data_opt_out" boolean DEFAULT false NOT NULL,
	"permissions" "permission"[] DEFAULT '{}' NOT NULL,
	"template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_display_name_length" CHECK (char_length("users"."display_name") between 1 and 255),
	CONSTRAINT "users_report_time_step" CHECK (extract(minute from "users"."report_time")::integer % 15 = 0)
);
--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_channels" ADD CONSTRAINT "user_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sources" ADD CONSTRAINT "user_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deliveries_user_id_index" ON "deliveries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "deliveries_report_id_index" ON "deliveries" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "reports_template_id_index" ON "reports" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "report_templates_owner_id_index" ON "report_templates" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "users_template_id_index" ON "users" USING btree ("template_id");