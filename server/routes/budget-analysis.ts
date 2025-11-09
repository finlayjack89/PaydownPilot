import type { Express } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import { fetchTransactions } from "../plaid";
import { decryptToken } from "../encryption";
import { 
  analyzeTransactionsWithClaude, 
  calculateBudgetFromAnalysis,
  type TransactionData
} from "../ai/budget-analyzer";
import { z } from "zod";

// Request validation schemas
const saveBudgetSchema = z.object({
  currentBudgetCents: z.number().int().min(0),
  potentialBudgetCents: z.number().int().min(0).optional(),
});

export function registerBudgetAnalysisRoutes(app: Express): void {
  /**
   * POST /api/budget/analyze-transactions
   * Fetches transactions from Plaid and analyzes them with Claude
   * to determine the user's current budget
   */
  app.post("/api/budget/analyze-transactions", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      // Check if user is a guest
      if (userId === "guest-user") {
        return res.status(403).send({ 
          message: "Budget analysis is not available for guest users. Please create an account to connect your bank and analyze transactions." 
        });
      }
      
      // Get the user's Plaid item
      const plaidItem = await storage.getPlaidItemByUserId(userId);
      if (!plaidItem) {
        return res.status(404).send({ 
          message: "No bank account connected. Please connect your bank account first to analyze transactions." 
        });
      }
      
      // Decrypt the access token
      let accessToken: string;
      try {
        accessToken = decryptToken(plaidItem.accessTokenEncrypted);
      } catch (error: any) {
        console.error("Error decrypting Plaid access token:", error);
        return res.status(500).send({ 
          message: "Failed to access bank connection. Please reconnect your bank account." 
        });
      }
      
      // Fetch transactions from Plaid (90-120 days)
      const days = req.body.days || 90; // Allow customization, default to 90 days
      let transactions: any[];
      try {
        transactions = await fetchTransactions(accessToken, Math.min(Math.max(days, 30), 365)); // Limit between 30-365 days
        console.log(`[Budget Analysis] Fetched ${transactions.length} transactions for user ${userId}`);
      } catch (error: any) {
        console.error("Error fetching transactions from Plaid:", error);
        return res.status(500).send({ 
          message: "Failed to fetch transactions from your bank. Please try again later." 
        });
      }
      
      if (!transactions || transactions.length === 0) {
        return res.status(404).send({ 
          message: "No transactions found in the specified period. Please check your bank account has transaction history." 
        });
      }
      
      // Transform Plaid transactions to our simplified format for Claude
      const transactionData: TransactionData[] = transactions.map(t => ({
        name: t.name,
        amount: t.amount, // Plaid format: positive = money out, negative = money in
        date: t.date,
        category: t.category,
        merchant_name: t.merchant_name,
        payment_channel: t.payment_channel
      }));
      
      // Analyze transactions with Claude
      let claudeAnalysis;
      try {
        claudeAnalysis = await analyzeTransactionsWithClaude(transactionData);
        console.log(`[Budget Analysis] Claude analysis completed for user ${userId}`);
      } catch (error: any) {
        console.error("Error analyzing transactions with Claude:", error);
        return res.status(500).send({ 
          message: "Failed to analyze transactions. Please try again later." 
        });
      }
      
      // Calculate final budget figures (Two-Brain doctrine: backend does the math)
      const budgetAnalysis = calculateBudgetFromAnalysis(claudeAnalysis, days);
      
      // Log the results for debugging
      console.log(`[Budget Analysis] Results for user ${userId}:`, {
        incomePerMonth: budgetAnalysis.identified_monthly_net_income_cents / 100,
        essentialExpenses: budgetAnalysis.identified_essential_expenses_total_cents / 100,
        currentBudget: budgetAnalysis.current_budget_cents / 100,
        potentialBudget: budgetAnalysis.potential_budget_cents / 100,
        subscriptionCount: budgetAnalysis.non_essential_subscriptions.length,
        discretionaryCategories: budgetAnalysis.non_essential_discretionary_categories.length
      });
      
      // Update Plaid item's last synced timestamp
      await storage.updatePlaidItem(plaidItem.id, {
        lastSyncedAt: new Date()
      });
      
      // Return the analysis (raw transaction data is NOT stored, per security requirements)
      res.json({
        success: true,
        analysis: budgetAnalysis,
        message: "Transaction analysis completed successfully"
      });
      
    } catch (error: any) {
      console.error("Unexpected error in budget analysis:", error);
      res.status(500).send({ 
        message: "An unexpected error occurred during budget analysis. Please try again." 
      });
    }
  });
  
  /**
   * POST /api/budget/save-analyzed-budget
   * Saves the analyzed budget figures to the user's profile
   */
  app.post("/api/budget/save-analyzed-budget", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      // Validate request body
      const validatedData = saveBudgetSchema.parse(req.body);
      
      // Check if user is a guest
      if (userId === "guest-user") {
        return res.status(403).send({ 
          message: "Budget saving is not available for guest users. Please create an account." 
        });
      }
      
      // Update user's budget fields
      const updatedUser = await storage.updateUser(userId, {
        currentBudgetCents: validatedData.currentBudgetCents,
        potentialBudgetCents: validatedData.potentialBudgetCents
      });
      
      if (!updatedUser) {
        return res.status(404).send({ 
          message: "User not found" 
        });
      }
      
      console.log(`[Budget Analysis] Saved budget for user ${userId}:`, {
        currentBudget: validatedData.currentBudgetCents / 100,
        potentialBudget: validatedData.potentialBudgetCents ? validatedData.potentialBudgetCents / 100 : null
      });
      
      res.json({
        success: true,
        message: "Budget saved successfully",
        currentBudgetCents: updatedUser.currentBudgetCents,
        potentialBudgetCents: updatedUser.potentialBudgetCents
      });
      
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).send({ 
          message: "Invalid budget data",
          errors: error.errors 
        });
      }
      
      console.error("Error saving analyzed budget:", error);
      res.status(500).send({ 
        message: "Failed to save budget. Please try again." 
      });
    }
  });
  
  /**
   * GET /api/budget/current
   * Gets the user's current analyzed budget (if any)
   */
  app.get("/api/budget/current", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      // Check if user is a guest
      if (userId === "guest-user") {
        return res.json({
          currentBudgetCents: null,
          potentialBudgetCents: null,
          hasAnalyzedBudget: false
        });
      }
      
      // Get user's current budget
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).send({ 
          message: "User not found" 
        });
      }
      
      res.json({
        currentBudgetCents: user.currentBudgetCents || null,
        potentialBudgetCents: user.potentialBudgetCents || null,
        hasAnalyzedBudget: user.currentBudgetCents !== null && user.currentBudgetCents !== undefined
      });
      
    } catch (error: any) {
      console.error("Error fetching current budget:", error);
      res.status(500).send({ 
        message: "Failed to fetch budget. Please try again." 
      });
    }
  });
}