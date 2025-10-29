import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Onboarding from "@/pages/onboarding";
import Accounts from "@/pages/accounts";
import Budget from "@/pages/budget";
import Preferences from "@/pages/preferences";
import Generate from "@/pages/generate";
import Dashboard from "@/pages/dashboard";

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
        return user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />;
      }} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={Onboarding} />} />
      <Route path="/accounts" component={() => <ProtectedRoute component={Accounts} />} />
      <Route path="/budget" component={() => <ProtectedRoute component={Budget} />} />
      <Route path="/preferences" component={() => <ProtectedRoute component={Preferences} />} />
      <Route path="/generate" component={() => <ProtectedRoute component={Generate} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
