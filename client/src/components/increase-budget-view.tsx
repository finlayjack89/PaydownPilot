import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, DollarSign, ShoppingCart, Tv, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, parseCurrencyToCents } from "@/lib/format";
import { Separator } from "@/components/ui/separator";
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

interface IncreaseBudgetViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisData: BudgetAnalysisData;
  onBack: () => void;
}

export function IncreaseBudgetView({ open, onOpenChange, analysisData, onBack }: IncreaseBudgetViewProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const currency = user?.currency || "USD";

  // State for selected subscriptions to cancel
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Set<string>>(new Set());
  
  // State for discretionary spending reductions
  const [discretionaryReductions, setDiscretionaryReductions] = useState<Record<string, string>>({});

  // Calculate total savings
  const calculateTotalSavings = () => {
    let total = 0;

    // Add subscription savings
    analysisData.nonEssentialSubscriptions.forEach(sub => {
      if (selectedSubscriptions.has(sub.name)) {
        total += sub.monthlyCostCents;
      }
    });

    // Add discretionary spending reductions
    Object.entries(discretionaryReductions).forEach(([category, reduction]) => {
      const reductionCents = parseCurrencyToCents(reduction);
      const categoryData = analysisData.nonEssentialDiscretionaryCategories.find(c => c.category === category);
      if (categoryData && reductionCents > 0) {
        // Cap reduction at the actual spending amount
        total += Math.min(reductionCents, categoryData.monthlyCostCents);
      }
    });

    return total;
  };

  const totalSavings = calculateTotalSavings();
  const newBudget = analysisData.currentBudgetCents + totalSavings;

  // Save optimized budget
  const saveOptimizedBudgetMutation = useMutation({
    mutationFn: async () => {
      const optimizations = {
        cancelledSubscriptions: Array.from(selectedSubscriptions),
        discretionaryReductions: Object.entries(discretionaryReductions)
          .filter(([_, reduction]) => parseCurrencyToCents(reduction) > 0)
          .map(([category, reduction]) => ({
            category,
            reductionCents: parseCurrencyToCents(reduction),
          })),
      };

      return await apiRequest("POST", "/api/budget/save-analyzed-budget", {
        currentBudgetCents: newBudget,
        potentialBudgetCents: newBudget, // Save the optimized budget as potential
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/current"] });
      toast({
        title: "Optimized Budget Saved",
        description: `Your new budget of ${formatCurrency(newBudget, currency)} has been saved!`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Save Error",
        description: error.message || "Failed to save optimized budget. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubscriptionToggle = (name: string) => {
    const newSelected = new Set(selectedSubscriptions);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedSubscriptions(newSelected);
  };

  const handleDiscretionaryReduction = (category: string, value: string) => {
    setDiscretionaryReductions({
      ...discretionaryReductions,
      [category]: value,
    });
  };

  const handleApplySavings = () => {
    if (totalSavings === 0) {
      toast({
        title: "No Savings Selected",
        description: "Please select subscriptions to cancel or spending to reduce.",
        variant: "destructive",
      });
      return;
    }

    saveOptimizedBudgetMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              data-testid="button-back-to-analysis"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <DialogTitle className="text-2xl">Increase Your Budget</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current vs Potential Budget */}
          <Card className="bg-primary/5">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Current Budget</p>
                  <p className="text-2xl font-bold font-mono">
                    {formatCurrency(analysisData.currentBudgetCents, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Potential Savings</p>
                  <p className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">
                    +{formatCurrency(totalSavings, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">New Budget</p>
                  <p className="text-2xl font-bold font-mono text-primary">
                    {formatCurrency(newBudget, currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscriptions Section */}
          {analysisData.nonEssentialSubscriptions.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Tv className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Media & Subscriptions</CardTitle>
                </div>
                <CardDescription>
                  Select subscriptions you're willing to cancel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysisData.nonEssentialSubscriptions.map((sub) => (
                  <div
                    key={sub.name}
                    className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                    data-testid={`subscription-item-${sub.name.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedSubscriptions.has(sub.name)}
                        onCheckedChange={() => handleSubscriptionToggle(sub.name)}
                        data-testid={`checkbox-subscription-${sub.name.replace(/\s+/g, '-').toLowerCase()}`}
                      />
                      <span className="font-medium">{sub.name}</span>
                    </div>
                    <span className="font-mono font-semibold">
                      {formatCurrency(sub.monthlyCostCents, currency)}/mo
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Discretionary Spending Section */}
          {analysisData.nonEssentialDiscretionaryCategories.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Discretionary Spending</CardTitle>
                </div>
                <CardDescription>
                  Reduce spending in these categories
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisData.nonEssentialDiscretionaryCategories.map((category) => (
                  <div
                    key={category.category}
                    className="space-y-2"
                    data-testid={`category-item-${category.category.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{category.category}</span>
                      <span className="font-mono text-sm text-muted-foreground">
                        Current: {formatCurrency(category.monthlyCostCents, currency)}/mo
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Reduce by:</span>
                      <div className="relative flex-1 max-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"}
                        </span>
                        <Input
                          type="text"
                          placeholder="0.00"
                          value={discretionaryReductions[category.category] || ""}
                          onChange={(e) => handleDiscretionaryReduction(category.category, e.target.value)}
                          className="pl-8"
                          data-testid={`input-reduction-${category.category.replace(/\s+/g, '-').toLowerCase()}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onBack}
              className="flex-1"
              data-testid="button-keep-current"
            >
              Keep Current Budget
            </Button>
            <Button
              onClick={handleApplySavings}
              className="flex-1"
              disabled={totalSavings === 0 || saveOptimizedBudgetMutation.isPending}
              data-testid="button-apply-savings"
            >
              <Calculator className="mr-2 h-4 w-4" />
              Apply Savings to Budget
            </Button>
          </div>

          {/* Info Text */}
          <p className="text-xs text-muted-foreground text-center">
            These optimizations will help you pay off debt faster. You can adjust these settings anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}