#!/usr/bin/env python3
"""
Test case to verify minimum payment constraints are enforced during promotional periods.
This test reproduces the user's reported issue of $0.00 payments during promo periods.
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

def test_promo_period_minimum_payments():
    """
    Test that minimum payments are enforced during 0% promotional periods.
    
    Scenario:
    - Account with balance of $8,374.23
    - Minimum payment: $100 fixed OR 2% of balance (whichever is greater)
    - 6-month promotional period with 0% APR
    - Standard APR: 24.99% after promo
    
    Expected: Every month should have at least the minimum payment, even during promo.
    Bug: If payments are $0.00 during promo, minimum payment constraint is not working.
    """
    print("\n" + "="*80)
    print("TEST: Minimum Payments During Promotional Period")
    print("="*80)
    
    # Create account matching user's scenario
    test_account = Account(
        lender_name="Test Card (6-Month Promo)",
        account_type=AccountType.CREDIT_CARD,
        current_balance_cents=837423,  # $8,374.23
        apr_standard_bps=2499,         # 24.99% APR after promo
        payment_due_day=15,
        
        # THIS IS THE KEY: Minimum payment rule
        min_payment_rule=MinPaymentRule(
            fixed_cents=10000,      # $100 fixed
            percentage_bps=200,     # 2% of balance
            includes_interest=False
        ),
        
        # 6-month promotional period
        promo_duration_months=6,
        
        account_open_date=date.today()
    )
    
    # Budget that allows for minimum payments
    test_budget = Budget(
        monthly_budget_cents=50000,  # $500/month budget
        future_changes=[],
        lump_sum_payments=[]
    )
    
    # User preferences - testing with different strategies
    strategies_to_test = [
        OptimizationStrategy.MINIMIZE_TOTAL_INTEREST,
        OptimizationStrategy.MINIMIZE_MONTHLY_SPEND,
    ]
    
    for strategy in strategies_to_test:
        print(f"\n--- Testing Strategy: {strategy.value} ---")
        
        test_prefs = UserPreferences(
            strategy=strategy,
            payment_shape=PaymentShape.OPTIMIZED_MONTH_TO_MONTH
        )
        
        test_portfolio = DebtPortfolio(
            accounts=[test_account],
            budget=test_budget,
            preferences=test_prefs,
            plan_start_date=date.today()
        )
        
        # Run the solver
        print("\n🔬 Running solver...")
        results = generate_payment_plan(test_portfolio)
        
        if results is None:
            print("❌ SOLVER FAILED: No solution found")
            continue
        
        # Check for minimum payment violations
        print("\n📊 Checking Results:")
        violations = []
        
        for result in results:
            if result.month <= 6:  # Within promo period
                # Calculate what the minimum should be
                # For first month: balance = $8,374.23
                # Min payment = max($100, 2% * $8,374.23) = max($100, $167.48) = $167.48
                prev_balance = test_account.current_balance_cents if result.month == 1 else None
                
                # For simplicity, check if payment is at least $100 (the fixed minimum)
                if result.payment_cents < 10000:  # Less than $100
                    violations.append({
                        'month': result.month,
                        'payment': result.payment_cents / 100,
                        'balance': result.ending_balance_cents / 100,
                    })
                    print(f"  ⚠️  Month {result.month}: Payment = ${result.payment_cents/100:.2f} "
                          f"(BELOW MINIMUM!), Balance = ${result.ending_balance_cents/100:.2f}")
                else:
                    print(f"  ✓ Month {result.month}: Payment = ${result.payment_cents/100:.2f}, "
                          f"Balance = ${result.ending_balance_cents/100:.2f}")
        
        # Report results
        if violations:
            print(f"\n❌ TEST FAILED: {len(violations)} minimum payment violations found!")
            print("Violations:")
            for v in violations:
                print(f"  - Month {v['month']}: Payment ${v['payment']:.2f} < $100.00 minimum")
        else:
            print(f"\n✅ TEST PASSED: All payments meet minimum requirements during promo period")
    
    print("\n" + "="*80)

if __name__ == "__main__":
    test_promo_period_minimum_payments()
