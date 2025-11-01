#!/usr/bin/env python3
"""
Test case to demonstrate what happens when minimum payment rule is ZERO.
This is likely the root cause of the user's issue.
"""

from datetime import date
from solver_engine import (
    generate_payment_plan,
    DebtPortfolio,
    Account,
    MinPaymentRule,
    Budget,
    UserPreferences,
    AccountType,
    OptimizationStrategy,
    PaymentShape,
)

def test_zero_minimum_payment():
    """
    Test what happens when an account has ZERO minimum payment rule.
    
    THIS IS LIKELY THE ROOT CAUSE:
    - If accounts are created with minPaymentRuleFixedCents = 0
    - And minPaymentRulePercentageBps = 0
    - Then the solver will correctly allow $0 payments during promo periods
    """
    print("\n" + "="*80)
    print("TEST: ZERO Minimum Payment Rule (Likely Root Cause)")
    print("="*80)
    
    # Create account with ZERO minimum payment rule
    test_account = Account(
        lender_name="Test Card (ZERO Min Payment)",
        account_type=AccountType.CREDIT_CARD,
        current_balance_cents=837423,  # $8,374.23
        apr_standard_bps=2499,         # 24.99% APR after promo
        payment_due_day=15,
        
        # THIS IS THE BUG: Minimum payment rule is ZERO
        min_payment_rule=MinPaymentRule(
            fixed_cents=0,          # $0 fixed <- BUG!
            percentage_bps=0,       # 0% of balance <- BUG!
            includes_interest=False
        ),
        
        # 6-month promotional period
        promo_duration_months=6,
        
        account_open_date=date.today()
    )
    
    # Budget
    test_budget = Budget(
        monthly_budget_cents=50000,  # $500/month budget
        future_changes=[],
        lump_sum_payments=[]
    )
    
    # Test with MINIMIZE_TOTAL_INTEREST (should defer payments during promo if min=0)
    test_prefs = UserPreferences(
        strategy=OptimizationStrategy.MINIMIZE_TOTAL_INTEREST,
        payment_shape=PaymentShape.OPTIMIZED_MONTH_TO_MONTH
    )
    
    test_portfolio = DebtPortfolio(
        accounts=[test_account],
        budget=test_budget,
        preferences=test_prefs,
        plan_start_date=date.today()
    )
    
    print("\n🔬 Running solver with ZERO minimum payment rule...")
    results = generate_payment_plan(test_portfolio)
    
    if results is None:
        print("❌ SOLVER FAILED: No solution found")
        return
    
    # Check for $0 payments during promo period
    print("\n📊 Checking Results (First 10 Months):")
    zero_payment_months = []
    
    for result in results[:10]:  # Check first 10 months
        if result.month <= 6:  # Within promo period
            if result.payment_cents == 0:
                zero_payment_months.append(result.month)
                print(f"  ⚠️  Month {result.month}: Payment = $0.00 "
                      f"(Balance = ${result.ending_balance_cents/100:.2f}) "
                      f"<< PROMO PERIOD >>")
            else:
                print(f"  ✓ Month {result.month}: Payment = ${result.payment_cents/100:.2f}, "
                      f"Balance = ${result.ending_balance_cents/100:.2f}")
        else:
            print(f"  Month {result.month}: Payment = ${result.payment_cents/100:.2f}, "
                  f"Balance = ${result.ending_balance_cents/100:.2f}, "
                  f"Interest = ${result.interest_charged_cents/100:.2f}")
    
    # Report results
    if zero_payment_months:
        print(f"\n🐛 ROOT CAUSE IDENTIFIED!")
        print(f"When minimum payment rule is ZERO, solver allows $0 payments during promo!")
        print(f"Zero payment months: {zero_payment_months}")
        print(f"\n💡 SOLUTION: Ensure all accounts have proper minimum payment rules set")
        print(f"   - fixed_cents should be > 0 (e.g., $25-$100)")
        print(f"   - OR percentage_bps should be > 0 (e.g., 2% = 200 bps)")
    else:
        print(f"\n✅ No zero payments found")
    
    print("\n" + "="*80)

if __name__ == "__main__":
    test_zero_minimum_payment()
