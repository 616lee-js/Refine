ALTER TABLE "journal_entries" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "time_zone" text;