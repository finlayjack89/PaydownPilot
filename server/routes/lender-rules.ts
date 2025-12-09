import type { Express } from "express";
import { db } from "../db";
import { lenderRules } from "@shared/schema";
import type { LenderRuleDiscoveryRequest, LenderRuleDiscoveryResponse, MinPaymentRule } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const AI_SYSTEM_PROMPT = `You are the "Research Team," an AI assistant for a fintech app called Resolve. Your *only* job is to research and extract structured data on credit card minimum payment rules.

CRITICAL RULES:
1. You are a researcher. You are *forbidden* from giving financial advice, performing calculations, or generating any monetary values that are not part of a quoted rule.
2. Your *only* output format is a single, valid JSON object matching the user's requested schema. Do not output any other text, greetings, or explanations.
3. The user will provide a lender name and country. You must find the most common *standard* minimum payment rule for that lender's credit cards in that country.
4. min_payment_percentage_bp: Must be in basis points (e.g., 2.5% = 250).
5. min_payment_fixed_cents: Must be in cents (e.g., $25 = 2500, £5 = 500).
6. includes_interest: This is the most critical field.
   * Set to false for US/CA rules (e.g., "X% of statement balance").
   * Set to true for UK rules (e.g., "X% of balance + interest + fees"). This is a key regional difference.
7. rule_summary: Write a one-sentence summary (e.g., "2.5% of (balance + interest), or £5, whichever is higher.")
8. If you cannot find a reliable rule, return a default rule of 1% (100 bps) and $10 (1000 cents), and set the summary to "Could not be verified - using conservative default."

Examples of correct responses:

For Chase (USA):
{
  "min_payment_percentage_bp": 200,
  "min_payment_fixed_cents": 2500,
  "includes_interest": false,
  "rule_summary": "2% of statement balance, or $25, whichever is greater"
}

For Barclaycard (UK):
{
  "min_payment_percentage_bp": 250,
  "min_payment_fixed_cents": 500,
  "includes_interest": true,
  "rule_summary": "2.5% of (balance + interest + fees), or £5, whichever is higher"
}`;

interface AIResearchResult {
  min_payment_percentage_bp: number;
  min_payment_fixed_cents: number;
  includes_interest: boolean;
  rule_summary: string;
}

function normalizeLenderKey(lenderName: string): string {
  return lenderName.toLowerCase().trim();
}

export function registerLenderRuleRoutes(app: Express) {
  app.post("/api/lender-rules/research", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { lenderName, country } = req.body as LenderRuleDiscoveryRequest;

      if (!lenderName || !country) {
        return res.status(400).json({ message: 'lenderName and country are required' });
      }

      // 1. Check cache first
      const normalizedKey = normalizeLenderKey(lenderName);
      const cached = await db.select().from(lenderRules)
        .where(and(
          eq(lenderRules.lenderName, normalizedKey),
          eq(lenderRules.country, country)
        ))
        .limit(1);

      if (cached.length > 0) {
        const rule = cached[0];
        const response: LenderRuleDiscoveryResponse = {
          lenderName,
          ruleDescription: rule.ruleDescription || '',
          minPaymentRule: {
            fixedCents: rule.fixedCents || 0,
            percentageBps: rule.percentageBps || 0,
            includesInterest: rule.includesInterest || false,
          },
          confidence: 'high', // Cached rules are user-verified
        };
        return res.json(response);
      }

      // 2. No cache hit - call AI Research Team
      console.log(`[AI Research] Researching ${lenderName} in ${country}...`);

      const userPrompt = `Find the standard minimum payment rule for ${lenderName} credit cards in ${country}. Return ONLY a valid JSON object with the fields: min_payment_percentage_bp, min_payment_fixed_cents, includes_interest, and rule_summary.`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: AI_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      // Extract JSON from response
      let aiResult: AIResearchResult;
      const content = message.content[0];
      
      if (content.type === 'text') {
        const text = content.text.trim();
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('AI did not return valid JSON');
        }
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Unexpected AI response format');
      }

      // 3. Validate the AI response
      if (
        typeof aiResult.min_payment_percentage_bp !== 'number' ||
        typeof aiResult.min_payment_fixed_cents !== 'number' ||
        typeof aiResult.includes_interest !== 'boolean' ||
        typeof aiResult.rule_summary !== 'string'
      ) {
        throw new Error('AI response missing required fields');
      }

      console.log(`[AI Research] Found rule: ${aiResult.rule_summary}`);

      // 4. Return to frontend for user verification (DO NOT save yet)
      const response: LenderRuleDiscoveryResponse = {
        lenderName,
        ruleDescription: aiResult.rule_summary,
        minPaymentRule: {
          fixedCents: aiResult.min_payment_fixed_cents,
          percentageBps: aiResult.min_payment_percentage_bp,
          includesInterest: aiResult.includes_interest,
        },
        confidence: 'medium', // AI-researched, not yet verified
      };

      res.json(response);
    } catch (error: any) {
      console.error('[AI Research] Error:', error);
      
      // Fallback to conservative default
      const response: LenderRuleDiscoveryResponse = {
        lenderName: req.body.lenderName,
        ruleDescription: 'Could not be verified - using conservative default: 1% or $10',
        minPaymentRule: {
          fixedCents: 1000, // $10
          percentageBps: 100, // 1%
          includesInterest: false,
        },
        confidence: 'low',
      };

      res.json(response);
    }
  });

  app.post("/api/lender-rules/verify", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { lenderName, country, minPaymentRule, ruleDescription } = req.body as {
        lenderName: string;
        country: string;
        minPaymentRule: MinPaymentRule;
        ruleDescription: string;
      };

      if (!lenderName || !country || !minPaymentRule) {
        return res.status(400).json({ message: 'lenderName, country, and minPaymentRule are required' });
      }

      // Save the user-verified rule to cache
      const normalizedKey = normalizeLenderKey(lenderName);

      await db.insert(lenderRules).values({
        lenderName: normalizedKey,
        country,
        fixedCents: minPaymentRule.fixedCents,
        percentageBps: minPaymentRule.percentageBps,
        includesInterest: minPaymentRule.includesInterest,
        ruleDescription: ruleDescription || '',
        verifiedAt: new Date(),
      }).onConflictDoUpdate({
        target: [lenderRules.lenderName, lenderRules.country],
        set: {
          fixedCents: minPaymentRule.fixedCents,
          percentageBps: minPaymentRule.percentageBps,
          includesInterest: minPaymentRule.includesInterest,
          ruleDescription: ruleDescription || '',
          verifiedAt: new Date(),
        },
      });

      console.log(`[Lender Rules] User verified and saved: ${lenderName} (${country})`);

      res.json({ 
        message: 'Rule verified and saved',
        success: true,
      });
    } catch (error: any) {
      console.error('[Lender Rules] Error saving verified rule:', error);
      res.status(500).json({ 
        message: 'Failed to save verified rule',
        error: error.message 
      });
    }
  });

  // Endpoint to get all cached rules (for debugging/admin)
  app.get("/api/lender-rules/cache", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const rules = await db.select().from(lenderRules).orderBy(lenderRules.verifiedAt);
      res.json(rules);
    } catch (error: any) {
      console.error('[Lender Rules] Error fetching cache:', error);
      res.status(500).json({ message: 'Failed to fetch cache' });
    }
  });
}
