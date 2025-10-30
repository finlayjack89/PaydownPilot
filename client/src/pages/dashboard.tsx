import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TrendingDown, Calendar, DollarSign, Target, Settings, CreditCard, LayoutGrid, LayoutList, Wallet } from "lucide-react";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { DebtTimeline } from "@/components/debt-timeline";
import { AccountTimeline } from "@/components/account-timeline";
import type { MonthlyResult } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PlanSummary {
  totalDebt: number;
  totalInterest: number;
  payoffMonths: number;
  nextPayment: number;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [scheduleView, setScheduleView] = useState<"by-month" | "by-account">("by-month");

  const { data: plan, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/plans/latest"],
    retry: 3,
    retryDelay: 1000,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["/api/accounts"],
  });

  const { data: budget } = useQuery({
    queryKey: ["/api/budget"],
  });

  const planData = plan?.planData as MonthlyResult[] | undefined;
  
  // Calculate summary statistics
  const summary: PlanSummary = planData ? {
    totalDebt: accounts.reduce((sum: number, acc: any) => sum + acc.currentBalanceCents, 0),
    totalInterest: planData.reduce((sum, r) => sum + r.interestChargedCents, 0),
    payoffMonths: Math.max(...planData.map(r => r.month)),
    nextPayment: planData
      .filter(r => r.month === 1)
      .reduce((sum, r) => sum + r.paymentCents, 0),
  } : { totalDebt: 0, totalInterest: 0, payoffMonths: 0, nextPayment: 0 };

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + summary.payoffMonths);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md text-center p-8">
          <CardHeader>
            <CardTitle>No Plan Yet</CardTitle>
            <CardDescription>Generate your first plan to see your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/accounts")}>
              Get Started
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setLocation("/accounts")}
              data-testid="button-manage-accounts"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Accounts
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/preferences")}
              data-testid="button-settings"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Your Debt Payoff Plan</h1>
          <p className="text-muted-foreground mt-2">
            Optimized to {plan.status === "OPTIMAL" ? "minimize your total interest" : "work within your constraints"}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8">
          <Card data-testid="card-total-debt">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Debt
              </CardTitle>
              <TrendingDown className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold">
                {formatCurrency(summary.totalDebt, user?.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {accounts.length} accounts
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-interest">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Interest
              </CardTitle>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold">
                {formatCurrency(summary.totalInterest, user?.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Over the life of the plan
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-payoff-date">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Debt-Free Date
              </CardTitle>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold">
                {summary.payoffMonths} mo
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-next-payment">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Next Payment
              </CardTitle>
              <Target className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold">
                {formatCurrency(summary.nextPayment, user?.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Due this month
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-monthly-budget">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Budget
              </CardTitle>
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold">
                {formatCurrency(budget?.monthlyBudgetCents || 0, user?.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Available for debt
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Timeline Chart */}
        {planData && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Debt Reduction Timeline</CardTitle>
              <CardDescription>
                Watch your debt decrease month by month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DebtTimeline data={planData} currency={user?.currency || "USD"} />
            </CardContent>
          </Card>
        )}

        {/* Tabbed Details */}
        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedule" data-testid="tab-schedule">
              Payment Schedule
            </TabsTrigger>
            <TabsTrigger value="accounts" data-testid="tab-accounts">
              Account Details
            </TabsTrigger>
            <TabsTrigger value="explanation" data-testid="tab-explanation">
              Why This Plan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>Payment Schedule</CardTitle>
                    <CardDescription>
                      Your optimized payment plan for the next {summary.payoffMonths} months
                    </CardDescription>
                  </div>
                  <Select value={scheduleView} onValueChange={(v) => setScheduleView(v as "by-month" | "by-account")}>
                    <SelectTrigger className="w-40" data-testid="select-schedule-view">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="by-month" data-testid="option-by-month">
                        <div className="flex items-center gap-2">
                          <LayoutGrid className="h-4 w-4" />
                          By Month
                        </div>
                      </SelectItem>
                      <SelectItem value="by-account" data-testid="option-by-account">
                        <div className="flex items-center gap-2">
                          <LayoutList className="h-4 w-4" />
                          By Account
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {scheduleView === "by-month" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Month</th>
                          <th className="text-left py-3 px-4 font-medium">Account</th>
                          <th className="text-left py-3 px-4 font-medium">Due Date</th>
                          <th className="text-right py-3 px-4 font-medium">Payment</th>
                          <th className="text-right py-3 px-4 font-medium">Interest</th>
                          <th className="text-right py-3 px-4 font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planData?.slice(0, 36).map((row, idx) => {
                          const account = accounts.find((a: any) => a.lenderName === row.lenderName);
                          const dueDay = account?.paymentDueDay || 1;
                          const monthDate = new Date();
                          monthDate.setMonth(monthDate.getMonth() + row.month - 1);
                          const paymentDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                          
                          return (
                            <tr
                              key={idx}
                              className="border-b hover:bg-muted/50"
                              data-testid={`row-payment-${idx}`}
                            >
                              <td className="py-3 px-4 font-mono">
                                {formatMonthYear(row.month - 1, new Date())}
                              </td>
                              <td className="py-3 px-4">{row.lenderName}</td>
                              <td className="py-3 px-4 text-muted-foreground">
                                {paymentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold">
                                {formatCurrency(row.paymentCents, user?.currency)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                                {formatCurrency(row.interestChargedCents, user?.currency)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold">
                                {formatCurrency(Math.max(0, row.endingBalanceCents), user?.currency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {planData && planData.length > 36 && (
                      <p className="text-center text-sm text-muted-foreground mt-4">
                        Showing first 36 months of {summary.payoffMonths} total months
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    {accounts.map((account: any) => {
                      const accountPayments = planData?.filter(r => r.lenderName === account.lenderName).slice(0, 24) || [];
                      
                      return (
                        <div key={account.id} className="space-y-2">
                          <h3 className="font-semibold text-lg">{account.lenderName}</h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-3 font-medium">Month</th>
                                  <th className="text-left py-2 px-3 font-medium">Due Date</th>
                                  <th className="text-right py-2 px-3 font-medium">Payment</th>
                                  <th className="text-right py-2 px-3 font-medium">Interest</th>
                                  <th className="text-right py-2 px-3 font-medium">Balance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {accountPayments.map((row, idx) => {
                                  const dueDay = account.paymentDueDay || 1;
                                  const monthDate = new Date();
                                  monthDate.setMonth(monthDate.getMonth() + row.month - 1);
                                  const paymentDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dueDay);
                                  
                                  return (
                                    <tr
                                      key={idx}
                                      className="border-b hover:bg-muted/50"
                                      data-testid={`row-account-payment-${account.id}-${idx}`}
                                    >
                                      <td className="py-2 px-3 font-mono">
                                        {formatMonthYear(row.month - 1, new Date())}
                                      </td>
                                      <td className="py-2 px-3 text-muted-foreground">
                                        {paymentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-semibold">
                                        {formatCurrency(row.paymentCents, user?.currency)}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                                        {formatCurrency(row.interestChargedCents, user?.currency)}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-semibold">
                                        {formatCurrency(Math.max(0, row.endingBalanceCents), user?.currency)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {planData && accountPayments.length === 24 && planData.filter(r => r.lenderName === account.lenderName).length > 24 && (
                              <p className="text-center text-sm text-muted-foreground mt-2">
                                Showing first 24 months
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-6">
            {accounts.map((account: any) => {
              const accountPayments = planData?.filter(r => r.lenderName === account.lenderName) || [];
              const totalPaid = accountPayments.reduce((sum, r) => sum + r.paymentCents, 0);
              const totalInterest = accountPayments.reduce((sum, r) => sum + r.interestChargedCents, 0);
              const payoffRecord = accountPayments.find(r => r.endingBalanceCents <= 0);
              const payoffMonth = payoffRecord ? payoffRecord.month : 0;

              return (
                <Card key={account.id} data-testid={`card-account-detail-${account.id}`}>
                  <CardHeader>
                    <CardTitle>{account.lenderName}</CardTitle>
                    <CardDescription>{account.accountType}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Payoff Month</p>
                        <p className="text-lg font-mono font-bold">
                          Month {payoffMonth}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total to Pay</p>
                        <p className="text-lg font-mono font-bold">
                          {formatCurrency(totalPaid, user?.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Interest Paid</p>
                        <p className="text-lg font-mono font-bold">
                          {formatCurrency(totalInterest, user?.currency)}
                        </p>
                      </div>
                    </div>
                    
                    {accountPayments.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-3">Balance Reduction Timeline</p>
                        <AccountTimeline 
                          data={accountPayments} 
                          currency={user?.currency || "USD"}
                          accountName={account.lenderName}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="explanation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Why This Plan Works</CardTitle>
                <CardDescription>
                  AI-generated explanation of your optimization strategy
                </CardDescription>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                {plan.explanation ? (
                  <div className="whitespace-pre-wrap">{plan.explanation}</div>
                ) : (
                  <div className="space-y-4">
                    <p>
                      Your payment plan has been optimized using advanced constraint programming to find the best allocation of your {formatCurrency(summary.nextPayment, user?.currency)} monthly budget across your {accounts.length} accounts.
                    </p>
                    <p>
                      By following this plan, you'll pay off all your debts in {summary.payoffMonths} months while paying only {formatCurrency(summary.totalInterest, user?.currency)} in total interest charges.
                    </p>
                    <p>
                      The optimizer takes into account each account's APR, minimum payment requirements, promotional periods, and payment due dates to create a mathematically optimal repayment schedule.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
