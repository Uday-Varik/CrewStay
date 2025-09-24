import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import ConstructionDashboard from "@/pages/construction-dashboard";
import HotelDashboard from "@/pages/hotel-dashboard";
import ExtensionsPage from "@/pages/extensions-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/extensions" component={ExtensionsPage} />
      <ProtectedRoute path="/" component={() => <DashboardRouter />} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function DashboardRouter() {
  // This component will be rendered inside ProtectedRoute, so we have access to user
  return (
    <Switch>
      <Route path="/" component={DashboardHome} />
      <Route component={NotFound} />
    </Switch>
  );
}

function DashboardHome() {
  // We need to access the user to determine which dashboard to show
  const { user } = useAuth();
  
  if (user?.userType === "construction") {
    return <ConstructionDashboard />;
  } else if (user?.userType === "hotel") {
    return <HotelDashboard />;
  }
  
  return <NotFound />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
