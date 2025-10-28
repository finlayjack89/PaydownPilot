import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Plus, CreditCard, ShoppingBag, Banknote, Edit, Trash2, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Account } from "@shared/schema";
import { AccountType } from "@shared/schema";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function Accounts() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete account");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({
        title: "Account deleted",
        description: "The account has been removed successfully.",
      });
      setDeletingAccountId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getAccountIcon = (type: string) => {
    switch (type) {
      case AccountType.CREDIT_CARD:
        return <CreditCard className="h-5 w-5" />;
      case AccountType.BNPL:
        return <ShoppingBag className="h-5 w-5" />;
      case AccountType.LOAN:
        return <Banknote className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const totalDebt = accounts.reduce((sum, acc) => sum + acc.currentBalanceCents, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Your Accounts</h1>
            <p className="text-muted-foreground mt-2">
              Manage your credit cards, loans, and BNPL accounts
            </p>
          </div>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="h-12 px-6"
            data-testid="button-add-account"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>

        {accounts.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Debt</p>
                  <p className="text-3xl font-mono font-bold mt-1" data-testid="text-total-debt">
                    {formatCurrency(totalDebt, user?.currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">{accounts.length} Accounts</p>
                  {accounts.length >= 1 && (
                    <Button
                      onClick={() => setLocation("/budget")}
                      className="mt-2"
                      data-testid="button-continue-budget"
                    >
                      Continue to Budget
                      <TrendingDown className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && accounts.length === 0 && (
          <Card className="text-center py-16">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-muted p-6">
                  <CreditCard className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
              <CardTitle className="text-2xl">No accounts yet</CardTitle>
              <CardDescription className="text-base mt-2">
                Add your first account to start building your debt repayment plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="h-12 px-8"
                data-testid="button-add-first-account"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Account
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && accounts.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Card key={account.id} className="hover:shadow-md transition-shadow" data-testid={`card-account-${account.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getAccountIcon(account.accountType)}
                      <div>
                        <CardTitle className="text-lg">{account.lenderName}</CardTitle>
                        <Badge variant="secondary" className="mt-1">
                          {account.accountType}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingAccount(account);
                          setIsAddDialogOpen(true);
                        }}
                        data-testid={`button-edit-${account.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingAccountId(account.id)}
                        data-testid={`button-delete-${account.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Balance</p>
                    <p className="text-2xl font-mono font-bold">
                      {formatCurrency(account.currentBalanceCents, user?.currency)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">APR</p>
                      <p className="text-sm font-mono font-semibold">
                        {formatPercentage(account.aprStandardBps)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Due Day</p>
                      <p className="text-sm font-mono font-semibold">
                        Day {account.paymentDueDay}
                      </p>
                    </div>
                  </div>
                  {(account.promoEndDate || account.promoDurationMonths) && (
                    <Badge variant="default" className="w-full justify-center">
                      0% Promo Active
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AddAccountDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) setEditingAccount(null);
        }}
        account={editingAccount}
      />

      <AlertDialog open={!!deletingAccountId} onOpenChange={(open) => !open && setDeletingAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this account from your portfolio. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAccountId && deleteMutation.mutate(deletingAccountId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
