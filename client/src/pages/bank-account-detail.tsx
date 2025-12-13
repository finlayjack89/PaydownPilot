import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Building2,
  Clock,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Home,
  Car,
  ShoppingCart,
  Utensils,
  Heart,
  Zap,
  CreditCard,
  Gift,
  HelpCircle
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";

interface CategoryBreakdown {
  category: string;
  displayName: string;
  budgetGroup: string;
  icon: string;
  color: string;
  totalCents: number;
  transactionCount: number;
  percentage: number;
}

interface EnrichedTransactionDetail {
  id: string;
  trueLayerTransactionId: string;
  originalDescription: string;
  merchantCleanName: string | null;
  merchantLogoUrl: string | null;
  amountCents: number;
  entryType: string;
  ukCategory: string | null;
  budgetCategory: string | null;
  transactionDate: string | null;
  isRecurring: boolean | null;
  recurrenceFrequency: string | null;
}

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

interface AccountDetailResponse {
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
  transactions: EnrichedTransactionDetail[];
  categoryBreakdown: CategoryBreakdown[];
}

const categoryIcons: Record<string, typeof Wallet> = {
  // Income
  employment: Briefcase,
  benefits: Gift,
  pension: Wallet,
  investment_income: TrendingUp,
  rental_income: Home,
  side_hustle: Briefcase,
  other_income: Wallet,
  // Fixed Costs
  rent: Home,
  mortgage: Home,
  council_tax: Building2,
  utilities: Zap,
  insurance: Heart,
  childcare: Heart,
  // Essentials
  groceries: ShoppingCart,
  transport: Car,
  healthcare: Heart,
  education: Gift,
  // Discretionary
  subscriptions: CreditCard,
  entertainment: Gift,
  dining: Utensils,
  shopping: ShoppingCart,
  personal_care: Heart,
  travel: Car,
  gifts: Gift,
  // Debt & Savings
  debt_payment: CreditCard,
  savings: Wallet,
  // Other
  transfer: TrendingDown,
  cash: Wallet,
  fees: CreditCard,
  other: HelpCircle,
};

const budgetGroupColors: Record<string, string> = {
  income: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  fixed_costs: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  essentials: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  discretionary: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  debt: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function BankAccountDetail() {
  const [match, params] = useRoute("/current-finances/:id");
  const { user } = useAuth();
  const { toast } = useToast();
  const accountId = params?.id;
  const currency = user?.currency || "GBP";

  const { data: account, isLoading, refetch } = useQuery<AccountDetailResponse>({
    queryKey: ["/api/current-finances/account", accountId],
    queryFn: async () => {
      const response = await fetch(`/api/current-finances/account/${accountId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch account details");
      return response.json();
    },
    enabled: !!accountId,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/current-finances/account/${accountId}/analyze`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/current-finances/account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["/api/current-finances/combined"] });
      toast({ title: "Analysis complete", description: "Transactions have been re-analyzed." });
    },
    onError: () => {
      toast({ title: "Analysis failed", description: "Could not analyze transactions.", variant: "destructive" });
    },
  });

  const toggleSideHustleMutation = useMutation({
    mutationFn: async (isSideHustle: boolean) => {
      const response = await apiRequest("PATCH", `/api/truelayer/item/${accountId}`, { isSideHustle });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/current-finances/account", accountId] });
      queryClient.invalidateQueries({ queryKey: ["/api/current-finances/combined"] });
      toast({ title: "Updated", description: "Account preference saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update preference.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" data-testid="loading-spinner" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Account Not Found</CardTitle>
            <CardDescription>
              The bank account you're looking for doesn't exist or has been disconnected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild data-testid="button-back-to-finances">
              <Link href="/current-finances">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Current Finances
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isConnected = account.connectionStatus === "connected" || account.connectionStatus === "active";
  const lastSynced = account.lastSyncedAt 
    ? formatDistanceToNow(new Date(account.lastSyncedAt), { addSuffix: true })
    : "Never";

  const incomeTransactions = account.transactions.filter(tx => tx.entryType === "incoming");
  const outgoingTransactions = account.transactions.filter(tx => tx.entryType === "outgoing");

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button variant="ghost" asChild data-testid="button-back">
            <Link href="/current-finances">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Current Finances
            </Link>
          </Button>
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            variant="outline"
            data-testid="button-reanalyze"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />
            Re-analyze
          </Button>
        </div>

        {/* Account Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {account.institutionLogoUrl ? (
                  <img
                    src={account.institutionLogoUrl}
                    alt={account.institutionName}
                    className="h-14 w-14 rounded-full object-contain bg-white border"
                    data-testid="img-institution"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-7 w-7 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-2xl" data-testid="text-institution-name">
                    {account.institutionName}
                  </CardTitle>
                  <CardDescription className="text-base" data-testid="text-account-name">
                    {account.accountName}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isConnected ? (
                  <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    <AlertCircle className="h-3 w-3" />
                    Disconnected
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span data-testid="text-last-synced">Last synced {lastSynced}</span>
                <span className="mx-2">|</span>
                <span data-testid="text-transaction-count">{account.transactionCount} transactions</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="side-hustle"
                  checked={account.isSideHustle || false}
                  onCheckedChange={(checked) => toggleSideHustleMutation.mutate(checked)}
                  disabled={toggleSideHustleMutation.isPending}
                  data-testid="switch-side-hustle"
                />
                <Label htmlFor="side-hustle" className="flex items-center gap-1 cursor-pointer">
                  <Briefcase className="h-4 w-4" />
                  Side Hustle Account
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {account.analysisSummary && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-mono font-bold text-green-600 dark:text-green-400" data-testid="text-income">
                  {formatCurrency(account.analysisSummary.averageMonthlyIncomeCents, currency)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fixed Costs</CardTitle>
                <Building2 className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-mono font-bold" data-testid="text-fixed-costs">
                  {formatCurrency(account.analysisSummary.fixedCostsCents, currency)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Essentials</CardTitle>
                <Wallet className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-mono font-bold" data-testid="text-essentials">
                  {formatCurrency(account.analysisSummary.essentialsCents, currency)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Discretionary</CardTitle>
                <Gift className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-mono font-bold" data-testid="text-discretionary">
                  {formatCurrency(account.analysisSummary.discretionaryCents, currency)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Category Breakdown */}
        {account.categoryBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
              <CardDescription>Breakdown of your transactions by budget category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {account.categoryBreakdown.map((cat) => {
                  const IconComponent = categoryIcons[cat.category] || HelpCircle;
                  return (
                    <div key={cat.category} className="space-y-2" data-testid={`category-${cat.category}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{cat.displayName}</span>
                          <Badge variant="secondary" className={budgetGroupColors[cat.budgetGroup] || budgetGroupColors.other}>
                            {cat.budgetGroup.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">{cat.transactionCount} txns</span>
                          <span className="font-mono font-semibold">{formatCurrency(cat.totalCents, currency)}</span>
                        </div>
                      </div>
                      <Progress value={cat.percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" data-testid="tab-all">All ({account.transactions.length})</TabsTrigger>
            <TabsTrigger value="income" data-testid="tab-income">Income ({incomeTransactions.length})</TabsTrigger>
            <TabsTrigger value="outgoing" data-testid="tab-outgoing">Outgoing ({outgoingTransactions.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <TransactionTable transactions={account.transactions} currency={currency} />
          </TabsContent>
          
          <TabsContent value="income">
            <TransactionTable transactions={incomeTransactions} currency={currency} />
          </TabsContent>
          
          <TabsContent value="outgoing">
            <TransactionTable transactions={outgoingTransactions} currency={currency} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function TransactionTable({ transactions, currency }: { transactions: EnrichedTransactionDetail[]; currency: string }) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No transactions in this category
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.slice(0, 50).map((tx) => {
            const IconComponent = categoryIcons[tx.ukCategory || "other"] || HelpCircle;
            const isIncoming = tx.entryType === "incoming";
            return (
              <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                <TableCell className="text-muted-foreground">
                  {tx.transactionDate ? format(new Date(tx.transactionDate), "MMM d, yyyy") : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {tx.merchantLogoUrl && (
                      <img src={tx.merchantLogoUrl} alt="" className="h-6 w-6 rounded-full object-contain" />
                    )}
                    <div>
                      <p className="font-medium">{tx.merchantCleanName || tx.originalDescription}</p>
                      {tx.isRecurring && (
                        <Badge variant="outline" className="text-xs">
                          Recurring {tx.recurrenceFrequency && `(${tx.recurrenceFrequency})`}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{tx.ukCategory?.replace(/_/g, " ") || "Other"}</span>
                  </div>
                </TableCell>
                <TableCell className={`text-right font-mono font-semibold ${isIncoming ? "text-green-600 dark:text-green-400" : ""}`}>
                  {isIncoming ? "+" : "-"}{formatCurrency(Math.abs(tx.amountCents), currency)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {transactions.length > 50 && (
        <div className="p-4 text-center text-sm text-muted-foreground border-t">
          Showing 50 of {transactions.length} transactions
        </div>
      )}
    </Card>
  );
}
