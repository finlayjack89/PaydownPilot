import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Building2, PenLine, CreditCard, Wallet, Landmark } from "lucide-react";
import { AccountType } from "@shared/schema";
import type { Account, LenderRuleDiscoveryResponse, PlaidLinkTokenResponse, PlaidExchangeResponse, PlaidAccount } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { parseCurrencyToCents, formatBpsInput } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { usePlaidLink } from "react-plaid-link";
import { StatementWizard } from "./statement-wizard";

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
}

export function AddAccountDialog({ open, onOpenChange, account }: AddAccountDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEditing = !!account;

  // Entry method state: selection | type-selection | manual | plaid | credit-card-wizard
  const [entryMethod, setEntryMethod] = useState<"selection" | "type-selection" | "manual" | "plaid" | "credit-card-wizard">("selection");
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType>(AccountType.CREDIT_CARD);

  const [lenderName, setLenderName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>(AccountType.CREDIT_CARD);
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [promoType, setPromoType] = useState<"none" | "duration" | "date">("none");
  const [promoDuration, setPromoDuration] = useState("");
  const [promoEndDate, setPromoEndDate] = useState("");
  const [notes, setNotes] = useState("");
  
  // Min payment rule
  const [fixedAmount, setFixedAmount] = useState("");
  const [percentage, setPercentage] = useState("");
  const [includesInterest, setIncludesInterest] = useState(false);
  
  // AI discovery state
  const [discoveredRule, setDiscoveredRule] = useState<LenderRuleDiscoveryResponse | null>(null);

  // Plaid state
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoadingPlaid, setIsLoadingPlaid] = useState(false);

  useEffect(() => {
    if (account) {
      // Editing mode: go straight to manual entry
      setEntryMethod("manual");
      setLenderName(account.lenderName);
      setAccountType(account.accountType as AccountType);
      setBalance((account.currentBalanceCents / 100).toString());
      setApr((account.aprStandardBps / 100).toString());
      setDueDay(account.paymentDueDay.toString());
      setNotes(account.notes || "");
      // Fix LSP errors: Handle null values
      setFixedAmount(account.minPaymentRuleFixedCents != null ? (account.minPaymentRuleFixedCents / 100).toString() : "");
      setPercentage(account.minPaymentRulePercentageBps != null ? (account.minPaymentRulePercentageBps / 100).toString() : "");
      setIncludesInterest(account.minPaymentRuleIncludesInterest ?? false);
      
      if (account.promoEndDate) {
        setPromoType("date");
        setPromoEndDate(account.promoEndDate);
      } else if (account.promoDurationMonths) {
        setPromoType("duration");
        setPromoDuration(account.promoDurationMonths.toString());
      }
    } else {
      // Adding mode: check if UK user to skip Plaid selection
      resetForm();
      // Skip Plaid selection for UK users - go straight to account type selection
      if (user?.country === "GB") {
        setEntryMethod("type-selection");
      } else {
        setEntryMethod("selection");
      }
    }
  }, [account, open, user?.country]);

  const resetForm = () => {
    setLenderName("");
    setAccountType(AccountType.CREDIT_CARD);
    setBalance("");
    setApr("");
    setDueDay("");
    setPromoType("none");
    setPromoDuration("");
    setPromoEndDate("");
    setNotes("");
    setFixedAmount("");
    setPercentage("");
    setIncludesInterest(false);
    setDiscoveredRule(null);
    setLinkToken(null);
    setIsLoadingPlaid(false);
    setEntryMethod("selection");
  };

  const discoverRuleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/lender-rules/discover", {
        lenderName,
        country: user?.country || "US",
      });
    },
    onSuccess: (data: any) => {
      const ruleData = data as LenderRuleDiscoveryResponse;
      setDiscoveredRule(ruleData);
      if (ruleData.minPaymentRule) {
        setFixedAmount((ruleData.minPaymentRule.fixedCents / 100).toString());
        setPercentage((ruleData.minPaymentRule.percentageBps / 100).toString());
        setIncludesInterest(ruleData.minPaymentRule.includesInterest);
      }
      toast({
        title: "Rule discovered!",
        description: `Found minimum payment rule for ${lenderName}`,
      });
    },
    onError: () => {
      toast({
        title: "Discovery failed",
        description: "Could not find rules automatically. You can enter them manually.",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        return await apiRequest("PATCH", `/api/accounts/${account.id}`, data);
      } else {
        return await apiRequest("POST", "/api/accounts", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", "withBuckets=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({
        title: isEditing ? "Account updated" : "Account added",
        description: isEditing ? "Your account has been updated successfully." : "Your account has been added successfully.",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save account. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Plaid link token mutation
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
        title: "Plaid Connection Error",
        description: error.message || "Failed to initialize Plaid. Please try again.",
        variant: "destructive",
      });
      setEntryMethod("selection");
    },
  });

  // Plaid exchange token and create accounts
  const exchangeTokenMutation = useMutation({
    mutationFn: async (publicToken: string) => {
      return await apiRequest("POST", "/api/plaid/exchange-token", {
        publicToken,
      });
    },
    onSuccess: async (responseData: any) => {
      const data = responseData as PlaidExchangeResponse;
      setIsLoadingPlaid(true);
      
      if (data.accounts.length === 0) {
        toast({
          title: "No Accounts Found",
          description: "No credit accounts were found. Please add them manually.",
          variant: "destructive",
        });
        setEntryMethod("manual");
        setIsLoadingPlaid(false);
        return;
      }

      // Create accounts from Plaid data
      let successCount = 0;
      let errorCount = 0;

      for (const plaidAccount of data.accounts) {
        try {
          const accountData = {
            lenderName: plaidAccount.name || "Credit Account",
            accountType: AccountType.CREDIT_CARD,
            currentBalanceCents: plaidAccount.balanceCents,
            aprStandardBps: plaidAccount.apr ? Math.round(plaidAccount.apr * 100) : 2499, // Default 24.99% if not provided
            paymentDueDay: plaidAccount.dueDay || 15, // Default to 15th if not provided
            minPaymentRuleFixedCents: 2500, // Default $25
            minPaymentRulePercentageBps: 250, // Default 2.5%
            minPaymentRuleIncludesInterest: false,
            promoEndDate: null,
            promoDurationMonths: null,
            notes: `Imported from Plaid on ${new Date().toLocaleDateString()}`,
          };

          await apiRequest("POST", "/api/accounts", accountData);
          successCount++;
        } catch (error) {
          console.error(`Failed to create account ${plaidAccount.name}:`, error);
          errorCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/accounts", "withBuckets=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setIsLoadingPlaid(false);

      if (successCount > 0) {
        toast({
          title: "Accounts Imported",
          description: `Successfully imported ${successCount} account${successCount > 1 ? 's' : ''} from Plaid.`,
        });
        setEntryMethod("selection");
        onOpenChange(false);
        resetForm();
      } else {
        toast({
          title: "Import Failed",
          description: "Failed to import accounts. Please add them manually.",
          variant: "destructive",
        });
        setLinkToken(null);
        setEntryMethod("manual");
      }
    },
    onError: (error: any) => {
      setIsLoadingPlaid(false);
      setLinkToken(null);
      toast({
        title: "Plaid Error",
        description: error.message || "Failed to fetch account data. Please try again.",
        variant: "destructive",
      });
      setEntryMethod("selection");
    },
  });

  // Plaid Link hook
  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => {
      exchangeTokenMutation.mutate(publicToken);
    },
    onExit: (err) => {
      setIsLoadingPlaid(false);
      setLinkToken(null);
      if (err) {
        toast({
          title: "Plaid Connection Cancelled",
          description: "You can connect with Plaid later or enter accounts manually.",
        });
      }
      setEntryMethod("selection");
    },
  });

  // When entering Plaid mode, fetch the link token
  useEffect(() => {
    if (entryMethod === "plaid" && !linkToken && !fetchLinkTokenMutation.isPending) {
      fetchLinkTokenMutation.mutate();
    }
  }, [entryMethod]);

  // Open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && plaidReady && entryMethod === "plaid") {
      openPlaidLink();
    }
  }, [linkToken, plaidReady, entryMethod]);

  const handleSave = () => {
    const accountData = {
      lenderName,
      accountType,
      currentBalanceCents: parseCurrencyToCents(balance),
      aprStandardBps: formatBpsInput(apr),
      paymentDueDay: parseInt(dueDay),
      minPaymentRuleFixedCents: parseCurrencyToCents(fixedAmount),
      minPaymentRulePercentageBps: formatBpsInput(percentage),
      minPaymentRuleIncludesInterest: includesInterest,
      promoEndDate: promoType === "date" ? promoEndDate : null,
      promoDurationMonths: promoType === "duration" ? parseInt(promoDuration) : null,
      notes,
    };

    saveMutation.mutate(accountData);
  };

  // Selection screen UI - Choose entry method
  const renderSelectionScreen = () => (
    <div className="space-y-6 py-8">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">How would you like to add your accounts?</h3>
        <p className="text-sm text-muted-foreground">
          Connect with Plaid for automatic import or enter details manually
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card 
          className="p-6 hover-elevate active-elevate-2 cursor-pointer border-2"
          onClick={() => setEntryMethod("plaid")}
          data-testid="card-plaid-connect"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Connect with Plaid</h4>
              <p className="text-sm text-muted-foreground">
                Securely import your accounts automatically
              </p>
            </div>
            <Button className="w-full" data-testid="button-plaid-connect">
              Connect Bank
            </Button>
          </div>
        </Card>

        <Card 
          className="p-6 hover-elevate active-elevate-2 cursor-pointer border-2"
          onClick={() => setEntryMethod("type-selection")}
          data-testid="card-manual-entry"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 rounded-full bg-primary/10">
              <PenLine className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Enter Manually</h4>
              <p className="text-sm text-muted-foreground">
                Add account details yourself
              </p>
            </div>
            <Button variant="outline" className="w-full" data-testid="button-manual-entry">
              Enter Details
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  // Account type selection screen
  const renderTypeSelectionScreen = () => (
    <div className="space-y-6 py-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">What type of debt would you like to add?</h3>
        <p className="text-sm text-muted-foreground">
          Select the type that best matches your account
        </p>
      </div>

      <div className="grid gap-4">
        <Card 
          className="p-5 hover-elevate active-elevate-2 cursor-pointer border-2 transition-all"
          onClick={() => {
            setSelectedAccountType(AccountType.CREDIT_CARD);
            setEntryMethod("credit-card-wizard");
          }}
          data-testid="card-credit-card"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-0.5">Credit Card</h4>
              <p className="text-sm text-muted-foreground">
                Track multiple balance types with different APRs (balance transfers, purchases, etc.)
              </p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-5 hover-elevate active-elevate-2 cursor-pointer border-2 transition-all"
          onClick={() => {
            setSelectedAccountType(AccountType.BNPL);
            setAccountType(AccountType.BNPL);
            setEntryMethod("manual");
          }}
          data-testid="card-bnpl"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Wallet className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-0.5">Buy Now, Pay Later</h4>
              <p className="text-sm text-muted-foreground">
                Klarna, Clearpay, PayPal Pay in 3, and similar services
              </p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-5 hover-elevate active-elevate-2 cursor-pointer border-2 transition-all"
          onClick={() => {
            setSelectedAccountType(AccountType.LOAN);
            setAccountType(AccountType.LOAN);
            setEntryMethod("manual");
          }}
          data-testid="card-loan"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <Landmark className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-0.5">Personal Loan</h4>
              <p className="text-sm text-muted-foreground">
                Fixed-term loans with regular monthly payments
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Button 
        variant="ghost" 
        onClick={() => setEntryMethod("selection")}
        className="w-full"
        data-testid="button-back-to-selection"
      >
        Back to connection options
      </Button>
    </div>
  );

  // Loading screen for Plaid
  const renderPlaidLoading = () => (
    <div className="space-y-6 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div>
          <h3 className="text-lg font-semibold mb-2">
            {isLoadingPlaid ? "Importing Accounts..." : "Connecting to Plaid..."}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isLoadingPlaid 
              ? "Creating your accounts. This may take a moment." 
              : "Please complete the connection in the Plaid window."}
          </p>
        </div>
        {!isLoadingPlaid && (
          <Button 
            variant="outline" 
            onClick={() => {
              setIsLoadingPlaid(false);
              setLinkToken(null);
              setEntryMethod("selection");
            }}
            data-testid="button-cancel-plaid"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );

  // Manual entry form
  const renderManualForm = () => (
    <div className="space-y-6 py-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="lenderName">Lender Name</Label>
          <div className="flex gap-2">
            <Input
              id="lenderName"
              placeholder="e.g., Chase, Capital One"
              value={lenderName}
              onChange={(e) => setLenderName(e.target.value)}
              className="h-12"
              data-testid="input-lender-name"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => discoverRuleMutation.mutate()}
              disabled={!lenderName || discoverRuleMutation.isPending}
              className="h-12"
              data-testid="button-discover-rule"
            >
              {discoverRuleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </div>
          {discoveredRule && (
            <Card className="p-4 bg-primary/5 border-primary/20">
              <p className="text-sm font-medium">✓ AI Found: {discoveredRule.ruleDescription}</p>
            </Card>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="accountType">Account Type</Label>
          <Select value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
            <SelectTrigger className="h-12" data-testid="select-account-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AccountType.CREDIT_CARD}>Credit Card</SelectItem>
              <SelectItem value={AccountType.BNPL}>Buy Now, Pay Later</SelectItem>
              <SelectItem value={AccountType.LOAN}>Loan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="balance">Current Balance</Label>
          <Input
            id="balance"
            type="text"
            placeholder="1500.00"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="h-12 font-mono"
            data-testid="input-balance"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apr">Standard APR (%)</Label>
          <Input
            id="apr"
            type="text"
            placeholder="24.99"
            value={apr}
            onChange={(e) => setApr(e.target.value)}
            className="h-12 font-mono"
            data-testid="input-apr"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDay">Payment Due Day (1-28)</Label>
          <Input
            id="dueDay"
            type="number"
            min="1"
            max="28"
            placeholder="15"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            className="h-12"
            data-testid="input-due-day"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Promotional Period (Optional)</Label>
        <Tabs value={promoType} onValueChange={(v) => setPromoType(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="none">None</TabsTrigger>
            <TabsTrigger value="duration">Duration</TabsTrigger>
            <TabsTrigger value="date">End Date</TabsTrigger>
          </TabsList>
          <TabsContent value="duration" className="mt-4">
            <Input
              type="number"
              placeholder="Number of months"
              value={promoDuration}
              onChange={(e) => setPromoDuration(e.target.value)}
              className="h-12"
              data-testid="input-promo-duration"
            />
          </TabsContent>
          <TabsContent value="date" className="mt-4">
            <Input
              type="date"
              value={promoEndDate}
              onChange={(e) => setPromoEndDate(e.target.value)}
              className="h-12"
              data-testid="input-promo-end-date"
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-4">
        <Label>Minimum Payment Rule</Label>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fixedAmount" className="text-xs">Fixed Amount</Label>
            <Input
              id="fixedAmount"
              type="text"
              placeholder="25.00"
              value={fixedAmount}
              onChange={(e) => setFixedAmount(e.target.value)}
              className="h-12 font-mono"
              data-testid="input-fixed-amount"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="percentage" className="text-xs">Percentage of Balance (%)</Label>
            <Input
              id="percentage"
              type="text"
              placeholder="2.5"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              className="h-12 font-mono"
              data-testid="input-percentage"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Minimum payment is the greater of fixed amount or percentage of balance
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Input
          id="notes"
          placeholder="Any additional notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-12"
          data-testid="input-notes"
        />
      </div>
    </div>
  );

  // For credit card wizard, render the separate dialog
  if (entryMethod === "credit-card-wizard") {
    return (
      <StatementWizard 
        open={open} 
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEntryMethod("selection");
          }
          onOpenChange(isOpen);
        }}
        account={account?.accountType === AccountType.CREDIT_CARD ? account : null}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isEditing ? "Edit Account" : "Add Account"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update your account details" 
              : entryMethod === "selection" 
                ? "Choose how you'd like to add your accounts"
                : entryMethod === "type-selection"
                  ? "Select your account type"
                  : entryMethod === "plaid"
                    ? "Connecting with Plaid..."
                    : `Add a ${selectedAccountType === AccountType.BNPL ? "BNPL" : "Loan"} account`}
          </DialogDescription>
        </DialogHeader>

        {entryMethod === "selection" && renderSelectionScreen()}
        {entryMethod === "type-selection" && renderTypeSelectionScreen()}
        {entryMethod === "plaid" && renderPlaidLoading()}
        {entryMethod === "manual" && (
          <>
            {renderManualForm()}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  if (!isEditing) {
                    setLinkToken(null);
                    setEntryMethod("type-selection");
                  } else {
                    onOpenChange(false);
                    resetForm();
                  }
                }}
                data-testid="button-cancel"
              >
                {!isEditing ? "Back" : "Cancel"}
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  saveMutation.isPending || 
                  !lenderName || 
                  !balance || 
                  !apr || 
                  !dueDay || 
                  (!fixedAmount && !percentage)
                }
                data-testid="button-save-account"
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update Account" : "Add Account"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
