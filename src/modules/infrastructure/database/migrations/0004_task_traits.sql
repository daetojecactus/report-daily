ALTER TYPE "public"."label_dimension" RENAME TO "trait_dimension";--> statement-breakpoint
ALTER TYPE "public"."permission" RENAME VALUE 'labels' TO 'traits';--> statement-breakpoint
ALTER TABLE "label_mappings" RENAME TO "trait_mappings";--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME COLUMN "label" TO "source_name";--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME COLUMN "label_key" TO "source_key";--> statement-breakpoint
ALTER TABLE "trait_mappings" ADD COLUMN "source" "source" DEFAULT 'gitlab' NOT NULL;--> statement-breakpoint
ALTER TABLE "trait_mappings" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME CONSTRAINT "label_mappings_pkey" TO "trait_mappings_pkey";--> statement-breakpoint
ALTER TABLE "trait_mappings" DROP CONSTRAINT "label_mappings_label_key_dimension_role_unique";--> statement-breakpoint
ALTER TABLE "trait_mappings" ADD CONSTRAINT "trait_mappings_source_source_key_dimension_role_unique" UNIQUE NULLS NOT DISTINCT("source","source_key","dimension","role");--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME CONSTRAINT "label_mappings_label_length" TO "trait_mappings_source_name_length";--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME CONSTRAINT "label_mappings_dimension_value" TO "trait_mappings_dimension_value";--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME CONSTRAINT "label_mappings_id_not_null" TO "trait_mappings_id_not_null";--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME CONSTRAINT "label_mappings_label_not_null" TO "trait_mappings_source_name_not_null";--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME CONSTRAINT "label_mappings_label_key_not_null" TO "trait_mappings_source_key_not_null";--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME CONSTRAINT "label_mappings_dimension_not_null" TO "trait_mappings_dimension_not_null";--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME CONSTRAINT "label_mappings_value_not_null" TO "trait_mappings_value_not_null";--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME CONSTRAINT "label_mappings_created_at_not_null" TO "trait_mappings_created_at_not_null";--> statement-breakpoint
ALTER TABLE "trait_mappings" RENAME CONSTRAINT "label_mappings_updated_at_not_null" TO "trait_mappings_updated_at_not_null";
