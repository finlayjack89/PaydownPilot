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

// Persona 6: The "Freelancer" (Creative Industry)
// Scenario: Multiple income sources, irregular timing, home office expenses.
export const PERSONA_FREELANCER: TrueLayerPersona = {
  id: "user_006",
  transactions: [
    { description: "DESIGN AGENCY INVOICE", amount: 2500.00, transaction_classification: ["Income", "Self-Employment"], transaction_type: "CREDIT" },
    { description: "PHOTOGRAPHY CLIENT", amount: 800.00, transaction_classification: ["Income", "Self-Employment"], transaction_type: "CREDIT" },
    { description: "ADOBE CC SUBSCRIPTION", amount: -54.99, transaction_classification: ["Business", "Software"], transaction_type: "DEBIT" },
    { description: "VIRGIN MEDIA BROADBAND", amount: -45.00, transaction_classification: ["Bills", "Utilities"], transaction_type: "DIRECT_DEBIT" },
    { description: "COSTA COFFEE", amount: -15.80, transaction_classification: ["Entertainment", "Coffee"], transaction_type: "DEBIT" },
    { description: "NATIONWIDE VISA", amount: -180.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "AMAZON PRIME", amount: -8.99, transaction_classification: ["Entertainment", "Subscription"], transaction_type: "DEBIT" }
  ],
  direct_debits: [
    { name: "VIRGIN MEDIA", amount: 45.00 },
    { name: "NATIONWIDE", amount: 180.00 }
  ]
};

// Persona 7: The "Retiree" (Fixed Income)
// Scenario: Pension income, low debt, careful spending.
export const PERSONA_RETIREE: TrueLayerPersona = {
  id: "user_007",
  transactions: [
    { description: "STATE PENSION", amount: 785.00, transaction_classification: ["Income", "Pension"], transaction_type: "CREDIT" },
    { description: "PRIVATE PENSION FUND", amount: 450.00, transaction_classification: ["Income", "Pension"], transaction_type: "CREDIT" },
    { description: "BRITISH GAS", amount: -95.00, transaction_classification: ["Bills", "Utilities"], transaction_type: "DIRECT_DEBIT" },
    { description: "SAINSBURYS LOCAL", amount: -65.00, transaction_classification: ["Shopping", "Groceries"], transaction_type: "DEBIT" },
    { description: "NHS PRESCRIPTION", amount: -9.90, transaction_classification: ["Health", "Medical"], transaction_type: "DEBIT" },
    { description: "M&S CARD", amount: -50.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "TV LICENCE", amount: -13.25, transaction_classification: ["Entertainment", "Subscription"], transaction_type: "DIRECT_DEBIT" }
  ],
  direct_debits: [
    { name: "BRITISH GAS", amount: 95.00 },
    { name: "M&S BANK", amount: 50.00 },
    { name: "TV LICENCE", amount: 13.25 }
  ]
};

// Persona 8: The "Single Parent" (Benefits + Part-time)
// Scenario: Government benefits, part-time work, tight margins.
export const PERSONA_SINGLE_PARENT: TrueLayerPersona = {
  id: "user_008",
  transactions: [
    { description: "DWP UNIVERSAL CREDIT", amount: 890.00, transaction_classification: ["Income", "Benefits"], transaction_type: "CREDIT" },
    { description: "CHILD BENEFIT", amount: 102.40, transaction_classification: ["Income", "Benefits"], transaction_type: "CREDIT" },
    { description: "TESCO CASHIER WAGE", amount: 650.00, transaction_classification: ["Income", "Salary"], transaction_type: "CREDIT" },
    { description: "COUNCIL RENT", amount: -520.00, transaction_classification: ["Bills", "Rent"], transaction_type: "STANDING_ORDER" },
    { description: "ALDI", amount: -85.00, transaction_classification: ["Shopping", "Groceries"], transaction_type: "DEBIT" },
    { description: "SCHOOL UNIFORM DIRECT", amount: -45.00, transaction_classification: ["Shopping", "Clothing"], transaction_type: "DEBIT" },
    { description: "AQUA CREDIT CARD", amount: -35.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "OCTOPUS ENERGY", amount: -78.00, transaction_classification: ["Bills", "Utilities"], transaction_type: "DIRECT_DEBIT" }
  ],
  direct_debits: [
    { name: "AQUA", amount: 35.00 },
    { name: "OCTOPUS ENERGY", amount: 78.00 }
  ]
};

// Persona 9: The "Entrepreneur" (Business Owner)
// Scenario: Business income, multiple credit cards, high expenses.
export const PERSONA_ENTREPRENEUR: TrueLayerPersona = {
  id: "user_009",
  transactions: [
    { description: "INVOICE PAYMENT - CLIENT A", amount: 5500.00, transaction_classification: ["Income", "Business"], transaction_type: "CREDIT" },
    { description: "INVOICE PAYMENT - CLIENT B", amount: 3200.00, transaction_classification: ["Income", "Business"], transaction_type: "CREDIT" },
    { description: "OFFICE RENT", amount: -1500.00, transaction_classification: ["Business", "Rent"], transaction_type: "STANDING_ORDER" },
    { description: "EMPLOYEE SALARY TRANSFER", amount: -2800.00, transaction_classification: ["Business", "Payroll"], transaction_type: "DEBIT" },
    { description: "HSBC BUSINESS CARD", amount: -450.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "BARCLAYS BUSINESS CARD", amount: -320.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "STOCK PURCHASE", amount: -800.00, transaction_classification: ["Business", "Inventory"], transaction_type: "DEBIT" },
    { description: "XERO ACCOUNTING", amount: -24.00, transaction_classification: ["Business", "Software"], transaction_type: "DEBIT" }
  ],
  direct_debits: [
    { name: "HSBC", amount: 450.00 },
    { name: "BARCLAYS", amount: 320.00 }
  ]
};

// Persona 10: The "Young Professional" (First Job)
// Scenario: Entry-level salary, student loan, starter credit card, shared flat.
export const PERSONA_YOUNG_PROFESSIONAL: TrueLayerPersona = {
  id: "user_010",
  transactions: [
    { description: "GRADUATE SCHEME SALARY", amount: 2100.00, transaction_classification: ["Income", "Salary"], transaction_type: "CREDIT" },
    { description: "FLATSHARE RENT", amount: -650.00, transaction_classification: ["Bills", "Rent"], transaction_type: "STANDING_ORDER" },
    { description: "SLC STUDENT LOAN", amount: -120.00, transaction_classification: ["Education", "Loan"], transaction_type: "DIRECT_DEBIT" },
    { description: "MONZO CREDIT CARD", amount: -75.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "LIDL", amount: -45.00, transaction_classification: ["Shopping", "Groceries"], transaction_type: "DEBIT" },
    { description: "NANDOS", amount: -22.50, transaction_classification: ["Entertainment", "Dining Out"], transaction_type: "DEBIT" },
    { description: "GYM MEMBERSHIP", amount: -29.99, transaction_classification: ["Health", "Fitness"], transaction_type: "DIRECT_DEBIT" },
    { description: "SPOTIFY STUDENT", amount: -5.99, transaction_classification: ["Entertainment", "Subscription"], transaction_type: "DEBIT" }
  ],
  direct_debits: [
    { name: "SLC", amount: 120.00 },
    { name: "MONZO", amount: 75.00 },
    { name: "GYM", amount: 29.99 }
  ]
};

// Persona 11: The "Property Investor" (Buy-to-Let)
// Scenario: Rental income, multiple mortgages, high cash flow.
export const PERSONA_PROPERTY_INVESTOR: TrueLayerPersona = {
  id: "user_011",
  transactions: [
    { description: "RENTAL PROPERTY 1", amount: 1200.00, transaction_classification: ["Income", "Rental"], transaction_type: "CREDIT" },
    { description: "RENTAL PROPERTY 2", amount: 950.00, transaction_classification: ["Income", "Rental"], transaction_type: "CREDIT" },
    { description: "NATIONWIDE BTL MORTGAGE", amount: -680.00, transaction_classification: ["Home", "Mortgage"], transaction_type: "DIRECT_DEBIT" },
    { description: "LLOYDS BTL MORTGAGE", amount: -520.00, transaction_classification: ["Home", "Mortgage"], transaction_type: "DIRECT_DEBIT" },
    { description: "PROPERTY MANAGEMENT FEE", amount: -180.00, transaction_classification: ["Business", "Fees"], transaction_type: "DEBIT" },
    { description: "LANDLORD INSURANCE", amount: -45.00, transaction_classification: ["Insurance", "Property"], transaction_type: "DIRECT_DEBIT" },
    { description: "VIRGIN MONEY CREDIT", amount: -200.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "PROPERTY REPAIRS", amount: -350.00, transaction_classification: ["Home", "Maintenance"], transaction_type: "DEBIT" }
  ],
  direct_debits: [
    { name: "NATIONWIDE", amount: 680.00 },
    { name: "LLOYDS", amount: 520.00 },
    { name: "VIRGIN MONEY", amount: 200.00 }
  ]
};

// Persona 12: The "IT Contractor" (Ltd Company)
// Scenario: High day rate, quarterly payments, IR35 considerations.
export const PERSONA_IT_CONTRACTOR: TrueLayerPersona = {
  id: "user_012",
  transactions: [
    { description: "CONTRACT INVOICE Q1", amount: 12000.00, transaction_classification: ["Income", "Self-Employment"], transaction_type: "CREDIT" },
    { description: "CORPORATION TAX RESERVE", amount: -2400.00, transaction_classification: ["Bills", "Tax"], transaction_type: "DEBIT" },
    { description: "PERSONAL DRAWINGS", amount: -4500.00, transaction_classification: ["Transfer"], transaction_type: "DEBIT" },
    { description: "ACCOUNTANT FEES", amount: -150.00, transaction_classification: ["Business", "Professional"], transaction_type: "DEBIT" },
    { description: "PROFESSIONAL INDEMNITY", amount: -85.00, transaction_classification: ["Insurance", "Business"], transaction_type: "DIRECT_DEBIT" },
    { description: "AMEX PLATINUM", amount: -650.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "AWS SERVICES", amount: -120.00, transaction_classification: ["Business", "Software"], transaction_type: "DEBIT" },
    { description: "LINKEDIN PREMIUM", amount: -29.99, transaction_classification: ["Business", "Software"], transaction_type: "DEBIT" }
  ],
  direct_debits: [
    { name: "AMEX", amount: 650.00 },
    { name: "PROFESSIONAL INDEMNITY", amount: 85.00 }
  ]
};

// Persona 13: The "Multiple Job Holder" (Side Hustles)
// Scenario: Main job plus two side gigs, multiple income streams.
export const PERSONA_MULTIPLE_JOBS: TrueLayerPersona = {
  id: "user_013",
  transactions: [
    { description: "RETAIL STORE WAGE", amount: 1600.00, transaction_classification: ["Income", "Salary"], transaction_type: "CREDIT" },
    { description: "DELIVEROO PAYOUT", amount: 380.00, transaction_classification: ["Income", "Self-Employment"], transaction_type: "CREDIT" },
    { description: "TUTORING INCOME", amount: 240.00, transaction_classification: ["Income", "Self-Employment"], transaction_type: "CREDIT" },
    { description: "SHARED HOUSE RENT", amount: -480.00, transaction_classification: ["Bills", "Rent"], transaction_type: "STANDING_ORDER" },
    { description: "SHELL PETROL", amount: -75.00, transaction_classification: ["Transport", "Fuel"], transaction_type: "DEBIT" },
    { description: "TESCO MOBILE", amount: -15.00, transaction_classification: ["Bills", "Phone"], transaction_type: "DIRECT_DEBIT" },
    { description: "VANQUIS CARD", amount: -95.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "VERY ACCOUNT", amount: -45.00, transaction_classification: ["Shopping", "BNPL"], transaction_type: "DIRECT_DEBIT" },
    { description: "MORRISONS", amount: -55.00, transaction_classification: ["Shopping", "Groceries"], transaction_type: "DEBIT" }
  ],
  direct_debits: [
    { name: "VANQUIS", amount: 95.00 },
    { name: "VERY", amount: 45.00 },
    { name: "TESCO MOBILE", amount: 15.00 }
  ]
};

// Persona 14: The "Recent Graduate" (Low Income, High Debt)
// Scenario: Just started career, heavy student debt, credit building.
export const PERSONA_RECENT_GRADUATE: TrueLayerPersona = {
  id: "user_014",
  transactions: [
    { description: "MARKETING ASSISTANT", amount: 1850.00, transaction_classification: ["Income", "Salary"], transaction_type: "CREDIT" },
    { description: "SLC PLAN 2 REPAYMENT", amount: -95.00, transaction_classification: ["Education", "Loan"], transaction_type: "DIRECT_DEBIT" },
    { description: "PARENTS RENT CONTRIB", amount: -300.00, transaction_classification: ["Bills", "Rent"], transaction_type: "STANDING_ORDER" },
    { description: "TRAIN SEASON TICKET", amount: -180.00, transaction_classification: ["Transport", "Commute"], transaction_type: "DIRECT_DEBIT" },
    { description: "CREDIT BUILDER CARD", amount: -25.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "KLARNA PURCHASE", amount: -35.00, transaction_classification: ["Shopping", "BNPL"], transaction_type: "DIRECT_DEBIT" },
    { description: "GREGGS", amount: -8.50, transaction_classification: ["Entertainment", "Dining Out"], transaction_type: "DEBIT" },
    { description: "DISNEY PLUS", amount: -7.99, transaction_classification: ["Entertainment", "Subscription"], transaction_type: "DEBIT" }
  ],
  direct_debits: [
    { name: "SLC", amount: 95.00 },
    { name: "TRAIN", amount: 180.00 },
    { name: "KLARNA", amount: 35.00 }
  ]
};

// Persona 15: The "Seasonal Worker" (Hospitality)
// Scenario: High income in summer, low in winter, irregular cash flow.
export const PERSONA_SEASONAL_WORKER: TrueLayerPersona = {
  id: "user_015",
  transactions: [
    { description: "HOTEL SEASONAL WAGE", amount: 2800.00, transaction_classification: ["Income", "Salary"], transaction_type: "CREDIT" },
    { description: "TIP INCOME", amount: 450.00, transaction_classification: ["Income", "Tips"], transaction_type: "CREDIT" },
    { description: "WINTER LET RENT", amount: -650.00, transaction_classification: ["Bills", "Rent"], transaction_type: "STANDING_ORDER" },
    { description: "CAR FINANCE", amount: -220.00, transaction_classification: ["Transport", "Car Payment"], transaction_type: "DIRECT_DEBIT" },
    { description: "CAR INSURANCE", amount: -85.00, transaction_classification: ["Insurance", "Vehicle"], transaction_type: "DIRECT_DEBIT" },
    { description: "ASDA", amount: -95.00, transaction_classification: ["Shopping", "Groceries"], transaction_type: "DEBIT" },
    { description: "TESCO CLUBCARD CC", amount: -125.00, transaction_classification: ["Bills", "Credit Card"], transaction_type: "DIRECT_DEBIT" },
    { description: "VODAFONE", amount: -35.00, transaction_classification: ["Bills", "Phone"], transaction_type: "DIRECT_DEBIT" },
    { description: "PUB NIGHT", amount: -65.00, transaction_classification: ["Entertainment", "Alcohol"], transaction_type: "DEBIT" }
  ],
  direct_debits: [
    { name: "CAR FINANCE", amount: 220.00 },
    { name: "CAR INSURANCE", amount: 85.00 },
    { name: "TESCO BANK", amount: 125.00 },
    { name: "VODAFONE", amount: 35.00 }
  ]
};

// Map of all personas by ID
export const PERSONAS: Record<string, TrueLayerPersona> = {
  "user_001": PERSONA_HIGH_EARNER,
  "user_002": PERSONA_FAMILY,
  "user_003": PERSONA_GIG_WORKER,
  "user_004": PERSONA_DEBT_HEAVY,
  "user_005": PERSONA_NEW_USER,
  "user_006": PERSONA_FREELANCER,
  "user_007": PERSONA_RETIREE,
  "user_008": PERSONA_SINGLE_PARENT,
  "user_009": PERSONA_ENTREPRENEUR,
  "user_010": PERSONA_YOUNG_PROFESSIONAL,
  "user_011": PERSONA_PROPERTY_INVESTOR,
  "user_012": PERSONA_IT_CONTRACTOR,
  "user_013": PERSONA_MULTIPLE_JOBS,
  "user_014": PERSONA_RECENT_GRADUATE,
  "user_015": PERSONA_SEASONAL_WORKER,
};

// Helper function to get persona by ID
export function getPersonaById(personaId: string): TrueLayerPersona | undefined {
  return PERSONAS[personaId];
}

// Export all persona IDs for testing
export const PERSONA_IDS = Object.keys(PERSONAS);

// Export persona summaries for easier testing
export const PERSONA_SUMMARIES = [
  { id: "user_001", name: "High Earner", income: 4500, debt: "AMEX", profile: "High salary, high rent, London" },
  { id: "user_002", name: "Family", income: 2800, debt: "Mortgage", profile: "NHS worker, mortgage, tight budget" },
  { id: "user_003", name: "Gig Worker", income: 470, debt: "Student Loan", profile: "Irregular income, low fixed costs" },
  { id: "user_004", name: "Debt Heavy", income: 2200, debt: "Multi-card", profile: "High debt repayments, struggling" },
  { id: "user_005", name: "New User", income: 1000, debt: "None", profile: "Edge case, minimal data" },
  { id: "user_006", name: "Freelancer", income: 3300, debt: "Nationwide", profile: "Multiple income sources, creative" },
  { id: "user_007", name: "Retiree", income: 1235, debt: "M&S Card", profile: "Pension income, careful spending" },
  { id: "user_008", name: "Single Parent", income: 1642, debt: "Aqua", profile: "Benefits + part-time, tight margins" },
  { id: "user_009", name: "Entrepreneur", income: 8700, debt: "Multi-card", profile: "Business owner, high expenses" },
  { id: "user_010", name: "Young Professional", income: 2100, debt: "Monzo+SLC", profile: "First job, student loan" },
  { id: "user_011", name: "Property Investor", income: 2150, debt: "Mortgages+CC", profile: "Rental income, BTL mortgages" },
  { id: "user_012", name: "IT Contractor", income: 12000, debt: "AMEX", profile: "High day rate, quarterly income" },
  { id: "user_013", name: "Multiple Jobs", income: 2220, debt: "Vanquis+BNPL", profile: "Main job plus side hustles" },
  { id: "user_014", name: "Recent Graduate", income: 1850, debt: "SLC+Klarna", profile: "Just started career, building credit" },
  { id: "user_015", name: "Seasonal Worker", income: 3250, debt: "Tesco CC", profile: "Hospitality, high summer income" },
];
