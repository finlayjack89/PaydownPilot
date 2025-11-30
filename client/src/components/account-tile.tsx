import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ShoppingBag, Banknote } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/format";
import type { Account, AccountWithBuckets, DebtBucket } from "@shared/schema";
import { AccountType, BucketType } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AccountTileProps {
  account: Account | AccountWithBuckets;
  currency?: string;
}

const BUCKET_COLORS: Record<string, string> = {
  [BucketType.BALANCE_TRANSFER]: "bg-blue-500",
  [BucketType.PURCHASES]: "bg-green-500",
  [BucketType.CASH_ADVANCE]: "bg-orange-500",
  [BucketType.MONEY_TRANSFER]: "bg-purple-500",
  [BucketType.CUSTOM]: "bg-gray-500",
};

const BUCKET_PROMO_PATTERNS: Record<string, string> = {
  [BucketType.BALANCE_TRANSFER]: "bg-gradient-to-r from-blue-500 via-blue-300 to-blue-500 bg-[length:10px_100%]",
  [BucketType.PURCHASES]: "bg-gradient-to-r from-green-500 via-green-300 to-green-500 bg-[length:10px_100%]",
  [BucketType.CASH_ADVANCE]: "bg-gradient-to-r from-orange-500 via-orange-300 to-orange-500 bg-[length:10px_100%]",
  [BucketType.MONEY_TRANSFER]: "bg-gradient-to-r from-purple-500 via-purple-300 to-purple-500 bg-[length:10px_100%]",
  [BucketType.CUSTOM]: "bg-gradient-to-r from-gray-500 via-gray-300 to-gray-500 bg-[length:10px_100%]",
};

const BUCKET_LABELS: Record<string, string> = {
  [BucketType.BALANCE_TRANSFER]: "Balance Transfer",
  [BucketType.PURCHASES]: "Purchases",
  [BucketType.CASH_ADVANCE]: "Cash Advance",
  [BucketType.MONEY_TRANSFER]: "Money Transfer",
  [BucketType.CUSTOM]: "Custom",
};

export function AccountTile({ account, currency = "USD" }: AccountTileProps) {
  const displayCurrency = account.currency || currency;
  const buckets = 'buckets' in account ? (account.buckets || []) : [];
  const hasBuckets = buckets.length > 1;

  const getAccountIcon = (type: string) => {
    switch (type) {
      case AccountType.CREDIT_CARD: return <CreditCard className="h-6 w-6" />;
      case AccountType.BNPL: return <ShoppingBag className="h-6 w-6" />;
      case AccountType.LOAN: return <Banknote className="h-6 w-6" />;
      default: return <CreditCard className="h-6 w-6" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case AccountType.CREDIT_CARD: return "Credit Card";
      case AccountType.BNPL: return "Buy Now Pay Later";
      case AccountType.LOAN: return "Loan";
      default: return "Account";
    }
  };

  const renderBucketBar = () => {
    if (!hasBuckets) return null;

    const totalBalance = account.currentBalanceCents;
    if (totalBalance <= 0) return null;

    return (
      <div className="mt-3">
        <p className="text-xs text-muted-foreground mb-1.5">Balance Breakdown</p>
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted" data-testid={`bucket-bar-${account.id}`}>
          {buckets.map((bucket, index) => {
            const percentage = (bucket.balanceCents / totalBalance) * 100;
            if (percentage < 1) return null;
            
            const colorClass = bucket.isPromo 
              ? BUCKET_PROMO_PATTERNS[bucket.bucketType] || BUCKET_PROMO_PATTERNS[BucketType.CUSTOM]
              : BUCKET_COLORS[bucket.bucketType] || BUCKET_COLORS[BucketType.CUSTOM];
            
            return (
              <Tooltip key={bucket.id || index}>
                <TooltipTrigger asChild>
                  <div 
                    className={cn("h-full transition-all hover:opacity-80", colorClass)}
                    style={{ width: `${percentage}%` }}
                    data-testid={`bucket-segment-${account.id}-${index}`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <p className="font-medium">
                      {bucket.label || BUCKET_LABELS[bucket.bucketType] || "Balance"}
                    </p>
                    <p className="text-muted-foreground">
                      {formatCurrency(bucket.balanceCents, displayCurrency)} at {formatPercentage(bucket.aprBps)}
                      {bucket.isPromo && " (Promo)"}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {buckets.map((bucket, index) => (
            <div key={bucket.id || index} className="flex items-center gap-1 text-xs">
              <div className={cn(
                "w-2 h-2 rounded-full",
                BUCKET_COLORS[bucket.bucketType] || BUCKET_COLORS[BucketType.CUSTOM]
              )} />
              <span className="text-muted-foreground">
                {formatPercentage(bucket.aprBps)}
                {bucket.isPromo && "*"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getDisplayApr = () => {
    if (hasBuckets) {
      const nonPromoBuckets = buckets.filter(b => !b.isPromo);
      if (nonPromoBuckets.length > 0) {
        const maxApr = Math.max(...nonPromoBuckets.map(b => b.aprBps));
        return formatPercentage(maxApr);
      }
    }
    return formatPercentage(account.aprStandardBps);
  };

  return (
    <Link href={`/accounts/${account.id}`}>
      <Card className="hover-elevate active-elevate-2 cursor-pointer transition-all" data-testid={`tile-account-${account.id}`}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <div className="flex items-center gap-2">
            {getAccountIcon(account.accountType)}
            <div>
              <CardTitle className="text-base" data-testid={`text-account-name-${account.id}`}>
                {account.lenderName}
              </CardTitle>
              <Badge variant="secondary" className="text-xs mt-1">
                {getTypeLabel(account.accountType)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className="text-2xl font-mono font-bold" data-testid={`text-balance-${account.id}`}>
                {formatCurrency(account.currentBalanceCents, displayCurrency)}
              </p>
            </div>
            
            {renderBucketBar()}
            
            <div className="flex justify-between gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">
                  {hasBuckets ? "Highest APR" : "APR"}
                </p>
                <p className="font-medium" data-testid={`text-apr-${account.id}`}>
                  {getDisplayApr()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Payment Day</p>
                <p className="font-medium" data-testid={`text-payment-day-${account.id}`}>
                  {account.paymentDueDay}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
