-- Drop tables that depend on sessions/session_summaries (cascade)
DROP TABLE IF EXISTS "content_access_log" CASCADE;
DROP TABLE IF EXISTS "safety_log" CASCADE;
DROP TABLE IF EXISTS "user_memory" CASCADE;
DROP TABLE IF EXISTS "session_summaries" CASCADE;
DROP TABLE IF EXISTS "entries" CASCADE;
DROP TABLE IF EXISTS "check_ins" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
--> statement-breakpoint
-- Drop old enum types
DROP TYPE IF EXISTS "session_type";
--> statement-breakpoint
DROP TYPE IF EXISTS "session_modality";
--> statement-breakpoint
-- Create new enum types
CREATE TYPE "public"."reflection_type" AS ENUM('scheduled', 'as_needed', 'guided');
--> statement-breakpoint
CREATE TYPE "public"."reflection_modality" AS ENUM('voice', 'text', 'mixed');
--> statement-breakpoint
-- Recreate tables with new names and columns
CREATE TABLE "reflections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "reflection_type" NOT NULL,
	"modality" "reflection_modality" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"extraction_status" text
);
--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" text PRIMARY KEY NOT NULL,
	"reflection_id" text NOT NULL,
	"mood" jsonb DEFAULT '{}' NOT NULL,
	"present_text" text,
	"intention_text" text,
	"tier_at_start" integer
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" text PRIMARY KEY NOT NULL,
	"reflection_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"source" "entry_source" NOT NULL,
	"encrypted_content" text NOT NULL,
	"raw_audio_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tier_classification" integer
);
--> statement-breakpoint
CREATE TABLE "reflection_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"reflection_id" text NOT NULL,
	"encrypted_summary" text NOT NULL,
	"notable_quotes" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generation_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "memory_kind" NOT NULL,
	"encrypted_content" text NOT NULL,
	"source" "memory_source" NOT NULL,
	"reflection_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "safety_log" (
	"id" text PRIMARY KEY NOT NULL,
	"reflection_id" text NOT NULL,
	"entry_id" text,
	"tier" integer NOT NULL,
	"classifier_version" text NOT NULL,
	"raw_signals" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL,
	"reviewer_notes" text
);
--> statement-breakpoint
CREATE TABLE "content_access_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reflection_id" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"context" text NOT NULL
);
--> statement-breakpoint
-- Foreign keys
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reflection_summaries" ADD CONSTRAINT "reflection_summaries_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "safety_log" ADD CONSTRAINT "safety_log_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "safety_log" ADD CONSTRAINT "safety_log_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_access_log" ADD CONSTRAINT "content_access_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_access_log" ADD CONSTRAINT "content_access_log_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE cascade ON UPDATE no action;
