CREATE TYPE "public"."feedback_status" AS ENUM('new', 'completed');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('bug', 'request');--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "feedback_type" NOT NULL,
	"body" text NOT NULL,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
