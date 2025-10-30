import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

export default function Generate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Initializing...");

  const { data: accounts, isSuccess: accountsLoaded } = useQuery({ queryKey: ["/api/accounts"] });
  const { data: budget, isSuccess: budgetLoaded } = useQuery({ queryKey: ["/api/budget"] });
  const { data: preferences, isSuccess: preferencesLoaded } = useQuery({ queryKey: ["/api/preferences"] });

  const generateMutation = useMutation({
    mutationFn: async () => {
      setProgress(10);
      setStatusMessage("Preparing your financial data...");
      
      const planRequest = {
        accounts: accounts.map((acc: any) => ({
          lenderName: acc.lenderName,
          accountType: acc.accountType,
          currentBalanceCents: acc.currentBalanceCents,
          aprStandardBps: acc.aprStandardBps,
          paymentDueDay: acc.paymentDueDay,
          minPaymentRule: {
            fixedCents: acc.minPaymentRuleFixedCents,
            percentageBps: acc.minPaymentRulePercentageBps,
            includesInterest: acc.minPaymentRuleIncludesInterest,
          },
          promoEndDate: acc.promoEndDate,
          promoDurationMonths: acc.promoDurationMonths,
          accountOpenDate: acc.accountOpenDate,
          notes: acc.notes,
        })),
        budget: {
          monthlyBudgetCents: budget.monthlyBudgetCents,
          futureChanges: budget.futureChanges || [],
          lumpSumPayments: budget.lumpSumPayments || [],
        },
        preferences: {
          strategy: preferences.strategy,
          paymentShape: preferences.paymentShape,
        },
        planStartDate: new Date().toISOString().split('T')[0],
      };

      setProgress(30);
      setStatusMessage("Running optimization engine...");
      
      const result = await apiRequest("POST", "/api/plans/generate", planRequest);
      
      setProgress(80);
      setStatusMessage("Generating AI explanation...");
      
      return result;
    },
    onSuccess: async (data) => {
      setProgress(100);
      setStatusMessage("Plan generated successfully!");
      
      // Ensure the plan is available before redirecting
      await queryClient.invalidateQueries({ queryKey: ["/api/plans/latest"] });
      await queryClient.refetchQueries({ queryKey: ["/api/plans/latest"] });
      
      setTimeout(() => {
        setLocation("/dashboard");
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: "Plan generation failed",
        description: error.message || "Could not generate plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    // Wait for all queries to finish loading before checking
    if (!accountsLoaded || !budgetLoaded || !preferencesLoaded) {
      return;
    }

    if (accounts && budget && preferences) {
      // Auto-start generation
      setTimeout(() => {
        generateMutation.mutate();
      }, 1000);
    } else if (accountsLoaded && !budget) {
      // Budget is missing - show error
      toast({
        title: "Budget Required",
        description: "Please set your monthly budget before generating a plan.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/budget");
      }, 2000);
    } else if (accountsLoaded && !preferences) {
      // Preferences missing
      toast({
        title: "Preferences Required",
        description: "Please set your preferences before generating a plan.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/preferences");
      }, 2000);
    }
  }, [accounts, budget, preferences, accountsLoaded, budgetLoaded, preferencesLoaded]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-16">
        <Card className="text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              {generateMutation.isError ? (
                <div className="rounded-full bg-destructive/10 p-6">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                </div>
              ) : generateMutation.isSuccess ? (
                <div className="rounded-full bg-primary/10 p-6">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                </div>
              ) : (
                <div className="rounded-full bg-primary/10 p-6">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                </div>
              )}
            </div>
            <CardTitle className="text-3xl font-bold">
              {generateMutation.isError
                ? "Generation Failed"
                : generateMutation.isSuccess
                ? "Plan Ready!"
                : "Generating Your Plan"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!generateMutation.isError && (
              <>
                <p className="text-lg text-muted-foreground">{statusMessage}</p>
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  This may take up to 60 seconds...
                </p>
              </>
            )}

            {generateMutation.isError && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  {generateMutation.error instanceof Error
                    ? generateMutation.error.message
                    : "An error occurred while generating your plan"}
                </p>
                <div className="flex gap-4 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/preferences")}
                    data-testid="button-back-to-preferences"
                  >
                    Back to Preferences
                  </Button>
                  <Button
                    onClick={() => generateMutation.mutate()}
                    data-testid="button-retry"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {generateMutation.isSuccess && (
              <p className="text-sm text-muted-foreground">
                Redirecting to your dashboard...
              </p>
            )}
          </CardContent>
        </Card>

        {generateMutation.isPending && (
          <div className="mt-8 space-y-4">
            <Card className="p-6">
              <h3 className="font-medium mb-3">What's happening now:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Analyzing your {accounts?.length || 0} accounts</li>
                <li>• Calculating minimum payments and interest charges</li>
                <li>• Running optimization algorithms (120-month horizon)</li>
                <li>• Finding the best payment strategy for your goals</li>
                <li>• Generating month-by-month payment schedule</li>
              </ul>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
