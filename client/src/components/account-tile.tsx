import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ShoppingBag, Banknote } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/format";
import type { Account } from "@shared/schema";
import { AccountType } from "@shared/schema";

interface AccountTileProps {
  account: Account;
  currency?: string;
}

export function AccountTile({ account, currency = "USD" }: AccountTileProps) {
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
                {formatCurrency(account.currentBalanceCents, currency)}
              </p>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">APR</p>
                <p className="font-medium" data-testid={`text-apr-${account.id}`}>
                  {formatPercentage(account.aprStandardBps)}
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
