#!/usr/bin/env python3
"""
Test with a SINGLE account that has ZERO minimum payment rule.
This is the simplest way to demonstrate the root cause.
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

def test_single_account_zero_min():
    """
    Simplest test: One account, zero minimum payment, promo period
    """
    print("\n" + "="*80)
    print("TEST: Single Account with ZERO Minimum Payment")
    print("="*80)
    
    # Single account with ZERO minimum payment
    account = Account(
        lender_name="Test Card (ZERO Min Payment)",
        account_type=AccountType.CREDIT_CARD,
        current_balance_cents=100000,  # $1,000
        apr_standard_bps=2499,         # 24.99%
        payment_due_day=15,
        min_payment_rule=MinPaymentRule(
            fixed_cents=0,           # ZERO minimum!
            percentage_bps=0,        # ZERO minimum!
            includes_interest=False
        ),
        promo_duration_months=6,  # 6-month 0% promo
    )
    
    # Very small budget
    test_budget = Budget(
        monthly_budget_cents=2000,  # Only $20/month
        future_changes=[],
        lump_sum_payments=[]
    )
    
    # Test with MINIMIZE_MONTHLY_SPEND (should pay as little as possible)
    test_prefs = UserPreferences(
        strategy=OptimizationStrategy.MINIMIZE_MONTHLY_SPEND,
        payment_shape=PaymentShape.OPTIMIZED_MONTH_TO_MONTH
    )
    
    test_portfolio = DebtPortfolio(
        accounts=[account],
        budget=test_budget,
        preferences=test_prefs,
        plan_start_date=date.today()
    )
    
    print("\n🔬 Running solver...")
    print("Account: $1,000 balance, ZERO min payment, 6-month promo")
    print("Budget: $20/month")
    print("Strategy: MINIMIZE_MONTHLY_SPEND")
    print("\nWith ZERO minimum, solver should be able to pay $0 during promo period")
    
    results = generate_payment_plan(test_portfolio)
    
    if results is None:
        print("\n❌ SOLVER FAILED")
        return
    
    print("\n📊 Results (First 10 Months):")
    zero_payment_months = []
    
    for month in range(1, 11):
        month_results = [r for r in results if r.month == month]
        if not month_results:
            break
            
        r = month_results[0]
        promo_indicator = " [PROMO]" if month <= 6 else ""
        if r.payment_cents == 0 and month <= 6:
            zero_payment_months.append(month)
            print(f"  Month {month}: Payment = $0.00{promo_indicator} ⚠️ ZERO PAYMENT!")
        else:
            print(f"  Month {month}: Payment = ${r.payment_cents/100:.2f}{promo_indicator}, " 
                  f"Balance = ${r.ending_balance_cents/100:.2f}")
    
    if zero_payment_months:
        print(f"\n🐛 ROOT CAUSE CONFIRMED!")
        print(f"When minimum payment rule is ZERO, solver allows $0 payments!")
        print(f"Zero payment months during promo: {zero_payment_months}")
        print(f"\n💡 SOLUTION: Enforce that all accounts must have a minimum payment > 0")
    else:
        print(f"\n✅ No zero payments found (solver chose to pay during promo despite zero minimum)")
    
    print("\n" + "="*80)

if __name__ == "__main__":
    test_single_account_zero_min()
