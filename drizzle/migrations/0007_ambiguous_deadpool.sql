CREATE INDEX "journal_entries_user_updated_idx" ON "journal_entries" USING btree ("user_id","updated_at" desc);--> statement-breakpoint
CREATE INDEX "journal_entries_user_completed_idx" ON "journal_entries" USING btree ("user_id","completed_at" desc);--> statement-breakpoint
CREATE INDEX "questionnaire_responses_user_completed_idx" ON "questionnaire_responses" USING btree ("user_id","completed_at" desc);--> statement-breakpoint
CREATE INDEX "questionnaire_responses_user_slug_completed_idx" ON "questionnaire_responses" USING btree ("user_id","questionnaire_slug","completed_at" desc);