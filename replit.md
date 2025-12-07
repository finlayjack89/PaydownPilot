# Paydown Pilot

## Overview
Paydown Pilot is a web-based debt optimization application designed to help users manage and pay off multiple credit accounts efficiently. It utilizes a deterministic Math Brain (Google OR-Tools CP-SAT solver) for mathematically optimal repayment strategies and a Language Brain (Anthropic Claude) for user interaction and data research. The application aims to minimize interest, fit user budgets, and honor promotional periods, providing clear and trustworthy financial guidance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Technology Stack**: React with TypeScript (Vite), Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS.
- **Design Philosophy**: Hybrid design combining Material Design 3, Stripe, and Linear for trust, clarity, and efficient data entry. Typography uses Inter for UI and JetBrains Mono for financial values.
- **Key Features**: Authentication, multi-step onboarding, account management (CRUD), budget configuration (including future changes and lump sums), preference selection (optimization strategy, payment shape), plan generation, dashboard with ECharts visualizations, Payment Calendar with interactive event highlighting.

### Recent Updates (December 2024)
- **AI Chat Improvements**: ChatGPT-style conversation history with user/assistant message bubbles; uses Claude Haiku for fast responses.
- **Delete Plan Button**: Users can delete generated plans with confirmation dialog.
- **Refresh Dashboard Button**: Manual refresh to fetch latest account and plan data.
- **Account Bucket Breakdown**: Detailed view of credit card balance segments (buckets) showing individual APRs, promo periods, and balances.
- **Plan Generation UX**: Smooth animated progress bar with percentage display; rotating finance tips with fade animation during generation.
- **Payment Calendar Page**: Full-screen calendar at `/calendar` showing:
  - Payment dates (blue) with hover tooltips showing accounts and amounts
  - Budget change dates (amber) with old→new budget values
  - Lump sum dates (green) with payment amounts
  - Account payoff dates (purple) celebrating debt-free milestones
  - Month/year navigation controls and "Today" button
  - Upcoming events list for next 3 months

### Backend
- **Technology Stack**: Express.js with TypeScript, Drizzle ORM, Passport.js (local strategy), session-based authentication, Plaid SDK. Python backend (FastAPI) for the optimization engine.
- **API Structure**: RESTful endpoints (`/api/auth`, `/api/accounts`, `/api/budget`, `/api/preferences`, `/api/plans`, `/api/plaid/*`, `/api/lender-rules/*`).
- **Authentication & Security**: Scrypt password hashing, express-session management (30-minute timeout), AES-256-GCM encryption for Plaid tokens, secure credential storage.
- **Plaid Integration**: Bank connection via Plaid Link, encrypted access token storage, liability account syncing.
- **AI Research System**: Claude 4.5 Sonnet for automated lender rule discovery with human verification, intelligent caching of verified rules.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with WebSocket support, Drizzle ORM.
- **Schema Design**: `users`, `accounts`, `debt_buckets`, `budgets`, `preferences`, `plans`, `lenderRules`, `plaidItems`.
- **Key Data Patterns**: Monetary values in cents (integers), percentages in basis points (bps), JSONB for nested data, cascade deletes, encrypted sensitive data (Plaid tokens).
- **Security**: Plaid access tokens encrypted with AES-256-GCM using ENCRYPTION_SECRET environment variable.

### Debt Buckets (UK Credit Card Feature)
- **Purpose**: UK credit cards often have multiple balance segments at different APRs (0% balance transfers, 24.9% purchases, 39.9% cash advances). The bucket system allows users to track these separately for accurate interest calculations and payment prioritization.
- **Bucket Types**: PURCHASES (blue), BALANCE_TRANSFER (green), MONEY_TRANSFER (purple), CASH_ADVANCE (amber), CUSTOM (gray).
- **Data Model**: Each bucket has `bucketType`, `balanceCents`, `aprBps`, `isPromo`, `promoExpiryDate`, and `label`. Bucket totals must equal the account's `currentBalanceCents`.
- **Solver Integration**: The Python solver uses weighted-average APR across buckets for interest calculations and respects bucket-level promo periods. When a promo expires, the bucket reverts to the account's standard APR. Validation ensures only Credit Card accounts can have buckets.
- **UI Flow**: 3-step Statement Wizard (Headline → Split Decision → Bucket Builder) guides users through creating bucket-enabled credit card accounts. Dashboard tiles show colored bucket segments with tooltips.
- **API Integration**: Use `GET /api/accounts?withBuckets=true` to fetch accounts with their bucket data. The frontend accounts and dashboard pages use this endpoint.
- **Guest Mode**: Buckets are fully supported in guest mode with in-memory storage via GuestStorageWrapper.

### Python Backend Integration
- **Setup**: FastAPI backend (`main.py`, `solver_engine.py`, `schemas.py`) runs as a child process of the Node.js server (port 8000).
- **Functionality**: Uses Google OR-Tools CP-SAT solver for mathematical optimization. Node.js proxies requests to Python.
- **Reliability**: Includes health checks, retry logic with exponential backoff for plan generation, and auto-restart capability for crashed Python processes.

### Key Architectural Decisions
- **Two-Brain Separation**: Divides financial calculation (deterministic Python solver) from AI assistance (Anthropic Claude "Language Brain") to ensure accuracy and intelligent user support. The Math Brain receives only verified structured data; the Language Brain handles research and explanations only.
- **Hybrid-Assisted Onboarding**: Combines Plaid automation (bank connections, balances, due dates) with AI research (minimum payment rules) and human verification to create a fast yet accurate onboarding flow.
- **Monetary Precision**: All currency stored as cents and percentages as basis points to prevent floating-point errors.
- **Session-Based Authentication**: Uses Passport.js with express-session for secure, time-sensitive authentication.
- **Serverless Database**: Neon serverless PostgreSQL for scalability and reliability.
- **Client-Side State Management**: TanStack Query for efficient server state management and caching.
- **Form Handling**: React Hook Form with Zod for type-safe, validated forms.
- **Component Design System**: shadcn/ui built on Radix UI primitives for a consistent, accessible, and customizable UI.

## External Dependencies

**AI Services:**
- Anthropic Claude Sonnet 4.5: Used for lender rule discovery (AI "Research Team") and plan explanations. Strictly forbidden from performing financial calculations per Two-Brain architecture.

**Banking Integration:**
- Plaid: Bank connection, account aggregation, liability data fetching. Supports US, GB, CA markets.

**Optimization Engine:**
- Google OR-Tools CP-SAT solver: Python implementation for deterministic mathematical debt optimization.

**UI Component Libraries:**
- Radix UI: Accessible component primitives.
- ECharts: Data visualization (debt timeline).
- React Hook Form with Zod: Form validation.
- date-fns: Date manipulation.
- shadcn/ui: Custom component library built on Radix UI.

**Database:**
- Neon serverless PostgreSQL: Cloud-hosted PostgreSQL with WebSocket support.
- Drizzle Kit: Database schema migrations.

**Development Tools:**
- Vite: Frontend build tool.
- TypeScript: Type safety.
- ESBuild: Server bundling.