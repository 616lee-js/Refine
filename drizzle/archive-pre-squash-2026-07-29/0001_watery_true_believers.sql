CREATE TABLE "content_access_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"context" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_access_log" ADD CONSTRAINT "content_access_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_access_log" ADD CONSTRAINT "content_access_log_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;