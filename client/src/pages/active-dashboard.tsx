import { Link } from "wouter";
import { useAccounts, useActivePlan } from "@/hooks/use-plan-data";
import { getCurrentMonthIndex, getDashboardStats } from "@/lib/date-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingDown, Calendar, DollarSign, Target, CreditCard, BarChart3, CheckCircle2, RefreshCw } from "lucide-react";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { FindMyBudgetButton } from "@/components/find-my-budget-button";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function ActiveDashboard() {
  const { user } = useAuth();
  const { data: accounts = [], refetch: refetchAccounts } = useAccounts();
  const { data: plan, refetch: refetchPlan } = useActivePlan();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchAccounts(),
        refetchPlan(),
        queryClient.invalidateQueries({ queryKey: ["/api/budget"] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!plan || !accounts) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const currentMonthIndex = getCurrentMonthIndex(plan);
  const stats = getDashboardStats(plan, accounts, currentMonthIndex);
  
  const nextPayoffAccountName = stats.nextAccountSettle === 0 
    ? "Soon!" 
    : plan.accountSchedules?.find(
        (s) => s.payoffTimeMonths - (currentMonthIndex + 1) === stats.nextAccountSettle
      )?.lenderName || "Unknown";

  const statCards = [
    {
      title: "Current Total Debt",
      value: formatCurrency(stats.totalCurrentDebt, user?.currency),
      description: currentMonthIndex === -1 ? "Starting balance" : "As of this month",
      icon: DollarSign,
      iconColor: "text-blue-500",
    },
    {
      title: "Total Paid So Far",
      value: formatCurrency(stats.totalPaidSoFar, user?.currency),
      description: currentMonthIndex === -1 ? "Plan not started yet" : `${currentMonthIndex + 1} payment${currentMonthIndex !== 0 ? 's' : ''} made`,
      icon: CheckCircle2,
      iconColor: "text-green-500",
    },
    {
      title: "Next Account Payoff",
      value: stats.nextAccountSettle === 0 ? "This month!" : `${stats.nextAccountSettle} month${stats.nextAccountSettle !== 1 ? 's' : ''}`,
      description: nextPayoffAccountName,
      icon: Target,
      iconColor: "text-orange-500",
    },
    {
      title: "Debt-Free Date",
      value: stats.allAccountsSettle === 0 ? "Debt-Free!" : `${stats.allAccountsSettle} month${stats.allAccountsSettle !== 1 ? 's' : ''}`,
      description: stats.allAccountsSettle === 0 ? "Congratulations!" : "Remaining until debt-free",
      icon: TrendingDown,
      iconColor: "text-purple-500",
    },
    {
      title: "Next Payment",
      value: formatCurrency(stats.nextPayment.amount, user?.currency),
      description: `Due ${stats.nextPayment.date.toLocaleDateString("en-US", { month: "short", year: "numeric" })} • ${stats.nextPayment.account}`,
      icon: Calendar,
      iconColor: "text-pink-500",
    },
  ];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold" data-testid="text-dashboard-title">
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your progress and stay on target
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh-dashboard"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button asChild variant="outline" data-testid="button-browse-accounts">
              <Link href="/accounts">
                <CreditCard className="h-4 w-4 mr-2" />
                Browse Accounts
              </Link>
            </Button>
            <Button asChild data-testid="button-view-full-plan">
              <Link href="/plan">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Full Plan
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((stat, index) => (
            <Card key={index} data-testid={`card-stat-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono" data-testid={`text-stat-value-${index}`}>
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1" data-testid={`text-stat-description-${index}`}>
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks to manage your debt payoff plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button
                asChild
                variant="outline"
                className="h-auto py-4 flex-col items-start hover-elevate"
                data-testid="button-quick-add-account"
              >
                <Link href="/accounts">
                  <CreditCard className="h-6 w-6 mb-2" />
                  <div className="text-left">
                    <div className="font-semibold">Manage Accounts</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      Add, edit, or remove debt accounts
                    </div>
                  </div>
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-auto py-4 flex-col items-start hover-elevate"
                data-testid="button-quick-adjust-budget"
              >
                <Link href="/budget">
                  <DollarSign className="h-6 w-6 mb-2" />
                  <div className="text-left">
                    <div className="font-semibold">Adjust Budget</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      Update your monthly payment budget
                    </div>
                  </div>
                </Link>
              </Button>

              <div className="h-auto py-4 flex-col items-start">
                <FindMyBudgetButton variant="outline" className="h-full w-full justify-start flex-col items-start hover-elevate" />
                <div className="text-xs text-muted-foreground font-normal mt-2 px-1">
                  AI-powered budget analysis based on your transactions
                </div>
              </div>

              <Button
                asChild
                variant="outline"
                className="h-auto py-4 flex-col items-start hover-elevate"
                data-testid="button-quick-regenerate-plan"
              >
                <Link href="/generate">
                  <BarChart3 className="h-6 w-6 mb-2" />
                  <div className="text-left">
                    <div className="font-semibold">Regenerate Plan</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      Create a new optimized plan
                    </div>
                  </div>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Your Accounts</CardTitle>
            <CardDescription>
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} being tracked
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accounts.slice(0, 5).map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                  data-testid={`card-account-${account.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold" data-testid={`text-account-name-${account.id}`}>
                        {account.lenderName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {account.accountType}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold" data-testid={`text-account-balance-${account.id}`}>
                      {formatCurrency(account.currentBalanceCents, user?.currency)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(account.aprStandardBps / 100).toFixed(2)}% APR
                    </div>
                  </div>
                </div>
              ))}
              {accounts.length > 5 && (
                <Button
                  asChild
                  variant="ghost"
                  className="w-full"
                  data-testid="button-view-all-accounts"
                >
                  <Link href="/accounts">
                    View all {accounts.length} accounts
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
