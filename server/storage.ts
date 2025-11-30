import { 
  users, accounts, budgets, preferences, plans, lenderRules, plaidItems, debtBuckets,
  type User, type InsertUser, 
  type Account, type InsertAccount,
  type Budget, type InsertBudget,
  type Preference, type InsertPreference,
  type Plan, type InsertPlan,
  type LenderRule, type InsertLenderRule,
  type PlaidItem, type InsertPlaidItem,
  type DebtBucket, type InsertDebtBucket,
  type AccountWithBuckets
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
  getAccountsWithBucketsByUserId(userId: string): Promise<AccountWithBuckets[]>;
  getAccount(id: string): Promise<Account | undefined>;
  getAccountWithBuckets(id: string): Promise<AccountWithBuckets | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  createAccountWithBuckets(account: InsertAccount, buckets: Omit<InsertDebtBucket, 'accountId'>[]): Promise<AccountWithBuckets>;
  updateAccount(id: string, updates: Partial<Account>): Promise<Account | undefined>;
  updateAccountWithBuckets(id: string, updates: Partial<Account>, buckets?: InsertDebtBucket[]): Promise<AccountWithBuckets | undefined>;
  deleteAccount(id: string): Promise<void>;

  // Bucket methods
  getBucketsByAccountId(accountId: string): Promise<DebtBucket[]>;
  createBucket(bucket: InsertDebtBucket): Promise<DebtBucket>;
  updateBucket(id: string, updates: Partial<DebtBucket>): Promise<DebtBucket | undefined>;
  deleteBucket(id: string): Promise<void>;
  deleteAllBucketsByAccountId(accountId: string): Promise<void>;

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
  deletePlan(id: string): Promise<void>;

  // Lender Rules methods
  getLenderRule(lenderName: string, country: string): Promise<LenderRule | undefined>;
  createLenderRule(rule: InsertLenderRule): Promise<LenderRule>;
  
  // Plaid Item methods
  getPlaidItemByUserId(userId: string): Promise<PlaidItem | undefined>;
  createPlaidItem(item: InsertPlaidItem): Promise<PlaidItem>;
  updatePlaidItem(id: string, updates: Partial<PlaidItem>): Promise<PlaidItem | undefined>;
}

type BucketInput = Omit<InsertDebtBucket, 'accountId'>;

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

  async getAccountsWithBucketsByUserId(userId: string): Promise<AccountWithBuckets[]> {
    const accountList = await db.select().from(accounts).where(eq(accounts.userId, userId));
    const result: AccountWithBuckets[] = [];
    for (const account of accountList) {
      const buckets = await db.select().from(debtBuckets).where(eq(debtBuckets.accountId, account.id));
      result.push({ ...account, buckets });
    }
    return result;
  }

  async getAccountWithBuckets(id: string): Promise<AccountWithBuckets | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    if (!account) return undefined;
    const buckets = await db.select().from(debtBuckets).where(eq(debtBuckets.accountId, id));
    return { ...account, buckets };
  }

  async createAccountWithBuckets(account: InsertAccount, buckets: BucketInput[]): Promise<AccountWithBuckets> {
    const [newAccount] = await db.insert(accounts).values(account).returning();
    const createdBuckets: DebtBucket[] = [];
    for (const bucket of buckets) {
      const [newBucket] = await db.insert(debtBuckets).values({ ...bucket, accountId: newAccount.id }).returning();
      createdBuckets.push(newBucket);
    }
    return { ...newAccount, buckets: createdBuckets };
  }

  async updateAccountWithBuckets(id: string, updates: Partial<Account>, buckets?: InsertDebtBucket[]): Promise<AccountWithBuckets | undefined> {
    const [updatedAccount] = await db.update(accounts).set(updates).where(eq(accounts.id, id)).returning();
    if (!updatedAccount) return undefined;
    
    if (buckets !== undefined) {
      await db.delete(debtBuckets).where(eq(debtBuckets.accountId, id));
      const createdBuckets: DebtBucket[] = [];
      for (const bucket of buckets) {
        const [newBucket] = await db.insert(debtBuckets).values({ ...bucket, accountId: id }).returning();
        createdBuckets.push(newBucket);
      }
      return { ...updatedAccount, buckets: createdBuckets };
    }
    
    const existingBuckets = await db.select().from(debtBuckets).where(eq(debtBuckets.accountId, id));
    return { ...updatedAccount, buckets: existingBuckets };
  }

  // Bucket methods
  async getBucketsByAccountId(accountId: string): Promise<DebtBucket[]> {
    return await db.select().from(debtBuckets).where(eq(debtBuckets.accountId, accountId));
  }

  async createBucket(bucket: InsertDebtBucket): Promise<DebtBucket> {
    const [newBucket] = await db.insert(debtBuckets).values(bucket).returning();
    return newBucket;
  }

  async updateBucket(id: string, updates: Partial<DebtBucket>): Promise<DebtBucket | undefined> {
    const [bucket] = await db.update(debtBuckets).set(updates).where(eq(debtBuckets.id, id)).returning();
    return bucket || undefined;
  }

  async deleteBucket(id: string): Promise<void> {
    await db.delete(debtBuckets).where(eq(debtBuckets.id, id));
  }

  async deleteAllBucketsByAccountId(accountId: string): Promise<void> {
    await db.delete(debtBuckets).where(eq(debtBuckets.accountId, accountId));
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

  async deletePlan(id: string): Promise<void> {
    await db.delete(plans).where(eq(plans.id, id));
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
    buckets: DebtBucket[];
    budget: Budget | null;
    preferences: Preference | null;
    plans: Plan[];
  };

  constructor(dbStorage: DatabaseStorage) {
    this.dbStorage = dbStorage;
    this.guestData = {
      accounts: [],
      buckets: [],
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
      this.guestData.buckets = this.guestData.buckets.filter(b => b.accountId !== id);
      return;
    }
    return this.dbStorage.deleteAccount(id);
  }

  async getAccountsWithBucketsByUserId(userId: string): Promise<AccountWithBuckets[]> {
    if (this.isGuest(userId)) {
      return this.guestData.accounts.map(acc => ({
        ...acc,
        buckets: this.guestData.buckets.filter(b => b.accountId === acc.id)
      }));
    }
    return this.dbStorage.getAccountsWithBucketsByUserId(userId);
  }

  async getAccountWithBuckets(id: string): Promise<AccountWithBuckets | undefined> {
    const guestAccount = this.guestData.accounts.find(a => a.id === id);
    if (guestAccount) {
      return {
        ...guestAccount,
        buckets: this.guestData.buckets.filter(b => b.accountId === id)
      };
    }
    return this.dbStorage.getAccountWithBuckets(id);
  }

  async createAccountWithBuckets(account: InsertAccount, buckets: BucketInput[]): Promise<AccountWithBuckets> {
    if (this.isGuest(account.userId)) {
      const accountId = `guest-account-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newAccount = { 
        ...account, 
        id: accountId,
        createdAt: new Date() 
      } as Account;
      this.guestData.accounts.push(newAccount);
      
      const createdBuckets: DebtBucket[] = buckets.map((bucket, idx) => ({
        ...bucket,
        id: `guest-bucket-${Date.now()}-${idx}`,
        accountId,
        createdAt: new Date()
      } as DebtBucket));
      this.guestData.buckets.push(...createdBuckets);
      
      return { ...newAccount, buckets: createdBuckets };
    }
    return this.dbStorage.createAccountWithBuckets(account, buckets);
  }

  async updateAccountWithBuckets(id: string, updates: Partial<Account>, buckets?: InsertDebtBucket[]): Promise<AccountWithBuckets | undefined> {
    const guestIdx = this.guestData.accounts.findIndex(a => a.id === id);
    if (guestIdx !== -1) {
      this.guestData.accounts[guestIdx] = { ...this.guestData.accounts[guestIdx], ...updates };
      
      if (buckets !== undefined) {
        this.guestData.buckets = this.guestData.buckets.filter(b => b.accountId !== id);
        const createdBuckets: DebtBucket[] = buckets.map((bucket, idx) => ({
          ...bucket,
          id: `guest-bucket-${Date.now()}-${idx}`,
          accountId: id,
          createdAt: new Date()
        } as DebtBucket));
        this.guestData.buckets.push(...createdBuckets);
        return { ...this.guestData.accounts[guestIdx], buckets: createdBuckets };
      }
      
      return {
        ...this.guestData.accounts[guestIdx],
        buckets: this.guestData.buckets.filter(b => b.accountId === id)
      };
    }
    return this.dbStorage.updateAccountWithBuckets(id, updates, buckets);
  }

  // Bucket methods
  async getBucketsByAccountId(accountId: string): Promise<DebtBucket[]> {
    const isGuestAccount = this.guestData.accounts.some(a => a.id === accountId);
    if (isGuestAccount) {
      return this.guestData.buckets.filter(b => b.accountId === accountId);
    }
    return this.dbStorage.getBucketsByAccountId(accountId);
  }

  async createBucket(bucket: InsertDebtBucket): Promise<DebtBucket> {
    const isGuestAccount = this.guestData.accounts.some(a => a.id === bucket.accountId);
    if (isGuestAccount) {
      const newBucket = {
        ...bucket,
        id: `guest-bucket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date()
      } as DebtBucket;
      this.guestData.buckets.push(newBucket);
      return newBucket;
    }
    return this.dbStorage.createBucket(bucket);
  }

  async updateBucket(id: string, updates: Partial<DebtBucket>): Promise<DebtBucket | undefined> {
    const guestIdx = this.guestData.buckets.findIndex(b => b.id === id);
    if (guestIdx !== -1) {
      this.guestData.buckets[guestIdx] = { ...this.guestData.buckets[guestIdx], ...updates };
      return this.guestData.buckets[guestIdx];
    }
    return this.dbStorage.updateBucket(id, updates);
  }

  async deleteBucket(id: string): Promise<void> {
    const guestIdx = this.guestData.buckets.findIndex(b => b.id === id);
    if (guestIdx !== -1) {
      this.guestData.buckets.splice(guestIdx, 1);
      return;
    }
    return this.dbStorage.deleteBucket(id);
  }

  async deleteAllBucketsByAccountId(accountId: string): Promise<void> {
    const isGuestAccount = this.guestData.accounts.some(a => a.id === accountId);
    if (isGuestAccount) {
      this.guestData.buckets = this.guestData.buckets.filter(b => b.accountId !== accountId);
      return;
    }
    return this.dbStorage.deleteAllBucketsByAccountId(accountId);
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

  async deletePlan(id: string): Promise<void> {
    const planToDelete = this.guestData.plans.find(p => p.id === id);
    if (planToDelete) {
      this.guestData.plans = this.guestData.plans.filter(p => p.id !== id);
      return;
    }
    return this.dbStorage.deletePlan(id);
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
