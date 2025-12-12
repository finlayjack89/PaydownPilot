import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BudgetAnalysisView } from "./budget-analysis-view";

interface BudgetConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TrueLayerAuthResponse {
  authUrl: string;
  redirectUri: string;
}

interface TrueLayerStatusResponse {
  connected: boolean;
  lastSynced?: string;
  consentExpires?: string;
  needsReauth?: boolean;
}

export function BudgetConsentModal({ open, onOpenChange }: BudgetConsentModalProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  // Check TrueLayer connection status
  const { data: connectionStatus, refetch: refetchStatus } = useQuery<TrueLayerStatusResponse>({
    queryKey: ["/api/truelayer/status"],
    enabled: open,
    refetchInterval: isConnecting ? 2000 : false,
  });

  // Track if we've already triggered auto-analysis to avoid double triggers
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  // Get TrueLayer auth URL
  const getAuthUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/truelayer/auth-url");
      const data = await response.json();
      return data as TrueLayerAuthResponse;
    },
    onSuccess: (data) => {
      if (!data.authUrl) {
        toast({
          title: "Configuration Error",
          description: "TrueLayer is not properly configured. Please check your credentials.",
          variant: "destructive",
        });
        return;
      }
      setIsConnecting(true);
      window.location.href = data.authUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Connection Error",
        description: error.message || "Failed to initialize bank connection. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Analyze transactions
  const analyzeTransactionsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/budget/analyze-transactions", {
        days: 90,
      });
    },
    onSuccess: (data: any) => {
      setIsAnalyzing(false);
      
      const transformedData = {
        averageMonthlyIncomeCents: data.analysis.averageMonthlyIncomeCents,
        fixedCostsCents: data.analysis.fixedCostsCents,
        variableEssentialsCents: data.analysis.variableEssentialsCents,
        discretionaryCents: data.analysis.discretionaryCents,
        safeToSpendCents: data.analysis.safeToSpendCents,
        detectedDebtPayments: data.analysis.detectedDebtPayments,
        breakdown: data.analysis.breakdown,
        transactionCount: data.transactionCount,
        directDebitCount: data.directDebitCount,
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
    },
  });

  const handleConnect = () => {
    getAuthUrlMutation.mutate();
  };

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    analyzeTransactionsMutation.mutate();
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setIsConnecting(false);
      setIsAnalyzing(false);
      setAnalysisResults(null);
      setHasAutoTriggered(false);
    }
  }, [open]);

  // Check URL params for callback result and auto-trigger analysis
  useEffect(() => {
    if (open && !hasAutoTriggered) {
      const urlParams = new URLSearchParams(window.location.search);
      const connected = urlParams.get("connected");
      const error = urlParams.get("error");
      
      if (connected === "true") {
        window.history.replaceState({}, "", window.location.pathname);
        setIsConnecting(false);
        setHasAutoTriggered(true);
        refetchStatus();
        toast({
          title: "Bank Connected",
          description: "Analyzing your transactions automatically...",
        });
        // Auto-trigger analysis after successful connection
        setIsAnalyzing(true);
        setTimeout(() => {
          analyzeTransactionsMutation.mutate();
        }, 500);
      } else if (error) {
        window.history.replaceState({}, "", window.location.pathname);
        setIsConnecting(false);
        toast({
          title: "Connection Failed",
          description: error === "session_expired" 
            ? "Your session has expired. Please log in again." 
            : `Failed to connect: ${error}`,
          variant: "destructive",
        });
      }
    }
  }, [open, hasAutoTriggered, refetchStatus, toast, analyzeTransactionsMutation]);

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
                This may take a few seconds while we categorize your income and expenses...
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show connecting state
  if (isConnecting) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Connecting to Your Bank</h3>
              <p className="text-sm text-muted-foreground">
                Please complete the authentication in the new window...
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setIsConnecting(false)}
              data-testid="button-cancel-connect"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show connected state - ready to analyze
  if (connectionStatus?.connected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500/10 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <DialogTitle className="text-2xl">Bank Connected</DialogTitle>
            </div>
            <DialogDescription className="text-base leading-relaxed mt-4 space-y-4">
              <p>
                Your bank account is connected via TrueLayer. Click the button below to analyze 
                your transaction history and get a suggested budget.
              </p>
              {connectionStatus.lastSynced && (
                <p className="text-sm text-muted-foreground">
                  Last synced: {new Date(connectionStatus.lastSynced).toLocaleDateString()}
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-modal"
            >
              Close
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={analyzeTransactionsMutation.isPending}
              data-testid="button-analyze-transactions"
            >
              {analyzeTransactionsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Transactions"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Default: consent screen for connecting
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
                <span>Securely connect to your bank through TrueLayer (UK Open Banking)</span>
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
                I authorize Resolve to securely connect to my bank via TrueLayer. I agree to a one-time analysis 
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
            onClick={handleConnect}
            disabled={getAuthUrlMutation.isPending}
            data-testid="button-budget-consent-agree"
          >
            {getAuthUrlMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Agree & Connect
                <ExternalLink className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
