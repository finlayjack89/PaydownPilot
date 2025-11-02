import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRight, ArrowLeft, Plus, Trash2, Calendar, DollarSign } from "lucide-react";
import { parseCurrencyToCents, formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Budget, Account } from "@shared/schema";

interface FutureBudgetChange {
  effectiveDate: string;
  newMonthlyBudgetCents: number;
}

interface LumpSumPayment {
  paymentDate: string;
  amountCents: number;
  targetLenderName: string | null;
}

export default function Budget() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [futureChanges, setFutureChanges] = useState<FutureBudgetChange[]>([]);
  const [lumpSumPayments, setLumpSumPayments] = useState<LumpSumPayment[]>([]);

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

  // Handle 404 as "no budget yet" rather than an error
  const hasBudget = existingBudget && !budgetError;

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
                    <Label htmlFor="changeAmount">New Monthly Budget</Label>
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
            disabled={saveMutation.isPending}
            className="h-12 px-8"
            data-testid="button-continue"
          >
            Continue to Preferences
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
