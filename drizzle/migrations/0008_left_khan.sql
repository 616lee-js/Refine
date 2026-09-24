CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summary_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"journal_entry_id" text,
	"supported" boolean NOT NULL,
	"complete" boolean NOT NULL,
	"quotes_verbatim" boolean,
	"descriptive_only" boolean NOT NULL,
	"overall_accuracy" integer NOT NULL,
	"summariser_version" text NOT NULL,
	"entry_updated_at" timestamp with time zone,
	"encrypted_entry_snapshot" text,
	"encrypted_summary_snapshot" text,
	"snapshots_cleared_at" timestamp with time zone,
	"encrypted_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "summary_evaluations" ADD CONSTRAINT "summary_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summary_evaluations" ADD CONSTRAINT "summary_evaluations_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "summary_evaluations_created_idx" ON "summary_evaluations" USING btree ("created_at" desc);--> statement-breakpoint
CREATE INDEX "summary_evaluations_entry_idx" ON "summary_evaluations" USING btree ("journal_entry_id");