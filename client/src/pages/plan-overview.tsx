import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TrendingDown, Calendar, DollarSign, Target, Settings, CreditCard, LayoutGrid, LayoutList, Wallet, Send, Loader2, Trash2, Bot, User } from "lucide-react";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { DebtTimeline } from "@/components/debt-timeline";
import { AccountTimeline } from "@/components/account-timeline";
import type { MonthlyResult } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PlanSummary {
  totalDebt: number;
  totalInterest: number;
  payoffMonths: number;
  nextPayment: number;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [scheduleView, setScheduleView] = useState<"by-month" | "by-account">("by-month");
  
  // Accelerator state
  const [acceleratorValue, setAcceleratorValue] = useState(0);
  const [heuristicPayoff, setHeuristicPayoff] = useState(0);
  const [heuristicInterest, setHeuristicInterest] = useState(0);
  const [originalBudget, setOriginalBudget] = useState<number | null>(null);
  
  // AI Assistant state - ChatGPT-style conversation
  const [aiQuestion, setAiQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  const { data: preferences } = useQuery({
    queryKey: ["/api/preferences"],
  });

  // Re-optimize mutation with new budget
  const reOptimizeMutation = useMutation({
    mutationFn: async (newBudgetCents: number) => {
      if (!budget || !preferences || !accounts || accounts.length === 0) {
        throw new Error("Required data not loaded");
      }
      
      const planRequest = {
        accounts: accounts.map((acc: any) => ({
          lenderName: acc.lenderName,
          accountType: acc.accountType,
          currentBalanceCents: acc.currentBalanceCents,
          aprStandardBps: acc.aprStandardBps,
          paymentDueDay: acc.paymentDueDay,
          minPaymentRuleFixedCents: acc.minPaymentRuleFixedCents,
          minPaymentRulePercentageBps: acc.minPaymentRulePercentageBps,
          minPaymentRuleIncludesInterest: acc.minPaymentRuleIncludesInterest,
          promoEndDate: acc.promoEndDate,
          promoDurationMonths: acc.promoDurationMonths,
          accountOpenDate: acc.accountOpenDate,
          notes: acc.notes,
        })),
        budget: {
          monthlyBudgetCents: newBudgetCents,
          futureChanges: budget.futureChanges || [],
          lumpSumPayments: budget.lumpSumPayments || [],
        },
        preferences: {
          strategy: preferences.strategy || "minimize_interest",
          paymentShape: preferences.paymentShape || "standard",
        },
        planStartDate: new Date().toISOString().split('T')[0],
      };
      
      return await apiRequest("POST", "/api/plans/generate", planRequest);
    },
    onSuccess: async (data, newBudgetCents) => {
      // Update the budget in the database to match the new plan
      await apiRequest("PATCH", "/api/budget", {
        monthlyBudgetCents: newBudgetCents,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/plans/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
      refetch();
      toast({
        title: "Plan updated!",
        description: "Your optimized plan has been recalculated with the new budget.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Optimization failed",
        description: error.message || "Could not update your plan.",
        variant: "destructive",
      });
    },
  });

  // AI explanation mutation with conversation history
  const aiExplainMutation = useMutation({
    mutationFn: async (question: string) => {
      return await apiRequest("POST", "/api/plans/explain", {
        question,
        planData: plan?.planData,
        explanation: plan?.explanation,
        conversationHistory: chatMessages,
      });
    },
    onSuccess: (data: any, question: string) => {
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: question },
        { role: 'assistant', content: data.answer }
      ]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    },
    onError: (error: any) => {
      toast({
        title: "Question failed",
        description: error.message || "Could not get an answer.",
        variant: "destructive",
      });
    },
  });

  // Delete plan mutation
  const deletePlanMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/plans/${plan?.id}/delete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans/latest"] });
      toast({
        title: "Plan deleted",
        description: "Your plan has been deleted. Your accounts remain unchanged.",
      });
      setLocation("/accounts");
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Could not delete the plan.",
        variant: "destructive",
      });
    },
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

  // Initialize and update heuristic baseline when plan changes
  useEffect(() => {
    if (summary.payoffMonths > 0) {
      setHeuristicPayoff(summary.payoffMonths);
      setHeuristicInterest(summary.totalInterest);
      setAcceleratorValue(0); // Reset slider when plan updates
    }
  }, [plan?.id, summary.payoffMonths, summary.totalInterest]);

  // Store original budget when first loaded
  useEffect(() => {
    if (budget?.monthlyBudgetCents && originalBudget === null) {
      setOriginalBudget(budget.monthlyBudgetCents);
    }
  }, [budget?.monthlyBudgetCents, originalBudget]);

  // Simple heuristic calculator for instant feedback
  const calculateHeuristic = (extraCents: number) => {
    if (!budget || !accounts || accounts.length === 0) return;
    
    const newBudget = (budget.monthlyBudgetCents || 0) + extraCents;
    const totalDebt = summary.totalDebt;
    
    // Simple heuristic: assume average APR and distribute payments
    const avgApr = accounts.reduce((sum: number, acc: any) => sum + (acc.aprStandardBps / 10000), 0) / accounts.length;
    const monthlyRate = avgApr / 12;
    
    // Rough estimate using amortization formula
    let estimatedMonths = 0;
    let remainingDebt = totalDebt;
    let estimatedInterest = 0;
    
    while (remainingDebt > 0 && estimatedMonths < 500) {
      const interestCharge = remainingDebt * monthlyRate;
      const principal = Math.min(newBudget - interestCharge, remainingDebt);
      
      if (principal <= 0) break; // Can't make progress
      
      estimatedInterest += interestCharge;
      remainingDebt -= principal;
      estimatedMonths++;
    }
    
    setHeuristicPayoff(Math.ceil(estimatedMonths));
    setHeuristicInterest(Math.round(estimatedInterest));
  };

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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" data-testid="button-delete-plan">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Plan
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove your current payment plan. Your accounts and budget settings will remain unchanged.
                    You can generate a new plan at any time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletePlanMutation.mutate()}
                    disabled={deletePlanMutation.isPending}
                    data-testid="button-confirm-delete"
                  >
                    {deletePlanMutation.isPending ? "Deleting..." : "Delete Plan"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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

        {/* Accelerator Slider */}
        <Card className="mb-8" data-testid="card-accelerator">
          <CardHeader>
            <CardTitle>Accelerator</CardTitle>
            <CardDescription>
              Explore higher or lower monthly budgets and see the impact
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-mono text-lg font-semibold">
                {acceleratorValue >= 0 ? '+ ' : '− '}
                {formatCurrency(Math.abs(acceleratorValue * 100), user?.currency)}
              </span>
              <span className="text-sm text-muted-foreground">per month</span>
            </div>
            <Slider
              value={[acceleratorValue]}
              min={-250}
              max={250}
              step={25}
              onValueChange={(value) => {
                const newValue = value[0];
                setAcceleratorValue(newValue);
                calculateHeuristic(newValue * 100);
              }}
              data-testid="slider-accelerator"
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Lower Budget</span>
              <button 
                className="hover:text-foreground transition-colors cursor-pointer"
                onClick={() => {
                  setAcceleratorValue(0);
                  calculateHeuristic(0);
                }}
                data-testid="button-center-slider"
              >
                Current
              </button>
              <span>Higher Budget</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <div className="text-sm">
                <span className="text-muted-foreground">New Payoff: </span>
                <span className="font-semibold" data-testid="text-heuristic-payoff">
                  {heuristicPayoff} mo
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">
                  {heuristicInterest <= summary.totalInterest ? 'Est. Saved: ' : 'Est. Added: '}
                </span>
                <span 
                  className={`font-semibold ${heuristicInterest <= summary.totalInterest ? 'text-green-500' : 'text-orange-500'}`}
                  data-testid="text-heuristic-savings"
                >
                  {formatCurrency(Math.abs(summary.totalInterest - heuristicInterest), user?.currency)}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                className="flex-1"
                onClick={() => {
                  if (!budget) return;
                  const newBudget = budget.monthlyBudgetCents + (acceleratorValue * 100);
                  reOptimizeMutation.mutate(newBudget);
                }}
                disabled={reOptimizeMutation.isPending || acceleratorValue === 0 || !budget || !preferences}
                data-testid="button-apply-accelerator"
              >
                {reOptimizeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  "Apply & Re-Optimize Plan"
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  if (!originalBudget) return;
                  reOptimizeMutation.mutate(originalBudget);
                }}
                disabled={reOptimizeMutation.isPending || !originalBudget || budget?.monthlyBudgetCents === originalBudget}
                data-testid="button-reset-budget"
              >
                Reset to Original Budget
              </Button>
            </div>
          </CardContent>
        </Card>

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
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>AI Plan Assistant</CardTitle>
                  <CardDescription>
                    Ask questions about your optimization strategy
                  </CardDescription>
                </div>
                {chatMessages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setChatMessages([])}
                    data-testid="button-clear-chat"
                  >
                    Clear Chat
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[400px] border rounded-md bg-muted/30" data-testid="div-chat-container">
                  <div className="p-4 space-y-4">
                    {chatMessages.length === 0 ? (
                      <div className="space-y-4 text-sm" data-testid="div-default-explanation">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                          <div className="space-y-3">
                            <p className="font-medium">Welcome! I can help explain your debt payoff plan.</p>
                            {plan.explanation ? (
                              <div className="whitespace-pre-wrap text-muted-foreground">{plan.explanation}</div>
                            ) : (
                              <>
                                <p className="text-muted-foreground">
                                  Your payment plan has been optimized using advanced constraint programming to find the best allocation of your {formatCurrency(summary.nextPayment, user?.currency)} monthly budget across your {accounts.length} accounts.
                                </p>
                                <p className="text-muted-foreground">
                                  By following this plan, you'll pay off all your debts in {summary.payoffMonths} months while paying only {formatCurrency(summary.totalInterest, user?.currency)} in total interest charges.
                                </p>
                              </>
                            )}
                            <p className="text-muted-foreground italic">
                              Ask me anything! For example: "Why am I paying more to this account?" or "What happens if I pay an extra $100?"
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      chatMessages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex items-start gap-3 p-3 rounded-lg ${
                            message.role === 'user' 
                              ? 'bg-muted ml-8' 
                              : 'bg-primary/10'
                          }`}
                          data-testid={`chat-message-${index}`}
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            message.role === 'user' 
                              ? 'bg-muted-foreground/20' 
                              : 'bg-primary/20'
                          }`}>
                            {message.role === 'user' ? (
                              <User className="h-4 w-4" />
                            ) : (
                              <Bot className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="whitespace-pre-wrap text-sm flex-1">
                            {message.content}
                          </div>
                        </div>
                      ))
                    )}
                    {aiExplainMutation.isPending && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Ask a question about your plan..."
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && aiQuestion.trim() && !aiExplainMutation.isPending) {
                        e.preventDefault();
                        aiExplainMutation.mutate(aiQuestion);
                        setAiQuestion("");
                      }
                    }}
                    className="flex-grow resize-none"
                    rows={2}
                    data-testid="textarea-ai-question"
                  />
                  <Button
                    onClick={() => {
                      if (aiQuestion.trim()) {
                        aiExplainMutation.mutate(aiQuestion);
                        setAiQuestion("");
                      }
                    }}
                    disabled={aiExplainMutation.isPending || !aiQuestion.trim()}
                    data-testid="button-ask-ai"
                  >
                    {aiExplainMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
