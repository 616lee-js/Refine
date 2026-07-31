ALTER TABLE "journal_entries" ADD COLUMN "summary_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entry_summaries" DROP COLUMN "encrypted_summary";--> statement-breakpoint
ALTER TABLE "journal_entry_summaries" DROP COLUMN "encrypted_notable_quotes";--> statement-breakpoint
ALTER TABLE "journal_entry_summaries" ADD CONSTRAINT "journal_entry_summaries_journal_entry_id_unique" UNIQUE("journal_entry_id");