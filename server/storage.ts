import { 
  users, accounts, budgets, preferences, plans, lenderRules,
  type User, type InsertUser, 
  type Account, type InsertAccount,
  type Budget, type InsertBudget,
  type Preference, type InsertPreference,
  type Plan, type InsertPlan,
  type LenderRule, type InsertLenderRule
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Account methods
  getAccountsByUserId(userId: string): Promise<Account[]>;
  getAccount(id: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: string, updates: Partial<Account>): Promise<Account | undefined>;
  deleteAccount(id: string): Promise<void>;

  // Budget methods
  getBudgetByUserId(userId: string): Promise<Budget | undefined>;
  createOrUpdateBudget(budget: InsertBudget): Promise<Budget>;

  // Preferences methods
  getPreferencesByUserId(userId: string): Promise<Preference | undefined>;
  createOrUpdatePreferences(prefs: InsertPreference): Promise<Preference>;

  // Plan methods
  getPlansByUserId(userId: string): Promise<Plan[]>;
  getLatestPlan(userId: string): Promise<Plan | undefined>;
  createPlan(plan: InsertPlan): Promise<Plan>;

  // Lender Rules methods
  getLenderRule(lenderName: string, country: string): Promise<LenderRule | undefined>;
  createLenderRule(rule: InsertLenderRule): Promise<LenderRule>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  // Account methods
  async getAccountsByUserId(userId: string): Promise<Account[]> {
    return await db.select().from(accounts).where(eq(accounts.userId, userId));
  }

  async getAccount(id: string): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account || undefined;
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const [newAccount] = await db.insert(accounts).values(account).returning();
    return newAccount;
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<Account | undefined> {
    const [account] = await db.update(accounts).set(updates).where(eq(accounts.id, id)).returning();
    return account || undefined;
  }

  async deleteAccount(id: string): Promise<void> {
    await db.delete(accounts).where(eq(accounts.id, id));
  }

  // Budget methods
  async getBudgetByUserId(userId: string): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets).where(eq(budgets.userId, userId));
    return budget || undefined;
  }

  async createOrUpdateBudget(budget: InsertBudget): Promise<Budget> {
    const existing = await this.getBudgetByUserId(budget.userId);
    if (existing) {
      const [updated] = await db.update(budgets).set(budget).where(eq(budgets.userId, budget.userId)).returning();
      return updated;
    } else {
      const [newBudget] = await db.insert(budgets).values(budget).returning();
      return newBudget;
    }
  }

  // Preferences methods
  async getPreferencesByUserId(userId: string): Promise<Preference | undefined> {
    const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, userId));
    return prefs || undefined;
  }

  async createOrUpdatePreferences(prefs: InsertPreference): Promise<Preference> {
    const existing = await this.getPreferencesByUserId(prefs.userId);
    if (existing) {
      const [updated] = await db.update(preferences).set(prefs).where(eq(preferences.userId, prefs.userId)).returning();
      return updated;
    } else {
      const [newPrefs] = await db.insert(preferences).values(prefs).returning();
      return newPrefs;
    }
  }

  // Plan methods
  async getPlansByUserId(userId: string): Promise<Plan[]> {
    return await db.select().from(plans).where(eq(plans.userId, userId)).orderBy(desc(plans.createdAt));
  }

  async getLatestPlan(userId: string): Promise<Plan | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.userId, userId)).orderBy(desc(plans.createdAt)).limit(1);
    return plan || undefined;
  }

  async createPlan(plan: InsertPlan): Promise<Plan> {
    const [newPlan] = await db.insert(plans).values(plan).returning();
    return newPlan;
  }

  // Lender Rules methods
  async getLenderRule(lenderName: string, country: string): Promise<LenderRule | undefined> {
    const [rule] = await db.select().from(lenderRules).where(
      and(eq(lenderRules.lenderName, lenderName), eq(lenderRules.country, country))
    );
    return rule || undefined;
  }

  async createLenderRule(rule: InsertLenderRule): Promise<LenderRule> {
    const [newRule] = await db.insert(lenderRules).values(rule).returning();
    return newRule;
  }
}

export const storage = new DatabaseStorage();
