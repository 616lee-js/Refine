CREATE TABLE "entry_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"encrypted_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry_categories" (
	"journal_entry_id" text NOT NULL,
	"category_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entry_categories_journal_entry_id_category_id_pk" PRIMARY KEY("journal_entry_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "sensitive_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entry_categories" ADD CONSTRAINT "entry_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_categories" ADD CONSTRAINT "journal_entry_categories_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_categories" ADD CONSTRAINT "journal_entry_categories_category_id_entry_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."entry_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_categories_user_idx" ON "entry_categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "journal_entry_categories_category_idx" ON "journal_entry_categories" USING btree ("category_id");