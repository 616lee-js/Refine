CREATE TYPE "public"."entry_source" AS ENUM('user_voice', 'user_text', 'claude');--> statement-breakpoint
CREATE TYPE "public"."memory_kind" AS ENUM('fact', 'thread', 'preference', 'diagnostic_context', 'other');--> statement-breakpoint
CREATE TYPE "public"."memory_source" AS ENUM('user_added', 'claude_inferred', 'reflection_derived');--> statement-breakpoint
CREATE TYPE "public"."reflection_modality" AS ENUM('voice', 'text', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."reflection_type" AS ENUM('scheduled', 'as_needed', 'guided');--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" text PRIMARY KEY NOT NULL,
	"reflection_id" text NOT NULL,
	"mood" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"present_text" text,
	"intention_text" text,
	"tier_at_start" integer
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
CREATE TABLE "invite_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"used_by_user_id" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
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
CREATE TABLE "safety_log" (
	"id" text PRIMARY KEY NOT NULL,
	"reflection_id" text NOT NULL,
	"entry_id" text,
	"tier" integer NOT NULL,
	"classifier_version" text NOT NULL,
	"raw_signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL,
	"reviewer_notes" text
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
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"encrypted_content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email_encrypted" text NOT NULL,
	"email_hmac" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "users_email_hmac_unique" UNIQUE("email_hmac")
);
--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_access_log" ADD CONSTRAINT "content_access_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_access_log" ADD CONSTRAINT "content_access_log_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_user_id_users_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflection_summaries" ADD CONSTRAINT "reflection_summaries_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_log" ADD CONSTRAINT "safety_log_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_log" ADD CONSTRAINT "safety_log_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_reflection_id_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."reflections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;