import type { Express, Response } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import { decryptToken } from "../encryption";
import { analyzeBudget, analyzePersona } from "../services/budget-engine";
import { getPersonaById, PERSONAS } from "../mock-data/truelayer-personas";
import { budgetAnalyzeRequestSchema } from "@shared/schema";
import { z } from "zod";
import { fetchAllTransactions, fetchAllDirectDebits, refreshAccessToken, encryptToken } from "../truelayer";
import { randomUUID } from "crypto";

// Request validation schemas
const saveBudgetSchema = z.object({
  currentBudgetCents: z.number().int().min(0),
  potentialBudgetCents: z.number().int().min(0).optional(),
});

// Job state management for SSE streaming
interface EnrichmentJob {
  id: string;
  userId: string;
  status: "pending" | "extracting" | "enriching" | "classifying" | "complete" | "error";
  current: number;
  total: number;
  startTime: number;
  result?: any;
  error?: string;
  subscribers: Response[];
}

const enrichmentJobs = new Map<string, EnrichmentJob>();

function broadcastToSubscribers(job: EnrichmentJob, event: any) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  job.subscribers.forEach(res => {
    try {
      res.write(data);
    } catch (e) {
      // Subscriber disconnected
    }
  });
}

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
      
      // Try Ntropy enrichment first, fall back to basic analysis
      let analysis;
      let enrichedTransactions = null;
      let detectedDebts: any[] = [];
      
      try {
        // Call Python enrichment service
        const enrichmentResponse = await fetch("http://localhost:8000/enrich-transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactions: transactions.map(t => ({
              transaction_id: t.transaction_id,
              description: t.description,
              amount: t.amount,
              currency: t.currency || "GBP",
              transaction_type: t.transaction_type,
              transaction_category: t.transaction_category,
              transaction_classification: t.transaction_classification,
              timestamp: t.timestamp,
            })),
            user_id: userId,
            analysis_months: analysisMonths,
          }),
        });
        
        if (enrichmentResponse.ok) {
          const enrichmentData = await enrichmentResponse.json();
          console.log(`[Budget Analysis] Ntropy enrichment successful: ${enrichmentData.enriched_transactions?.length || 0} transactions enriched`);
          
          // Use enriched budget analysis
          analysis = {
            averageMonthlyIncomeCents: enrichmentData.budget_analysis.averageMonthlyIncomeCents,
            fixedCostsCents: enrichmentData.budget_analysis.fixedCostsCents,
            variableEssentialsCents: 0, // Ntropy doesn't separate variable essentials
            discretionaryCents: enrichmentData.budget_analysis.discretionaryCents,
            safeToSpendCents: enrichmentData.budget_analysis.safeToSpendCents,
            detectedDebtPayments: enrichmentData.detected_debts.map((d: any) => ({
              description: d.merchant_name || d.description,
              amountCents: d.amount_cents,
              type: "debt",
              logoUrl: d.logo_url,
              isRecurring: d.is_recurring,
              recurrenceFrequency: d.recurrence_frequency,
            })),
            breakdown: {
              income: [],
              fixedCosts: [],
              variableEssentials: [],
              discretionary: [],
            },
          };
          
          enrichedTransactions = enrichmentData.enriched_transactions;
          detectedDebts = enrichmentData.detected_debts;
        } else {
          console.log("[Budget Analysis] Ntropy enrichment unavailable, using fallback analysis");
          throw new Error("Enrichment service returned non-OK status");
        }
      } catch (enrichmentError) {
        console.log("[Budget Analysis] Using fallback budget analysis (Ntropy unavailable):", enrichmentError);
        
        // Fallback to original budget analysis
        analysis = analyzeBudget({
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
      }
      
      console.log(`[Budget Analysis] Results for user ${userId}:`, {
        income: analysis.averageMonthlyIncomeCents / 100,
        fixed: analysis.fixedCostsCents / 100,
        variable: analysis.variableEssentialsCents / 100,
        safeToSpend: analysis.safeToSpendCents / 100,
        debtsDetected: analysis.detectedDebtPayments?.length || detectedDebts.length,
      });
      
      await storage.updateTrueLayerItem(trueLayerItem.id, {
        lastSyncedAt: new Date()
      });
      
      res.json({
        success: true,
        analysis,
        enrichedTransactions,
        detectedDebts,
        transactionCount: transactions.length,
        directDebitCount: directDebits.length,
        message: enrichedTransactions ? "Transaction analysis with Ntropy enrichment completed" : "Transaction analysis completed successfully"
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

  // ============================================
  // Streaming Enrichment Endpoints
  // ============================================

  /**
   * POST /api/budget/start-enrichment
   * Starts an async enrichment job and returns a jobId for SSE subscription
   */
  app.post("/api/budget/start-enrichment", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      if (userId === "guest-user") {
        return res.status(403).send({ 
          message: "Budget analysis is not available for guest users." 
        });
      }
      
      // Get TrueLayer connection
      const trueLayerItem = await storage.getTrueLayerItemByUserId(userId);
      if (!trueLayerItem) {
        return res.status(404).send({ 
          message: "No bank account connected." 
        });
      }
      
      let accessToken: string;
      try {
        accessToken = decryptToken(trueLayerItem.accessTokenEncrypted);
      } catch (error: any) {
        return res.status(500).send({ 
          message: "Failed to access bank connection." 
        });
      }
      
      // Refresh token if expired
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
          return res.status(401).send({ 
            message: "Bank connection expired. Please reconnect.",
            needsReauth: true 
          });
        }
      }
      
      // Create job
      const jobId = randomUUID();
      const job: EnrichmentJob = {
        id: jobId,
        userId,
        status: "pending",
        current: 0,
        total: 0,
        startTime: Date.now(),
        subscribers: [],
      };
      enrichmentJobs.set(jobId, job);
      
      // Start enrichment in background
      (async () => {
        try {
          // Fetch transactions
          job.status = "extracting";
          broadcastToSubscribers(job, {
            type: "progress",
            current: 0,
            total: 0,
            status: "extracting",
            startTime: job.startTime,
          });
          
          const days = 90;
          const transactions = await fetchAllTransactions(accessToken, days);
          const directDebits = await fetchAllDirectDebits(accessToken);
          
          job.total = transactions.length;
          
          console.log(`[Enrichment Job ${jobId}] Fetched ${transactions.length} transactions`);
          
          // Stream enrichment through Python
          const streamResponse = await fetch("http://localhost:8000/enrich-transactions-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transactions: transactions.map(t => ({
                transaction_id: t.transaction_id,
                description: t.description,
                amount: t.amount,
                currency: t.currency || "GBP",
                transaction_type: t.transaction_type,
                transaction_category: t.transaction_category,
                transaction_classification: t.transaction_classification,
                timestamp: t.timestamp,
              })),
              user_id: userId,
              analysis_months: Math.max(1, Math.round(days / 30)),
            }),
          });
          
          if (!streamResponse.ok) {
            throw new Error("Enrichment service failed");
          }
          
          const reader = streamResponse.body?.getReader();
          const decoder = new TextDecoder();
          
          if (!reader) {
            throw new Error("No response body from enrichment service");
          }
          
          let buffer = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const event = JSON.parse(line.slice(6));
                  
                  if (event.type === "progress") {
                    job.current = event.current;
                    job.total = event.total;
                    job.status = event.status;
                    broadcastToSubscribers(job, {
                      type: "progress",
                      current: event.current,
                      total: event.total,
                      status: event.status,
                      startTime: job.startTime,
                    });
                  } else if (event.type === "complete") {
                    job.status = "complete";
                    job.result = {
                      success: true,
                      analysis: event.result.budget_analysis,
                      enrichedTransactions: event.result.enriched_transactions,
                      detectedDebts: event.result.detected_debts,
                      transactionCount: transactions.length,
                      directDebitCount: directDebits.length,
                      isEnriched: true,
                    };
                    broadcastToSubscribers(job, {
                      type: "complete",
                      result: job.result,
                    });
                  } else if (event.type === "error") {
                    job.status = "error";
                    job.error = event.message;
                    broadcastToSubscribers(job, {
                      type: "error",
                      message: event.message,
                    });
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
          
          // Update TrueLayer sync time
          await storage.updateTrueLayerItem(trueLayerItem.id, {
            lastSyncedAt: new Date()
          });
          
        } catch (error: any) {
          console.error(`[Enrichment Job ${jobId}] Error:`, error);
          job.status = "error";
          job.error = error.message || "An error occurred during enrichment";
          broadcastToSubscribers(job, {
            type: "error",
            message: job.error,
          });
        }
      })();
      
      res.json({
        success: true,
        jobId,
        message: "Enrichment job started",
      });
      
    } catch (error: any) {
      console.error("Error starting enrichment:", error);
      res.status(500).send({ 
        message: "Failed to start enrichment. Please try again." 
      });
    }
  });

  /**
   * GET /api/budget/enrichment-stream/:jobId
   * SSE endpoint for streaming enrichment progress
   */
  app.get("/api/budget/enrichment-stream/:jobId", requireAuth, (req, res) => {
    const { jobId } = req.params;
    const job = enrichmentJobs.get(jobId);
    
    if (!job) {
      return res.status(404).send({ message: "Job not found" });
    }
    
    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    
    // Add subscriber
    job.subscribers.push(res);
    
    // Send current state immediately
    if (job.status === "complete" && job.result) {
      res.write(`data: ${JSON.stringify({ type: "complete", result: job.result })}\n\n`);
    } else if (job.status === "error") {
      res.write(`data: ${JSON.stringify({ type: "error", message: job.error })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({
        type: "progress",
        current: job.current,
        total: job.total,
        status: job.status,
        startTime: job.startTime,
      })}\n\n`);
    }
    
    // Handle disconnect
    req.on("close", () => {
      const index = job.subscribers.indexOf(res);
      if (index > -1) {
        job.subscribers.splice(index, 1);
      }
      
      // Clean up job after all subscribers disconnect (with delay)
      if (job.subscribers.length === 0) {
        setTimeout(() => {
          if (job.subscribers.length === 0) {
            enrichmentJobs.delete(jobId);
          }
        }, 60000); // Clean up after 1 minute
      }
    });
  });
}