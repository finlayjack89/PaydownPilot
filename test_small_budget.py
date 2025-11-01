#!/usr/bin/env python3
"""
Test with ZERO minimum payment AND small budget to force $0 payments.
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

def test_zero_min_with_small_budget():
    """
    Test: ZERO min payment + small budget that can't cover all accounts
    This should produce $0 payments if min payment = 0
    """
    print("\n" + "="*80)
    print("TEST: ZERO Min Payment + Small Budget (Force $0 Payments)")
    print("="*80)
    
    # Account 1: High balance, ZERO minimum payment
    account1 = Account(
        lender_name="Account 1 (ZERO Min, 6mo Promo)",
        account_type=AccountType.CREDIT_CARD,
        current_balance_cents=500000,  # $5,000
        apr_standard_bps=2499,
        payment_due_day=15,
        min_payment_rule=MinPaymentRule(fixed_cents=0, percentage_bps=0),  # ZERO!
        promo_duration_months=6,
    )
    
    # Account 2: Smaller balance, HAS minimum payment
    account2 = Account(
        lender_name="Account 2 (Has Min, No Promo)",
        account_type=AccountType.CREDIT_CARD,
        current_balance_cents=200000,  # $2,000
        apr_standard_bps=1999,
        payment_due_day=20,
        min_payment_rule=MinPaymentRule(fixed_cents=5000, percentage_bps=200),  # $50 or 2%
        promo_duration_months=None,  # No promo
    )
    
    # Small budget - only enough for Account 2's minimum
    test_budget = Budget(
        monthly_budget_cents=10000,  # $100/month (enough for both minimums if Account1 had one)
        future_changes=[],
        lump_sum_payments=[]
    )
    
    test_prefs = UserPreferences(
        strategy=OptimizationStrategy.MINIMIZE_MONTHLY_SPEND,  # Pay minimum
        payment_shape=PaymentShape.OPTIMIZED_MONTH_TO_MONTH
    )
    
    test_portfolio = DebtPortfolio(
        accounts=[account1, account2],
        budget=test_budget,
        preferences=test_prefs,
        plan_start_date=date.today()
    )
    
    print("\n🔬 Running solver...")
    print("Account 1: $5,000 balance, ZERO min payment, 6-month promo")
    print("Account 2: $2,000 balance, $50 min payment, NO promo")
    print("Budget: $100/month")
    print("\nExpected: Account 1 gets minimal or $0 during promo, Account 2 gets its minimum")
    
    results = generate_payment_plan(test_portfolio)
    
    if results is None:
        print("\n❌ SOLVER FAILED")
        return
    
    print("\n📊 Results (First 8 Months):")
    account1_zero_months = []
    
    for month in range(1, 9):
        month_results = [r for r in results if r.month == month]
        if not month_results:
            break
            
        print(f"\n  Month {month}:")
        for r in month_results:
            payment_str = f"${r.payment_cents/100:.2f}"
            if r.lender_name == "Account 1 (ZERO Min, 6mo Promo)" and r.payment_cents == 0:
                account1_zero_months.append(month)
                payment_str += " ⚠️ ZERO PAYMENT DURING PROMO"
            print(f"    {r.lender_name}: {payment_str}")
    
    if account1_zero_months:
        print(f"\n🐛 REPRODUCED THE BUG!")
        print(f"Account 1 had $0 payments during promo in months: {account1_zero_months}")
        print(f"\nROOT CAUSE: Minimum payment rule = 0 allows solver to skip payments")
    else:
        print(f"\n✅ No zero payments found")
    
    print("\n" + "="*80)

if __name__ == "__main__":
    test_zero_min_with_small_budget()
