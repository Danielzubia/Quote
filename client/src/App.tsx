import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import MapView from "@/pages/map-view";
import ProfilePage from "@/pages/profile-page";
import HistoryPage from "@/pages/history-page";
import AdminDashboard from "@/pages/admin-dashboard";
import PaymentPlanPage from "@/pages/payment-plan";
import PaymentProcessingPage from "@/pages/payment-processing";
import PaymentConfirmationPage from "@/pages/payment-confirmation";
import PaymentSuccessPage from "@/pages/payment-success";
import ResetPasswordPage from "@/pages/reset-password";
import BlogPage from "@/pages/blog-page";
import BlogPostPage from "@/pages/blog-post-page";
import TestLeadForm from "@/pages/test-lead-form";
import TestQuoteStorage from "@/pages/test-quote-storage";
import SupabaseTestPage from "@/pages/supabase-test";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      {/* Special route to handle redirection from payment plan page */}
      <Route path="/redirect-home">
        {() => {
          // This route exists just to break the loop
          console.log('Redirect home route triggered');
          setTimeout(() => {
            window.location.href = '/';
          }, 100);
          return <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
          </div>;
        }}
      </Route>
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      {/* Regular routes for Free Quote flow - no auth required */}
      <Route path="/map/:address" component={MapView} />
      <Route path="/map" component={MapView} />
      <Route path="/payment-plan" component={PaymentPlanPage} />
      <Route path="/payment-processing/:plan" component={PaymentProcessingPage} />
      <Route path="/payment-confirmation/:plan" component={PaymentConfirmationPage} />
      <Route path="/payment-success" component={PaymentSuccessPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/blog/:id" component={BlogPostPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <Route path="/history" component={HistoryPage} />
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      <Route path="/test-leads" component={TestLeadForm} />
      <Route path="/test-quotes" component={TestQuoteStorage} />
      <Route path="/test-supabase" component={SupabaseTestPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Helper to check if we're on the payment plan page
  const isPaymentPlanPage = window.location.pathname === '/payment-plan';
  
  // If we're on the payment plan page, disable automatic redirection for route changes
  if (isPaymentPlanPage) {
    console.log('On payment plan page, setting allowRouteChanges flag in sessionStorage');
    sessionStorage.setItem('allowRouteChanges', 'true');
  }
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;