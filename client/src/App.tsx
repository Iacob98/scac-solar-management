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
import TestLogin from "@/pages/TestLogin";
import Home from "@/pages/Home";
import Projects from "@/pages/Projects";
import Clients from "@/pages/Clients";
import Crews from "@/pages/Crews";
import CrewsNew from "@/pages/CrewsNew";
import CrewStatistics from "@/pages/CrewStatistics";
import Invoices from "@/pages/Invoices";
import Users from "@/pages/admin/Users";
import FirmsManagement from "@/pages/admin/FirmsManagement";
import FirmEdit from "@/pages/FirmEdit";
import Settings from "@/pages/Settings";
import Calendar from "@/pages/Calendar";
import CalendarTest from "@/pages/CalendarTest";
import { FileStorage } from "@/pages/FileStorage";
import GoogleCalendar from "@/pages/GoogleCalendar";
import GoogleCalendarSetup from "@/pages/GoogleCalendarSetup";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component, ...props }: any) {
  const { isAuthenticated, isLoading, refetch } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <TestLogin onLoginSuccess={() => refetch()} />;
  }

  return <Component {...props} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <ProtectedRoute component={Home} />} />
      <Route path="/projects" component={() => <ProtectedRoute component={Projects} />} />
      <Route path="/projects/:id" component={() => <ProtectedRoute component={Projects} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/crews" component={() => <ProtectedRoute component={CrewsNew} />} />
      <Route path="/crews/statistics" component={() => <ProtectedRoute component={CrewStatistics} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/files" component={() => <ProtectedRoute component={FileStorage} />} />
      <Route path="/calendar" component={() => <ProtectedRoute component={Calendar} />} />
      <Route path="/google-calendar" component={() => <ProtectedRoute component={GoogleCalendar} />} />
      <Route path="/google-setup" component={() => <ProtectedRoute component={GoogleCalendarSetup} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/calendar-test" component={() => <ProtectedRoute component={CalendarTest} />} />
      <Route path="/admin/firms" component={() => <ProtectedRoute component={FirmsManagement} />} />
      <Route path="/admin/firms/:id/edit" component={() => <ProtectedRoute component={FirmEdit} />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={Users} />} />
      <Route component={NotFound} />
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
