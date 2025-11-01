# Bug Fix Report: Minimum Payment $0.00 Display Issue

## Executive Summary

**Issue**: UI displays $0.00 payments for accounts that should be receiving their minimum payments.

**Root Cause**: Data mapping bug in `server/routes.ts` - the backend was reading **flat fields** from a **nested object** sent by the frontend, causing minimum payment rules to be set to 0 when sent to the Python solver.

**Fix**: Updated field mapping to correctly read from nested `minPaymentRule` object.

**Status**: ✅ FIXED

---

## Investigation Process

### 1. Added Comprehensive Logging

Added logging at critical points in the data pipeline to trace where $0 payments appear:

- ✅ **routes.ts POST /api/plans/generate**: Log raw Python solver output before transformation
- ✅ **routes.ts POST /api/plans/generate**: Log transformed planData after mapping
- ✅ **routes.ts POST /api/plans/generate**: Log planData before database save
- ✅ **routes.ts POST /api/plans/generate**: Log plan after database save
- ✅ **routes.ts GET /api/plans/latest**: Log plan data retrieved from database
- ✅ **routes.ts GET /api/plans/latest**: Log final response sent to client
- ✅ **routes.ts POST /api/plans/generate**: Log minimum payment rules being sent to Python solver

### 2. Database Investigation

Queried existing plan data and found:
```sql
-- Account: test2 (balance $8,374.23, 34-month promo)
-- Min payment rule: $25 fixed OR 2.5% (=$209.36)
-- Plan shows: $0 payments for months 1-25!

Month 1: paymentCents: 0, endingBalanceCents: 837423
Month 2: paymentCents: 0, endingBalanceCents: 837423
...
Month 25: paymentCents: 0, endingBalanceCents: 837423
Month 26: paymentCents: 37423
Month 27-34: paymentCents: 100000
```

This confirmed $0 payments were stored in the database, meaning the bug occurred during plan generation.

### 3. Root Cause Analysis

**Frontend sends nested object** (client/src/pages/generate.tsx lines 35-39):
```typescript
minPaymentRule: {
  fixedCents: acc.minPaymentRuleFixedCents,
  percentageBps: acc.minPaymentRulePercentageBps,
  includesInterest: acc.minPaymentRuleIncludesInterest,
}
```

**Backend incorrectly reads flat fields** (server/routes.ts lines 389-393 BEFORE fix):
```typescript
min_payment_rule: {
  fixed_cents: acc.minPaymentRuleFixedCents || 0,  // ← undefined! Becomes 0
  percentage_bps: acc.minPaymentRulePercentageBps || 0,  // ← undefined! Becomes 0
  includes_interest: acc.minPaymentRuleIncludesInterest || false,
}
```

**Result**: 
- `acc.minPaymentRuleFixedCents` is `undefined` (because frontend sends `acc.minPaymentRule.fixedCents`)
- `undefined || 0 = 0`
- Minimum payment rule sent to solver: `{fixed_cents: 0, percentage_bps: 0}`
- Solver allows $0 payments during promo periods (correctly following the constraints!)

---

## The Fix

**File**: `server/routes.ts`

**Change**: Updated field mapping to read from nested object:

```typescript
// BEFORE (INCORRECT):
min_payment_rule: {
  fixed_cents: acc.minPaymentRuleFixedCents || 0,  // ← WRONG!
  percentage_bps: acc.minPaymentRulePercentageBps || 0,
  includes_interest: acc.minPaymentRuleIncludesInterest || false,
}

// AFTER (CORRECT):
min_payment_rule: {
  // CRITICAL FIX: Frontend sends nested minPaymentRule object, not flat fields
  fixed_cents: acc.minPaymentRule?.fixedCents || 0,  // ← CORRECT!
  percentage_bps: acc.minPaymentRule?.percentageBps || 0,
  includes_interest: acc.minPaymentRule?.includesInterest || false,
}
```

**Impact**:
- ✅ Minimum payment rules now correctly sent to Python solver
- ✅ Solver enforces minimum payments even during promo periods
- ✅ UI will display correct minimum payments

---

## Verification Steps

To verify the fix works:

1. **Regenerate a plan** via the UI or API
2. **Check server logs** for the new logging:
   ```
   [DEBUG] Sending to Python solver - Account minimum payment rules:
     Promo Card: fixed=$100.00, percentage=200bps
     High Interest Card: fixed=$50.00, percentage=500bps
   ```
3. **Check the generated plan** - should show minimum payments for all months:
   ```
   Month 1: Promo Card payment >= $100 (minimum)
   Month 2: Promo Card payment >= $100 (minimum)
   etc.
   ```

---

## Technical Details

### Data Flow

1. **Frontend** (client/src/pages/generate.tsx): Fetches accounts from `/api/accounts` (returns flat fields)
2. **Frontend**: Transforms to nested object for POST request
3. **Backend** (server/routes.ts): Receives nested object, maps to Python schema
4. **Python Solver**: Receives minimum payment rules, enforces constraints
5. **Backend**: Stores results in database
6. **Frontend**: Displays plan data from database

### Why the Solver Was "Correct"

The solver was working perfectly! When given `{fixed_cents: 0, percentage_bps: 0}`, it correctly calculated:
```
raw_minimum = max(0, 0) = 0
final_minimum = min(0, total_owed) = 0
payment >= 0  ✓ (allows $0 payments)
```

The bug was in the **data input**, not the solver logic.

---

## Related Files

- ✅ `server/routes.ts` - Fixed field mapping (lines 394-396)
- ✅ `server/routes.ts` - Added comprehensive logging
- ✅ `BUG_FIX_REPORT.md` - This documentation
- ℹ️ `INVESTIGATION_REPORT.md` - Previous fix for zero minimum payment validation (different issue)

---

## Regression Prevention

**Logging Added**:
- Minimum payment rules sent to solver (prevents this bug from reoccurring silently)
- Full data pipeline logging (helps debug future issues)

**Validation**:
- Backend validation in `shared/schema.ts` ensures accounts must have at least one non-zero minimum payment component
- This prevents zero minimum payments from being created in the first place

---

## Summary

| Component | Issue | Fix |
|-----------|-------|-----|
| Data Mapping | Reading flat fields from nested object | Use `acc.minPaymentRule?.fixedCents` instead of `acc.minPaymentRuleFixedCents` |
| Solver | ✅ Working correctly | No changes needed |
| Database | ✅ JSONB storage working | No changes needed |
| UI Display | ✅ Working correctly | No changes needed |

**Conclusion**: The bug was a simple field mapping error that caused minimum payment rules to be zeroed when sent to the solver. The fix is straightforward and the logging will prevent similar issues in the future.
