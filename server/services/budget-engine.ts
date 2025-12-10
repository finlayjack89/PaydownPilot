import type {
  TrueLayerTransaction,
  TrueLayerDirectDebit,
  TrueLayerPersona,
  BudgetAnalysisResponse,
  DetectedDebtPayment,
  BreakdownItem,
} from "@shared/schema";

// Debt-related keywords for detection
const DEBT_KEYWORDS = [
  "AMEX",
  "AMERICAN EXPRESS",
  "BARCLAYCARD",
  "BARCLAYS CARD",
  "CAPITAL ONE",
  "MBNA",
  "HSBC CARD",
  "LLOYDS CARD",
  "NATWEST CARD",
  "SANTANDER CARD",
  "VIRGIN MONEY",
  "TESCO CREDIT",
  "LOAN",
  "KLARNA",
  "CLEARPAY",
  "AFTERPAY",
  "LAYBUY",
  "PAYPAL CREDIT",
  "VERY",
  "LITTLEWOODS",
  "JD WILLIAMS",
  "STUDIO",
  "BRIGHTHOUSE",
  "PROVIDENT",
  "QUICKQUID",
  "WONGA",
  "PAYDAY",
];

// Fixed cost classification patterns
const FIXED_COST_CLASSIFICATIONS = [
  ["Bills", "Rent"],
  ["Bills", "Utilities"],
  ["Bills", "Tax"],
  ["Bills", "Credit Card"],
  ["Home", "Mortgage"],
  ["Home", "Rent"],
  ["Insurance"],
];

// Variable essential classification patterns
const VARIABLE_ESSENTIAL_CLASSIFICATIONS = [
  ["Shopping", "Groceries"],
  ["Transport"],
  ["Health"],
  ["Education"],
];

// Income classification patterns
const INCOME_CLASSIFICATIONS = [
  ["Income", "Salary"],
  ["Income"],
];

// Internal transfer patterns to exclude from income
const TRANSFER_KEYWORDS = ["Transfer", "TRANSFER", "TFR", "INTERNAL"];

function classificationMatches(
  txClassification: string[],
  patterns: string[][]
): boolean {
  for (const pattern of patterns) {
    // Check if ALL elements of the pattern exist in the transaction classification
    const allMatch = pattern.every((p) =>
      txClassification.some(
        (c) => c.toLowerCase() === p.toLowerCase()
      )
    );
    if (allMatch) return true;
  }
  return false;
}

function isInternalTransfer(tx: TrueLayerTransaction): boolean {
  // Check if description contains transfer keywords
  const upperDesc = tx.description.toUpperCase();
  if (TRANSFER_KEYWORDS.some((kw) => upperDesc.includes(kw.toUpperCase()))) {
    return true;
  }
  // Check if classification indicates transfer
  if (tx.transaction_classification.some((c) => c.toLowerCase() === "transfer")) {
    return true;
  }
  return false;
}

function detectDebtPayments(transactions: TrueLayerTransaction[]): DetectedDebtPayment[] {
  const detectedDebts = new Map<string, DetectedDebtPayment>();

  for (const tx of transactions) {
    // Only look at debits (negative amounts)
    if (tx.amount >= 0) continue;
    
    const upperDesc = tx.description.toUpperCase();
    for (const keyword of DEBT_KEYWORDS) {
      if (upperDesc.includes(keyword.toUpperCase())) {
        const existingDebt = detectedDebts.get(keyword);
        const amountCents = Math.round(Math.abs(tx.amount) * 100);
        
        // Determine debt type
        let type = "credit_card";
        if (keyword.includes("LOAN") || keyword === "PROVIDENT" || keyword === "QUICKQUID" || keyword === "WONGA" || keyword === "PAYDAY") {
          type = "loan";
        } else if (["KLARNA", "CLEARPAY", "AFTERPAY", "LAYBUY"].includes(keyword)) {
          type = "bnpl";
        }
        
        if (existingDebt) {
          // Add to existing amount
          existingDebt.amountCents += amountCents;
        } else {
          detectedDebts.set(keyword, {
            description: keyword,
            amountCents,
            type,
          });
        }
        break;
      }
    }
  }

  return Array.from(detectedDebts.values());
}

function categorizeTransaction(tx: TrueLayerTransaction): "income" | "fixed" | "variable" | "discretionary" {
  const classification = tx.transaction_classification;
  const txType = tx.transaction_type;

  // Credits are income (if not internal transfer)
  if (tx.amount > 0) {
    if (isInternalTransfer(tx)) {
      return "discretionary"; // Exclude from income calculation
    }
    if (classificationMatches(classification, INCOME_CLASSIFICATIONS)) {
      return "income";
    }
    return "income"; // Default credits to income
  }

  // Standing orders and direct debits are fixed costs
  if (txType === "STANDING_ORDER" || txType === "DIRECT_DEBIT") {
    return "fixed";
  }

  // Check for fixed cost classifications
  if (classificationMatches(classification, FIXED_COST_CLASSIFICATIONS)) {
    return "fixed";
  }

  // Check for variable essential classifications
  if (classificationMatches(classification, VARIABLE_ESSENTIAL_CLASSIFICATIONS)) {
    return "variable";
  }

  // Everything else is discretionary
  return "discretionary";
}

export interface BudgetEngineInput {
  transactions: TrueLayerTransaction[];
  direct_debits?: TrueLayerDirectDebit[];
  analysisMonths?: number; // Default to 1 for single-month snapshots
}

function extractCategory(classification: string[]): string | undefined {
  // Return the first classification as the primary category
  if (classification.length > 0) {
    return classification.join(" > ");
  }
  return undefined;
}

export function analyzeBudget(input: BudgetEngineInput): BudgetAnalysisResponse {
  const { transactions, direct_debits = [], analysisMonths = 1 } = input;

  // Categorize all transactions - using BreakdownItem with amount in dollars (not cents)
  const incomeItems: BreakdownItem[] = [];
  const fixedCostsItems: BreakdownItem[] = [];
  const variableEssentialsItems: BreakdownItem[] = [];
  const discretionaryItems: BreakdownItem[] = [];

  let totalIncomeCents = 0;
  let totalFixedCents = 0;
  let totalVariableCents = 0;
  let totalDiscretionaryCents = 0;

  for (const tx of transactions) {
    const budgetCategory = categorizeTransaction(tx);
    const amountCents = Math.round(Math.abs(tx.amount) * 100);
    const amount = Math.abs(tx.amount); // Amount in dollars for frontend
    const category = extractCategory(tx.transaction_classification);
    const txRecord: BreakdownItem = { description: tx.description, amount, category };

    switch (budgetCategory) {
      case "income":
        incomeItems.push(txRecord);
        totalIncomeCents += amountCents;
        break;
      case "fixed":
        fixedCostsItems.push(txRecord);
        totalFixedCents += amountCents;
        break;
      case "variable":
        variableEssentialsItems.push(txRecord);
        totalVariableCents += amountCents;
        break;
      case "discretionary":
        // Only count debits as discretionary spending
        if (tx.amount < 0) {
          discretionaryItems.push(txRecord);
          totalDiscretionaryCents += amountCents;
        }
        break;
    }
  }

  // Add direct debits to fixed costs (they represent committed monthly payments)
  for (const dd of direct_debits) {
    if (dd.amount > 0) {
      const amountCents = Math.round(dd.amount * 100);
      // Only add if not already counted in transactions
      const alreadyCounted = fixedCostsItems.some(
        (t) => t.description.toUpperCase().includes(dd.name.toUpperCase())
      );
      if (!alreadyCounted) {
        fixedCostsItems.push({ description: `${dd.name} (Direct Debit)`, amount: dd.amount, category: "Bills > Direct Debit" });
        totalFixedCents += amountCents;
      }
    }
  }

  // Calculate monthly averages
  const averageMonthlyIncomeCents = Math.round(totalIncomeCents / analysisMonths);
  const fixedCostsCents = Math.round(totalFixedCents / analysisMonths);
  const variableEssentialsCents = Math.round(totalVariableCents / analysisMonths);
  const discretionaryCents = Math.round(totalDiscretionaryCents / analysisMonths);

  // Safe-to-Spend = Income - Fixed - Variable Essentials
  const safeToSpendCents = Math.max(
    0,
    averageMonthlyIncomeCents - fixedCostsCents - variableEssentialsCents
  );

  // Detect debt payments from transaction descriptions
  const detectedDebtPayments = detectDebtPayments(transactions);

  return {
    averageMonthlyIncomeCents,
    fixedCostsCents,
    variableEssentialsCents,
    discretionaryCents,
    safeToSpendCents,
    detectedDebtPayments,
    breakdown: {
      income: incomeItems,
      fixedCosts: fixedCostsItems,
      variableEssentials: variableEssentialsItems,
      discretionary: discretionaryItems,
    },
    analysisMonths,
  };
}

export function analyzePersona(persona: TrueLayerPersona, analysisMonths: number = 1): BudgetAnalysisResponse {
  return analyzeBudget({
    transactions: persona.transactions,
    direct_debits: persona.direct_debits,
    analysisMonths,
  });
}

// Validation helper - runs all personas and returns results for testing
export function validateAllPersonas(
  personas: Record<string, TrueLayerPersona>
): Record<string, BudgetAnalysisResponse> {
  const results: Record<string, BudgetAnalysisResponse> = {};
  for (const [id, persona] of Object.entries(personas)) {
    results[id] = analyzePersona(persona);
  }
  return results;
}
