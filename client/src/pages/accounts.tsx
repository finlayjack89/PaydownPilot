import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Plus, CreditCard, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import type { Account } from "@shared/schema";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { AccountTile } from "@/components/account-tile";

export default function Accounts() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

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
                    {formatCurrency(totalDebt, user?.currency ?? undefined)}
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
              <AccountTile
                key={account.id}
                account={account}
                currency={user?.currency ?? undefined}
              />
            ))}
          </div>
        )}
      </main>

      <AddAccountDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </div>
  );
}
