CREATE TABLE "mirror_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"entries_read" integer NOT NULL,
	"encrypted_findings" text NOT NULL,
	"model_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_memory" ADD COLUMN "mirror_review_id" text;--> statement-breakpoint
ALTER TABLE "mirror_reviews" ADD CONSTRAINT "mirror_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mirror_reviews_user_created_idx" ON "mirror_reviews" USING btree ("user_id","created_at" desc);--> statement-breakpoint
ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_mirror_review_id_mirror_reviews_id_fk" FOREIGN KEY ("mirror_review_id") REFERENCES "public"."mirror_reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" DROP COLUMN "extraction_status";