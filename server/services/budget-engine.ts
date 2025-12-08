import type {
  TrueLayerTransaction,
  TrueLayerDirectDebit,
  TrueLayerPersona,
  BudgetAnalysisResponse,
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

function detectDebtPayments(transactions: TrueLayerTransaction[]): string[] {
  const detectedDebts = new Set<string>();

  for (const tx of transactions) {
    const upperDesc = tx.description.toUpperCase();
    for (const keyword of DEBT_KEYWORDS) {
      if (upperDesc.includes(keyword.toUpperCase())) {
        // Clean up the keyword for display
        detectedDebts.add(keyword);
        break;
      }
    }
  }

  return Array.from(detectedDebts);
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

export function analyzeBudget(input: BudgetEngineInput): BudgetAnalysisResponse {
  const { transactions, direct_debits = [], analysisMonths = 1 } = input;

  // Categorize all transactions
  const incomeTransactions: Array<{ description: string; amountCents: number }> = [];
  const fixedTransactions: Array<{ description: string; amountCents: number }> = [];
  const variableTransactions: Array<{ description: string; amountCents: number }> = [];
  const discretionaryTransactions: Array<{ description: string; amountCents: number }> = [];

  let totalIncomeCents = 0;
  let totalFixedCents = 0;
  let totalVariableCents = 0;
  let totalDiscretionaryCents = 0;

  for (const tx of transactions) {
    const category = categorizeTransaction(tx);
    const amountCents = Math.round(Math.abs(tx.amount) * 100);
    const txRecord = { description: tx.description, amountCents };

    switch (category) {
      case "income":
        incomeTransactions.push(txRecord);
        totalIncomeCents += amountCents;
        break;
      case "fixed":
        fixedTransactions.push(txRecord);
        totalFixedCents += amountCents;
        break;
      case "variable":
        variableTransactions.push(txRecord);
        totalVariableCents += amountCents;
        break;
      case "discretionary":
        // Only count debits as discretionary spending
        if (tx.amount < 0) {
          discretionaryTransactions.push(txRecord);
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
      const alreadyCounted = fixedTransactions.some(
        (t) => t.description.toUpperCase().includes(dd.name.toUpperCase())
      );
      if (!alreadyCounted) {
        fixedTransactions.push({ description: `${dd.name} (Direct Debit)`, amountCents });
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
      incomeTransactions,
      fixedTransactions,
      variableTransactions,
      discretionaryTransactions,
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
