import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
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
  CreditCard, 
  ShoppingBag, 
  Banknote, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Edit2, 
  Trash2,
  Layers
} from "lucide-react";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { useAccounts, useActivePlan } from "@/hooks/use-plan-data";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { AccountTimeline } from "@/components/account-timeline";
import type { Account, DebtBucket } from "@shared/schema";
import { AccountType, BucketType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AccountDetail() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/accounts/:id");
  const { user } = useAuth();
  const { toast } = useToast();
  const accountId = params?.id;

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: accounts = [], isLoading: isLoadingAccount } = useAccounts();
  const account = accounts.find(acc => acc.id === accountId);

  const { data: plan, isLoading: isLoadingPlan } = useActivePlan();
  
  const { data: buckets = [] } = useQuery<DebtBucket[]>({
    queryKey: [`/api/accounts/${accountId}/buckets`],
    enabled: !!accountId,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/accounts/${accountId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({
        title: "Account deleted",
        description: "Your account has been deleted successfully.",
      });
      setLocation("/accounts");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getAccountIcon = (type: string) => {
    switch (type) {
      case AccountType.CREDIT_CARD: return <CreditCard className="h-8 w-8 text-primary" />;
      case AccountType.BNPL: return <ShoppingBag className="h-8 w-8 text-primary" />;
      case AccountType.LOAN: return <Banknote className="h-8 w-8 text-primary" />;
      default: return <CreditCard className="h-8 w-8 text-primary" />;
    }
  };

  const getPromoDuration = () => {
    if (!account) return null;
    
    if (account.promoDurationMonths) {
      return `${account.promoDurationMonths} months`;
    }
    
    if (account.promoEndDate && account.accountOpenDate) {
      const start = new Date(account.accountOpenDate);
      const end = new Date(account.promoEndDate);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      return `${months} months`;
    }
    
    return null;
  };

  // Filter plan data to show only this account's schedule
  const accountSchedule = plan?.plan?.filter(
    (entry: any) => entry.lenderName === account?.lenderName
  ) || [];

  const accountInfo = plan?.accountSchedules?.find(
    (schedule) => schedule.accountId === accountId
  );

  if (isLoadingAccount) {
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
              The account you're looking for doesn't exist or has been removed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild data-testid="button-back-to-accounts">
              <Link href="/accounts">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Accounts
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const minPayment = Math.max(
    (account.minPaymentRuleFixedCents || 0) / 100,
    (account.currentBalanceCents * (account.minPaymentRulePercentageBps || 0)) / 1000000
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild data-testid="button-back">
            <Link href="/accounts">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Accounts
            </Link>
          </Button>
        </div>

        {/* Account Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {getAccountIcon(account.accountType)}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-3xl mb-2" data-testid="text-account-name">
                    {account.lenderName}
                  </CardTitle>
                  <Badge variant="outline" data-testid="badge-account-type">
                    {account.accountType}
                  </Badge>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(true)}
                  data-testid="button-edit-account"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDeleteDialogOpen(true)}
                  data-testid="button-delete-account"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Current Balance</p>
                <p className="text-3xl font-mono font-bold" data-testid="text-current-balance">
                  {formatCurrency(account.currentBalanceCents, user?.currency || undefined)}
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Interest Rate</p>
                <p className="text-3xl font-mono font-bold" data-testid="text-apr">
                  {(account.aprStandardBps / 100).toFixed(2)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">APR</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Payment Due Day</p>
                <p className="text-3xl font-mono font-bold" data-testid="text-payment-due-day">
                  {account.paymentDueDay}
                </p>
                <p className="text-xs text-muted-foreground mt-1">of each month</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Min Payment</p>
                <p className="text-3xl font-mono font-bold" data-testid="text-min-payment">
                  {formatCurrency(Math.round(minPayment * 100), user?.currency || undefined)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">estimated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Complete information for this account</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {account.accountOpenDate && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Account Opened</dt>
                  <dd className="mt-1 text-base" data-testid="text-detail-open-date">
                    {formatDate(account.accountOpenDate)}
                  </dd>
                </div>
              )}
              
              {account.promoEndDate && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Promo End Date</dt>
                  <dd className="mt-1 text-base" data-testid="text-detail-promo-end">
                    {formatDate(account.promoEndDate)}
                  </dd>
                </div>
              )}
              
              {getPromoDuration() && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Promo Duration</dt>
                  <dd className="mt-1 text-base" data-testid="text-detail-promo-duration">
                    {getPromoDuration()}
                  </dd>
                </div>
              )}
              
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Min Payment (Fixed)</dt>
                <dd className="mt-1 text-base font-mono" data-testid="text-detail-min-payment-fixed">
                  {formatCurrency(account.minPaymentRuleFixedCents || 0, user?.currency || undefined)}
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Min Payment (Percentage)</dt>
                <dd className="mt-1 text-base font-mono" data-testid="text-detail-min-payment-percentage">
                  {((account.minPaymentRulePercentageBps || 0) / 100).toFixed(2)}%
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Includes Interest in Min Payment</dt>
                <dd className="mt-1 text-base" data-testid="text-detail-includes-interest">
                  {account.minPaymentRuleIncludesInterest ? "Yes" : "No"}
                </dd>
              </div>
              
              {accountInfo && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Projected Payoff Time</dt>
                  <dd className="mt-1 text-base" data-testid="text-detail-payoff-months">
                    {accountInfo.payoffTimeMonths} months
                  </dd>
                </div>
              )}
            </dl>
            
            {account.notes && (
              <div className="mt-6 pt-6 border-t">
                <dt className="text-sm font-medium text-muted-foreground mb-2">Notes</dt>
                <dd className="text-base" data-testid="text-detail-notes">{account.notes}</dd>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bucket Breakdown Section */}
        {buckets.length > 0 && (
          <Card data-testid="card-bucket-breakdown">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Balance Breakdown
              </CardTitle>
              <CardDescription>
                View the different rate segments of your balance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {buckets.map((bucket, index) => {
                  const totalBalance = buckets.reduce((sum, b) => sum + b.balanceCents, 0);
                  const percentage = totalBalance > 0 ? (bucket.balanceCents / totalBalance) * 100 : 0;
                  const monthsLeft = bucket.promoExpiryDate 
                    ? Math.max(0, Math.ceil((new Date(bucket.promoExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)))
                    : null;
                  
                  return (
                    <div 
                      key={bucket.id} 
                      className="p-4 border rounded-lg space-y-3"
                      data-testid={`bucket-${index}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold" data-testid={`bucket-name-${index}`}>
                            {bucket.label || bucket.bucketType}
                          </span>
                          {bucket.isPromo && (
                            <Badge variant="secondary" data-testid={`bucket-promo-badge-${index}`}>
                              Promo Rate
                            </Badge>
                          )}
                        </div>
                        <span className="font-mono font-bold" data-testid={`bucket-apr-${index}`}>
                          {(bucket.aprBps / 100).toFixed(2)}% APR
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Balance</span>
                        <span className="font-mono" data-testid={`bucket-balance-${index}`}>
                          {formatCurrency(bucket.balanceCents, user?.currency || undefined)}
                        </span>
                      </div>
                      
                      <Progress value={percentage} className="h-2" />
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{percentage.toFixed(1)}% of total balance</span>
                        {bucket.isPromo && bucket.promoExpiryDate && (
                          <span className="flex items-center gap-1" data-testid={`bucket-expiry-${index}`}>
                            <Calendar className="h-3 w-3" />
                            {monthsLeft !== null && monthsLeft > 0 
                              ? `${monthsLeft} month${monthsLeft !== 1 ? 's' : ''} left`
                              : 'Expires soon'}
                            {' '}({formatDate(bucket.promoExpiryDate)})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {/* Total Summary */}
                <div className="pt-4 border-t flex items-center justify-between">
                  <span className="font-medium">Total Balance</span>
                  <span className="font-mono font-bold text-lg" data-testid="bucket-total">
                    {formatCurrency(buckets.reduce((sum, b) => sum + b.balanceCents, 0), user?.currency || undefined)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Timeline Visualization */}
        {plan && accountSchedule.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Timeline</CardTitle>
              <CardDescription>
                Visualize how this account will be paid off over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccountTimeline 
                data={accountSchedule} 
                currency={user?.currency || "USD"}
                accountName={account.lenderName}
              />
            </CardContent>
          </Card>
        )}

        {/* Payment Schedule Table */}
        {plan && accountSchedule.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Schedule</CardTitle>
              <CardDescription>
                Month-by-month breakdown of payments, interest, and balance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Month</TableHead>
                      <TableHead className="text-right">Payment</TableHead>
                      <TableHead className="text-right">Interest</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Remaining Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountSchedule.map((entry: any) => {
                      const principal = entry.paymentCents - entry.interestChargedCents;
                      const startDate = plan.planStartDate ? new Date(plan.planStartDate) : new Date();
                      
                      return (
                        <TableRow key={entry.month} data-testid={`row-month-${entry.month}`}>
                          <TableCell className="font-medium" data-testid={`text-month-${entry.month}`}>
                            {formatMonthYear(entry.month - 1, startDate)}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-payment-${entry.month}`}>
                            {formatCurrency(entry.paymentCents, user?.currency || undefined)}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-interest-${entry.month}`}>
                            {formatCurrency(entry.interestChargedCents, user?.currency || undefined)}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-principal-${entry.month}`}>
                            {formatCurrency(principal, user?.currency || undefined)}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-balance-${entry.month}`}>
                            {formatCurrency(entry.endingBalanceCents, user?.currency || undefined)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Plan State */}
        {!isLoadingPlan && !plan && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Timeline</CardTitle>
              <CardDescription>
                Generate a plan to see your payment timeline
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground mb-4" data-testid="text-no-plan">
                You haven't generated a payment plan yet. Create a plan to see the month-by-month payment schedule for this account.
              </p>
              <Button asChild data-testid="button-generate-plan">
                <Link href="/budget">
                  Resolve
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Account Dialog */}
      <AddAccountDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        account={account}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{account.lenderName}"? This action cannot be undone.
              Any plans associated with this account will need to be regenerated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
