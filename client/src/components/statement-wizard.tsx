import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Plus, Trash2, ArrowLeft, ArrowRight, CreditCard, Layers, CircleDot, ChevronRight, HelpCircle } from "lucide-react";
import { StatementGuidanceButton } from "./statement-guidance-assistant";
import { AccountType, BucketType } from "@shared/schema";
import type { Account, LenderRuleDiscoveryResponse, DebtBucket } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { parseCurrencyToCents, formatBpsInput, formatCurrency, formatPercentage } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StatementWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
}

interface BucketFormData {
  id: string;
  bucketType: string;
  label: string;
  balanceCents: number;
  aprBps: number;
  isPromo: boolean;
  promoExpiryDate: string;
}

const BUCKET_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  [BucketType.BALANCE_TRANSFER]: { bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-400", text: "text-blue-700 dark:text-blue-300" },
  [BucketType.PURCHASES]: { bg: "bg-green-100 dark:bg-green-900/30", border: "border-green-400", text: "text-green-700 dark:text-green-300" },
  [BucketType.CASH_ADVANCE]: { bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-400", text: "text-orange-700 dark:text-orange-300" },
  [BucketType.MONEY_TRANSFER]: { bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-400", text: "text-purple-700 dark:text-purple-300" },
  [BucketType.CUSTOM]: { bg: "bg-gray-100 dark:bg-gray-900/30", border: "border-gray-400", text: "text-gray-700 dark:text-gray-300" },
};

const BUCKET_TYPE_LABELS: Record<string, string> = {
  [BucketType.BALANCE_TRANSFER]: "Balance Transfer",
  [BucketType.PURCHASES]: "Purchases",
  [BucketType.CASH_ADVANCE]: "Cash Advance",
  [BucketType.MONEY_TRANSFER]: "Money Transfer",
  [BucketType.CUSTOM]: "Custom",
};

interface CurrencyInputProps {
  valueCents: number;
  onValueChange: (cents: number) => void;
  currencySymbol: string;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

function CurrencyInput({ valueCents, onValueChange, currencySymbol, placeholder = "0.00", className, "data-testid": testId }: CurrencyInputProps) {
  const [localValue, setLocalValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const displayValue = isFocused 
    ? localValue 
    : (valueCents ? (valueCents / 100).toFixed(2) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
      setLocalValue(val);
      // Update parent state for real-time allocation tracking
      // Parse immediately - trailing decimals parse fine (e.g., "1500." becomes 150000 cents)
      const cents = val.trim() === "" ? 0 : parseCurrencyToCents(val);
      onValueChange(cents);
    }
  };

  const handleFocus = () => {
    setLocalValue(valueCents ? (valueCents / 100).toFixed(2) : "");
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (localValue.trim() === "") {
      onValueChange(0);
    } else {
      const cents = parseCurrencyToCents(localValue);
      onValueChange(cents);
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
        {currencySymbol}
      </span>
      <Input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn("font-mono pl-6", className)}
        data-testid={testId}
      />
    </div>
  );
}

interface PercentageInputProps {
  valueBps: number;
  onValueChange: (bps: number) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

function PercentageInput({ valueBps, onValueChange, placeholder = "0", className, "data-testid": testId }: PercentageInputProps) {
  const [localValue, setLocalValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const displayValue = isFocused 
    ? localValue 
    : (valueBps ? (valueBps / 100).toFixed(2) : "0");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
      setLocalValue(val);
    }
  };

  const handleFocus = () => {
    setLocalValue(valueBps ? (valueBps / 100).toFixed(2) : "0");
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const bps = formatBpsInput(localValue || "0");
    onValueChange(bps);
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn("font-mono", className)}
      data-testid={testId}
    />
  );
}

export function StatementWizard({ open, onOpenChange, account }: StatementWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEditing = !!account;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  // Step 1: Headline data
  const [lenderName, setLenderName] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [totalBalance, setTotalBalance] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [standardApr, setStandardApr] = useState("");
  
  // Min payment rule (discovered or manual)
  const [fixedAmount, setFixedAmount] = useState("");
  const [percentage, setPercentage] = useState("");
  const [includesInterest, setIncludesInterest] = useState(false);
  const [notes, setNotes] = useState("");
  
  // AI discovery state
  const [discoveredRule, setDiscoveredRule] = useState<LenderRuleDiscoveryResponse | null>(null);
  const [showAiMinPaymentDialog, setShowAiMinPaymentDialog] = useState(false);

  // Step 2: Split decision
  const [splitMode, setSplitMode] = useState<"single" | "multiple" | null>(null);

  // Step 3: Bucket data
  const [buckets, setBuckets] = useState<BucketFormData[]>([]);

  const generateBucketId = () => `bucket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    if (account) {
      setLenderName(account.lenderName);
      setCurrency(account.currency || "GBP");
      setTotalBalance((account.currentBalanceCents / 100).toString());
      setDueDay(account.paymentDueDay.toString());
      setStandardApr((account.aprStandardBps / 100).toString());
      setNotes(account.notes || "");
      setFixedAmount(account.minPaymentRuleFixedCents != null ? (account.minPaymentRuleFixedCents / 100).toString() : "");
      setPercentage(account.minPaymentRulePercentageBps != null ? (account.minPaymentRulePercentageBps / 100).toString() : "");
      setIncludesInterest(account.minPaymentRuleIncludesInterest ?? false);
      
      // TODO: Load existing buckets if available
      setSplitMode("single");
      setStep(1);
    } else {
      resetForm();
    }
  }, [account, open]);

  const resetForm = () => {
    setStep(1);
    setLenderName("");
    setCurrency("GBP");
    setTotalBalance("");
    setDueDay("");
    setStandardApr("");
    setNotes("");
    setFixedAmount("");
    setPercentage("");
    setIncludesInterest(false);
    setDiscoveredRule(null);
    setSplitMode(null);
    setBuckets([]);
  };

  const discoverRuleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/lender-rules/discover", {
        lenderName,
        country: user?.country || "UK",
      });
    },
    onSuccess: (data: any) => {
      const ruleData = data as LenderRuleDiscoveryResponse;
      setDiscoveredRule(ruleData);
      setShowAiMinPaymentDialog(true);
    },
    onError: () => {
      toast({
        title: "Discovery unavailable",
        description: "Could not find rules automatically. You can enter them manually.",
        variant: "destructive",
      });
    },
  });

  const applyDiscoveredRule = (applyApr: boolean = false) => {
    if (discoveredRule?.minPaymentRule) {
      setFixedAmount((discoveredRule.minPaymentRule.fixedCents / 100).toString());
      setPercentage((discoveredRule.minPaymentRule.percentageBps / 100).toString());
      setIncludesInterest(discoveredRule.minPaymentRule.includesInterest);
    }
    if (applyApr && discoveredRule?.aprInfo?.purchaseAprBps) {
      setStandardApr((discoveredRule.aprInfo.purchaseAprBps / 100).toString());
    }
    toast({
      title: "Rule applied",
      description: `Payment rule${applyApr ? " and APR" : ""} for ${lenderName} has been applied.`,
    });
    setShowAiMinPaymentDialog(false);
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
        description: isEditing ? "Your credit card has been updated." : "Your credit card has been added with bucket breakdown.",
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
    const totalBalanceCents = parseCurrencyToCents(totalBalance);
    
    // Build buckets array
    let bucketData: any[] = [];
    
    if (splitMode === "multiple" && buckets.length > 0) {
      bucketData = buckets.map(b => ({
        bucketType: b.bucketType,
        label: b.label || null,
        balanceCents: b.balanceCents,
        aprBps: b.aprBps,
        isPromo: b.isPromo,
        promoExpiryDate: b.promoExpiryDate || null,
      }));
    } else {
      // Single bucket - use the total balance and standard APR
      bucketData = [{
        bucketType: BucketType.PURCHASES,
        label: "Standard Balance",
        balanceCents: totalBalanceCents,
        aprBps: formatBpsInput(standardApr),
        isPromo: false,
        promoExpiryDate: null,
      }];
    }

    const accountData = {
      lenderName,
      accountType: AccountType.CREDIT_CARD,
      currency,
      isManualEntry: true,
      currentBalanceCents: totalBalanceCents,
      aprStandardBps: formatBpsInput(standardApr),
      paymentDueDay: parseInt(dueDay),
      minPaymentRuleFixedCents: parseCurrencyToCents(fixedAmount),
      minPaymentRulePercentageBps: formatBpsInput(percentage),
      minPaymentRuleIncludesInterest: includesInterest,
      promoEndDate: null,
      promoDurationMonths: null,
      notes,
      buckets: bucketData,
    };

    saveMutation.mutate(accountData);
  };

  const addBucket = (type: string) => {
    // Balance transfers and money transfers default to 0% promo rate
    const isPromoType = type === BucketType.BALANCE_TRANSFER || type === BucketType.MONEY_TRANSFER;
    const newBucket: BucketFormData = {
      id: generateBucketId(),
      bucketType: type,
      label: "",
      balanceCents: 0,
      aprBps: isPromoType ? 0 : formatBpsInput(standardApr),
      isPromo: isPromoType,
      promoExpiryDate: "",
    };
    setBuckets([...buckets, newBucket]);
  };

  const updateBucket = (id: string, updates: Partial<BucketFormData>) => {
    setBuckets(buckets.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBucket = (id: string) => {
    setBuckets(buckets.filter(b => b.id !== id));
  };

  const getBucketTotal = () => {
    return buckets.reduce((sum, b) => sum + (b.balanceCents || 0), 0);
  };

  const getTotalBalanceCents = () => parseCurrencyToCents(totalBalance);

  const getRemainingBalance = () => {
    return getTotalBalanceCents() - getBucketTotal();
  };

  const canProceedFromStep1 = () => {
    const result = lenderName && totalBalance && dueDay && standardApr && (fixedAmount || percentage);
    console.log('[StatementWizard] canProceedFromStep1:', { 
      lenderName, totalBalance, dueDay, standardApr, fixedAmount, percentage, 
      result: !!result 
    });
    return result;
  };

  const canProceedFromStep2 = () => {
    return splitMode !== null;
  };

  const canFinish = () => {
    if (splitMode === "single") return true;
    // For multiple, check that bucket total matches statement total
    const remaining = getRemainingBalance();
    return buckets.length > 0 && Math.abs(remaining) < 1; // Allow 1 cent tolerance
  };

  const getCurrencySymbol = () => {
    return currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  };

  // Step 1: Headline (Statement Overview)
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="lenderName">Credit Card Provider</Label>
          <div className="flex gap-2">
            <Input
              id="lenderName"
              placeholder="e.g., Barclays, HSBC, Amex"
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
              className="h-12 px-4"
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
            <Card className="p-3 bg-primary/5 border-primary/20">
              <p className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Found: {discoveredRule.ruleDescription}
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="h-12" data-testid="select-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GBP">£ GBP</SelectItem>
              <SelectItem value="USD">$ USD</SelectItem>
              <SelectItem value="EUR">€ EUR</SelectItem>
            </SelectContent>
          </Select>
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

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="totalBalance">Statement Balance</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {getCurrencySymbol()}
            </span>
            <Input
              id="totalBalance"
              type="text"
              placeholder="2,500.00"
              value={totalBalance}
              onChange={(e) => setTotalBalance(e.target.value)}
              className="h-12 font-mono pl-8"
              data-testid="input-total-balance"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter the total balance shown on your latest statement
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="standardApr">Standard Purchase APR (%)</Label>
          <Input
            id="standardApr"
            type="text"
            placeholder="24.9"
            value={standardApr}
            onChange={(e) => setStandardApr(e.target.value)}
            className="h-12 font-mono"
            data-testid="input-standard-apr"
          />
        </div>

        <div className="space-y-2">
          <Label>&nbsp;</Label>
          <p className="text-sm text-muted-foreground h-12 flex items-center">
            This is typically the rate for regular purchases
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <Label>Minimum Payment Rule</Label>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fixedAmount" className="text-xs text-muted-foreground">Fixed Minimum Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {getCurrencySymbol()}
              </span>
              <Input
                id="fixedAmount"
                type="text"
                placeholder="25.00"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(e.target.value)}
                className="h-12 font-mono pl-8"
                data-testid="input-fixed-amount"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="percentage" className="text-xs text-muted-foreground">Or % of Balance</Label>
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
          Minimum payment is typically the greater of these two amounts
        </p>
        
        <Button
          type="button"
          variant="outline"
          className="w-full mt-4"
          onClick={() => discoverRuleMutation.mutate()}
          disabled={!lenderName || discoverRuleMutation.isPending}
          data-testid="button-ai-min-payment"
        >
          {discoverRuleMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Calculate my minimum payment with AI
        </Button>
      </div>
    </div>
  );

  // Step 2: Split Decision
  const renderStep2 = () => (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">How is your balance structured?</h3>
        <p className="text-sm text-muted-foreground">
          Many UK credit cards have multiple balances at different interest rates
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card 
          className={cn(
            "p-6 cursor-pointer border-2 transition-all",
            splitMode === "single" 
              ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-2 shadow-lg scale-[1.02]" 
              : "hover-elevate hover:shadow-md hover:border-muted-foreground/50"
          )}
          onClick={() => setSplitMode("single")}
          data-testid="card-single-rate"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={cn(
              "p-4 rounded-full transition-colors",
              splitMode === "single" ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <CircleDot className="h-8 w-8" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Single Rate</h4>
              <p className="text-sm text-muted-foreground">
                All my balance is at the same APR
              </p>
            </div>
            <div className={cn(
              "text-sm font-medium",
              splitMode === "single" ? "text-primary" : "text-muted-foreground"
            )}>
              {getCurrencySymbol()}{totalBalance || "0"} at {standardApr || "0"}%
            </div>
          </div>
        </Card>

        <Card 
          className={cn(
            "p-6 cursor-pointer border-2 transition-all",
            splitMode === "multiple" 
              ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-2 shadow-lg scale-[1.02]" 
              : "hover-elevate hover:shadow-md hover:border-muted-foreground/50"
          )}
          onClick={() => setSplitMode("multiple")}
          data-testid="card-multiple-buckets"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={cn(
              "p-4 rounded-full transition-colors",
              splitMode === "multiple" ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <Layers className="h-8 w-8" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Multiple Rates</h4>
              <p className="text-sm text-muted-foreground">
                I have balance transfers, purchases, etc. at different rates
              </p>
            </div>
            <div className="flex gap-1 flex-wrap justify-center">
              <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/30 border-blue-400">
                0% Balance Transfer
              </Badge>
              <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 border-green-400">
                24.9% Purchases
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="text-sm font-medium mb-2">Why does this matter?</h4>
        <p className="text-sm text-muted-foreground">
          UK credit cards often have different APRs for different types of spending. 
          Balance transfers and money transfers often come with promotional 0% rates for a limited period (e.g., 18-24 months), 
          while purchases are at your standard rate (e.g., 24.9%), and cash advances can be even higher. 
          Tracking these separately with their promo expiry dates helps you prioritize which balances to pay off first 
          and avoid surprise rate increases when promotional periods end.
        </p>
      </div>
    </div>
  );

  // Step 3: Bucket Builder
  const renderStep3 = () => {
    const remaining = getRemainingBalance();
    const totalBalanceCents = getTotalBalanceCents();
    const allocated = getBucketTotal();
    const allocationPercent = totalBalanceCents > 0 ? (allocated / totalBalanceCents) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* Allocation Progress */}
        <Card className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Balance Allocation</span>
            <span className={cn(
              "text-sm font-mono",
              Math.abs(remaining) < 1 ? "text-green-600" : remaining > 0 ? "text-orange-600" : "text-red-600"
            )}>
              {Math.abs(remaining) < 1 
                ? "Fully allocated" 
                : remaining > 0 
                  ? `${getCurrencySymbol()}${(remaining / 100).toFixed(2)} remaining`
                  : `${getCurrencySymbol()}${(Math.abs(remaining) / 100).toFixed(2)} over-allocated`
              }
            </span>
          </div>
          <Progress value={Math.min(allocationPercent, 100)} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Allocated: {getCurrencySymbol()}{(allocated / 100).toFixed(2)}</span>
            <span>Statement: {getCurrencySymbol()}{(totalBalanceCents / 100).toFixed(2)}</span>
          </div>
        </Card>

        {/* Bucket List */}
        <div className="space-y-3">
          {buckets.map((bucket, index) => {
            const colors = BUCKET_TYPE_COLORS[bucket.bucketType] || BUCKET_TYPE_COLORS[BucketType.CUSTOM];
            return (
              <Card 
                key={bucket.id} 
                className={cn("p-4 border-l-4", colors.border)}
                data-testid={`bucket-${index}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn(colors.bg, colors.text, "text-xs")}>
                        {BUCKET_TYPE_LABELS[bucket.bucketType]}
                      </Badge>
                      {bucket.isPromo && (
                        <Badge variant="secondary" className="text-xs">
                          Promotional
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Custom Label</Label>
                      <Input
                        placeholder="e.g., 0% until Dec 2025"
                        value={bucket.label}
                        onChange={(e) => updateBucket(bucket.id, { label: e.target.value })}
                        className="h-10"
                        data-testid={`input-bucket-label-${index}`}
                      />
                    </div>
                    
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Balance</Label>
                        <CurrencyInput
                          valueCents={bucket.balanceCents}
                          onValueChange={(cents) => updateBucket(bucket.id, { balanceCents: cents })}
                          currencySymbol={getCurrencySymbol()}
                          className="h-10"
                          data-testid={`input-bucket-balance-${index}`}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">APR (%)</Label>
                        <PercentageInput
                          valueBps={bucket.aprBps}
                          onValueChange={(bps) => updateBucket(bucket.id, { 
                            aprBps: bps,
                            isPromo: bps === 0
                          })}
                          className="h-10"
                          data-testid={`input-bucket-apr-${index}`}
                        />
                      </div>
                      
                      {bucket.isPromo && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Promo Ends</Label>
                          <Input
                            type="date"
                            value={bucket.promoExpiryDate}
                            onChange={(e) => updateBucket(bucket.id, { 
                              promoExpiryDate: e.target.value 
                            })}
                            className="h-10"
                            data-testid={`input-bucket-promo-date-${index}`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeBucket(bucket.id)}
                    className="text-muted-foreground hover:text-destructive"
                    data-testid={`button-remove-bucket-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Add Bucket Buttons */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Add Balance Type</Label>
            <StatementGuidanceButton bankName={lenderName} />
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(BUCKET_TYPE_LABELS).map(([type, label]) => {
              const colors = BUCKET_TYPE_COLORS[type];
              return (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => addBucket(type)}
                  className={cn("gap-1", colors.bg, colors.border, colors.text)}
                  data-testid={`button-add-bucket-${type}`}
                >
                  <Plus className="h-3 w-3" />
                  {label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Quick Fill Remaining */}
        {remaining > 100 && (
          <Card className="p-4 bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Remaining Balance</p>
                <p className="text-xs text-muted-foreground">
                  {getCurrencySymbol()}{(remaining / 100).toFixed(2)} not yet allocated
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  addBucket(BucketType.PURCHASES);
                  // Slight delay to allow state update
                  setTimeout(() => {
                    setBuckets(prev => {
                      const last = prev[prev.length - 1];
                      if (last) {
                        return prev.map(b => 
                          b.id === last.id 
                            ? { ...b, balanceCents: remaining, aprBps: formatBpsInput(standardApr) }
                            : b
                        );
                      }
                      return prev;
                    });
                  }, 0);
                }}
                data-testid="button-fill-remaining"
              >
                Add as Purchases
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <div 
          key={s} 
          className={cn(
            "flex items-center gap-2",
            s < step ? "text-primary" : s === step ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
            s < step ? "bg-primary text-primary-foreground" : 
            s === step ? "bg-primary/20 border-2 border-primary" : "bg-muted"
          )}>
            {s}
          </div>
          <span className={cn("text-sm hidden md:inline", s !== step && "text-muted-foreground")}>
            {s === 1 ? "Statement" : s === 2 ? "Structure" : "Breakdown"}
          </span>
          {s < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            {isEditing ? "Edit Credit Card" : "Add Credit Card"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Enter your credit card statement details"}
            {step === 2 && "Tell us about your balance structure"}
            {step === 3 && "Break down your balance into rate buckets"}
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep((step - 1) as 1 | 2)}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          {step === 1 && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          )}
          
          <div className="flex-1" />
          
          {step < 3 && splitMode !== "single" && (
            <Button
              onClick={() => setStep((step + 1) as 2 | 3)}
              disabled={step === 1 ? !canProceedFromStep1() : !canProceedFromStep2()}
              data-testid="button-next"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {(step === 3 || (step === 2 && splitMode === "single")) && (
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !canFinish()}
              data-testid="button-save-account"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Card" : "Confirm plan and add to dashboard"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* AI Minimum Payment Confirmation Dialog */}
      <Dialog open={showAiMinPaymentDialog} onOpenChange={setShowAiMinPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Discovered Rule
            </DialogTitle>
            <DialogDescription>
              We found minimum payment information for {lenderName}
            </DialogDescription>
          </DialogHeader>
          
          {discoveredRule && discoveredRule.minPaymentRule && (
            <div className="space-y-4">
              <Card className="p-4 bg-primary/5 border-primary/20">
                <p className="text-sm font-medium mb-3">{discoveredRule.ruleDescription}</p>
                <div className="grid gap-2 text-sm">
                  {(discoveredRule.minPaymentRule.fixedCents ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fixed minimum:</span>
                      <span className="font-mono font-medium">
                        {getCurrencySymbol()}{((discoveredRule.minPaymentRule.fixedCents ?? 0) / 100).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {(discoveredRule.minPaymentRule.percentageBps ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Percentage of balance:</span>
                      <span className="font-mono font-medium">
                        {((discoveredRule.minPaymentRule.percentageBps ?? 0) / 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Includes interest:</span>
                    <span className="font-medium">
                      {discoveredRule.minPaymentRule.includesInterest ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </Card>
              
              {discoveredRule.aprInfo && (
                <Card className="p-4 bg-muted/50">
                  <p className="text-sm font-medium mb-3">APR Information</p>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Standard Purchase APR:</span>
                      <span className="font-mono font-medium">
                        {(discoveredRule.aprInfo.purchaseAprBps / 100).toFixed(2)}%
                      </span>
                    </div>
                    {discoveredRule.aprInfo.balanceTransferAprBps !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Balance Transfer APR:</span>
                        <span className="font-mono font-medium">
                          {(discoveredRule.aprInfo.balanceTransferAprBps / 100).toFixed(2)}%
                        </span>
                      </div>
                    )}
                    {discoveredRule.aprInfo.cashAdvanceAprBps !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cash Advance APR:</span>
                        <span className="font-mono font-medium">
                          {(discoveredRule.aprInfo.cashAdvanceAprBps / 100).toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              )}
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confidence:</span>
                <Badge 
                  variant={discoveredRule.confidence === "high" ? "default" : "secondary"}
                  className={cn(
                    discoveredRule.confidence === "high" && "bg-green-600",
                    discoveredRule.confidence === "medium" && "bg-yellow-600",
                    discoveredRule.confidence === "low" && "bg-orange-600"
                  )}
                  data-testid="badge-confidence"
                >
                  {discoveredRule.confidence}
                </Badge>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAiMinPaymentDialog(false)}
              data-testid="button-cancel-ai-rule"
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => applyDiscoveredRule(false)}
              data-testid="button-apply-payment-only"
            >
              Apply Payment Rule Only
            </Button>
            {discoveredRule?.aprInfo && (
              <Button
                onClick={() => applyDiscoveredRule(true)}
                data-testid="button-apply-all"
              >
                Apply All
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
