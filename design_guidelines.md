# Paydown Pilot Design Guidelines

## Design Approach

**Selected Approach: Design System Hybrid**
- **Primary Influence**: Material Design 3 for robust component patterns and data-heavy interfaces
- **Secondary Influences**: Stripe (financial clarity, trust-building), Linear (clean productivity aesthetics, sophisticated form design)
- **Rationale**: This is a utility-focused financial application where trust, clarity, and efficient data entry are paramount. Users need to confidently input sensitive financial data and understand complex optimization results.

## Core Design Principles

1. **Financial Trust**: Every interaction must feel secure and professional
2. **Information Clarity**: Dense financial data presented with clear hierarchy
3. **Efficient Input**: Minimize friction in multi-step data entry flows
4. **Progressive Disclosure**: Reveal complexity only when needed

## Typography

**Font Families**:
- Primary: Inter (body text, UI elements, data displays)
- Monospace: JetBrains Mono (numerical values, currency amounts, account balances)

**Type Scale**:
- Hero/Page Titles: text-4xl font-bold (onboarding, dashboard headers)
- Section Headers: text-2xl font-semibold
- Card Titles: text-lg font-medium
- Body Text: text-base
- Labels/Metadata: text-sm font-medium
- Helper Text: text-xs text-gray-600
- Financial Values: text-base md:text-lg font-mono font-semibold (always monospace for numbers)

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Component Internal Padding: p-4 or p-6
- Card Spacing: space-y-6 or gap-6
- Section Margins: my-12 or my-16
- Form Field Gaps: space-y-4

**Container Strategy**:
- Auth Pages: max-w-md mx-auto (centered, narrow)
- Onboarding/Forms: max-w-3xl mx-auto
- Dashboard: max-w-7xl mx-auto with full-width charts
- Multi-column Layouts: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6

## Core Component Library

### Navigation
- **Top App Bar**: Fixed header with logo, navigation tabs, user menu (h-16)
- **Progress Stepper**: For onboarding flow (steps 1-5), horizontal with completion states
- **Sidebar Navigation** (Dashboard): Sticky left sidebar (w-64) with icon + label menu items

### Forms & Data Entry
- **Input Fields**: 
  - Height: h-12
  - Padding: px-4
  - Border: border-2 with focus ring
  - Labels: text-sm font-medium mb-2, positioned above input
  - Helper text below input: text-xs mt-1
  
- **Currency Inputs**: 
  - Prefix currency symbol inside input (left-aligned)
  - Monospace font for entered values
  - Right-align numerical values
  
- **Date Pickers**: Native date inputs with calendar icon
- **Dropdowns/Select**: Custom styled with chevron icon, h-12 matching text inputs
- **Radio Groups**: For Choice 1 & Choice 2 selection, card-based options with icons
- **Toggle Switches**: For boolean preferences (promo periods, MFA settings)

### Cards & Containers
- **Account Cards**: 
  - Padding: p-6
  - Border radius: rounded-lg
  - Shadow: shadow-sm hover:shadow-md transition
  - Header with lender name + account type badge
  - Grid layout for financial data (2-3 columns)
  
- **Stat Cards** (Dashboard):
  - Large numerical value (text-3xl font-mono font-bold)
  - Label below (text-sm)
  - Icon in top-right corner
  - 4-column grid on desktop, stack on mobile

- **Info Panels**: 
  - For AI rule discovery results, plan explanations
  - Bordered container with icon
  - Padding: p-6, space-y-3 for content

### Buttons & Actions
- **Primary Button**: 
  - Height: h-12
  - Padding: px-6
  - Font: text-base font-semibold
  - Rounded: rounded-lg
  - Full width on mobile, auto on desktop
  
- **Secondary Button**: Same dimensions, different visual treatment
- **Icon Buttons**: w-10 h-10 rounded-full for actions (edit, delete)
- **Button Groups**: For multi-action contexts (Save/Cancel), gap-3

### Data Display
- **Tables**: 
  - Month-by-month payment schedules
  - Sticky header row
  - Alternating row treatments for readability
  - Right-align all numerical columns
  - Monospace for currency values
  
- **Lists**: 
  - Account summaries
  - py-4 per item, border-b dividers
  - Icon/badge on left, content center, action on right

- **Badges**: 
  - Account type indicators: rounded-full px-3 py-1 text-xs font-medium
  - Status indicators: (Active, Paid Off, In Promo)

### Charts & Visualization
- **Timeline Chart** (ECharts):
  - Full width container (w-full)
  - Fixed height: h-96 on desktop, h-64 on mobile
  - Stacked area chart showing debt reduction per account
  - Interactive tooltips with exact values
  - Legend at bottom
  
- **Progress Bars**:
  - For individual account payoff progress
  - Height: h-2, rounded-full
  - Label and percentage above bar

### Modals & Overlays
- **Modal Dialog**:
  - Max width: max-w-2xl
  - Padding: p-6
  - Header with title + close button
  - Footer with action buttons
  
- **Confirmation Dialog**: For destructive actions (delete account)
- **Toast Notifications**: Top-right corner for success/error messages

## Page-Specific Layouts

### Authentication Pages
- Centered card design (max-w-md)
- Logo at top
- Form with social login buttons
- Helper links below (Sign up, Forgot password)

### Onboarding Flow
- Multi-step wizard with progress indicator
- Step 1: Welcome + Country/Region/Currency selection (dropdown selectors in grid-cols-2)
- Step 2: Add First Account (comprehensive form, all fields visible)
- Step 3: AI Rule Discovery (loading state, confirmation interface)
- Step 4: Budget Setup (numerical input + future changes table)
- Step 5: Preferences (radio card groups for Choice 1 & 2)
- Step Navigation: Back/Next buttons, skip option where appropriate

### Dashboard (Post-Plan Generation)
**Layout Structure**:
- Top: Summary stat cards (4-column grid)
  - Total Debt Remaining
  - Total Interest to Pay
  - Months Until Debt-Free
  - Next Month's Payment
- Middle: Full-width timeline chart
- Bottom: Tabbed interface
  - Tab 1: Monthly Payment Schedule (table)
  - Tab 2: Account Details (card grid)
  - Tab 3: AI Explanation (formatted text with highlights)

### Account Management
- Header with "Add Account" button
- Grid of account cards (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Each card: Edit/Delete actions, expandable for details

## Accessibility Features

- **High Contrast Mode**: Increased border weights, stronger dividers
- **Dyslexia-Friendly**: Increased letter-spacing (tracking-wide), larger line-height (leading-relaxed)
- **Dyscalculia Mode**: Enhanced visual separators for numerical groupings, always show currency symbols
- **Focus States**: 2px offset ring on all interactive elements
- **ARIA Labels**: All form inputs, buttons, and interactive charts

## Special Interactions

- **AI Rule Discovery Loading**: Skeleton loader with animated pulse, "Researching lender rules..." text
- **Confirmation Modal**: When AI presents discovered rule, show side-by-side comparison if user entered manual rule
- **Plan Generation**: Loading overlay with progress indicator (estimated 15-60 seconds), solver status updates
- **What-If Scenarios**: Inline editing of budget/accounts with instant "Recalculate" button

## Images

**Hero Image**: Not applicable (utility app, no marketing landing page needed)

**Onboarding Welcome Screen**: Abstract financial growth illustration (upward trending graph motif), centered, max-w-md, mb-8

**Empty States**: 
- No accounts yet: Illustration of credit cards, centered, max-w-xs
- No plan generated: Illustration of calculator/optimization, centered, max-w-sm

**Account Type Icons**: Use icon library (Heroicons) for visual indicators on cards (credit-card, shopping-bag, banknote icons)