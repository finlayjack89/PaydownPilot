import type { Express } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import { decryptToken } from "../encryption";
import { 
  analyzeTransactionsWithClaude, 
  calculateBudgetFromAnalysis,
  type TransactionData
} from "../ai/budget-analyzer";
import { analyzeBudget, analyzePersona } from "../services/budget-engine";
import { getPersonaById, PERSONAS } from "../mock-data/truelayer-personas";
import { budgetAnalyzeRequestSchema } from "@shared/schema";
import { z } from "zod";
import { fetchAllTransactions, fetchAllDirectDebits, refreshAccessToken, encryptToken } from "../truelayer";

// Request validation schemas
const saveBudgetSchema = z.object({
  currentBudgetCents: z.number().int().min(0),
  potentialBudgetCents: z.number().int().min(0).optional(),
});

export function registerBudgetAnalysisRoutes(app: Express): void {
  /**
   * POST /api/budget/analyze-transactions
   * Fetches transactions from TrueLayer and analyzes them with the budget engine
   * to determine the user's current budget and suggest a safe-to-spend amount
   */
  app.post("/api/budget/analyze-transactions", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      if (userId === "guest-user") {
        return res.status(403).send({ 
          message: "Budget analysis is not available for guest users. Please create an account to connect your bank and analyze transactions." 
        });
      }
      
      const trueLayerItem = await storage.getTrueLayerItemByUserId(userId);
      if (!trueLayerItem) {
        return res.status(404).send({ 
          message: "No bank account connected. Please connect your bank account first to analyze transactions." 
        });
      }
      
      let accessToken: string;
      try {
        accessToken = decryptToken(trueLayerItem.accessTokenEncrypted);
      } catch (error: any) {
        console.error("Error decrypting TrueLayer access token:", error);
        return res.status(500).send({ 
          message: "Failed to access bank connection. Please reconnect your bank account." 
        });
      }
      
      const isExpired = trueLayerItem.consentExpiresAt && 
        new Date(trueLayerItem.consentExpiresAt) < new Date();
      
      if (isExpired && trueLayerItem.refreshTokenEncrypted) {
        try {
          const refreshToken = decryptToken(trueLayerItem.refreshTokenEncrypted);
          const newTokens = await refreshAccessToken(refreshToken);
          
          accessToken = newTokens.access_token;
          
          await storage.updateTrueLayerItem(trueLayerItem.id, {
            accessTokenEncrypted: encryptToken(newTokens.access_token),
            refreshTokenEncrypted: newTokens.refresh_token 
              ? encryptToken(newTokens.refresh_token) 
              : trueLayerItem.refreshTokenEncrypted,
            consentExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
          });
        } catch (refreshError) {
          console.error("[Budget Analysis] Token refresh failed:", refreshError);
          return res.status(401).send({ 
            message: "Bank connection expired. Please reconnect your bank.",
            needsReauth: true 
          });
        }
      }
      
      const days = req.body.days || 90;
      let transactions;
      let directDebits;
      
      try {
        transactions = await fetchAllTransactions(accessToken, Math.min(Math.max(days, 30), 365));
        directDebits = await fetchAllDirectDebits(accessToken);
        console.log(`[Budget Analysis] Fetched ${transactions.length} transactions and ${directDebits.length} direct debits for user ${userId}`);
      } catch (error: any) {
        console.error("Error fetching data from TrueLayer:", error);
        return res.status(500).send({ 
          message: "Failed to fetch transactions from your bank. Please try again later." 
        });
      }
      
      if (!transactions || transactions.length === 0) {
        return res.status(404).send({ 
          message: "No transactions found in the specified period. Please check your bank account has transaction history." 
        });
      }
      
      const analysisMonths = Math.max(1, Math.round(days / 30));
      
      const analysis = analyzeBudget({
        transactions: transactions.map(t => ({
          description: t.description,
          amount: t.amount,
          transaction_classification: t.transaction_classification,
          transaction_type: t.transaction_type as "CREDIT" | "DEBIT" | "STANDING_ORDER" | "DIRECT_DEBIT" | "FEE",
          date: t.timestamp,
        })),
        direct_debits: directDebits.map(dd => ({
          name: dd.name,
          amount: dd.previous_payment_amount || 0,
        })),
        analysisMonths,
      });
      
      console.log(`[Budget Analysis] Results for user ${userId}:`, {
        income: analysis.averageMonthlyIncomeCents / 100,
        fixed: analysis.fixedCostsCents / 100,
        variable: analysis.variableEssentialsCents / 100,
        safeToSpend: analysis.safeToSpendCents / 100,
        debtsDetected: analysis.detectedDebtPayments,
      });
      
      await storage.updateTrueLayerItem(trueLayerItem.id, {
        lastSyncedAt: new Date()
      });
      
      res.json({
        success: true,
        analysis,
        transactionCount: transactions.length,
        directDebitCount: directDebits.length,
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

  // ============================================
  // Find My Budget - Deterministic Analysis (TrueLayer)
  // ============================================

  /**
   * POST /api/budget/analyze
   * Deterministic budget analysis using TrueLayer transaction classifications.
   * Accepts either a personaId (for testing) or raw transaction data.
   */
  app.post("/api/budget/analyze", requireAuth, async (req, res) => {
    try {
      const validatedData = budgetAnalyzeRequestSchema.parse(req.body);
      
      // Option 1: Use a test persona
      if (validatedData.personaId) {
        const persona = getPersonaById(validatedData.personaId);
        if (!persona) {
          return res.status(404).send({ 
            message: `Persona not found: ${validatedData.personaId}` 
          });
        }
        
        const analysis = analyzePersona(persona);
        console.log(`[Budget Engine] Analyzed persona ${validatedData.personaId}:`, {
          income: analysis.averageMonthlyIncomeCents / 100,
          fixed: analysis.fixedCostsCents / 100,
          variable: analysis.variableEssentialsCents / 100,
          safeToSpend: analysis.safeToSpendCents / 100,
          debtsDetected: analysis.detectedDebtPayments,
        });
        
        return res.json({
          success: true,
          analysis,
          personaId: validatedData.personaId,
        });
      }
      
      // Option 2: Use raw transaction data
      if (validatedData.transactions && validatedData.transactions.length > 0) {
        const analysis = analyzeBudget({
          transactions: validatedData.transactions.map(t => ({
            description: t.description,
            amount: t.amount,
            transaction_classification: t.transaction_classification,
            transaction_type: t.transaction_type,
            date: t.date,
          })),
          direct_debits: validatedData.direct_debits,
          analysisMonths: 1,
        });
        
        return res.json({
          success: true,
          analysis,
        });
      }
      
      return res.status(400).send({ 
        message: "Either personaId or transactions array is required" 
      });
      
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).send({ 
          message: "Invalid request data",
          errors: error.errors 
        });
      }
      
      console.error("Error in deterministic budget analysis:", error);
      res.status(500).send({ 
        message: "Failed to analyze budget. Please try again." 
      });
    }
  });

  /**
   * GET /api/budget/personas
   * Lists available test personas for the Budget Finder demo
   */
  app.get("/api/budget/personas", requireAuth, async (_req, res) => {
    try {
      const personaList = Object.entries(PERSONAS).map(([id, persona]) => ({
        id,
        transactionCount: persona.transactions.length,
        directDebitCount: persona.direct_debits.length,
      }));
      
      res.json({
        success: true,
        personas: personaList,
      });
    } catch (error: any) {
      console.error("Error fetching personas:", error);
      res.status(500).send({ 
        message: "Failed to fetch personas." 
      });
    }
  });

  /**
   * POST /api/budget/apply-safe-to-spend
   * Applies the calculated Safe-to-Spend amount to the user's budget
   */
  app.post("/api/budget/apply-safe-to-spend", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { safeToSpendCents } = req.body;
      
      if (typeof safeToSpendCents !== "number" || safeToSpendCents < 0) {
        return res.status(400).send({ 
          message: "Invalid safeToSpendCents value" 
        });
      }
      
      // Check if user is a guest
      if (userId === "guest-user") {
        return res.status(403).send({ 
          message: "Budget saving is not available for guest users. Please create an account." 
        });
      }
      
      // Update user's current budget with the safe-to-spend amount
      const updatedUser = await storage.updateUser(userId, {
        currentBudgetCents: safeToSpendCents,
      });
      
      if (!updatedUser) {
        return res.status(404).send({ 
          message: "User not found" 
        });
      }
      
      console.log(`[Budget Engine] Applied Safe-to-Spend for user ${userId}: $${safeToSpendCents / 100}`);
      
      res.json({
        success: true,
        message: "Safe-to-Spend amount applied to budget",
        currentBudgetCents: safeToSpendCents,
      });
      
    } catch (error: any) {
      console.error("Error applying safe-to-spend:", error);
      res.status(500).send({ 
        message: "Failed to apply budget. Please try again." 
      });
    }
  });
}