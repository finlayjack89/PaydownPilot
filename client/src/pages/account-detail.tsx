import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { AccountTimeline } from "@/components/account-timeline";

export default function AccountDetail() {
  const [match, params] = useRoute("/accounts/:id");
  const { user } = useAuth();
  const accountId = params?.id;

  const { data: account, isLoading } = useQuery({
    queryKey: ["/api/accounts", accountId],
    enabled: !!accountId,
  });

  const { data: plan } = useQuery({
    queryKey: ["/api/plans/latest"],
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
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

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild data-testid="button-back">
            <Link href="/accounts">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Accounts
            </Link>
          </Button>
        </div>

        {/* Account Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl" data-testid="text-account-name">
                      {account.lenderName}
                    </CardTitle>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" data-testid="badge-account-type">
                        {account.accountType}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <Button asChild variant="outline" data-testid="button-edit-account">
                <Link href="/accounts">Edit Account</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Account Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card data-testid="card-current-balance">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono" data-testid="text-current-balance">
                {formatCurrency(account.currentBalanceCents, user?.currency)}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-apr">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Interest Rate</CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono" data-testid="text-apr">
                {(account.aprStandardBps / 100).toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">APR</p>
            </CardContent>
          </Card>

          <Card data-testid="card-payment-due">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Due Day</CardTitle>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono" data-testid="text-payment-due-day">
                Day {account.paymentDueDay}
              </div>
              <p className="text-xs text-muted-foreground mt-1">of each month</p>
            </CardContent>
          </Card>
        </div>

        {/* Account Details */}
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Complete information for this account</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Account Type</dt>
                <dd className="mt-1 text-sm" data-testid="text-detail-account-type">{account.accountType}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Lender</dt>
                <dd className="mt-1 text-sm" data-testid="text-detail-lender">{account.lenderName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Minimum Payment (Fixed)</dt>
                <dd className="mt-1 text-sm font-mono" data-testid="text-detail-min-payment-fixed">
                  {formatCurrency(account.minPaymentRuleFixedCents, user?.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Minimum Payment (Percentage)</dt>
                <dd className="mt-1 text-sm font-mono" data-testid="text-detail-min-payment-percentage">
                  {(account.minPaymentRulePercentageBps / 100).toFixed(2)}%
                </dd>
              </div>
              {account.accountOpenDate && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Account Opened</dt>
                  <dd className="mt-1 text-sm" data-testid="text-detail-open-date">
                    {new Date(account.accountOpenDate).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {account.promoEndDate && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Promo End Date</dt>
                  <dd className="mt-1 text-sm" data-testid="text-detail-promo-end">
                    {new Date(account.promoEndDate).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
            {account.notes && (
              <div className="mt-6 pt-6 border-t">
                <dt className="text-sm font-medium text-muted-foreground mb-2">Notes</dt>
                <dd className="text-sm" data-testid="text-detail-notes">{account.notes}</dd>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Timeline */}
        {plan && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Timeline</CardTitle>
              <CardDescription>
                Visualize how this account will be paid off over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccountTimeline 
                data={plan.planData || []} 
                currency={user?.currency || "USD"}
                accountName={account.lenderName}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
