import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

const financeTips = [
  "Paying off high-interest debt first can save you thousands over time.",
  "Even small extra payments can significantly reduce your total interest.",
  "The avalanche method targets high APR accounts first for maximum savings.",
  "The snowball method pays off smallest balances first for quick wins.",
  "Setting up automatic payments helps avoid late fees and missed payments.",
  "Review your credit card statements monthly to catch errors early.",
  "A 0% APR promotional period can be a powerful debt payoff tool.",
  "Your credit score may improve as you pay down your utilization ratio.",
  "Consolidating multiple debts can simplify your payment schedule.",
  "Track your progress monthly to stay motivated on your debt-free journey.",
];

export default function Generate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [tipOpacity, setTipOpacity] = useState(1);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tipIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: accounts, isSuccess: accountsLoaded } = useQuery({ queryKey: ["/api/accounts"] });
  const { data: budget, isSuccess: budgetLoaded } = useQuery({ queryKey: ["/api/budget"] });
  const { data: preferences, isSuccess: preferencesLoaded } = useQuery({ queryKey: ["/api/preferences"] });

  // Smooth progress animation effect
  useEffect(() => {
    if (displayProgress < progress) {
      progressIntervalRef.current = setInterval(() => {
        setDisplayProgress(prev => {
          if (prev >= progress) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            return progress;
          }
          return prev + 1;
        });
      }, 50);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [progress, displayProgress]);

  // Rotating tips effect with fade animation
  useEffect(() => {
    tipIntervalRef.current = setInterval(() => {
      setTipOpacity(0);
      setTimeout(() => {
        setCurrentTipIndex(prev => (prev + 1) % financeTips.length);
        setTipOpacity(1);
      }, 500);
    }, 5000);
    
    return () => {
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    };
  }, []);

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
      setStatusMessage("Resolution generated successfully!");
      
      // Ensure the plan is available before redirecting
      await queryClient.invalidateQueries({ queryKey: ["/api/plans/latest"] });
      await queryClient.refetchQueries({ queryKey: ["/api/plans/latest"] });
      
      setTimeout(() => {
        setLocation("/plan");
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
                ? "Resolution Failed"
                : generateMutation.isSuccess
                ? "Resolution Ready!"
                : "Resolving Your Debt"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!generateMutation.isError && (
              <>
                <p className="text-lg text-muted-foreground">{statusMessage}</p>
                <div className="space-y-2">
                  <Progress value={displayProgress} className="w-full transition-all duration-200" />
                  <p className="text-xs text-muted-foreground text-right">{displayProgress}%</p>
                </div>
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
                <li className={displayProgress >= 10 ? "text-foreground" : ""}>
                  {displayProgress >= 10 ? "✓" : "•"} Analyzing your {accounts?.length || 0} accounts
                </li>
                <li className={displayProgress >= 20 ? "text-foreground" : ""}>
                  {displayProgress >= 20 ? "✓" : "•"} Calculating minimum payments and interest charges
                </li>
                <li className={displayProgress >= 40 ? "text-foreground" : ""}>
                  {displayProgress >= 40 ? "✓" : "•"} Running optimization algorithms (120-month horizon)
                </li>
                <li className={displayProgress >= 60 ? "text-foreground" : ""}>
                  {displayProgress >= 60 ? "✓" : "•"} Finding the best payment strategy for your goals
                </li>
                <li className={displayProgress >= 80 ? "text-foreground" : ""}>
                  {displayProgress >= 80 ? "✓" : "•"} Generating month-by-month payment schedule
                </li>
              </ul>
            </Card>
            
            <Card className="p-6 bg-primary/5 border-primary/20">
              <div 
                className="flex items-start gap-3 transition-opacity duration-500"
                style={{ opacity: tipOpacity }}
                data-testid="finance-tip"
              >
                <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-primary mb-1">Did you know?</p>
                  <p className="text-sm text-muted-foreground">{financeTips[currentTipIndex]}</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
