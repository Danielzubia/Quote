import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType<any>;
}) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // If path includes address parameter and user is not authenticated
    if (path.includes(':address') && !isLoading && !user) {
      // Extract the address from the current location
      const addressMatch = location.match(/\/map\/(.+)/);
      if (addressMatch && addressMatch[1]) {
        const address = decodeURIComponent(addressMatch[1]);
        // Store the address to redirect back after authentication
        sessionStorage.setItem('pendingAddress', address);
        
        // Show toast notification
        toast({
          title: "Sign Up Required",
          description: "Please select a plan to continue using this feature.",
          variant: "default",
        });
      }
    }
  }, [isLoading, user, path, location, toast]);

  return (
    <Route path={path}>
      {(params) => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        if (!user) {
          // Use direct navigation to ensure top of page and proper routing
          window.location.href = '/auth';
          return null;
        }
        
        // Redirect new users to payment plan selection if they haven't seen it yet
        // Don't redirect if we're already on the payment plan page to avoid loops
        // Also don't redirect if the user specifically opted to skip the payment plan page
        const skipPlanRedirect = sessionStorage.getItem('skipPlanRedirect') === 'true';
        
        if (user && user.hasSeenPlanSelection === false && !location.includes("/payment-plan") && !skipPlanRedirect) {
          console.log('User has not seen plan selection, redirecting to payment plan page');
          // Use direct navigation to ensure top of page and proper routing
          window.location.href = '/payment-plan';
          return null;
        }

        return <Component params={params} />;
      }}
    </Route>
  );
}
