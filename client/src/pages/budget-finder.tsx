import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2, TrendingUp, Wallet, DollarSign, AlertTriangle, CheckCircle2, PiggyBank, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { EnrichmentProgressModal } from "@/components/enrichment-progress-modal";
import type { BudgetAnalysisResponse } from "@shared/schema";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}

export default function BudgetFinder() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const { user } = useAuth();
  const [analysisResult, setAnalysisResult] = useState<BudgetAnalysisResponse | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  const [enrichmentJobId, setEnrichmentJobId] = useState<string | null>(null);

  // Check TrueLayer connection status
  const { data: connectionStatus } = useQuery<{ connected: boolean; accounts: any[] }>({
    queryKey: ["/api/truelayer/status"],
  });

  // Handle OAuth callback - check for ?connected=true in URL
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("connected") === "true") {
      setLocation("/budget-finder", { replace: true });
      startEnrichmentAfterConnection();
    } else if (params.get("error")) {
      const error = params.get("error");
      setLocation("/budget-finder", { replace: true });
      toast({
        title: "Connection Failed",
        description: error || "Failed to connect bank account",
        variant: "destructive",
      });
    }
  }, [searchString]);

  const startEnrichmentAfterConnection = async () => {
    try {
      const response = await apiRequest("POST", "/api/budget/start-enrichment", { forceRefresh: true });
      const data = await response.json();
      
      if (data.cached) {
        // Use cached data
        setAnalysisResult({
          averageMonthlyIncomeCents: data.result.analysis.averageMonthlyIncomeCents,
          fixedCostsCents: data.result.analysis.fixedCostsCents,
          variableEssentialsCents: data.result.analysis.variableEssentialsCents || 0,
          discretionaryCents: data.result.analysis.discretionaryCents,
          safeToSpendCents: data.result.analysis.safeToSpendCents,
          detectedDebtPayments: data.result.detectedDebts?.map((d: any) => ({
            description: d.merchant_name || d.description,
            amountCents: d.amount_cents,
            type: "debt",
          })) || [],
          breakdown: data.result.analysis.breakdown || {},
          analysisMonths: 1,
        });
        toast({
          title: "Analysis Complete",
          description: "Your budget has been calculated from your transaction history.",
        });
      } else if (data.jobId) {
        setEnrichmentJobId(data.jobId);
        setShowEnrichmentModal(true);
      }
    } catch (error: any) {
      toast({
        title: "Enrichment Failed",
        description: error.message || "Failed to analyze transactions",
        variant: "destructive",
      });
    }
  };

  const handleConnectBank = async () => {
    if (user?.id === "guest-user") {
      toast({
        title: "Account Required",
        description: "Please create an account to connect your bank.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      const response = await fetch(`/api/truelayer/auth-url?returnUrl=${encodeURIComponent("/budget-finder")}`, {
        credentials: "include",
      });
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.message || "Failed to get authentication URL");
      }
    } catch (error: any) {
      setIsConnecting(false);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to initiate bank connection",
        variant: "destructive",
      });
    }
  };

  const handleEnrichmentComplete = (result: any) => {
    setShowEnrichmentModal(false);
    setEnrichmentJobId(null);
    
    if (result?.analysis) {
      setAnalysisResult({
        averageMonthlyIncomeCents: result.analysis.averageMonthlyIncomeCents,
        fixedCostsCents: result.analysis.fixedCostsCents,
        variableEssentialsCents: result.analysis.variableEssentialsCents || 0,
        discretionaryCents: result.analysis.discretionaryCents,
        safeToSpendCents: result.analysis.safeToSpendCents,
        detectedDebtPayments: result.detectedDebts?.map((d: any) => ({
          description: d.merchant_name || d.description,
          amountCents: d.amount_cents,
          type: "debt",
        })) || [],
        breakdown: result.analysis.breakdown || {},
        analysisMonths: 1,
      });
    }
    
    toast({
      title: "Analysis Complete",
      description: "Your budget has been calculated successfully.",
    });
  };

  const handleEnrichmentError = (error: string) => {
    setShowEnrichmentModal(false);
    setEnrichmentJobId(null);
    toast({
      title: "Analysis Failed",
      description: error || "Failed to analyze transactions",
      variant: "destructive",
    });
  };

  const handleCancelEnrichment = async () => {
    if (enrichmentJobId) {
      try {
        await apiRequest("POST", `/api/budget/cancel-enrichment/${enrichmentJobId}`);
      } catch (e) {
        // Ignore cancel errors
      }
    }
  };

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

  const hasExistingConnection = connectionStatus?.connected && connectionStatus.accounts.length > 0;

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
                We'll analyze your transactions to calculate how much you can safely allocate to debt payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {hasExistingConnection && (
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Bank account already connected</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    You have {connectionStatus.accounts.length} account{connectionStatus.accounts.length !== 1 ? "s" : ""} connected. 
                    Click below to analyze your transactions.
                  </p>
                </div>
              )}

              <Button
                className="w-full h-12"
                onClick={hasExistingConnection ? startEnrichmentAfterConnection : handleConnectBank}
                disabled={isConnecting}
                data-testid="button-connect-bank"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Connecting...
                  </>
                ) : hasExistingConnection ? (
                  <>
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Analyze My Transactions
                  </>
                ) : (
                  <>
                    <Building2 className="mr-2 h-5 w-5" />
                    Connect Bank via Open Banking
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Your transaction data is securely processed and never shared with third parties
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
                      Based on your transaction history
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
                          We found payments to: {analysisResult.detectedDebtPayments.map(d => d.description).join(", ")}
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

      {/* Enrichment Progress Modal */}
      <EnrichmentProgressModal
        open={showEnrichmentModal}
        onOpenChange={setShowEnrichmentModal}
        jobId={enrichmentJobId}
        onComplete={handleEnrichmentComplete}
        onError={handleEnrichmentError}
        onCancel={handleCancelEnrichment}
      />
    </div>
  );
}
