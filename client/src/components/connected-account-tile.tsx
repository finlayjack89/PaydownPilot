import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Briefcase } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";

interface AccountAnalysisSummary {
  averageMonthlyIncomeCents: number;
  employmentIncomeCents: number;
  otherIncomeCents: number;
  sideHustleIncomeCents: number;
  fixedCostsCents: number;
  essentialsCents: number;
  discretionaryCents: number;
  debtPaymentsCents: number;
  availableForDebtCents: number;
  analysisMonths: number;
  lastUpdated: string;
}

interface ConnectedAccountSummary {
  id: string;
  trueLayerAccountId: string;
  institutionName: string;
  institutionLogoUrl: string | null;
  accountName: string;
  accountType: string | null;
  currency: string | null;
  connectionStatus: string | null;
  isSideHustle: boolean | null;
  lastSyncedAt: string | null;
  lastEnrichedAt: string | null;
  lastAnalyzedAt: string | null;
  transactionCount: number;
  analysisSummary: AccountAnalysisSummary | null;
}

interface ConnectedAccountTileProps {
  account: ConnectedAccountSummary;
  currency: string;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export function ConnectedAccountTile({ account, currency, isRefreshing, onRefresh }: ConnectedAccountTileProps) {
  const isConnected = account.connectionStatus === "connected" || account.connectionStatus === "active";
  const hasAnalysis = !!account.analysisSummary;
  
  const lastSynced = account.lastSyncedAt 
    ? formatDistanceToNow(new Date(account.lastSyncedAt), { addSuffix: true })
    : "Never";

  return (
    <Card 
      className="hover-elevate transition-all"
      data-testid={`card-account-${account.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-center gap-3 min-w-0">
          {account.institutionLogoUrl ? (
            <img
              src={account.institutionLogoUrl}
              alt={account.institutionName}
              className="h-10 w-10 rounded-full object-contain bg-white border"
              data-testid={`img-institution-${account.id}`}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-lg font-semibold text-muted-foreground">
                {account.institutionName.charAt(0)}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <CardTitle className="text-base truncate" data-testid={`text-institution-${account.id}`}>
              {account.institutionName}
            </CardTitle>
            <CardDescription className="truncate" data-testid={`text-account-name-${account.id}`}>
              {account.accountName}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {account.isSideHustle && (
            <Badge variant="secondary" className="gap-1" data-testid={`badge-side-hustle-${account.id}`}>
              <Briefcase className="h-3 w-3" />
              Side Hustle
            </Badge>
          )}
          {isConnected ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" data-testid={`icon-connected-${account.id}`} />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-500" data-testid={`icon-disconnected-${account.id}`} />
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {hasAnalysis && account.analysisSummary ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Monthly Income</p>
                <p className="font-mono font-semibold text-green-600 dark:text-green-400" data-testid={`text-income-${account.id}`}>
                  {formatCurrency(account.analysisSummary.averageMonthlyIncomeCents, currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fixed Costs</p>
                <p className="font-mono font-semibold" data-testid={`text-fixed-${account.id}`}>
                  {formatCurrency(account.analysisSummary.fixedCostsCents, currency)}
                </p>
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{account.transactionCount} transactions</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {lastSynced}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {account.transactionCount > 0 
                ? `${account.transactionCount} transactions ready for analysis`
                : "No transactions synced yet"
              }
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lastSynced}
              </span>
            </div>
          </div>
        )}
        
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-full mt-3"
            data-testid={`button-refresh-${account.id}`}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Analyzing..." : "Re-analyze"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
