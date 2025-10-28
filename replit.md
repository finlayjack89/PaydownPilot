# Paydown Pilot

## Overview

Paydown Pilot is a web-based debt optimization application that helps users create deterministic, optimized monthly payment plans across multiple credit accounts (credit cards, BNPL, and loans). The system uses Google OR-Tools CP-SAT solver to generate mathematically optimal repayment strategies that minimize interest and fit within user budgets while honoring promotional periods.

The application follows a strict "Two-Brain" architecture: a deterministic Math Brain (Python solver) handles all financial calculations, while a Language Brain (Anthropic Claude) assists with user interaction and data research. This separation ensures financial accuracy while providing intelligent user assistance.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript using Vite as the build tool
- Wouter for client-side routing
- TanStack Query (React Query) for server state management
- shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for styling with a custom design system

**Design Philosophy:**
- Hybrid design system combining Material Design 3, Stripe (financial clarity), and Linear (clean aesthetics)
- Focus on trust, information clarity, and efficient data entry
- Typography: Inter for UI, JetBrains Mono for financial values
- Component-based architecture with reusable UI primitives

**Key Pages:**
- Authentication flow (login/signup)
- Multi-step onboarding for user profile and location setup
- Account management (CRUD operations for debt accounts)
- Budget configuration with future changes and lump sum payments
- Preference selection (optimization strategy and payment shape)
- Plan generation with progress tracking
- Dashboard with debt timeline visualization using ECharts

### Backend Architecture

**Technology Stack:**
- Express.js server with TypeScript
- Drizzle ORM for database operations
- Passport.js with local strategy for authentication
- Session-based authentication with 30-minute timeout
- Python backend (FastAPI indicated in attached files) for optimization engine

**API Structure:**
- RESTful endpoints under `/api` prefix
- Authentication endpoints: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`
- Resource endpoints: `/api/accounts`, `/api/budget`, `/api/preferences`, `/api/plans`
- AI integration: `/api/lender-rules/discover` for automated rule discovery

**Authentication & Security:**
- Password hashing using scrypt with salting
- Session management with express-session
- MFA requirement enforced (policy level)
- Email verification before use
- Secure credential storage

### Data Storage

**Database:**
- PostgreSQL via Neon serverless
- WebSocket support for real-time database operations
- Drizzle ORM for type-safe database queries and migrations

**Schema Design:**
- `users`: Core user profile with country/region/currency
- `accounts`: Debt accounts with detailed financial parameters
- `budgets`: Monthly budget with future changes and lump sum payments
- `preferences`: User optimization strategy and payment shape preferences
- `plans`: Generated repayment plans with full monthly breakdown
- `lenderRules`: Cached minimum payment rules for lenders by country

**Key Data Patterns:**
- All monetary values stored in cents (integers) for precision
- APR and percentages stored in basis points (bps) to avoid floating point errors
- Dates for promotional periods and payment schedules
- JSONB fields for complex nested data (future changes, lump sums, plan results)
- Cascade deletes for user data cleanup

### External Dependencies

**AI Services:**
- Anthropic Claude Sonnet 4 (claude-sonnet-4-20250514) for lender rule discovery and plan explanations
- Language Brain handles user interaction and data research
- Explicitly forbidden from performing financial calculations

**Optimization Engine:**
- Google OR-Tools CP-SAT solver (Python implementation in solver_engine.py)
- Deterministic mathematical optimization
- Handles complex constraints: minimum payments, promotional windows, budget limits
- Multiple optimization strategies: minimize interest, maximize payoff speed, honor promos

**UI Component Libraries:**
- Radix UI for accessible component primitives (dialogs, dropdowns, selects, etc.)
- ECharts for data visualization (debt timeline charts)
- React Hook Form with Zod for form validation
- date-fns for date manipulation

**Database:**
- Neon serverless PostgreSQL with WebSocket support
- Drizzle Kit for schema migrations

**Development Tools:**
- Vite plugins for runtime error overlay and development banners
- TypeScript for type safety across the stack
- ESBuild for server bundling

### Key Architectural Decisions

**Two-Brain Separation:**
- **Problem:** Need both accurate financial calculations and intelligent user assistance
- **Solution:** Strict separation between deterministic solver (Math Brain) and AI assistant (Language Brain)
- **Rationale:** Ensures financial accuracy while providing smart features like automated rule discovery
- **Implementation:** Python solver is isolated; Claude handles only research and explanation tasks

**Monetary Precision:**
- **Problem:** Floating point errors are unacceptable in financial calculations
- **Solution:** All currency stored as cents (integers), all percentages as basis points
- **Rationale:** Eliminates rounding errors and ensures exact calculations
- **Trade-off:** Requires conversion functions throughout the UI layer

**Session-Based Authentication:**
- **Problem:** Need secure authentication with reasonable timeout
- **Solution:** Passport.js with express-session, 30-minute inactivity timeout
- **Rationale:** Balances security with user convenience for sensitive financial data
- **Alternative Considered:** JWT tokens (rejected due to session management complexity)

**Serverless Database:**
- **Problem:** Need scalable, reliable database with minimal ops overhead
- **Solution:** Neon serverless PostgreSQL with WebSocket support
- **Rationale:** Auto-scaling, connection pooling, and modern developer experience
- **Trade-off:** Vendor lock-in, but mitigated by standard PostgreSQL compatibility

**Client-Side State Management:**
- **Problem:** Complex data fetching and caching requirements
- **Solution:** TanStack Query for server state, React hooks for local state
- **Rationale:** Automatic caching, background refetching, optimistic updates
- **Alternatives Considered:** Redux (too complex), Context API (insufficient caching)

**Form Handling:**
- **Problem:** Complex multi-step forms with validation
- **Solution:** React Hook Form with Zod schema validation
- **Rationale:** Type-safe validation matching backend schemas, excellent performance
- **Integration:** Drizzle-zod generates Zod schemas from database schema for consistency

**Component Design System:**
- **Problem:** Need consistent, accessible UI that builds trust
- **Solution:** shadcn/ui (copy-paste components) on Radix UI primitives
- **Rationale:** Full control over components, no runtime dependency, Radix ensures accessibility
- **Customization:** Tailwind with custom color system and spacing primitives
## Python Backend Integration

**Setup:**
The Python FastAPI backend (`main.py`, `solver_engine.py`, `schemas.py`) runs automatically when you start the Node.js development server. The Node server spawns a Python child process on port 8000.

**Architecture:**
- `server/index.ts` starts `uvicorn` as a child process in development mode
- Python backend listens on `http://127.0.0.1:8000`
- Node backend proxies optimization requests to Python via `/api/plans/generate`
- Python uses Google OR-Tools CP-SAT solver for mathematical optimization
- Results are transformed between TypeScript (camelCase) and Python (snake_case) schemas

**Files:**
- `main.py` - FastAPI application with `/generate-plan` endpoint
- `solver_engine.py` - OR-Tools CP-SAT solver implementation with debt optimization logic
- `schemas.py` - Pydantic models for request/response validation

**Dependencies:**
- Python 3.11 (installed via Nix)
- fastapi, uvicorn, pydantic, ortools, python-dateutil (installed via uv package manager)

**Deployment:**
Both Node and Python backends run together in production. The Node server manages the Python process lifecycle (start/stop/restart).

## Recent Updates (October 28, 2025)

✅ **Core MVP Complete - All Features Working End-to-End:**

1. **Python OR-Tools Integration** - Integrated Python FastAPI backend that auto-starts with Node server, successfully generating OPTIMAL debt paydown plans using Google OR-Tools CP-SAT solver

2. **AI Lender Rule Discovery** - Claude Sonnet 4 integration for automatic minimum payment rule research with human-in-the-loop confirmation

3. **Future Budget Changes & Lump Sum Payments** - UI for managing future budget adjustments and one-time payments with validation and targeting

4. **Full Stack Integration** - Complete data flow from frontend → Node API → Python solver → AI explanation → Database → Dashboard visualization

**Test Results:**
- End-to-end test passed: User registration → Account creation → Budget/Preferences → Plan generation → Dashboard display
- Verified metrics: $3,000 debt paid in 10 months with $281.60 total interest
- All constraints satisfied: minimum payments, budget limits, date sequencing

**Technical Fixes:**
- Fixed plan_start_date database constraint (now defaults to current date)
- Fixed SelectItem empty value bug (using "__ANY__" sentinel)
- Improved error logging for Python backend communication
- Schema transformation working correctly between TypeScript and Python

**Ready for Deployment:**
Application is fully functional and tested. All core features operational.
