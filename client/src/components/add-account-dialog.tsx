import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, CreditCard, Wallet, Landmark, CheckCircle2 } from "lucide-react";
import { AccountType } from "@shared/schema";
import type { Account, LenderRuleDiscoveryResponse } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { parseCurrencyToCents, formatBpsInput } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
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

  const [entryMethod, setEntryMethod] = useState<"type-selection" | "manual" | "credit-card-wizard">("type-selection");
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
  
  const [fixedAmount, setFixedAmount] = useState("");
  const [percentage, setPercentage] = useState("");
  const [includesInterest, setIncludesInterest] = useState(false);
  
  const [discoveredRule, setDiscoveredRule] = useState<LenderRuleDiscoveryResponse | null>(null);
  const [pendingRule, setPendingRule] = useState<LenderRuleDiscoveryResponse | null>(null);
  const [showRuleConfirmation, setShowRuleConfirmation] = useState(false);

  useEffect(() => {
    if (account) {
      setEntryMethod("manual");
      setLenderName(account.lenderName);
      setAccountType(account.accountType as AccountType);
      setBalance((account.currentBalanceCents / 100).toString());
      setApr((account.aprStandardBps / 100).toString());
      setDueDay(account.paymentDueDay.toString());
      setNotes(account.notes || "");
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
      resetForm();
    }
  }, [account, open]);

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
    setPendingRule(null);
    setShowRuleConfirmation(false);
    setEntryMethod("type-selection");
  };

  const discoverRuleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/lender-rules/discover", {
        lenderName,
        country: user?.country || "US",
      });
      // apiRequest returns a Response object, so we need to parse JSON
      return await response.json();
    },
    onSuccess: (data: LenderRuleDiscoveryResponse) => {
      if (data.minPaymentRule) {
        setPendingRule(data);
        setShowRuleConfirmation(true);
      } else {
        toast({
          title: "No rule found",
          description: "Could not find minimum payment rules for this lender. Please enter them manually.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Discovery failed",
        description: "Could not find rules automatically. You can enter them manually.",
        variant: "destructive",
      });
    },
  });

  const handleConfirmRule = () => {
    if (pendingRule?.minPaymentRule) {
      setFixedAmount((pendingRule.minPaymentRule.fixedCents / 100).toString());
      setPercentage((pendingRule.minPaymentRule.percentageBps / 100).toString());
      setIncludesInterest(pendingRule.minPaymentRule.includesInterest);
      setDiscoveredRule(pendingRule);
      toast({
        title: "Rule applied",
        description: "Minimum payment fields have been populated with the discovered rule.",
      });
    }
    setShowRuleConfirmation(false);
    setPendingRule(null);
  };

  const handleRejectRule = () => {
    setShowRuleConfirmation(false);
    setPendingRule(null);
    toast({
      title: "Rule not applied",
      description: "You can enter the minimum payment details manually.",
    });
  };

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
    </div>
  );

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
              <p className="text-sm font-medium">AI Found: {discoveredRule.ruleDescription}</p>
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

  if (entryMethod === "credit-card-wizard") {
    return (
      <StatementWizard 
        open={open} 
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEntryMethod("type-selection");
          }
          onOpenChange(isOpen);
        }}
        account={account?.accountType === AccountType.CREDIT_CARD ? account : null}
      />
    );
  }

  const formatRuleDescription = (rule: LenderRuleDiscoveryResponse) => {
    if (!rule.minPaymentRule) return "";
    const { fixedCents, percentageBps, includesInterest } = rule.minPaymentRule;
    const fixedStr = fixedCents > 0 ? `£${(fixedCents / 100).toFixed(2)}` : null;
    const percentStr = percentageBps > 0 ? `${(percentageBps / 100).toFixed(1)}% of balance` : null;
    const interestStr = includesInterest ? " plus interest" : "";
    
    if (fixedStr && percentStr) {
      return `${fixedStr} or ${percentStr}${interestStr}, whichever is greater`;
    } else if (fixedStr) {
      return `${fixedStr}${interestStr}`;
    } else if (percentStr) {
      return `${percentStr}${interestStr}`;
    }
    return rule.ruleDescription || "";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {isEditing ? "Edit Account" : "Add Account"}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Update your account details" 
                : entryMethod === "type-selection"
                  ? "Select your account type"
                  : `Add a ${selectedAccountType === AccountType.BNPL ? "BNPL" : "Loan"} account`}
            </DialogDescription>
          </DialogHeader>

          {entryMethod === "type-selection" && renderTypeSelectionScreen()}
          {entryMethod === "manual" && (
            <>
              {renderManualForm()}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!isEditing) {
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

        {/* Nested Rule Confirmation Dialog */}
        <Dialog open={showRuleConfirmation} onOpenChange={setShowRuleConfirmation}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Minimum Payment Rule Discovered
              </DialogTitle>
              <DialogDescription>
                Based on our research of <span className="font-semibold">{lenderName}</span>, 
                we found the following minimum payment rule:
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {pendingRule && (
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <p className="font-medium text-foreground">
                    {formatRuleDescription(pendingRule)}
                  </p>
                  {pendingRule.ruleDescription && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {pendingRule.ruleDescription}
                    </p>
                  )}
                </Card>
              )}
              <p className="text-sm text-muted-foreground">
                Would you like to use this rule to populate the minimum payment fields?
              </p>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleRejectRule} data-testid="button-reject-rule">
                No, I'll enter manually
              </Button>
              <Button onClick={handleConfirmRule} data-testid="button-confirm-rule">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Yes, apply this rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Dialog>
    </>
  );
}
