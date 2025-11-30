CREATE TABLE "debt_buckets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" varchar NOT NULL,
	"bucket_type" text NOT NULL,
	"label" text,
	"balance_cents" integer NOT NULL,
	"apr_bps" integer NOT NULL,
	"is_promo" boolean DEFAULT false,
	"promo_expiry_date" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "currency" text DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_manual_entry" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_budget_cents" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "potential_budget_cents" integer;--> statement-breakpoint
ALTER TABLE "debt_buckets" ADD CONSTRAINT "debt_buckets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;