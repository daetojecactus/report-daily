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
ALTER TABLE "reports" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE set null ON UPDATE no action;