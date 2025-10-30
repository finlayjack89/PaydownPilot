import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, date, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums matching the Python backend
export enum AccountType {
  CREDIT_CARD = "Credit Card",
  BNPL = "Buy Now, Pay Later",
  LOAN = "Loan"
}

export enum OptimizationStrategy {
  MINIMIZE_TOTAL_INTEREST = "Minimize Total Interest",
  MINIMIZE_MONTHLY_SPEND = "Minimize Monthly Spend",
  TARGET_MAX_BUDGET = "Pay Off ASAP with Max Budget",
  PAY_OFF_IN_PROMO = "Pay Off Within Promo Windows",
  MINIMIZE_SPEND_TO_CLEAR_PROMOS = "Minimize Spend to Clear Promos"
}

export enum PaymentShape {
  LINEAR_PER_ACCOUNT = "Linear (Same Amount Per Account)",
  OPTIMIZED_MONTH_TO_MONTH = "Optimized (Variable Amounts)"
}

// Database Tables
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  country: text("country"),
  region: text("region"),
  currency: text("currency").default("USD"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lenderName: text("lender_name").notNull(),
  accountType: text("account_type").notNull(),
  currentBalanceCents: integer("current_balance_cents").notNull(),
  aprStandardBps: integer("apr_standard_bps").notNull(),
  paymentDueDay: integer("payment_due_day").notNull(),
  minPaymentRuleFixedCents: integer("min_payment_rule_fixed_cents").default(0),
  minPaymentRulePercentageBps: integer("min_payment_rule_percentage_bps").default(0),
  minPaymentRuleIncludesInterest: boolean("min_payment_rule_includes_interest").default(false),
  promoEndDate: date("promo_end_date"),
  promoDurationMonths: integer("promo_duration_months"),
  accountOpenDate: date("account_open_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const budgets = pgTable("budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  monthlyBudgetCents: integer("monthly_budget_cents").notNull(),
  futureChanges: jsonb("future_changes").$type<Array<[string, number]>>().default([]),
  lumpSumPayments: jsonb("lump_sum_payments").$type<Array<[string, number]>>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const preferences = pgTable("preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  strategy: text("strategy").notNull(),
  paymentShape: text("payment_shape").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planStartDate: date("plan_start_date").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  planData: jsonb("plan_data").$type<Array<MonthlyResult>>(),
  explanation: text("explanation"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lenderRules = pgTable("lender_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lenderName: text("lender_name").notNull(),
  country: text("country").notNull(),
  fixedCents: integer("fixed_cents").default(0),
  percentageBps: integer("percentage_bps").default(0),
  includesInterest: boolean("includes_interest").default(false),
  ruleDescription: text("rule_description"),
  verifiedAt: timestamp("verified_at").defaultNow(),
});

// TypeScript Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;

export type Preference = typeof preferences.$inferSelect;
export type InsertPreference = typeof preferences.$inferInsert;

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

export type LenderRule = typeof lenderRules.$inferSelect;
export type InsertLenderRule = typeof lenderRules.$inferInsert;

// API Request/Response Types
export interface MinPaymentRule {
  fixedCents: number;
  percentageBps: number;
  includesInterest: boolean;
}

export interface MonthlyResult {
  month: number;
  lenderName: string;
  paymentCents: number;
  interestChargedCents: number;
  endingBalanceCents: number;
}

export interface AccountRequest {
  lenderName: string;
  accountType: AccountType;
  currentBalanceCents: number;
  aprStandardBps: number;
  paymentDueDay: number;
  minPaymentRule: MinPaymentRule;
  promoEndDate?: string;
  promoDurationMonths?: number;
  accountOpenDate?: string;
  notes?: string;
}

export interface BudgetRequest {
  monthlyBudgetCents: number;
  futureChanges?: Array<[string, number]>;
  lumpSumPayments?: Array<[string, number]>;
}

export interface PreferenceRequest {
  strategy: OptimizationStrategy;
  paymentShape: PaymentShape;
}

export interface PlanRequest {
  accounts: AccountRequest[];
  budget: BudgetRequest;
  preferences: PreferenceRequest;
  planStartDate?: string;
}

export interface PlanScheduleEntry {
  month: number;
  startingBalanceCents: number;
  totalPaymentCents: number;
  payments: Record<string, number>;
}

export interface AccountSchedule {
  accountId: string;
  lenderName: string;
  payoffTimeMonths: number;
}

export interface PlanResponse {
  status: string;
  message?: string;
  plan?: MonthlyResult[];
  planStartDate?: string;
  payoffTimeMonths?: number;
  totalInterestPaidCents?: number;
  schedule?: PlanScheduleEntry[];
  accountSchedules?: AccountSchedule[];
}

export interface LenderRuleDiscoveryRequest {
  lenderName: string;
  country: string;
}

export interface LenderRuleDiscoveryResponse {
  lenderName: string;
  ruleDescription: string;
  minPaymentRule: MinPaymentRule;
  confidence: "high" | "medium" | "low";
}

// Zod Schemas for Validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  password: z.string().min(8),
}).pick({
  email: true,
  password: true,
  name: true,
  country: true,
  region: true,
  currency: true,
});

export const insertAccountSchema = createInsertSchema(accounts, {
  currentBalanceCents: z.number().int().min(0),
  aprStandardBps: z.number().int().min(0),
  paymentDueDay: z.number().int().min(1).max(28),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertBudgetSchema = createInsertSchema(budgets, {
  monthlyBudgetCents: z.number().int().min(0),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPreferenceSchema = createInsertSchema(preferences).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
