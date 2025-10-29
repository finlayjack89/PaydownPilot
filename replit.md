# Paydown Pilot

## Overview
Paydown Pilot is a web-based debt optimization application designed to help users manage and pay off multiple credit accounts efficiently. It utilizes a deterministic Math Brain (Google OR-Tools CP-SAT solver) for mathematically optimal repayment strategies and a Language Brain (Anthropic Claude) for user interaction and data research. The application aims to minimize interest, fit user budgets, and honor promotional periods, providing clear and trustworthy financial guidance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Technology Stack**: React with TypeScript (Vite), Wouter, TanStack Query, shadcn/ui (Radix UI), Tailwind CSS.
- **Design Philosophy**: Hybrid design combining Material Design 3, Stripe, and Linear for trust, clarity, and efficient data entry. Typography uses Inter for UI and JetBrains Mono for financial values.
- **Key Features**: Authentication, multi-step onboarding, account management (CRUD), budget configuration (including future changes and lump sums), preference selection (optimization strategy, payment shape), plan generation, and a dashboard with ECharts visualizations.

### Backend
- **Technology Stack**: Express.js with TypeScript, Drizzle ORM, Passport.js (local strategy), session-based authentication. Python backend (FastAPI) for the optimization engine.
- **API Structure**: RESTful endpoints (`/api/auth`, `/api/accounts`, `/api/budget`, `/api/preferences`, `/api/plans`, `/api/lender-rules/discover`).
- **Authentication & Security**: Scrypt password hashing, express-session management (30-minute timeout), MFA policy, email verification, secure credential storage.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with WebSocket support, Drizzle ORM.
- **Schema Design**: `users`, `accounts`, `budgets`, `preferences`, `plans`, `lenderRules`.
- **Key Data Patterns**: Monetary values in cents (integers), percentages in basis points (bps), JSONB for nested data, cascade deletes.

### Python Backend Integration
- **Setup**: FastAPI backend (`main.py`, `solver_engine.py`, `schemas.py`) runs as a child process of the Node.js server (port 8000).
- **Functionality**: Uses Google OR-Tools CP-SAT solver for mathematical optimization. Node.js proxies requests to Python.
- **Reliability**: Includes health checks, retry logic with exponential backoff for plan generation, and auto-restart capability for crashed Python processes.

### Key Architectural Decisions
- **Two-Brain Separation**: Divides financial calculation (deterministic Python solver) from AI assistance (Anthropic Claude) to ensure accuracy and intelligent user support.
- **Monetary Precision**: All currency stored as cents and percentages as basis points to prevent floating-point errors.
- **Session-Based Authentication**: Uses Passport.js with express-session for secure, time-sensitive authentication.
- **Serverless Database**: Neon serverless PostgreSQL for scalability and reliability.
- **Client-Side State Management**: TanStack Query for efficient server state management and caching.
- **Form Handling**: React Hook Form with Zod for type-safe, validated forms.
- **Component Design System**: shadcn/ui built on Radix UI primitives for a consistent, accessible, and customizable UI.

## External Dependencies

**AI Services:**
- Anthropic Claude Sonnet 4: Used for lender rule discovery and plan explanations. Not used for financial calculations.

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