import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

// Pages
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Projects from "@/pages/Projects";
import Clients from "@/pages/Clients";
import Crews from "@/pages/Crews";
import Invoices from "@/pages/Invoices";
import Firms from "@/pages/admin/Firms";
import Users from "@/pages/admin/Users";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component, ...props }: any) {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Nicht autorisiert",
        description: "Sie werden zur Anmeldung weitergeleitet...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 1500);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Weiterleitung zur Anmeldung...
          </h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return <Component {...props} />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route component={NotFound} />
        </>
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/projects" component={() => <ProtectedRoute component={Projects} />} />
          <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
          <Route path="/crews" component={() => <ProtectedRoute component={Crews} />} />
          <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
          <Route path="/admin/firms" component={() => <ProtectedRoute component={Firms} />} />
          <Route path="/admin/users" component={() => <ProtectedRoute component={Users} />} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
