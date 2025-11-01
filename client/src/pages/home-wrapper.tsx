import { useAccounts, useActivePlan } from "@/hooks/use-plan-data";
import { useAuth } from "@/lib/auth-context";
import { Redirect } from "wouter";
import EmptyDashboard from "./empty-dashboard";
import ActiveDashboard from "./active-dashboard";

export default function HomePageWrapper() {
  const { user } = useAuth();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: plan, isLoading: planLoading } = useActivePlan();
  
  // Redirect to onboarding if user hasn't completed it (no country/region/currency)
  if (user && (!user.country || !user.region || !user.currency)) {
    return <Redirect to="/onboarding" />;
  }
  
  if (accountsLoading || planLoading) {
    return <div className="flex min-h-screen items-center justify-center" data-testid="loading-home">
      <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
    </div>;
  }
  
  // Has plan → ActiveDashboard
  if (plan) {
    return <ActiveDashboard />;
  }
  
  // No plan → EmptyDashboard
  return <EmptyDashboard />;
}
