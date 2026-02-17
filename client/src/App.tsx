import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

// Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
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
import { FileStorage } from "@/pages/FileStorage";
import NotFound from "@/pages/not-found";
// CrewUpload is deprecated - replaced by Worker Portal with PIN authentication
// import CrewUpload from "@/pages/CrewUpload";

// Worker Pages
import WorkerLogin from "@/pages/worker/WorkerLogin";
import WorkerDashboard from "@/pages/worker/WorkerDashboard";
import WorkerProjects from "@/pages/worker/WorkerProjects";
import WorkerProjectDetail from "@/pages/worker/WorkerProjectDetail";
import WorkerCalendar from "@/pages/worker/WorkerCalendar";
import WorkerProfile from "@/pages/worker/WorkerProfile";
import WorkerReclamations from "@/pages/worker/WorkerReclamations";

function ProtectedRoute({ component: Component, adminOnly = false, ...props }: any) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login page
    return <Redirect to="/login" />;
  }

  // Use profile.role as primary source, fallback to user.role
  const userRole = profile?.role || user.role;

  // If role is still loading, show loading spinner
  if (!userRole && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Workers should be redirected to worker dashboard
  if (userRole === 'worker') {
    return <Redirect to="/worker" />;
  }

  // Admin only routes
  if (adminOnly && userRole !== 'admin') {
    return <Redirect to="/" />;
  }

  return <Component {...props} />;
}

// Protected route for worker-only pages
function WorkerRoute({ component: Component, ...props }: any) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to worker login page
    return <Redirect to="/worker/login" />;
  }

  // Wait for profile to load to check the role
  // Use profile.role as primary source, fallback to user.role
  const userRole = profile?.role || user.role;

  // If role is still loading (user exists but profile not yet), show loading
  if (!userRole && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Non-workers should go to the main app
  if (userRole !== 'worker') {
    return <Redirect to="/" />;
  }

  return <Component {...props} />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      {import.meta.env.DEV && (
        <Route path="/test-login">
          {() => {
            const [, setLocation] = useLocation();
            return <TestLogin onLoginSuccess={() => setLocation('/')} />;
          }}
        </Route>
      )}
      {/* Old crew upload route - redirect to worker portal */}
      <Route path="/crew-upload/:projectId/:token">
        {() => <Redirect to="/worker/login" />}
      </Route>

      {/* Worker public routes */}
      <Route path="/worker/login" component={WorkerLogin} />

      {/* Worker protected routes */}
      <Route path="/worker" component={() => <WorkerRoute component={WorkerDashboard} />} />
      <Route path="/worker/reclamations" component={() => <WorkerRoute component={WorkerReclamations} />} />
      <Route path="/worker/projects" component={() => <WorkerRoute component={WorkerProjects} />} />
      <Route path="/worker/projects/:id" component={() => <WorkerRoute component={WorkerProjectDetail} />} />
      <Route path="/worker/calendar" component={() => <WorkerRoute component={WorkerCalendar} />} />
      <Route path="/worker/profile" component={() => <WorkerRoute component={WorkerProfile} />} />

      {/* Admin/Leiter protected routes */}
      <Route path="/" component={() => <ProtectedRoute component={Home} />} />
      <Route path="/projects" component={() => <ProtectedRoute component={Projects} />} />
      <Route path="/projects/:id" component={() => <ProtectedRoute component={Projects} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/crews" component={() => <ProtectedRoute component={CrewsNew} />} />
      <Route path="/crews/statistics" component={() => <ProtectedRoute component={CrewStatistics} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/files" component={() => <ProtectedRoute component={FileStorage} />} />
      <Route path="/calendar" component={() => <ProtectedRoute component={Calendar} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/admin/firms" component={() => <ProtectedRoute component={FirmsManagement} adminOnly />} />
      <Route path="/admin/firms/:id/edit" component={() => <ProtectedRoute component={FirmEdit} adminOnly />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={Users} adminOnly />} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
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
