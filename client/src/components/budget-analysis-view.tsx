import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, Wallet, ChevronRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format";
import { IncreaseBudgetView } from "./increase-budget-view";
import { useAuth } from "@/lib/auth-context";

interface BudgetAnalysisData {
  monthlyNetIncomeCents: number;
  disposableIncomeCents: number;
  currentBudgetCents: number;
  nonEssentialSubscriptions: Array<{
    name: string;
    monthlyCostCents: number;
  }>;
  nonEssentialDiscretionaryCategories: Array<{
    category: string;
    monthlyCostCents: number;
  }>;
}

interface BudgetAnalysisViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisData: BudgetAnalysisData;
}

export function BudgetAnalysisView({ open, onOpenChange, analysisData }: BudgetAnalysisViewProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showIncreaseView, setShowIncreaseView] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Save analyzed budget mutation
  const saveBudgetMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/budget/save-analyzed-budget", {
        currentBudgetCents: analysisData.currentBudgetCents,
        potentialBudgetCents: null, // Will be set when optimizing
      });
    },
    onSuccess: () => {
      setIsSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/current"] });
      toast({
        title: "Budget Saved",
        description: "Your analyzed budget has been saved and is ready to use.",
      });
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Save Error",
        description: error.message || "Failed to save budget. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUseBudget = () => {
    saveBudgetMutation.mutate();
  };

  const handleIncreaseBudget = () => {
    setShowIncreaseView(true);
  };

  // If showing increase view, render that instead
  if (showIncreaseView) {
    return (
      <IncreaseBudgetView
        open={open}
        onOpenChange={onOpenChange}
        analysisData={analysisData}
        onBack={() => setShowIncreaseView(false)}
      />
    );
  }

  const currency = user?.currency || "USD";

  const statsCards = [
    {
      title: "Monthly Net Income",
      value: formatCurrency(analysisData.monthlyNetIncomeCents, currency),
      description: "Your total monthly income after taxes",
      icon: DollarSign,
      iconColor: "text-green-500",
    },
    {
      title: "Disposable Income",
      value: formatCurrency(analysisData.disposableIncomeCents, currency),
      description: "Income after essential expenses",
      icon: Wallet,
      iconColor: "text-blue-500",
    },
    {
      title: "Suggested Budget",
      value: formatCurrency(analysisData.currentBudgetCents, currency),
      description: "Recommended for debt payments",
      icon: TrendingUp,
      iconColor: "text-purple-500",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {isSaved ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                Budget Saved Successfully
              </>
            ) : (
              "Your Budget Analysis"
            )}
          </DialogTitle>
        </DialogHeader>

        {isSaved ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <p className="text-lg">Your budget has been saved!</p>
            <p className="text-muted-foreground">
              You can now generate an optimized debt payoff plan.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Based on your transaction history, we've identified your financial capacity:
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {statsCards.map((stat, index) => (
                <Card key={index} data-testid={`card-budget-stat-${index}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{stat.title}</p>
                      <p className="text-xl font-bold font-mono">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Optimization Opportunity */}
            {(analysisData.nonEssentialSubscriptions.length > 0 || 
              analysisData.nonEssentialDiscretionaryCategories.length > 0) && (
              <Card className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Budget Optimization Available</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        We found {analysisData.nonEssentialSubscriptions.length} subscriptions 
                        and {analysisData.nonEssentialDiscretionaryCategories.length} spending categories 
                        that you could reduce to increase your debt payment budget.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={handleUseBudget}
                disabled={saveBudgetMutation.isPending}
                data-testid="button-use-budget"
              >
                Use This Budget
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={handleIncreaseBudget}
                disabled={saveBudgetMutation.isPending}
                data-testid="button-increase-budget"
              >
                Increase My Budget
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Info Text */}
            <p className="text-xs text-muted-foreground text-center">
              You can always adjust your budget later in the Budget settings
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}