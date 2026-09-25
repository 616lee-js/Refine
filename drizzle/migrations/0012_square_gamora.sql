CREATE TABLE "report_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mirror_review_id" text,
	"supported" boolean NOT NULL,
	"complete" boolean NOT NULL,
	"descriptive_only" boolean NOT NULL,
	"no_prediction" boolean NOT NULL,
	"hedging_right" boolean,
	"figures_untouched" boolean,
	"overall_accuracy" integer NOT NULL,
	"prompt_version" text NOT NULL,
	"encrypted_report_snapshot" text,
	"snapshots_cleared_at" timestamp with time zone,
	"encrypted_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_evaluations" ADD CONSTRAINT "report_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_evaluations" ADD CONSTRAINT "report_evaluations_mirror_review_id_mirror_reviews_id_fk" FOREIGN KEY ("mirror_review_id") REFERENCES "public"."mirror_reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_evaluations_created_idx" ON "report_evaluations" USING btree ("created_at" desc);--> statement-breakpoint
CREATE INDEX "report_evaluations_review_idx" ON "report_evaluations" USING btree ("mirror_review_id");