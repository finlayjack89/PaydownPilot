import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { storage } from "./storage";
import { setupAuth, requireAuth, hashPassword } from "./auth";
import { discoverLenderRule, generatePlanExplanation } from "./anthropic";
import { 
  insertUserSchema, insertAccountSchema, insertBudgetSchema, 
  insertPreferenceSchema, type InsertAccount
} from "@shared/schema";
import { randomUUID } from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // ==================== Auth Routes ====================
  app.post("/api/auth/signup", async (req, res, next) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user exists
      const existing = await storage.getUserByEmail(validatedData.email);
      if (existing) {
        return res.status(400).send({ message: "User already exists" });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(validatedData.password);
      const user = await storage.createUser({
        ...validatedData,
        id: randomUUID(),
        password: hashedPassword,
      });

      // Auto-login
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    } catch (error: any) {
      res.status(400).send({ message: error.message || "Signup failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).send({ message: info?.message || "Login failed" });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).send({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send({ message: "Not authenticated" });
    }
    const { password: _, ...userWithoutPassword } = req.user as any;
    res.json(userWithoutPassword);
  });

  // ==================== Account Routes ====================
  app.get("/api/accounts", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const accounts = await storage.getAccountsByUserId(userId);
      res.json(accounts);
    } catch (error: any) {
      res.status(500).send({ message: error.message || "Failed to fetch accounts" });
    }
  });

  app.post("/api/accounts", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validatedData = insertAccountSchema.omit({ userId: true, id: true }).parse(req.body);
      
      const account = await storage.createAccount({
        ...validatedData,
        id: randomUUID(),
        userId,
      } as InsertAccount);

      res.json(account);
    } catch (error: any) {
      res.status(400).send({ message: error.message || "Failed to create account" });
    }
  });

  app.patch("/api/accounts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any).id;
      
      // Verify ownership
      const existing = await storage.getAccount(id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).send({ message: "Account not found" });
      }

      const updated = await storage.updateAccount(id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).send({ message: error.message || "Failed to update account" });
    }
  });

  app.delete("/api/accounts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any).id;
      
      // Verify ownership
      const existing = await storage.getAccount(id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).send({ message: "Account not found" });
      }

      await storage.deleteAccount(id);
      res.json({ message: "Account deleted" });
    } catch (error: any) {
      res.status(400).send({ message: error.message || "Failed to delete account" });
    }
  });

  // ==================== Budget Routes ====================
  app.get("/api/budget", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const budget = await storage.getBudgetByUserId(userId);
      if (!budget) {
        return res.status(404).send({ message: "Budget not found" });
      }
      res.json(budget);
    } catch (error: any) {
      res.status(500).send({ message: error.message || "Failed to fetch budget" });
    }
  });

  app.post("/api/budget", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validatedData = insertBudgetSchema.omit({ userId: true, id: true }).parse(req.body);
      
      const budget = await storage.createOrUpdateBudget({
        ...validatedData,
        id: randomUUID(),
        userId,
      });

      res.json(budget);
    } catch (error: any) {
      res.status(400).send({ message: error.message || "Failed to save budget" });
    }
  });

  // ==================== Preferences Routes ====================
  app.get("/api/preferences", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const prefs = await storage.getPreferencesByUserId(userId);
      if (!prefs) {
        return res.status(404).send({ message: "Preferences not found" });
      }
      res.json(prefs);
    } catch (error: any) {
      res.status(500).send({ message: error.message || "Failed to fetch preferences" });
    }
  });

  app.post("/api/preferences", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validatedData = insertPreferenceSchema.omit({ userId: true, id: true }).parse(req.body);
      
      const prefs = await storage.createOrUpdatePreferences({
        ...validatedData,
        id: randomUUID(),
        userId,
      });

      res.json(prefs);
    } catch (error: any) {
      res.status(400).send({ message: error.message || "Failed to save preferences" });
    }
  });

  // ==================== Lender Rules Routes (AI) ====================
  app.post("/api/lender-rules/discover", requireAuth, async (req, res) => {
    try {
      const { lenderName, country } = req.body;
      
      if (!lenderName || !country) {
        return res.status(400).send({ message: "lenderName and country are required" });
      }

      // Check cache first
      const existing = await storage.getLenderRule(lenderName, country);
      if (existing) {
        return res.json(existing);
      }

      // Discover using AI
      const result = await discoverLenderRule(lenderName, country);
      
      // Save to database
      const rule = await storage.createLenderRule({
        id: randomUUID(),
        lenderName: result.lenderName,
        country,
        ruleDescription: result.ruleDescription,
        minPaymentRuleFixedCents: result.minPaymentRule.fixedCents,
        minPaymentRulePercentageBps: result.minPaymentRule.percentageBps,
        minPaymentRuleIncludesInterest: result.minPaymentRule.includesInterest,
        confidence: result.confidence,
        source: "AI",
      });

      res.json(rule);
    } catch (error: any) {
      res.status(500).send({ message: error.message || "Failed to discover lender rule" });
    }
  });

  // ==================== Plan Generation Routes ====================
  app.post("/api/plans/generate", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { accounts, budget, preferences, planStartDate } = req.body;

      if (!accounts || !budget || !preferences) {
        return res.status(400).send({ message: "Missing required data" });
      }

      // TODO: Call Python FastAPI backend to run optimization
      // For now, generate mock plan data
      const mockPlanData = generateMockPlanData(accounts, budget, preferences);
      
      // Calculate totals
      const totalDebt = accounts.reduce((sum: number, acc: any) => sum + acc.currentBalanceCents, 0);
      const totalInterest = mockPlanData.reduce((sum: number, r: any) => sum + r.interestChargedCents, 0);
      const payoffMonths = Math.max(...mockPlanData.map((r: any) => r.month));

      // Generate AI explanation
      const explanation = await generatePlanExplanation(
        preferences.strategy,
        totalDebt,
        totalInterest,
        payoffMonths,
        accounts.length
      );

      // Save plan
      const plan = await storage.createPlan({
        id: randomUUID(),
        userId,
        planData: mockPlanData,
        status: "OPTIMAL",
        explanation,
        createdAt: new Date(),
      });

      res.json(plan);
    } catch (error: any) {
      console.error("Plan generation error:", error);
      res.status(500).send({ message: error.message || "Failed to generate plan" });
    }
  });

  app.get("/api/plans/latest", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const plan = await storage.getLatestPlan(userId);
      
      if (!plan) {
        return res.status(404).send({ message: "No plan found" });
      }

      res.json(plan);
    } catch (error: any) {
      res.status(500).send({ message: error.message || "Failed to fetch plan" });
    }
  });

  app.get("/api/plans", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const plans = await storage.getPlansByUserId(userId);
      res.json(plans);
    } catch (error: any) {
      res.status(500).send({ message: error.message || "Failed to fetch plans" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Mock plan generation (will be replaced with Python backend call)
function generateMockPlanData(accounts: any[], budget: any, preferences: any) {
  const planData: any[] = [];
  const monthlyBudget = budget.monthlyBudgetCents;
  
  // Create a simple debt snowball simulation
  const balances = accounts.map((acc: any) => ({
    lenderName: acc.lenderName,
    balance: acc.currentBalanceCents,
    apr: acc.aprStandardBps / 10000,
    minPayment: Math.max(
      acc.minPaymentRuleFixedCents,
      (acc.currentBalanceCents * acc.minPaymentRulePercentageBps) / 10000
    ),
  }));

  let month = 1;
  const maxMonths = 120;

  while (month <= maxMonths && balances.some(b => b.balance > 0)) {
    let remainingBudget = monthlyBudget;

    balances.forEach((acc) => {
      if (acc.balance <= 0) return;

      // Calculate interest
      const monthlyRate = acc.apr / 12;
      const interestCharged = Math.round(acc.balance * monthlyRate);
      
      // Determine payment
      const minPayment = Math.min(acc.minPayment, acc.balance + interestCharged);
      const payment = Math.min(
        Math.max(minPayment, remainingBudget),
        acc.balance + interestCharged
      );

      remainingBudget -= payment;

      // Apply payment
      const principalPaid = payment - interestCharged;
      acc.balance = Math.max(0, acc.balance - principalPaid);

      planData.push({
        month,
        lenderName: acc.lenderName,
        paymentCents: payment,
        interestChargedCents: interestCharged,
        principalPaidCents: principalPaid,
        endingBalanceCents: acc.balance,
      });
    });

    month++;
  }

  return planData;
}
