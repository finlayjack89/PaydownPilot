import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2, TrendingUp, Wallet, DollarSign, AlertTriangle, CheckCircle2, PiggyBank, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import type { BudgetAnalysisResponse } from "@shared/schema";

interface PersonaInfo {
  id: string;
  transactionCount: number;
  directDebitCount: number;
}

const PERSONA_LABELS: Record<string, { name: string; description: string }> = {
  "user_001": { name: "High Earner", description: "London - High salary, high rent, active credit card user" },
  "user_002": { name: "Family Budget", description: "Mortgage, Council Tax, weekly grocery shops" },
  "user_003": { name: "Gig Worker", description: "Irregular income, low fixed costs, high variable spend" },
  "user_004": { name: "Debt Heavy", description: "High debt repayments, overdraft fees" },
  "user_005": { name: "New Account", description: "Edge case - minimal transaction data" },
};

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}

export default function BudgetFinder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<BudgetAnalysisResponse | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: personasData } = useQuery<{ success: boolean; personas: PersonaInfo[] }>({
    queryKey: ["/api/budget/personas"],
  });

  const analyzeMutation = useMutation({
    mutationFn: async (personaId: string) => {
      return await apiRequest("POST", "/api/budget/analyze", { personaId });
    },
    onSuccess: (data: any) => {
      setAnalysisResult(data.analysis);
      setIsConnecting(false);
    },
    onError: (error: any) => {
      setIsConnecting(false);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze transactions",
        variant: "destructive",
      });
    },
  });

  const applyBudgetMutation = useMutation({
    mutationFn: async (safeToSpendCents: number) => {
      return await apiRequest("POST", "/api/budget/apply-safe-to-spend", { safeToSpendCents });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/current"] });
      toast({
        title: "Budget Applied",
        description: "Your Safe-to-Spend amount has been set as your monthly budget.",
      });
      setLocation("/budget");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply budget",
        variant: "destructive",
      });
    },
  });

  const handleConnect = () => {
    if (!selectedPersona) {
      toast({
        title: "Select a Persona",
        description: "Please select a test persona to simulate bank connection",
        variant: "destructive",
      });
      return;
    }
    setIsConnecting(true);
    setTimeout(() => {
      analyzeMutation.mutate(selectedPersona);
    }, 1500);
  };

  const handleApplyBudget = () => {
    if (analysisResult) {
      applyBudgetMutation.mutate(analysisResult.safeToSpendCents);
    }
  };

  const totalOutgoings = analysisResult
    ? analysisResult.fixedCostsCents + analysisResult.variableEssentialsCents + analysisResult.discretionaryCents
    : 0;

  const incomePercentUsed = analysisResult && analysisResult.averageMonthlyIncomeCents > 0
    ? Math.round((totalOutgoings / analysisResult.averageMonthlyIncomeCents) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/budget")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Logo />
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Building2 className="h-10 w-10 text-primary" />
            Find My Budget
          </h1>
          <p className="text-muted-foreground mt-2">
            Connect your bank to automatically calculate your Safe-to-Spend amount for debt repayment
          </p>
        </div>

        {!analysisResult ? (
          <Card>
            <CardHeader>
              <CardTitle>Connect Your Bank</CardTitle>
              <CardDescription>
                We'll analyze 6 months of transactions to calculate how much you can safely allocate to debt payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-muted rounded-lg border space-y-3">
                <p className="text-sm font-medium">Demo Mode - Select a Test Persona</p>
                <p className="text-xs text-muted-foreground">
                  This simulates TrueLayer bank connection with synthetic data for testing
                </p>
                <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                  <SelectTrigger data-testid="select-persona">
                    <SelectValue placeholder="Select a test persona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {personasData?.personas.map((persona) => (
                      <SelectItem key={persona.id} value={persona.id} data-testid={`persona-${persona.id}`}>
                        <div className="flex flex-col">
                          <span className="font-medium">{PERSONA_LABELS[persona.id]?.name || persona.id}</span>
                          <span className="text-xs text-muted-foreground">
                            {PERSONA_LABELS[persona.id]?.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full h-12"
                onClick={handleConnect}
                disabled={isConnecting || analyzeMutation.isPending}
                data-testid="button-connect-bank"
              >
                {isConnecting || analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing 6 months of data...
                  </>
                ) : (
                  <>
                    <Building2 className="mr-2 h-5 w-5" />
                    Connect Bank (Simulated)
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Your transaction data is analyzed locally and never stored
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Analysis Complete</h3>
                    <p className="text-sm text-muted-foreground">
                      Based on {analysisResult.analysisMonths} month(s) of transaction history
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="p-4 bg-background rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-muted-foreground">Monthly Income</span>
                    </div>
                    <p className="text-2xl font-bold font-mono" data-testid="text-income">
                      {formatMoney(analysisResult.averageMonthlyIncomeCents)}
                    </p>
                  </div>

                  <div className="p-4 bg-background rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <PiggyBank className="h-5 w-5 text-primary" />
                      <span className="text-sm text-muted-foreground">Safe-to-Spend</span>
                    </div>
                    <p className="text-2xl font-bold font-mono text-primary" data-testid="text-safe-to-spend">
                      {formatMoney(analysisResult.safeToSpendCents)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Spending Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Spending vs Income</span>
                    <span className="font-mono">{incomePercentUsed}% used</span>
                  </div>
                  <Progress value={Math.min(incomePercentUsed, 100)} className="h-3" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Fixed Costs</span>
                      <Badge variant="secondary">Committed</Badge>
                    </div>
                    <p className="text-lg font-bold font-mono" data-testid="text-fixed-costs">
                      {formatMoney(analysisResult.fixedCostsCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">Rent, Bills, Direct Debits</p>
                  </div>

                  <div className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Variable Essentials</span>
                      <Badge variant="outline">Necessary</Badge>
                    </div>
                    <p className="text-lg font-bold font-mono" data-testid="text-variable">
                      {formatMoney(analysisResult.variableEssentialsCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">Groceries, Transport, Health</p>
                  </div>

                  <div className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Discretionary</span>
                      <Badge variant="default">Flexible</Badge>
                    </div>
                    <p className="text-lg font-bold font-mono" data-testid="text-discretionary">
                      {formatMoney(analysisResult.discretionaryCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">Entertainment, Dining</p>
                  </div>
                </div>

                {analysisResult.detectedDebtPayments.length > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg mt-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Existing Debt Payments Detected</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          We found payments to: {analysisResult.detectedDebtPayments.join(", ")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Consider adding these accounts to your debt payoff plan
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setAnalysisResult(null);
                  setSelectedPersona("");
                }}
                data-testid="button-analyze-again"
              >
                Analyze Another Account
              </Button>
              <Button
                className="flex-1"
                onClick={handleApplyBudget}
                disabled={applyBudgetMutation.isPending || user?.id === "guest-user"}
                data-testid="button-apply-budget"
              >
                {applyBudgetMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TrendingUp className="mr-2 h-4 w-4" />
                )}
                Apply to Budget
              </Button>
            </div>

            {user?.id === "guest-user" && (
              <p className="text-xs text-muted-foreground text-center">
                Create an account to save your budget
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
