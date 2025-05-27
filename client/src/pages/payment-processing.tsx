import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ArrowLeft, CreditCard } from "lucide-react";
import { useStripe, useElements, PaymentElement, Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = loadStripe(stripeKey || '');

// Log the Stripe public key to help with debugging
if (!stripeKey) {
  console.error('VITE_STRIPE_PUBLIC_KEY is not set. The payment form will not work.');
} else {
  console.log('Stripe initialized with public key that starts with:', stripeKey.substring(0, 8) + '...');
}

// Checkout form component
const CheckoutForm = ({ plan }: { plan: string }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Format plan name for display
  const getPlanDisplayName = () => {
    if (plan === "team") return "Team / Franchise";
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  // Get price based on plan
  const getPlanPrice = () => {
    switch (plan) {
      case "pro": return "$49";
      case "team": return "$149+";
      default: return "$0";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not loaded yet. Make sure to disable form submission until Stripe.js has loaded
      return;
    }

    setProcessing(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-confirmation/${plan}`,
      },
      redirect: "if_required"
    });

    if (result.error) {
      setError(result.error.message || "Payment failed.");
      toast({
        title: "Payment Failed",
        description: result.error.message || "There was an issue processing your payment.",
        variant: "destructive",
      });
      setProcessing(false);
    } else {
      // The redirect will happen automatically if payment succeeds
      // If we get here, it means the payment requires additional steps or is processing
      // We'll let the return_url handle the redirect to the confirmation page
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 border rounded-lg bg-muted/10">
        <PaymentElement />
      </div>
      
      <div className="space-y-2">
        <p className="text-sm font-medium">Subscription Summary:</p>
        <div className="flex justify-between text-sm">
          <span>{getPlanDisplayName()} Plan</span>
          <span>{getPlanPrice()}/month</span>
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <Button 
        type="submit" 
        className="w-full" 
        disabled={!stripe || processing}
      >
        {processing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Pay ${getPlanPrice()}/month`
        )}
      </Button>
    </form>
  );
};

export default function PaymentProcessingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const plan = params.plan || "pro"; // Default to pro if not specified
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Format plan name for display
  const getPlanDisplayName = () => {
    if (plan === "team") return "Team / Franchise";
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  // Get price based on plan
  const getPlanPrice = () => {
    switch (plan) {
      case "pro": return "$49";
      case "team": return "$149+";
      default: return "$0";
    }
  };

  useEffect(() => {
    // If user is not logged in, redirect to auth page
    if (!user) {
      setLocation("/auth");
      return;
    }
    
    // Create a subscription and get client secret
    const getSubscription = async () => {
      try {
        setLoading(true);
        const response = await apiRequest("POST", "/api/stripe/create-subscription", { plan });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to create subscription");
        }
        
        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        console.error("Error creating subscription:", err);
      } finally {
        setLoading(false);
      }
    };
    
    getSubscription();
  }, [user, plan, setLocation]);

  const handleBackToPlans = () => {
    setLocation("/payment-plan");
  };

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Button 
            variant="ghost" 
            className="mb-4" 
            onClick={handleBackToPlans}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to plans
          </Button>
          
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Complete Your Subscription</CardTitle>
              <CardDescription>
                {getPlanDisplayName()} Plan - {getPlanPrice()}/month
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-center">Preparing your payment form...</p>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 text-red-700 rounded-md">
                  <p className="font-medium">Something went wrong</p>
                  <p className="text-sm mt-1">{error}</p>
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={handleBackToPlans}
                  >
                    Go back to plans
                  </Button>
                </div>
              ) : clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CheckoutForm plan={plan} />
                </Elements>
              ) : (
                <div className="p-4 border rounded-lg bg-muted/10 text-center">
                  <CreditCard className="h-10 w-10 mx-auto mb-3 text-primary" />
                  <p>Unable to initialize payment form. Please try again later.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}