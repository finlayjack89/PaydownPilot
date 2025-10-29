import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { storage } from "./storage";
import { setupAuth, requireAuth, hashPassword } from "./auth";
import { discoverLenderRule, generatePlanExplanation } from "./anthropic";
import { 
  insertUserSchema, insertAccountSchema, insertBudgetSchema, 
  insertPreferenceSchema, type InsertAccount, type InsertBudget
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

  app.post("/api/auth/guest", (req, res) => {
    // Create a guest user session
    const guestUser = {
      id: "guest-user",
      email: "guest@example.com",
      name: "Guest User",
      country: "US",
      region: null,
      currency: "USD",
      createdAt: new Date(),
    };
    
    req.login(guestUser, (err) => {
      if (err) {
        return res.status(500).send({ message: "Guest login failed" });
      }
      res.json(guestUser);
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
      const validatedData = insertAccountSchema.parse(req.body);
      
      const account = await storage.createAccount({
        ...validatedData,
        userId,
      });

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
      const validatedData = insertBudgetSchema.parse(req.body);
      
      const budget = await storage.createOrUpdateBudget({
        ...validatedData,
        userId,
      } as InsertBudget);

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
      const validatedData = insertPreferenceSchema.parse(req.body);
      
      const prefs = await storage.createOrUpdatePreferences({
        ...validatedData,
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
        fixedCents: result.minPaymentRule.fixedCents,
        percentageBps: result.minPaymentRule.percentageBps,
        includesInterest: result.minPaymentRule.includesInterest,
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

      // Transform data to match Python FastAPI schema (snake_case)
      const portfolioInput = {
        accounts: accounts.map((acc: any, index: number) => ({
          account_id: `acc_${index}`,
          lender_name: acc.lenderName,
          account_type: acc.accountType,
          current_balance_cents: acc.currentBalanceCents,
          apr_standard_bps: acc.aprStandardBps,
          payment_due_day: acc.paymentDueDay,
          min_payment_rule_type: "GREATER_OF",
          min_payment_rule: {
            fixed_cents: acc.minPaymentRuleFixedCents || 0,
            percentage_bps: acc.minPaymentRulePercentageBps || 0,
            includes_interest: acc.minPaymentRuleIncludesInterest || false,
          },
          promo_end_date: acc.promoEndDate || null,
          promo_duration_months: acc.promoDurationMonths || null,
          account_open_date: acc.accountOpenDate || planStartDate,
          notes: acc.notes || "",
        })),
        budget: {
          monthly_budget_cents: budget.monthlyBudgetCents,
          // Python expects List[Tuple[date, int]] - arrays of 2-element arrays
          future_changes: (budget.futureChanges || []).map((change: any) => [
            change.effectiveDate,
            change.newMonthlyBudgetCents
          ]),
          // Python expects List[Tuple[date, int]] - arrays of 2-element arrays
          // Note: targetLenderName is ignored for now (not supported by solver)
          lump_sum_payments: (budget.lumpSumPayments || []).map((payment: any) => [
            payment.paymentDate,
            payment.amountCents
          ]),
        },
        preferences: {
          strategy: preferences.strategy,
          payment_shape: preferences.paymentShape,
        },
        plan_start_date: planStartDate || new Date().toISOString().split('T')[0],
      };

      // Call Python FastAPI backend
      const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";
      const pythonResponse = await fetch(`${pythonBackendUrl}/generate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(portfolioInput),
      });

      if (!pythonResponse.ok) {
        let errorMessage = "Python solver failed";
        let errorDetail = null;
        try {
          const errorData = await pythonResponse.json();
          errorDetail = errorData.detail;
          errorMessage = JSON.stringify(errorData.detail || errorData) || errorMessage;
          console.error("Python backend error:", JSON.stringify(errorData, null, 2));
        } catch (e) {
          errorMessage = `Solver returned ${pythonResponse.status}`;
        }
        console.error("Python backend request failed:", {
          status: pythonResponse.status,
          url: `${pythonBackendUrl}/generate-plan`,
          error: errorMessage
        });
        return res.status(400).send({ 
          message: errorMessage,
          status: "ERROR",
          detail: errorDetail
        });
      }

      const pythonResult = await pythonResponse.json();

      // Validate solver response
      if (!pythonResult.status) {
        return res.status(500).send({ 
          message: "Invalid response from solver",
          status: "ERROR" 
        });
      }

      // Transform Python response back to our schema
      let planData: any[] = [];
      let status = pythonResult.status;
      let errorMessage = pythonResult.error_message || null;

      if (pythonResult.status === "OPTIMAL" && pythonResult.plan) {
        planData = pythonResult.plan.map((result: any) => ({
          month: result.month,
          lenderName: result.lender_name,
          paymentCents: result.payment_cents,
          interestChargedCents: result.interest_charged_cents,
          principalPaidCents: result.principal_paid_cents,
          endingBalanceCents: result.ending_balance_cents,
        }));
      } else if (pythonResult.status === "INFEASIBLE") {
        return res.status(400).send({
          message: errorMessage || "Budget too low to cover minimum payments. Please increase your monthly budget.",
          status: "INFEASIBLE"
        });
      } else if (pythonResult.status === "UNBOUNDED") {
        return res.status(400).send({
          message: errorMessage || "Optimization problem is unbounded. Please check your account data.",
          status: "UNBOUNDED"
        });
      } else {
        return res.status(500).send({
          message: errorMessage || "Solver failed with unknown error",
          status: pythonResult.status
        });
      }

      // Calculate totals for AI explanation
      const totalDebt = accounts.reduce((sum: number, acc: any) => sum + acc.currentBalanceCents, 0);
      const totalInterest = planData.reduce((sum: number, r: any) => sum + r.interestChargedCents, 0);
      const payoffMonths = planData.length > 0 ? Math.max(...planData.map((r: any) => r.month)) : 0;

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
        planStartDate: planStartDate || new Date().toISOString().split('T')[0],
        planData,
        status,
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

// Note: Mock plan generation removed - now using Python FastAPI backend integration
