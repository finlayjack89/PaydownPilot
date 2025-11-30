import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRight, ArrowLeft, Plus, Trash2, Calendar, DollarSign, AlertTriangle } from "lucide-react";
import { parseCurrencyToCents, formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FindMyBudgetButton } from "@/components/find-my-budget-button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, TrendingUp, CheckCircle2 } from "lucide-react";
import type { Budget, Account } from "@shared/schema";

// Calculate minimum payment for a single account based on its rules
function calculateMinimumPayment(account: Account): number {
  const balance = account.currentBalanceCents;
  const fixedCents = account.minPaymentRuleFixedCents || 0;
  const percentageBps = account.minPaymentRulePercentageBps || 0;
  
  // Calculate percentage component (in cents)
  // percentageBps is in basis points (e.g., 250 = 2.5%)
  const percentageAmount = Math.ceil((balance * percentageBps) / 10000);
  
  // Minimum payment is the greater of fixed amount or percentage
  const rawMinimum = Math.max(fixedCents, percentageAmount);
  
  // But never more than the total balance
  return Math.min(rawMinimum, balance);
}

// Calculate total minimum payments across all accounts
function calculateTotalMinimumPayments(accounts: Account[]): number {
  return accounts.reduce((total, account) => total + calculateMinimumPayment(account), 0);
}

interface FutureBudgetChange {
  effectiveDate: string;
  newMonthlyBudgetCents: number;
}

interface LumpSumPayment {
  paymentDate: string;
  amountCents: number;
  targetLenderName: string | null;
}

interface AnalyzedBudget {
  currentBudgetCents: number;
  potentialBudgetCents: number | null;
  savings?: {
    monthsFaster: number;
    interestSavedCents: number;
  };
}

export default function Budget() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [futureChanges, setFutureChanges] = useState<FutureBudgetChange[]>([]);
  const [lumpSumPayments, setLumpSumPayments] = useState<LumpSumPayment[]>([]);
  const [selectedBudgetType, setSelectedBudgetType] = useState<"manual" | "current" | "potential">("manual");

  // Future change form
  const [newChangeDate, setNewChangeDate] = useState("");
  const [newChangeAmount, setNewChangeAmount] = useState("");

  // Lump sum form
  const [newLumpDate, setNewLumpDate] = useState("");
  const [newLumpAmount, setNewLumpAmount] = useState("");
  const [newLumpTarget, setNewLumpTarget] = useState("");

  const { data: existingBudget, isError: budgetError, error: budgetErrorData } = useQuery<Budget>({
    queryKey: ["/api/budget"],
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  // Fetch analyzed budgets
  const { data: analyzedBudget } = useQuery<AnalyzedBudget>({
    queryKey: ["/api/budget/current"],
    retry: false,
  });

  // Handle 404 as "no budget yet" rather than an error
  const hasBudget = existingBudget && !budgetError;

  // Calculate total minimum payments across all accounts
  const totalMinimumPayments = useMemo(() => {
    if (!accounts || accounts.length === 0) return 0;
    return calculateTotalMinimumPayments(accounts);
  }, [accounts]);

  // Check if current budget meets minimum payment requirements
  const budgetCents = parseCurrencyToCents(monthlyBudget) || 0;
  const isBudgetSufficient = budgetCents >= totalMinimumPayments;
  const budgetShortfall = totalMinimumPayments - budgetCents;

  useEffect(() => {
    if (existingBudget && !budgetError) {
      setMonthlyBudget((existingBudget.monthlyBudgetCents / 100).toString());
      
      // Transform tuple arrays to objects, handle both tuple and object formats
      const transformedFutureChanges = (existingBudget.futureChanges || []).map((item: any) => {
        // Handle both tuple [date, amount] and object {effectiveDate, newMonthlyBudgetCents} formats
        if (Array.isArray(item)) {
          const [effectiveDate, newMonthlyBudgetCents] = item;
          return { effectiveDate, newMonthlyBudgetCents };
        }
        return item;
      });
      setFutureChanges(transformedFutureChanges);
      
      const transformedLumpSums = (existingBudget.lumpSumPayments || []).map((item: any) => {
        // Handle both tuple [date, amount] and object {paymentDate, amountCents, targetLenderName} formats
        if (Array.isArray(item)) {
          const [paymentDate, amountCents] = item;
          return { paymentDate, amountCents, targetLenderName: null };
        }
        return item;
      });
      setLumpSumPayments(transformedLumpSums);
    }
  }, [existingBudget, budgetError]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/budget", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
      toast({
        title: "Budget saved",
        description: "Your monthly budget has been saved successfully.",
      });
      setLocation("/preferences");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save budget. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddFutureChange = () => {
    if (!newChangeDate || !newChangeAmount) {
      toast({
        title: "Missing information",
        description: "Please enter both date and amount",
        variant: "destructive",
      });
      return;
    }

    const amountCents = parseCurrencyToCents(newChangeAmount);
    if (amountCents <= 0) {
      toast({
        title: "Invalid amount",
        description: "Amount must be greater than zero",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate dates
    if (futureChanges.some(c => c.effectiveDate === newChangeDate)) {
      toast({
        title: "Duplicate date",
        description: "A budget change already exists for this date",
        variant: "destructive",
      });
      return;
    }

    // Check chronological ordering (future date)
    const today = new Date().toISOString().split('T')[0];
    if (newChangeDate <= today) {
      toast({
        title: "Invalid date",
        description: "Budget change date must be in the future",
        variant: "destructive",
      });
      return;
    }

    setFutureChanges([
      ...futureChanges,
      { effectiveDate: newChangeDate, newMonthlyBudgetCents: amountCents }
    ].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)));
    setNewChangeDate("");
    setNewChangeAmount("");
  };

  const handleRemoveFutureChange = (index: number) => {
    setFutureChanges(futureChanges.filter((_, i) => i !== index));
  };

  const handleAddLumpSum = () => {
    if (!newLumpDate || !newLumpAmount) {
      toast({
        title: "Missing information",
        description: "Please enter both date and amount",
        variant: "destructive",
      });
      return;
    }

    const amountCents = parseCurrencyToCents(newLumpAmount);
    if (amountCents <= 0) {
      toast({
        title: "Invalid amount",
        description: "Amount must be greater than zero",
        variant: "destructive",
      });
      return;
    }

    // Validate future date
    const today = new Date().toISOString().split('T')[0];
    if (newLumpDate <= today) {
      toast({
        title: "Invalid date",
        description: "Payment date must be in the future",
        variant: "destructive",
      });
      return;
    }

    // Validate target account exists if specified (skip validation for __ANY__)
    if (newLumpTarget && newLumpTarget !== "__ANY__" && accounts) {
      const validTarget = accounts.some((acc: any) => acc.lenderName === newLumpTarget);
      if (!validTarget) {
        toast({
          title: "Invalid target account",
          description: "Please select a valid account from the list",
          variant: "destructive",
        });
        return;
      }
    }

    setLumpSumPayments([
      ...lumpSumPayments,
      { 
        paymentDate: newLumpDate, 
        amountCents,
        targetLenderName: (newLumpTarget === "__ANY__" || !newLumpTarget) ? null : newLumpTarget
      }
    ].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate)));
    setNewLumpDate("");
    setNewLumpAmount("");
    setNewLumpTarget("");
  };

  const handleRemoveLumpSum = (index: number) => {
    setLumpSumPayments(lumpSumPayments.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    if (!monthlyBudget || parseFloat(monthlyBudget) <= 0) {
      toast({
        title: "Invalid budget",
        description: "Please enter a valid monthly budget amount",
        variant: "destructive",
      });
      return;
    }

    // Convert objects to tuples for the API
    const futureChangesAsTuples = futureChanges.map((change) => 
      [change.effectiveDate, change.newMonthlyBudgetCents] as [string, number]
    );
    const lumpSumsAsTuples = lumpSumPayments.map((payment) => 
      [payment.paymentDate, payment.amountCents] as [string, number]
    );

    saveMutation.mutate({
      monthlyBudgetCents: parseCurrencyToCents(monthlyBudget),
      futureChanges: futureChangesAsTuples,
      lumpSumPayments: lumpSumsAsTuples,
    });
  };

  const currencySymbol = user?.currency === "GBP" ? "£" : user?.currency === "EUR" ? "€" : "$";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Set Your Budget</h1>
          <p className="text-muted-foreground mt-2">
            Configure your monthly budget and plan for future changes
          </p>
        </div>

        <Tabs defaultValue="monthly" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="monthly">Monthly Budget</TabsTrigger>
            <TabsTrigger value="future">Future Changes</TabsTrigger>
            <TabsTrigger value="lumpsum">Lump Sum Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Monthly Budget</CardTitle>
                <CardDescription>
                  Enter the total amount you can allocate to debt payments each month
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Show analyzed budget options if available */}
                {analyzedBudget && (
                  <div className="space-y-4">
                    <Alert className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>Budget analysis complete!</span>
                          {analyzedBudget.potentialBudgetCents && (
                            <Badge variant="secondary" className="ml-2">
                              {analyzedBudget.savings ? `Save ${formatCurrency(analyzedBudget.savings.interestSavedCents, user?.currency || "USD")} in interest` : "Optimized"}
                            </Badge>
                          )}
                        </div>
                        <FindMyBudgetButton 
                          size="sm"
                          variant="outline"
                        />
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Select Budget Option</Label>
                      <div className="grid gap-3">
                        {/* Manual Budget Option */}
                        <div
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover-elevate ${
                            selectedBudgetType === "manual" ? "border-primary bg-primary/5" : "border-border"
                          }`}
                          onClick={() => {
                            setSelectedBudgetType("manual");
                            setMonthlyBudget("");
                          }}
                          data-testid="budget-option-manual"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              <div className={`w-4 h-4 rounded-full border-2 ${
                                selectedBudgetType === "manual" 
                                  ? "border-primary bg-primary" 
                                  : "border-muted-foreground"
                              }`}>
                                {selectedBudgetType === "manual" && (
                                  <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">Enter Budget Manually</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Input your own monthly budget amount
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Current Budget Option */}
                        <div
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover-elevate ${
                            selectedBudgetType === "current" ? "border-primary bg-primary/5" : "border-border"
                          }`}
                          onClick={() => {
                            setSelectedBudgetType("current");
                            setMonthlyBudget((analyzedBudget.currentBudgetCents / 100).toString());
                          }}
                          data-testid="budget-option-current"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              <div className={`w-4 h-4 rounded-full border-2 ${
                                selectedBudgetType === "current" 
                                  ? "border-primary bg-primary" 
                                  : "border-muted-foreground"
                              }`}>
                                {selectedBudgetType === "current" && (
                                  <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="font-medium flex items-center gap-2">
                                <Calculator className="w-4 h-4" />
                                Use Analyzed Budget
                                <Badge variant="secondary">Recommended</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {formatCurrency(analyzedBudget.currentBudgetCents, user?.currency || "USD")}/month based on your transaction history
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Potential Budget Option */}
                        {analyzedBudget.potentialBudgetCents && (
                          <div
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover-elevate ${
                              selectedBudgetType === "potential" ? "border-primary bg-primary/5" : "border-border"
                            }`}
                            onClick={() => {
                              setSelectedBudgetType("potential");
                              setMonthlyBudget((analyzedBudget.potentialBudgetCents! / 100).toString());
                            }}
                            data-testid="budget-option-potential"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                <div className={`w-4 h-4 rounded-full border-2 ${
                                  selectedBudgetType === "potential" 
                                    ? "border-primary bg-primary" 
                                    : "border-muted-foreground"
                                }`}>
                                  {selectedBudgetType === "potential" && (
                                    <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                                  )}
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="font-medium flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                  Use Optimized Budget
                                  <Badge variant="default">Fastest Payoff</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {formatCurrency(analyzedBudget.potentialBudgetCents, user?.currency || "USD")}/month with spending optimizations
                                </div>
                                {analyzedBudget.savings && (
                                  <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                                    Pay off debt {analyzedBudget.savings.monthsFaster} months faster and save {formatCurrency(analyzedBudget.savings.interestSavedCents, user?.currency || "USD")} in interest
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Manual input field when manual is selected */}
                    {selectedBudgetType === "manual" && (
                      <div className="space-y-2 pt-2">
                        <Label htmlFor="monthlyBudget" className="text-sm font-medium">
                          Enter Monthly Payment Budget
                        </Label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                            {currencySymbol}
                          </span>
                          <Input
                            id="monthlyBudget"
                            type="text"
                            placeholder="500.00"
                            value={monthlyBudget}
                            onChange={(e) => setMonthlyBudget(e.target.value)}
                            className="h-16 pl-8 pr-4 text-2xl font-mono font-semibold text-right"
                            data-testid="input-monthly-budget"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This should be the total amount available for all debt payments, not per account
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Show manual input and Find My Budget button when no analyzed budget exists */}
                {!analyzedBudget && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="monthlyBudget" className="text-sm font-medium">
                        Monthly Payment Budget
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                          {currencySymbol}
                        </span>
                        <Input
                          id="monthlyBudget"
                          type="text"
                          placeholder="500.00"
                          value={monthlyBudget}
                          onChange={(e) => setMonthlyBudget(e.target.value)}
                          className="h-16 pl-8 pr-4 text-2xl font-mono font-semibold text-right"
                          data-testid="input-monthly-budget"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This should be the total amount available for all debt payments, not per account
                      </p>
                    </div>

                    {/* AI Budget Analysis */}
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground px-2">OR</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div className="flex flex-col items-center space-y-2 py-4">
                        <p className="text-sm text-muted-foreground text-center">
                          Let AI analyze your spending and suggest an optimal budget
                        </p>
                        <FindMyBudgetButton variant="outline" />
                      </div>
                    </div>
                  </>
                )}

                {/* Minimum Payment Requirements Display */}
                {accounts && accounts.length > 0 && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">Minimum Payment Requirement</h3>
                      <Badge variant="outline" className="font-mono" data-testid="badge-minimum-payments">
                        {formatCurrency(totalMinimumPayments, user?.currency)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Combined minimum payments for all {accounts.length} account{accounts.length > 1 ? 's' : ''} based on your lenders' rules
                    </p>
                    
                    {/* Warning if budget is below minimum */}
                    {monthlyBudget && !isBudgetSufficient && (
                      <Alert variant="destructive" className="mt-2" data-testid="alert-budget-insufficient">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="ml-2">
                          <strong>Budget too low:</strong> Your budget is {formatCurrency(budgetShortfall, user?.currency)} short of the minimum required.
                          You need at least {formatCurrency(totalMinimumPayments, user?.currency)} to cover all minimum payments.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Success message if budget is sufficient */}
                    {monthlyBudget && isBudgetSufficient && budgetCents > 0 && (
                      <Alert className="mt-2 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20" data-testid="alert-budget-sufficient">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="ml-2 text-green-700 dark:text-green-400">
                          Budget meets minimum requirements. Extra {formatCurrency(budgetCents - totalMinimumPayments, user?.currency)} will be optimized across accounts.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                <div className="rounded-lg bg-muted p-6 space-y-3">
                  <h3 className="font-medium">Budgeting Tips</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Your budget should be realistic and sustainable</li>
                    <li>• Don't forget to leave room for minimum payments on all accounts</li>
                    <li>• You can plan future changes in the "Future Changes" tab</li>
                    <li>• The optimizer will find the best way to allocate this amount</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="future" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Future Budget Changes</CardTitle>
                <CardDescription>
                  Plan for expected changes to your monthly budget (raise, new job, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <h4 className="font-medium text-sm">How it works</h4>
                  <p className="text-xs text-muted-foreground">
                    Enter the <strong>new absolute budget amount</strong> that will be available starting on the effective date.
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                    <li>• <strong>Increase:</strong> If your current budget is $500 and you get a raise, enter the new amount like $700</li>
                    <li>• <strong>Decrease:</strong> If your current budget is $500 but will drop to $300, enter $300 (not -$200)</li>
                  </ul>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="changeDate">Effective Date</Label>
                    <Input
                      id="changeDate"
                      type="date"
                      value={newChangeDate}
                      onChange={(e) => setNewChangeDate(e.target.value)}
                      className="h-12"
                      data-testid="input-future-change-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="changeAmount">
                      New Monthly Budget
                      <span className="text-xs text-muted-foreground font-normal ml-1">(absolute amount)</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
                        {currencySymbol}
                      </span>
                      <Input
                        id="changeAmount"
                        type="text"
                        placeholder="600.00"
                        value={newChangeAmount}
                        onChange={(e) => setNewChangeAmount(e.target.value)}
                        className="h-12 pl-7 font-mono"
                        data-testid="input-future-change-amount"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter what your budget will be, not the change amount
                    </p>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleAddFutureChange}
                      className="h-12 w-full"
                      data-testid="button-add-future-change"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Change
                    </Button>
                  </div>
                </div>

                {futureChanges.length > 0 && (
                  <div className="space-y-2">
                    <Label>Scheduled Changes</Label>
                    <div className="space-y-2">
                      {futureChanges.map((change, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-4 p-4 rounded-lg border"
                        >
                          <div className="flex items-center gap-4">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {new Date(change.effectiveDate).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                New budget: {formatCurrency(change.newMonthlyBudgetCents, user?.currency || "USD")}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFutureChange(index)}
                            data-testid={`button-remove-future-change-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {futureChanges.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No future budget changes planned</p>
                    <p className="text-sm">Add one above if you expect your budget to change</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lumpsum" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Lump Sum Payments</CardTitle>
                <CardDescription>
                  Plan one-time extra payments (tax refund, bonus, windfall, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="lumpDate">Payment Date</Label>
                    <Input
                      id="lumpDate"
                      type="date"
                      value={newLumpDate}
                      onChange={(e) => setNewLumpDate(e.target.value)}
                      className="h-12"
                      data-testid="input-lump-sum-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lumpAmount">Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
                        {currencySymbol}
                      </span>
                      <Input
                        id="lumpAmount"
                        type="text"
                        placeholder="1000.00"
                        value={newLumpAmount}
                        onChange={(e) => setNewLumpAmount(e.target.value)}
                        className="h-12 pl-7 font-mono"
                        data-testid="input-lump-sum-amount"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lumpTarget">Target Account (Optional)</Label>
                    <Select value={newLumpTarget} onValueChange={setNewLumpTarget}>
                      <SelectTrigger className="h-12" data-testid="select-lump-sum-target">
                        <SelectValue placeholder="Any account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ANY__">Any account (optimizer decides)</SelectItem>
                        {accounts?.map((acc: any) => (
                          <SelectItem key={acc.id} value={acc.lenderName}>
                            {acc.lenderName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleAddLumpSum}
                      className="h-12 w-full"
                      data-testid="button-add-lump-sum"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Payment
                    </Button>
                  </div>
                </div>

                {lumpSumPayments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Scheduled Lump Sum Payments</Label>
                    <div className="space-y-2">
                      {lumpSumPayments.map((payment, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-4 p-4 rounded-lg border"
                        >
                          <div className="flex items-center gap-4">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {formatCurrency(payment.amountCents, user?.currency || "USD")}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(payment.paymentDate).toLocaleDateString()}
                                {payment.targetLenderName && ` → ${payment.targetLenderName}`}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveLumpSum(index)}
                            data-testid={`button-remove-lump-sum-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lumpSumPayments.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No lump sum payments planned</p>
                    <p className="text-sm">Add one above if you're expecting extra money</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation("/accounts")}
            className="h-12"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Accounts
          </Button>
          <Button
            onClick={handleContinue}
            disabled={saveMutation.isPending || (accounts && accounts.length > 0 && !isBudgetSufficient)}
            className="h-12 px-8"
            data-testid="button-continue"
          >
            {!isBudgetSufficient && accounts && accounts.length > 0 
              ? "Budget Below Minimum" 
              : "Continue to Preferences"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
