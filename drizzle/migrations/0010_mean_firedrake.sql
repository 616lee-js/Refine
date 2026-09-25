ALTER TABLE "user_memory" DROP CONSTRAINT "user_memory_mirror_review_id_mirror_reviews_id_fk";
--> statement-breakpoint
ALTER TABLE "mirror_reviews" DROP COLUMN "encrypted_findings";--> statement-breakpoint
ALTER TABLE "user_memory" DROP COLUMN "mirror_review_id";