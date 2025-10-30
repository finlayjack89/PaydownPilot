import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, CreditCard, CircleDollarSign, Sliders, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Account, Budget, Preferences, PlanResponse } from "@shared/schema";

export default function EmptyDashboard() {
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: budget } = useQuery<Budget>({ queryKey: ["/api/budget"] });
  const { data: preferences } = useQuery<Preferences>({ queryKey: ["/api/preferences"] });
  const { data: plan } = useQuery<PlanResponse | null>({ queryKey: ["/api/plans/latest"] });

  const hasAccounts = accounts.length > 0;
  const hasBudget = !!budget?.monthlyBudgetCents;
  const hasPreferences = !!preferences?.strategy;
  const hasPlan = !!plan;

  const checklistItems = [
    {
      id: "accounts",
      title: "Add Your Accounts",
      description: "Add at least one debt account to get started",
      completed: hasAccounts,
      icon: CreditCard,
      link: "/accounts",
      linkText: "Add Account",
    },
    {
      id: "budget",
      title: "Set Your Budget",
      description: "Define how much you can pay towards debt each month",
      completed: hasBudget,
      icon: CircleDollarSign,
      link: "/budget",
      linkText: "Set Budget",
    },
    {
      id: "preferences",
      title: "Choose Your Strategy",
      description: "Select your debt payoff preferences",
      completed: hasPreferences,
      icon: Sliders,
      link: "/preferences",
      linkText: "Set Preferences",
    },
    {
      id: "plan",
      title: "Generate Your Plan",
      description: "Create an optimized debt payoff plan",
      completed: hasPlan,
      icon: TrendingUp,
      link: "/generate",
      linkText: "Generate Plan",
      disabled: !hasAccounts || !hasBudget || !hasPreferences,
    },
  ];

  const completedCount = checklistItems.filter((item) => item.completed).length;
  const totalCount = checklistItems.length;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold" data-testid="text-welcome-title">
            Welcome to Paydown Pilot
          </h1>
          <p className="text-lg text-muted-foreground">
            Let's get you started on your journey to becoming debt-free
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-medium">Progress:</span>
            <Badge variant="secondary" data-testid="text-progress-count">
              {completedCount} of {totalCount} completed
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started Checklist</CardTitle>
            <CardDescription>
              Complete these steps to generate your personalized debt payoff plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {checklistItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-4 p-4 rounded-lg border hover-elevate"
                data-testid={`card-checklist-${item.id}`}
              >
                <div className="flex-shrink-0 mt-1">
                  {item.completed ? (
                    <CheckCircle2 className="h-6 w-6 text-primary" data-testid={`icon-completed-${item.id}`} />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" data-testid={`icon-pending-${item.id}`} />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold" data-testid={`text-title-${item.id}`}>
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid={`text-description-${item.id}`}>
                    {item.description}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {item.completed ? (
                    <Badge variant="outline" data-testid={`badge-completed-${item.id}`}>
                      Completed
                    </Badge>
                  ) : (
                    <Button
                      asChild
                      size="sm"
                      disabled={item.disabled}
                      data-testid={`button-action-${item.id}`}
                    >
                      <Link href={item.link}>{item.linkText}</Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {completedCount === totalCount && (
          <div className="text-center space-y-4 p-6 rounded-lg border bg-primary/5">
            <p className="text-lg font-medium">
              🎉 You've completed all the steps!
            </p>
            <Button asChild size="lg" data-testid="button-view-plan">
              <Link href="/plan">View Your Plan</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
