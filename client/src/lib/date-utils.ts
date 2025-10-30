import { PlanResponse, Account } from "@shared/schema";

/**
 * Calculates the difference in months between two dates.
 */
function getMonthDifference(startDate: Date, endDate: Date): number {
  return (
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth())
  );
}

/**
 * Finds the index of the plan schedule that corresponds to the current date.
 * Returns -1 if the plan hasn't started, or the last index if it's finished.
 */
export function getCurrentMonthIndex(plan: PlanResponse): number {
  if (!plan.planStartDate || !plan.schedule || plan.schedule.length === 0) {
    return -1;
  }

  const planStartDate = new Date(plan.planStartDate);
  const today = new Date();

  // Set both dates to the 1st of the month for clean comparison
  planStartDate.setDate(1);
  today.setDate(1);

  if (today < planStartDate) {
    return -1; // Plan hasn't started yet
  }

  const monthIndex = getMonthDifference(planStartDate, today);

  if (monthIndex >= plan.schedule.length) {
    return plan.schedule.length - 1; // Plan is finished, return last index
  }

  return monthIndex;
}

/**
 * Calculates all dynamic dashboard stats based on the current date.
 */
export function getDashboardStats(
  plan: PlanResponse,
  accounts: Account[],
  currentMonthIndex: number,
) {
  // If plan doesn't have structured data, return defaults
  if (!plan.schedule || !plan.accountSchedules) {
    return {
      totalCurrentDebt: 0,
      nextAccountSettle: 0,
      allAccountsSettle: 0,
      nextPayment: {
        amount: 0,
        date: new Date(),
        account: "N/A",
      },
      totalPaidSoFar: 0,
    };
  }

  // 1. Total Debt (Current)
  const totalCurrentDebt =
    currentMonthIndex === -1
      ? // Plan hasn't started, sum initial balances
        accounts.reduce((sum, acc) => sum + acc.currentBalanceCents, 0)
      : // Get the *starting* balance of the current month from the plan
        plan.schedule[currentMonthIndex].startingBalanceCents;

  // 2. Months until next account settled (Remaining)
  const monthsRemaining = plan.accountSchedules.map(
    (sched) => sched.payoffTimeMonths - (currentMonthIndex + 1)
  );
  const nextAccountSettle = Math.min(...monthsRemaining.filter((m) => m >= 0));

  // 3. Months until all accounts settled (Remaining)
  const allAccountsSettle = Math.max(
    0,
    (plan.payoffTimeMonths ?? 0) - (currentMonthIndex + 1)
  );

  // 4. Next Payment
  // Find the schedule entry for the *next* month (or current if plan hasn't started)
  const nextPaymentIndex = currentMonthIndex === -1 ? 0 : currentMonthIndex + 1;
  const nextPaymentEntry = plan.schedule[nextPaymentIndex];
  const nextPaymentDate = new Date(plan.planStartDate!);
  nextPaymentDate.setMonth(nextPaymentDate.getMonth() + nextPaymentIndex);

  // Find which account gets the biggest payment next month
  let nextPaymentAccount = "Multiple";
  if (nextPaymentEntry && nextPaymentEntry.payments) {
    let maxPayment = 0;
    for (const [accountId, payment] of Object.entries(nextPaymentEntry.payments)) {
      if (payment > maxPayment) {
        maxPayment = payment;
        const acc = accounts.find((a) => a.id === accountId);
        nextPaymentAccount = acc?.lenderName ?? "Multiple";
      }
    }
  }

  const nextPayment = {
    amount: nextPaymentEntry?.totalPaymentCents ?? 0,
    date: nextPaymentDate,
    account: nextPaymentAccount,
  };

  // 5. Total Paid So Far
  // Sum all payments from month 0 up to and *including* the current month
  const totalPaidSoFar = plan.schedule
    .slice(0, currentMonthIndex + 1) // slice(0, 0) is empty (correct for index -1)
    .reduce((sum, entry) => sum + entry.totalPaymentCents, 0);

  return {
    totalCurrentDebt,
    nextAccountSettle: isFinite(nextAccountSettle) ? nextAccountSettle : 0,
    allAccountsSettle,
    nextPayment,
    totalPaidSoFar,
  };
}
