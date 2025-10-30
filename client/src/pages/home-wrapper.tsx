import { useAccounts, useActivePlan } from "@/hooks/use-plan-data";
import { Redirect } from "wouter";
import EmptyDashboard from "./empty-dashboard";
import ActiveDashboard from "./active-dashboard";

export default function HomePageWrapper() {
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: plan, isLoading: planLoading } = useActivePlan();
  
  if (accountsLoading || planLoading) {
    return <div className="flex min-h-screen items-center justify-center" data-testid="loading-home">
      <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
    </div>;
  }
  
  // No accounts → EmptyDashboard
  if (!accounts || accounts.length === 0) {
    return <EmptyDashboard />;
  }
  
  // Has accounts but no plan → Redirect to generate
  if (!plan) {
    return <Redirect to="/generate" />;
  }
  
  // Has both → ActiveDashboard
  return <ActiveDashboard />;
}
