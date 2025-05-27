import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Check, Shield, Users, ArrowRight, Building, Star } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function PaymentPlanPage() {
  // Helper function to enable navigation away from this page
  const allowNavigation = () => {
    console.log('Setting navigation flags to allow leaving payment plan page');
    sessionStorage.setItem('isNavigatingAway', 'true');
  };
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro" | "team">("free");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Add debugging information
    console.log('PaymentPlanPage useEffect running');
    console.log('URL search params:', window.location.search);
    console.log('User state:', user);
    console.log('Current location:', window.location.pathname + window.location.search);
    
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const isUpgrading = urlParams.get('upgrade') === 'true';
    const fromStripeCancel = urlParams.get('from') === 'stripe_cancel';
    
    console.log('Is upgrading?', isUpgrading);
    console.log('From Stripe cancel?', fromStripeCancel);
    
    // If coming back from Stripe cancel, just stay on the page and show a message
    if (fromStripeCancel) {
      console.log('User returned from Stripe checkout via back button, staying on payment plan page');
      
      // Show a toast message to inform the user they've returned from Stripe
      toast({
        title: "Payment not completed",
        description: "You can continue with your plan selection or navigate to other sections of the site."
      });
      
      // Allow navigation to other pages after returning from Stripe
      // This overwrites any previous navigation restrictions
      sessionStorage.removeItem('isNavigatingAway');
    }
    
    // Only redirect unauthenticated users - this is the only essential redirect
    if (!user) {
      console.log('User not logged in, redirecting to auth page');
      window.location.href = "/auth";
    }
  }, [user, toast]);

  const handlePlanSelect = async (plan: "free" | "pro" | "team") => {
    setSelectedPlan(plan);
    // Clear any previous error messages when selecting a new plan
    if (errorMessage) setErrorMessage(null);
  };

  const handleContinue = async () => {
    try {
      setIsLoading(true);
      
      // Handle free plan selection specially
      if (selectedPlan === 'free') {
        console.log('Free plan selected - processing...');
        
        // Update user's payment plan in our local DB
        const response = await apiRequest("PATCH", `/api/user/payment-plan`, { plan: selectedPlan });
        
        if (!response.ok) {
          throw new Error("Failed to update payment plan");
        }
        
        // If user has email (they should have), register them in Supabase as well
        if (user && user.username) {
          console.log(`Registering user ${user.username} in Supabase with plan ${selectedPlan}`);
          
          try {
            // Register the user in Supabase
            const supabaseResponse = await apiRequest("POST", "/api/supabase/register-user", {
              email: user.username, // Using username as email
              role: selectedPlan,
            });
            
            if (!supabaseResponse.ok) {
              // Log the error but don't throw - this is just supplementary registration
              console.warn("Failed to register user in Supabase, but continuing with plan selection");
            } else {
              console.log("Successfully registered user in Supabase");
            }
          } catch (supabaseError) {
            // Log but don't interrupt the flow - the local DB registration is the primary one
            console.error("Error registering in Supabase:", supabaseError);
          }
        } else {
          console.warn("No username/email available to register in Supabase");
        }
        
        toast({
          title: "Free plan selected",
          description: "You've successfully registered for the FREE plan. Redirecting to home page..."
        });
        
        // Navigate to home page using our special redirect route
        console.log('Redirecting to home page via special redirect route...');
        window.location.href = '/redirect-home';
        return;
      }
      
      // For paid plans (pro/team)
      // We won't update the payment plan locally immediately because they haven't paid yet
      // Instead, we'll proceed directly to Stripe checkout, and update the plan after payment
      
      // If user has email (they should have), register them in Supabase as well
      if (user && user.username) {
        console.log(`Registering user ${user.username} in Supabase with plan ${selectedPlan}`);
        
        try {
          // Register the user in Supabase
          const supabaseResponse = await apiRequest("POST", "/api/supabase/register-user", {
            email: user.username, // Using username as email
            role: selectedPlan,
          });
          
          if (!supabaseResponse.ok) {
            // Log the error but don't throw - this is just supplementary registration
            console.warn("Failed to register user in Supabase, but continuing with plan selection");
          } else {
            console.log("Successfully registered user in Supabase");
          }
        } catch (supabaseError) {
          // Log but don't interrupt the flow - the local DB registration is the primary one
          console.error("Error registering in Supabase:", supabaseError);
        }
      } else {
        console.warn("No username/email available to register in Supabase");
      }
      
      toast({
        title: "Payment plan selected",
        description: `You've selected the ${selectedPlan.toUpperCase()} plan. Proceeding to payment.`
      });
      
      // For paid plans, use the new checkout session redirect flow
      // If user is authenticated, we'll use their email/username, otherwise we'll ask for email
      let userEmail = user?.username || '';
      
      // If no user email is available, prompt the user for their email before proceeding
      if (!userEmail) {
        const emailPrompt = prompt('Please enter your email address to continue with checkout:');
        if (!emailPrompt) {
          // User cancelled the prompt
          setIsLoading(false);
          toast({
            title: "Checkout cancelled",
            description: "Email is required for checkout. Please try again."
          });
          return;
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailPrompt)) {
          setIsLoading(false);
          toast({
            title: "Invalid email",
            description: "Please enter a valid email address.",
            variant: "destructive"
          });
          return;
        }
        
        userEmail = emailPrompt;
      }
      
      try {
        console.log(`Creating checkout session for email: ${userEmail}...`);
        const response = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            plan: selectedPlan
          }),
          credentials: 'same-origin' // Include cookies in the request
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Checkout session error:', errorData);
          throw new Error(errorData.message || 'Failed to create checkout session');
        }

        const data = await response.json();
        console.log('Redirecting to Stripe checkout:', data.url);
        if (data.url) {
          window.location.href = data.url; // this opens the Stripe payment page
        } else {
          throw new Error('No checkout URL returned from server');
        }
      } catch (checkoutError) {
        console.error('Error creating checkout session:', checkoutError);
        toast({
          title: "Error",
          description: "Failed to create checkout session. Please try again.",
          variant: "destructive",
        });
        
        // Fallback to the old payment flow if checkout creation fails
        console.log('Falling back to old payment flow via direct navigation...');
        window.location.href = `/payment-processing/${selectedPlan}`;
      }
    } catch (error) {
      console.error("Error updating payment plan:", error);
      // Get error message
      const errorMsg = error instanceof Error ? error.message : "There was an error selecting your payment plan.";
      
      // Set the error message state
      setErrorMessage(errorMsg);
      
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Temporarily disabled for debugging
  /*
  if (!user) {
    return null; // Will redirect via useEffect
  }
  */

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold tracking-tight mb-3">Instant Parking Lot Quotes. Powered by AI.</h1>
            <p className="text-xl text-primary/90 font-semibold mb-4">
              Draw your lot. Get an accurate quote in seconds.
            </p>
            <h2 className="text-3xl font-bold tracking-tight mb-4 mt-10">Choose Your LotQuote Plan</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Select the plan that works best for your business needs. You can always upgrade later.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {/* Free Plan */}
            <Card className={`border-2 ${selectedPlan === "free" ? "border-primary" : "border-border"} transition-all hover:shadow-md`}>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <CardTitle className="text-xl font-semibold">Free</CardTitle>
                  <Shield className="h-5 w-5 text-primary ml-2" />
                </div>
                <CardDescription>For new users and small operators</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>3 estimates per month</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>Draw & count spaces</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>Basic quote preview</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>Email support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  variant={selectedPlan === "free" ? "default" : "outline"} 
                  className={`w-full py-2 ${selectedPlan === "free" ? "bg-gray-900 hover:bg-gray-800" : ""}`}
                  onClick={() => handlePlanSelect("free")}
                >
                  {selectedPlan === "free" ? "Selected" : "Select Free"}
                </Button>
              </CardFooter>
            </Card>

            {/* Pro Plan */}
            <Card className={`border-2 ${selectedPlan === "pro" ? "border-primary" : "border-border"} relative transition-all hover:shadow-md z-10`}>
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <span className="bg-primary text-primary-foreground text-sm font-medium py-1 px-3 rounded-full shadow">Most Popular</span>
              </div>
              <CardHeader className="pt-8">
                <div className="flex items-center mb-2">
                  <CardTitle className="text-xl font-semibold">Pro</CardTitle>
                  <Building className="h-5 w-5 text-primary ml-2" />
                </div>
                <CardDescription>For active striping businesses</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">$49</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>Unlimited estimates</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>Branded quote exports (PDF/Excel)</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>Lead capture</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>Priority support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  variant={selectedPlan === "pro" ? "default" : "outline"} 
                  className={`w-full py-2 ${selectedPlan === "pro" ? "bg-gray-900 hover:bg-gray-800" : ""}`}
                  onClick={() => handlePlanSelect("pro")}
                >
                  {selectedPlan === "pro" ? "Selected" : "Select Pro"}
                </Button>
              </CardFooter>
            </Card>

            {/* Enterprise Plan */}
            <Card className={`border-2 ${selectedPlan === "team" ? "border-primary" : "border-border"} transition-all hover:shadow-md`}>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <CardTitle className="text-xl font-semibold">Enterprise</CardTitle>
                  <Users className="h-5 w-5 text-primary ml-2" />
                </div>
                <CardDescription>For high volume users and lead generation</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">$149</span>
                  <span className="text-muted-foreground">+/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>Multi-user access</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>Priority Zip Code leads</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>Custom branding</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                    <span>Integration with QuickBooks, Jobber, etc.</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  variant={selectedPlan === "team" ? "default" : "outline"} 
                  className={`w-full py-2 ${selectedPlan === "team" ? "bg-gray-900 hover:bg-gray-800" : ""}`}
                  onClick={() => handlePlanSelect("team")}
                >
                  {selectedPlan === "team" ? "Selected" : "Select Enterprise"}
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div className="flex justify-center mt-8 gap-4">
            <Button 
              variant="outline"
              size="lg"
              disabled={isLoading}
              className="px-8 py-6 rounded-md flex items-center"
              onClick={async () => {
                try {
                  setIsLoading(true);
                  // Update the user's plan selection status
                  // Set session storage flag to skip immediate redirect
                  sessionStorage.setItem('skipPlanRedirect', 'true');
                  
                  const response = await apiRequest("PATCH", "/api/user/seen-plan-selection", { hasSeenPlanSelection: true });
                  
                  if (!response.ok) {
                    throw new Error("Failed to update settings");
                  }
                  
                  toast({
                    title: "Success",
                    description: "You can always select a plan later from your profile page."
                  });
                  
                  // Navigate to home
                  window.location.href = "/";
                } catch (error) {
                  console.error("Error updating plan selection status:", error);
                  toast({
                    title: "Error",
                    description: "There was a problem returning to home. Please try again.",
                    variant: "destructive"
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              Skip Plan Selection
            </Button>
            <Button 
              size="lg" 
              onClick={handleContinue}
              disabled={isLoading}
              className="px-8 py-6 bg-gray-900 hover:bg-gray-800 rounded-md flex items-center gap-2"
            >
              Continue with {selectedPlan === "team" ? "Enterprise" : selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan
              {!isLoading && <ArrowRight className="ml-2 h-5 w-5" />}
            </Button>
          </div>
          
          {errorMessage && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md text-center">
              <p className="text-red-600 font-medium">Error</p>
              <p className="text-red-700">{errorMessage}</p>
              <p className="text-sm text-red-600 mt-2">Please try again. If the problem persists, contact support.</p>
            </div>
          )}
          
          <div className="text-center mt-6 text-sm text-muted-foreground">
            <p>You can change your plan at any time from your account settings.</p>
          </div>
        </div>
      </main>
    </div>
  );
}