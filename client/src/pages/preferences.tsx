import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRight, ArrowLeft, Target, DollarSign, Zap, Trophy, TrendingDown } from "lucide-react";
import { OptimizationStrategy, PaymentShape } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const strategyOptions = [
  {
    value: OptimizationStrategy.MINIMIZE_TOTAL_INTEREST,
    label: "Minimize Total Interest",
    description: "Pay the least interest over time (Avalanche method)",
    icon: Target,
  },
  {
    value: OptimizationStrategy.TARGET_MAX_BUDGET,
    label: "Pay Off ASAP",
    description: "Use your full budget to become debt-free fastest",
    icon: Zap,
  },
  {
    value: OptimizationStrategy.PAY_OFF_IN_PROMO,
    label: "Clear Promo Balances",
    description: "Prioritize paying off promotional periods before they end",
    icon: Trophy,
  },
  {
    value: OptimizationStrategy.MINIMIZE_MONTHLY_SPEND,
    label: "Minimize Monthly Spend",
    description: "Pay the bare minimum to stay on track",
    icon: TrendingDown,
  },
];

const shapeOptions = [
  {
    value: PaymentShape.OPTIMIZED_MONTH_TO_MONTH,
    label: "Variable Payments",
    description: "Optimize payment amounts each month for best results",
  },
  {
    value: PaymentShape.LINEAR_PER_ACCOUNT,
    label: "Consistent Payments",
    description: "Same payment amount for each account until paid off",
  },
];

export default function Preferences() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [strategy, setStrategy] = useState<OptimizationStrategy>(
    OptimizationStrategy.MINIMIZE_TOTAL_INTEREST
  );
  const [paymentShape, setPaymentShape] = useState<PaymentShape>(
    PaymentShape.OPTIMIZED_MONTH_TO_MONTH
  );

  const { data: existingPrefs } = useQuery({
    queryKey: ["/api/preferences"],
  });

  useEffect(() => {
    if (existingPrefs) {
      setStrategy(existingPrefs.strategy as OptimizationStrategy);
      setPaymentShape(existingPrefs.paymentShape as PaymentShape);
    }
  }, [existingPrefs]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
      toast({
        title: "Preferences saved",
        description: "Your optimization preferences have been saved.",
      });
      setLocation("/generate");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleContinue = () => {
    saveMutation.mutate({
      strategy,
      paymentShape,
    });
  };

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
          <h1 className="text-4xl font-bold">Optimization Preferences</h1>
          <p className="text-muted-foreground mt-2">
            Choose how you want to optimize your debt repayment plan
          </p>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Primary Strategy</CardTitle>
              <CardDescription>
                What's your main goal for debt repayment?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {strategyOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setStrategy(option.value)}
                    className={cn(
                      "flex items-start gap-4 p-6 rounded-lg border-2 text-left transition-all hover-elevate",
                      strategy === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    )}
                    data-testid={`option-strategy-${option.value}`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <option.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{option.label}</h3>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    {strategy === option.value && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Payment Shape</CardTitle>
              <CardDescription>
                How should payments be structured?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {shapeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPaymentShape(option.value)}
                    className={cn(
                      "flex items-start gap-4 p-6 rounded-lg border-2 text-left transition-all hover-elevate",
                      paymentShape === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    )}
                    data-testid={`option-shape-${option.value}`}
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{option.label}</h3>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    {paymentShape === option.value && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation("/budget")}
            className="h-12"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Budget
          </Button>
          <Button
            onClick={handleContinue}
            disabled={saveMutation.isPending}
            className="h-12 px-8"
            data-testid="button-generate-plan"
          >
            Generate My Plan
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
