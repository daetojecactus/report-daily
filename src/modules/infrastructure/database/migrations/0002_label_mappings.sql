CREATE TYPE "public"."label_dimension" AS ENUM('workflow_state', 'task_kind', 'priority', 'severity', 'area', 'flag');--> statement-breakpoint
CREATE TABLE "label_mappings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"label" text NOT NULL,
	"label_key" text NOT NULL,
	"role" "job_role",
	"dimension" "label_dimension" NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "label_mappings_label_key_dimension_role_unique" UNIQUE NULLS NOT DISTINCT("label_key","dimension","role"),
	CONSTRAINT "label_mappings_label_length" CHECK (char_length("label_mappings"."label") between 1 and 255),
	CONSTRAINT "label_mappings_dimension_value" CHECK (("label_mappings"."dimension" = 'workflow_state' and "label_mappings"."value" in ('backlog', 'planned', 'analysis', 'design', 'in_progress', 'review', 'changes_requested', 'ready_for_qa', 'testing', 'qa_passed', 'ready_for_release', 'staging', 'released', 'done', 'cancelled', 'blocked', 'needs_info', 'handoff')) or ("label_mappings"."dimension" = 'task_kind' and "label_mappings"."value" in ('hotfix', 'incident', 'bug', 'feature', 'improvement', 'maintenance', 'dependency', 'epic', 'qa_internal', 'test_automation', 'documentation', 'requirements', 'research', 'support', 'release', 'task')) or ("label_mappings"."dimension" = 'priority' and "label_mappings"."value" in ('critical', 'high', 'medium', 'low')) or ("label_mappings"."dimension" = 'severity' and "label_mappings"."value" in ('blocker', 'critical', 'major', 'minor')) or ("label_mappings"."dimension" = 'area' and "label_mappings"."value" in ('frontend', 'backend', 'mobile', 'api', 'database', 'data', 'infrastructure', 'ci_cd', 'security', 'performance', 'accessibility', 'design')) or ("label_mappings"."dimension" = 'flag' and "label_mappings"."value" in ('exclude_from_report', 'returned_from_qa', 'e2e_required', 'unit_tests_required', 'needs_rebase', 'regression', 'flaky_test', 'draft', 'breaking_change', 'customer_request')))
);
