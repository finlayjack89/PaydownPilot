import { 
  users, accounts, budgets, preferences, plans, lenderRules, plaidItems,
  type User, type InsertUser, 
  type Account, type InsertAccount,
  type Budget, type InsertBudget,
  type Preference, type InsertPreference,
  type Plan, type InsertPlan,
  type LenderRule, type InsertLenderRule,
  type PlaidItem, type InsertPlaidItem
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
  
  // Plaid Item methods
  getPlaidItemByUserId(userId: string): Promise<PlaidItem | undefined>;
  createPlaidItem(item: InsertPlaidItem): Promise<PlaidItem>;
  updatePlaidItem(id: string, updates: Partial<PlaidItem>): Promise<PlaidItem | undefined>;
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
    return await db.select({
      id: accounts.id,
      userId: accounts.userId,
      lenderName: accounts.lenderName,
      accountType: accounts.accountType,
      currentBalanceCents: accounts.currentBalanceCents,
      aprStandardBps: accounts.aprStandardBps,
      paymentDueDay: accounts.paymentDueDay,
      minPaymentRuleFixedCents: accounts.minPaymentRuleFixedCents,
      minPaymentRulePercentageBps: accounts.minPaymentRulePercentageBps,
      minPaymentRuleIncludesInterest: accounts.minPaymentRuleIncludesInterest,
      promoEndDate: accounts.promoEndDate,
      promoDurationMonths: accounts.promoDurationMonths,
      accountOpenDate: accounts.accountOpenDate,
      notes: accounts.notes,
      createdAt: accounts.createdAt,
    }).from(accounts).where(eq(accounts.userId, userId));
  }

  async getAccount(id: string): Promise<Account | undefined> {
    const [account] = await db.select({
      id: accounts.id,
      userId: accounts.userId,
      lenderName: accounts.lenderName,
      accountType: accounts.accountType,
      currentBalanceCents: accounts.currentBalanceCents,
      aprStandardBps: accounts.aprStandardBps,
      paymentDueDay: accounts.paymentDueDay,
      minPaymentRuleFixedCents: accounts.minPaymentRuleFixedCents,
      minPaymentRulePercentageBps: accounts.minPaymentRulePercentageBps,
      minPaymentRuleIncludesInterest: accounts.minPaymentRuleIncludesInterest,
      promoEndDate: accounts.promoEndDate,
      promoDurationMonths: accounts.promoDurationMonths,
      accountOpenDate: accounts.accountOpenDate,
      notes: accounts.notes,
      createdAt: accounts.createdAt,
    }).from(accounts).where(eq(accounts.id, id));
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
  
  // Plaid Item methods
  async getPlaidItemByUserId(userId: string): Promise<PlaidItem | undefined> {
    const [item] = await db.select().from(plaidItems).where(eq(plaidItems.userId, userId));
    return item || undefined;
  }
  
  async createPlaidItem(item: InsertPlaidItem): Promise<PlaidItem> {
    const [newItem] = await db.insert(plaidItems).values(item).returning();
    return newItem;
  }
  
  async updatePlaidItem(id: string, updates: Partial<PlaidItem>): Promise<PlaidItem | undefined> {
    const [item] = await db.update(plaidItems).set(updates).where(eq(plaidItems.id, id)).returning();
    return item || undefined;
  }
}

// Guest mode in-memory storage
class GuestStorageWrapper implements IStorage {
  private dbStorage: DatabaseStorage;
  private guestData: {
    accounts: Account[];
    budget: Budget | null;
    preferences: Preference | null;
    plans: Plan[];
  };

  constructor(dbStorage: DatabaseStorage) {
    this.dbStorage = dbStorage;
    this.guestData = {
      accounts: [],
      budget: null,
      preferences: null,
      plans: [],
    };
  }

  private isGuest(userId: string): boolean {
    return userId === "guest-user";
  }

  // User methods - pass through to database
  async getUser(id: string): Promise<User | undefined> {
    return this.dbStorage.getUser(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.dbStorage.getUserByEmail(email);
  }

  async createUser(user: InsertUser): Promise<User> {
    return this.dbStorage.createUser(user);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    return this.dbStorage.updateUser(id, updates);
  }

  // Account methods - use memory for guest
  async getAccountsByUserId(userId: string): Promise<Account[]> {
    if (this.isGuest(userId)) {
      return this.guestData.accounts;
    }
    return this.dbStorage.getAccountsByUserId(userId);
  }

  async getAccount(id: string): Promise<Account | undefined> {
    // Check guest data first
    const guestAccount = this.guestData.accounts.find(a => a.id === id);
    if (guestAccount) return guestAccount;
    return this.dbStorage.getAccount(id);
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    if (this.isGuest(account.userId)) {
      const newAccount = { 
        ...account, 
        id: `guest-account-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date() 
      } as Account;
      this.guestData.accounts.push(newAccount);
      return newAccount;
    }
    return this.dbStorage.createAccount(account);
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<Account | undefined> {
    const guestIdx = this.guestData.accounts.findIndex(a => a.id === id);
    if (guestIdx !== -1) {
      this.guestData.accounts[guestIdx] = { ...this.guestData.accounts[guestIdx], ...updates };
      return this.guestData.accounts[guestIdx];
    }
    return this.dbStorage.updateAccount(id, updates);
  }

  async deleteAccount(id: string): Promise<void> {
    const guestIdx = this.guestData.accounts.findIndex(a => a.id === id);
    if (guestIdx !== -1) {
      this.guestData.accounts.splice(guestIdx, 1);
      return;
    }
    return this.dbStorage.deleteAccount(id);
  }

  // Budget methods - use memory for guest
  async getBudgetByUserId(userId: string): Promise<Budget | undefined> {
    if (this.isGuest(userId)) {
      return this.guestData.budget || undefined;
    }
    return this.dbStorage.getBudgetByUserId(userId);
  }

  async createOrUpdateBudget(budget: InsertBudget): Promise<Budget> {
    if (this.isGuest(budget.userId)) {
      const newBudget = { ...budget, id: "guest-budget", createdAt: new Date() } as Budget;
      this.guestData.budget = newBudget;
      return newBudget;
    }
    return this.dbStorage.createOrUpdateBudget(budget);
  }

  // Preferences methods - use memory for guest
  async getPreferencesByUserId(userId: string): Promise<Preference | undefined> {
    if (this.isGuest(userId)) {
      return this.guestData.preferences || undefined;
    }
    return this.dbStorage.getPreferencesByUserId(userId);
  }

  async createOrUpdatePreferences(prefs: InsertPreference): Promise<Preference> {
    if (this.isGuest(prefs.userId)) {
      const newPrefs = { ...prefs, id: "guest-prefs", createdAt: new Date() } as Preference;
      this.guestData.preferences = newPrefs;
      return newPrefs;
    }
    return this.dbStorage.createOrUpdatePreferences(prefs);
  }

  // Plan methods - use memory for guest
  async getPlansByUserId(userId: string): Promise<Plan[]> {
    if (this.isGuest(userId)) {
      return this.guestData.plans;
    }
    return this.dbStorage.getPlansByUserId(userId);
  }

  async getLatestPlan(userId: string): Promise<Plan | undefined> {
    if (this.isGuest(userId)) {
      return this.guestData.plans[this.guestData.plans.length - 1] || undefined;
    }
    return this.dbStorage.getLatestPlan(userId);
  }

  async createPlan(plan: InsertPlan): Promise<Plan> {
    if (this.isGuest(plan.userId)) {
      const newPlan = { ...plan, createdAt: new Date() } as Plan;
      this.guestData.plans.push(newPlan);
      return newPlan;
    }
    return this.dbStorage.createPlan(plan);
  }

  // Lender Rules - pass through to database (shared)
  async getLenderRule(lenderName: string, country: string): Promise<LenderRule | undefined> {
    return this.dbStorage.getLenderRule(lenderName, country);
  }

  async createLenderRule(rule: InsertLenderRule): Promise<LenderRule> {
    return this.dbStorage.createLenderRule(rule);
  }
  
  // Plaid Items - pass through to database (not guest specific)
  async getPlaidItemByUserId(userId: string): Promise<PlaidItem | undefined> {
    // Guest users don't have Plaid items
    if (this.isGuest(userId)) {
      return undefined;
    }
    return this.dbStorage.getPlaidItemByUserId(userId);
  }
  
  async createPlaidItem(item: InsertPlaidItem): Promise<PlaidItem> {
    // Guest users can't create Plaid items
    if (this.isGuest(item.userId)) {
      throw new Error("Guest users cannot connect bank accounts");
    }
    return this.dbStorage.createPlaidItem(item);
  }
  
  async updatePlaidItem(id: string, updates: Partial<PlaidItem>): Promise<PlaidItem | undefined> {
    return this.dbStorage.updatePlaidItem(id, updates);
  }
}

export const storage = new GuestStorageWrapper(new DatabaseStorage());
