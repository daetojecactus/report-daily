ALTER TABLE "reports" ADD COLUMN "ai_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "ai_model" text;