import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Onboarding from "@/pages/onboarding";
import Accounts from "@/pages/accounts";
import Budget from "@/pages/budget";
import Preferences from "@/pages/preferences";
import Generate from "@/pages/generate";
import HomePageWrapper from "@/pages/home-wrapper";
import PlanOverview from "@/pages/plan-overview";
import AccountDetail from "@/pages/account-detail";
import { type ReactNode } from "react";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  return user ? <Component /> : <Redirect to="/login" />;
}

function Router() {
  const { user, isLoading } = useAuth();
  
  return (
    <Switch>
      <Route path="/" component={() => {
        if (isLoading) {
          return (
            <div className="flex min-h-screen items-center justify-center">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          );
        }
        return user ? <ProtectedRoute component={HomePageWrapper} /> : <Redirect to="/login" />;
      }} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={Onboarding} />} />
      <Route path="/accounts" component={() => <ProtectedRoute component={Accounts} />} />
      <Route path="/accounts/:id" component={() => <ProtectedRoute component={AccountDetail} />} />
      <Route path="/budget" component={() => <ProtectedRoute component={Budget} />} />
      <Route path="/preferences" component={() => <ProtectedRoute component={Preferences} />} />
      <Route path="/generate" component={() => {
        if (isLoading) {
          return (
            <div className="flex min-h-screen items-center justify-center" data-testid="loading-generate">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          );
        }
        return user ? <Generate /> : <Redirect to="/login" />;
      }} />
      <Route path="/plan" component={() => <ProtectedRoute component={PlanOverview} />} />
      <Route path="/dashboard" component={() => <Redirect to="/" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  
  // Show sidebar for authenticated users, except on login, signup, and onboarding pages
  const showSidebar = user && !isLoading && !['/login', '/signup', '/onboarding'].includes(location);
  
  if (!showSidebar) {
    return <>{children}</>;
  }
  
  return (
    <div className="flex h-screen w-full">
      <AppSidebar />
      <div className="flex flex-col flex-1">
        <header className="flex items-center justify-between p-2 border-b">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <SidebarProvider>
              <AppLayout>
                <Router />
              </AppLayout>
            </SidebarProvider>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
