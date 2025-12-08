import type { TrueLayerPersona } from "@shared/schema";

// Persona 1: The "High Earner, High Spender" (London)
// Scenario: High salary, high rent, active credit card user.
export const PERSONA_HIGH_EARNER: TrueLayerPersona = {
  id: "user_001",
  transactions: [
    { description: "TECH CORP PAYROLL", amount: 4500.00, transaction_classification: ["Income", "Salary"], transaction_type: "CREDIT" },
    { description: "LONDON ESTATES RENT", amount: -2200.00, transaction_classification: ["Bills", "Rent"], transaction_type: "STANDING_ORDER" },
    { description: "WAITROSE KENSINGTON", amount: -125.50, transaction_classification: ["Shopping", "Groceries"], transaction_type: "DEBIT" },
    { description: "AMEX DIRECT DEBIT", amount: -500.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "SOHO HOUSE", amount: -250.00, transaction_classification: ["Entertainment", "Dining Out"], transaction_type: "DEBIT" }
  ],
  direct_debits: [
    { name: "AMEX", amount: 0 }, // Amount variable, but existence implies commitment
    { name: "THAMES WATER", amount: 35.00 }
  ]
};

// Persona 2: The "Squeezed Middle" (Family)
// Scenario: Mortgage, Council Tax, weekly big shops, tight budget.
export const PERSONA_FAMILY: TrueLayerPersona = {
  id: "user_002",
  transactions: [
    { description: "NHS TRUST SALARY", amount: 2800.00, transaction_classification: ["Income", "Salary"], transaction_type: "CREDIT" },
    { description: "HALIFAX MORTGAGE", amount: -1100.00, transaction_classification: ["Home", "Mortgage"], transaction_type: "DIRECT_DEBIT" },
    { description: "COUNCIL TAX", amount: -150.00, transaction_classification: ["Bills", "Tax"], transaction_type: "DIRECT_DEBIT" },
    { description: "TESCO SUPERSTORE", amount: -180.00, transaction_classification: ["Shopping", "Groceries"], transaction_type: "DEBIT" },
    { description: "E.ON ENERGY", amount: -120.00, transaction_classification: ["Bills", "Utilities"], transaction_type: "DIRECT_DEBIT" },
    { description: "NETFLIX", amount: -15.99, transaction_classification: ["Entertainment", "Subscription"], transaction_type: "DEBIT" }
  ],
  direct_debits: [
    { name: "HALIFAX", amount: 1100.00 },
    { name: "E.ON", amount: 120.00 }
  ]
};

// Persona 3: The "Student / Gig Worker"
// Scenario: Irregular income, low fixed costs, high variable spend.
export const PERSONA_GIG_WORKER: TrueLayerPersona = {
  id: "user_003",
  transactions: [
    { description: "UBER EATS PAYOUT", amount: 150.00, transaction_classification: ["Income"], transaction_type: "CREDIT" },
    { description: "UBER EATS PAYOUT", amount: 320.00, transaction_classification: ["Income"], transaction_type: "CREDIT" },
    { description: "PRET A MANGER", amount: -8.50, transaction_classification: ["Entertainment", "Dining Out"], transaction_type: "DEBIT" },
    { description: "TFL TRAVEL", amount: -6.40, transaction_classification: ["Transport", "Public Transport"], transaction_type: "DEBIT" },
    { description: "STUDENT LOANS CO", amount: -40.00, transaction_classification: ["Education", "Loan"], transaction_type: "DIRECT_DEBIT" },
    { description: "SPOTIFY", amount: -9.99, transaction_classification: ["Entertainment", "Subscription"], transaction_type: "DEBIT" }
  ],
  direct_debits: [
    { name: "STUDENT LOANS CO", amount: 40.00 }
  ]
};

// Persona 4: The "Debt Spiral"
// Scenario: High debt repayments, gambling, overdraft fees.
export const PERSONA_DEBT_HEAVY: TrueLayerPersona = {
  id: "user_004",
  transactions: [
    { description: "CONSTRUCTION LTD PAY", amount: 2200.00, transaction_classification: ["Income", "Salary"], transaction_type: "CREDIT" },
    { description: "WILLIAM HILL", amount: -50.00, transaction_classification: ["Entertainment", "Betting"], transaction_type: "DEBIT" },
    { description: "BARCLAYCARD", amount: -200.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DEBIT" },
    { description: "CAPITAL ONE", amount: -150.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DEBIT" },
    { description: "LLOYDS OVERDRAFT FEE", amount: -25.00, transaction_classification: ["Bank Charges"], transaction_type: "FEE" },
    { description: "KWIK FIT", amount: -400.00, transaction_classification: ["Transport", "Car Maintenance"], transaction_type: "DEBIT" }
  ],
  direct_debits: []
};

// Persona 5: The "Clean Slate" (Edge Case)
// Scenario: New account, minimal data.
export const PERSONA_NEW_USER: TrueLayerPersona = {
  id: "user_005",
  transactions: [
    { description: "OPENING DEPOSIT", amount: 1000.00, transaction_classification: ["Income", "Transfer"], transaction_type: "CREDIT" }
  ],
  direct_debits: []
};

// Map of all personas by ID
export const PERSONAS: Record<string, TrueLayerPersona> = {
  "user_001": PERSONA_HIGH_EARNER,
  "user_002": PERSONA_FAMILY,
  "user_003": PERSONA_GIG_WORKER,
  "user_004": PERSONA_DEBT_HEAVY,
  "user_005": PERSONA_NEW_USER,
};

// Helper function to get persona by ID
export function getPersonaById(personaId: string): TrueLayerPersona | undefined {
  return PERSONAS[personaId];
}

// Export all persona IDs for testing
export const PERSONA_IDS = Object.keys(PERSONAS);
