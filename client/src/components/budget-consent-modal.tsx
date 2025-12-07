import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePlaidLink } from "react-plaid-link";
import { BudgetAnalysisView } from "./budget-analysis-view";

interface BudgetConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PlaidLinkTokenResponse {
  linkToken: string;
}

export function BudgetConsentModal({ open, onOpenChange }: BudgetConsentModalProps) {
  const { toast } = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setLinkToken(null);
      setIsAnalyzing(false);
      setAnalysisResults(null);
    }
  }, [open]);

  // Fetch Plaid link token for transaction access
  const fetchLinkTokenMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/plaid/create-link-token", {});
    },
    onSuccess: (data: any) => {
      const tokenData = data as PlaidLinkTokenResponse;
      setLinkToken(tokenData.linkToken);
    },
    onError: (error: any) => {
      toast({
        title: "Connection Error",
        description: error.message || "Failed to initialize secure connection. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Exchange token and analyze transactions after Plaid connection
  const analyzeTransactionsMutation = useMutation({
    mutationFn: async (publicToken: string) => {
      setIsAnalyzing(true);
      // First exchange the public token for an access token
      await apiRequest("POST", "/api/plaid/exchange-token", {
        publicToken,
      });
      // Then analyze transactions
      return await apiRequest("POST", "/api/budget/analyze-transactions", {
        days: 90, // Analyze last 90 days
      });
    },
    onSuccess: (data: any) => {
      setIsAnalyzing(false);
      
      // Transform backend snake_case response to frontend camelCase format
      const transformedData = {
        monthlyNetIncomeCents: data.analysis.identified_monthly_net_income_cents,
        essentialExpensesCents: data.analysis.identified_essential_expenses_total_cents,
        currentBudgetCents: data.analysis.current_budget_cents,
        disposableIncomeCents: data.analysis.potential_budget_cents, // Income after essential expenses
        nonEssentialSubscriptions: data.analysis.non_essential_subscriptions.map((sub: any) => ({
          name: sub.name,
          monthlyCostCents: sub.amount_cents // Transform amount_cents to monthlyCostCents
        })),
        nonEssentialDiscretionaryCategories: data.analysis.non_essential_discretionary_categories.map((cat: any) => ({
          category: cat.category,
          monthlyCostCents: cat.total_cents // Transform total_cents to monthlyCostCents
        }))
      };
      
      setAnalysisResults(transformedData);
    },
    onError: (error: any) => {
      setIsAnalyzing(false);
      toast({
        title: "Analysis Error",
        description: error.message || "Failed to analyze transactions. Please try again.",
        variant: "destructive",
      });
      onOpenChange(false);
    },
  });

  // Plaid Link configuration
  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => {
      analyzeTransactionsMutation.mutate(publicToken);
    },
    onExit: (err) => {
      if (!isAnalyzing) {
        setLinkToken(null);
        if (err) {
          toast({
            title: "Connection Cancelled",
            description: "You can try again whenever you're ready.",
          });
        }
      }
    },
  });

  // Open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && plaidReady && !isAnalyzing && !analysisResults) {
      openPlaidLink();
    }
  }, [linkToken, plaidReady, isAnalyzing, analysisResults]);

  const handleAgree = () => {
    fetchLinkTokenMutation.mutate();
  };

  // If we have analysis results, show the analysis view
  if (analysisResults) {
    return (
      <BudgetAnalysisView
        open={open}
        onOpenChange={onOpenChange}
        analysisData={analysisResults}
      />
    );
  }

  // Show analyzing state
  if (isAnalyzing) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Analyzing Your Transactions</h3>
              <p className="text-sm text-muted-foreground">
                This may take 5-10 seconds while we identify your income and expenses...
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-2xl">Budget Analysis Authorization</DialogTitle>
          </div>
          <DialogDescription className="text-base leading-relaxed mt-4 space-y-4">
            <p className="font-medium">
              To analyze your spending and create a personalized budget, we need your permission to:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Securely connect to your bank through Plaid</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Perform a one-time analysis of your transaction history</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Identify your income and expense patterns</span>
              </li>
            </ul>
            <div className="p-4 bg-muted rounded-lg border">
              <p className="text-sm font-medium mb-2">Your Privacy Matters</p>
              <p className="text-sm text-muted-foreground">
                I authorize Resolve to securely connect to my bank via Plaid. I agree to a one-time analysis 
                of my transaction history to identify income and expenses to suggest a budget. My raw transaction 
                data will not be stored.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-budget-consent-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAgree}
            disabled={fetchLinkTokenMutation.isPending}
            data-testid="button-budget-consent-agree"
          >
            {fetchLinkTokenMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              "Agree & Connect"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}