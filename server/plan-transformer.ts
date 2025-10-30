import { MonthlyResult, PlanScheduleEntry, AccountSchedule, Account } from "@shared/schema";

export interface StructuredPlanData {
  planStartDate: string;
  payoffTimeMonths: number;
  totalInterestPaidCents: number;
  schedule: PlanScheduleEntry[];
  accountSchedules: AccountSchedule[];
}

export function buildStructuredPlan(
  monthlyResults: MonthlyResult[],
  accounts: Account[],
  planStartDate: string
): StructuredPlanData {
  if (!monthlyResults || monthlyResults.length === 0) {
    return {
      planStartDate,
      payoffTimeMonths: 0,
      totalInterestPaidCents: 0,
      schedule: [],
      accountSchedules: [],
    };
  }

  // Calculate payoffTimeMonths (max month number in results)
  const payoffTimeMonths = Math.max(...monthlyResults.map(r => r.month));

  // Calculate totalInterestPaidCents (sum all interestChargedCents)
  const totalInterestPaidCents = monthlyResults.reduce(
    (sum, r) => sum + r.interestChargedCents,
    0
  );

  // Group results by month
  const resultsByMonth = new Map<number, MonthlyResult[]>();
  for (const result of monthlyResults) {
    if (!resultsByMonth.has(result.month)) {
      resultsByMonth.set(result.month, []);
    }
    resultsByMonth.get(result.month)!.push(result);
  }

  // Build schedule entries
  const schedule: PlanScheduleEntry[] = [];
  const months = Array.from(resultsByMonth.keys()).sort((a, b) => a - b);

  // Track ending balances by lender for starting balance calculation
  const previousEndingBalances = new Map<string, number>();
  
  // Initialize with account starting balances
  for (const account of accounts) {
    previousEndingBalances.set(account.lenderName, account.currentBalanceCents);
  }

  for (const month of months) {
    const monthResults = resultsByMonth.get(month)!;

    // Calculate starting balance (sum of all ending balances from previous month)
    const startingBalanceCents = Array.from(previousEndingBalances.values()).reduce(
      (sum, balance) => sum + balance,
      0
    );

    // Calculate total payment and build payments object
    let totalPaymentCents = 0;
    const payments: Record<string, number> = {};

    for (const result of monthResults) {
      totalPaymentCents += result.paymentCents;
      payments[result.lenderName] = result.paymentCents;
      
      // Update ending balance for next iteration
      previousEndingBalances.set(result.lenderName, result.endingBalanceCents);
    }

    schedule.push({
      month,
      startingBalanceCents,
      totalPaymentCents,
      payments,
    });
  }

  // Build accountSchedules by finding the last month each account receives a payment
  const accountSchedules: AccountSchedule[] = [];
  const lastPaymentMonth = new Map<string, number>();

  for (const result of monthlyResults) {
    if (result.paymentCents > 0) {
      const currentLast = lastPaymentMonth.get(result.lenderName) || 0;
      lastPaymentMonth.set(result.lenderName, Math.max(currentLast, result.month));
    }
  }

  // Match with account IDs
  for (const account of accounts) {
    const payoffMonth = lastPaymentMonth.get(account.lenderName) || 0;
    accountSchedules.push({
      accountId: account.id,
      lenderName: account.lenderName,
      payoffTimeMonths: payoffMonth,
    });
  }

  return {
    planStartDate,
    payoffTimeMonths,
    totalInterestPaidCents,
    schedule,
    accountSchedules,
  };
}
