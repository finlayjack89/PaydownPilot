CREATE TABLE "accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"lender_name" text NOT NULL,
	"account_type" text NOT NULL,
	"current_balance_cents" integer NOT NULL,
	"apr_standard_bps" integer NOT NULL,
	"payment_due_day" integer NOT NULL,
	"min_payment_rule_fixed_cents" integer DEFAULT 0,
	"min_payment_rule_percentage_bps" integer DEFAULT 0,
	"min_payment_rule_includes_interest" boolean DEFAULT false,
	"promo_end_date" date,
	"promo_duration_months" integer,
	"account_open_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"monthly_budget_cents" integer NOT NULL,
	"future_changes" jsonb DEFAULT '[]'::jsonb,
	"lump_sum_payments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "budgets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "lender_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_name" text NOT NULL,
	"country" text NOT NULL,
	"fixed_cents" integer DEFAULT 0,
	"percentage_bps" integer DEFAULT 0,
	"includes_interest" boolean DEFAULT false,
	"rule_description" text,
	"verified_at" timestamp DEFAULT now(),
	CONSTRAINT "lender_rules_lender_name_country_unique" UNIQUE("lender_name","country")
);
--> statement-breakpoint
CREATE TABLE "plaid_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"item_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "plaid_items_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan_start_date" date NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"plan_data" jsonb,
	"explanation" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"strategy" text NOT NULL,
	"payment_shape" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text,
	"country" text,
	"region" text,
	"currency" text DEFAULT 'USD',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;