import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { parseCurrencyToCents, formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Budget() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [monthlyBudget, setMonthlyBudget] = useState("");

  const { data: existingBudget } = useQuery({
    queryKey: ["/api/budget"],
  });

  useEffect(() => {
    if (existingBudget) {
      setMonthlyBudget((existingBudget.monthlyBudgetCents / 100).toString());
    }
  }, [existingBudget]);

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

  const handleContinue = () => {
    if (!monthlyBudget || parseFloat(monthlyBudget) <= 0) {
      toast({
        title: "Invalid budget",
        description: "Please enter a valid monthly budget amount",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      monthlyBudgetCents: parseCurrencyToCents(monthlyBudget),
      futureChanges: [],
      lumpSumPayments: [],
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

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Set Your Budget</h1>
          <p className="text-muted-foreground mt-2">
            How much can you afford to pay toward your debts each month?
          </p>
        </div>

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
                  {user?.currency === "GBP" ? "£" : user?.currency === "EUR" ? "€" : "$"}
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
                <li>• You can always adjust this later as your situation changes</li>
                <li>• The optimizer will find the best way to allocate this amount</li>
              </ul>
            </div>
          </CardContent>
        </Card>

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
