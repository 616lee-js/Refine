ALTER TABLE "mirror_reviews" ADD COLUMN "encrypted_report" text NOT NULL;--> statement-breakpoint
ALTER TABLE "mirror_reviews" ADD COLUMN "encrypted_user_report" text;--> statement-breakpoint
ALTER TABLE "mirror_reviews" ADD COLUMN "user_edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mirror_reviews" ADD COLUMN "encrypted_period_note" text NOT NULL;