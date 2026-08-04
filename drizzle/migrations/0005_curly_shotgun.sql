ALTER TABLE "journal_entry_summaries" ADD COLUMN "encrypted_user_content" text;--> statement-breakpoint
ALTER TABLE "journal_entry_summaries" ADD COLUMN "user_edited_at" timestamp with time zone;