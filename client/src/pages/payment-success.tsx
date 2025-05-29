import React, { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Loader2, CreditCard } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function PaymentSuccessPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const sessionId = new URLSearchParams(search).get("session_id");
  
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("pro");
  const [email, setEmail] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<{brand?: string, last4?: string} | null>(null);

  // Verify the payment status with Stripe and confirm subscription
  useEffect(() => {
    async function confirmSubscription() {
      if (!sessionId) {
        setError("No session ID found. Unable to verify payment.");
        setLoading(false);
        return;
      }

      try {
        // Confirm the subscription with our backend
        console.log(`Verifying payment session: ${sessionId}`);
        const response = await fetch(`/api/confirm-subscription?session_id=${sessionId}`);
        
        // Get the response text first to log it
        const responseText = await response.text();
        console.log('Raw server response:', responseText);
        
        // Try to parse the JSON response
        let userData;
        try {
          userData = JSON.parse(responseText);
          console.log('Subscription verification response:', userData);
        } catch (jsonError) {
          console.error('Failed to parse JSON response:', jsonError);
          throw new Error(`Invalid response format from server: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
        }
        
        if (!response.ok) {
          console.error(`Server error: ${response.status} ${response.statusText}`);
          throw new Error(userData.error || userData.message || `Server error ${response.status}: ${response.statusText}`);
        }
        
        // The response should have a 'success' field if everything went well
        if (userData.success) {
          console.log('Payment verification successful');
          setSuccess(true);
          setPlan(userData.plan || "pro");
          console.log(`Plan set to: ${userData.plan || "pro"}`);
          
          // Set payment method info if available
          if (userData.paymentMethod) {
            console.log('Payment method details found:', userData.paymentMethod);
            setPaymentMethod(userData.paymentMethod);
          }
          
          // Set email if available in the response
          if (userData.email) {
            console.log('Customer email found:', userData.email);
            setEmail(userData.email);
          }
            // Refresh user data to get updated subscription details
          queryClient.invalidateQueries({ queryKey: ['/api/user'] });
          console.log('User data invalidated, subscription should be updated');
          console.log('UserData', userData);
          
          // Update local cache directly if we have user data
          if (userData.user) {
            console.log('Updating user data in cache:', userData.user);
            queryClient.setQueryData(['/api/user'], userData.user);
          }
          
          // CRITICAL: Sync user data from Supabase to ensure local storage is updated
          try {
            console.log('Syncing user data from Supabase after payment...');
            const syncResponse = await fetch('/api/user/sync', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (syncResponse.ok) {
              const syncData = await syncResponse.json();
              console.log('User data sync successful:', syncData);
              
              // Update the user data in the cache with the synced version
              if (syncData.user) {
                queryClient.setQueryData(['/api/user'], syncData.user);
                console.log(`User payment plan synced to: ${syncData.user.paymentPlan}`);
              }
            } else {
              console.warn('User data sync failed, but continuing...');
            }
          } catch (syncError) {
            console.error('Error syncing user data:', syncError);
            // Continue anyway - the invalidation should eventually refresh the data
          }
          
          // Only auto-redirect if the user is already authenticated
//          if (user) {
            console.log('Setting up redirect to dashboard in 5 seconds for authenticated user');
            setTimeout(() => {
              setLocation("/");
            }, 5000); // 5 seconds to ensure user sees the success message
//          } else {
            console.log('Not setting up auto-redirect as user is not authenticated - they need to create an account first');
//          }
        } else {
          console.error('Payment verification failed:', userData);
          setError(userData.error || userData.message || "Payment verification completed but subscription was not activated. Please contact support.");
        }
      } catch (error) {
        console.error("Error confirming subscription:", error);
        setError("An error occurred while confirming your subscription. Please contact support.");
      } finally {
        setLoading(false);
      }
    }

    confirmSubscription();
  }, [sessionId, setLocation]);

  // If user is not logged in, we won't redirect - we'll show a message and signup link
  // This is because the user might have started checkout without being logged in
  useEffect(() => {
    // If the user is not authenticated but payment was successful,
    // we should guide them through creating an account to access their subscription
    if (!user && !loading && success) {
      console.log('Payment successful but user not logged in - offering account creation');
    }
  }, [user, loading, success, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Processing your subscription...</h2>
            <p className="text-muted-foreground">Please wait while we verify your payment.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto mt-8">
          <Card className="border-2 shadow-md">
            <CardHeader className="text-center">
              {success ? (
                <>
                  <div className="mx-auto rounded-full bg-green-100 p-3 mb-4">
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                  </div>
                  <CardTitle className="text-2xl font-bold">Payment Successful!</CardTitle>
                  <CardDescription className="text-lg">
                    Your {plan.charAt(0).toUpperCase() + plan.slice(1)} subscription is now active
                  </CardDescription>
                </>
              ) : (
                <>
                  <CardTitle className="text-2xl font-bold text-red-600">Payment Verification Failed</CardTitle>
                  <CardDescription className="text-lg">{error}</CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent className="text-center">
              {success ? (
                <div className="space-y-4">
                  <p>Thank you for subscribing to LotQuote! You now have access to all {plan.charAt(0).toUpperCase() + plan.slice(1)} features.</p>
                  
                  {paymentMethod && (
                    <div className="mt-4">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                        <CreditCard className="h-4 w-4" />
                        <span>Payment Method</span>
                      </div>
                      <div className="bg-muted/50 rounded-md p-3 inline-flex items-center gap-2">
                        <span className="capitalize font-medium">{paymentMethod.brand}</span>
                        <span className="text-sm text-muted-foreground">•••• {paymentMethod.last4}</span>
                      </div>
                    </div>
                  )}
                  
                  {!user && (
                    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="font-medium text-amber-900 mb-2">Create an account to access your subscription</p>
                      <p className="text-sm text-amber-800 mb-4">Your payment was successful, but you need to create an account to access all features of your {plan} plan.</p>
                      <Button 
                        onClick={() => setLocation(`/auth?tab=register&from=payment_success&plan=${plan}&email=${encodeURIComponent(email || '')}`)} 
                        className="w-full bg-amber-600 hover:bg-amber-700"
                      >
                        Create Account
                      </Button>
                    </div>
                  )}
                  
                  {user && <p className="text-sm text-muted-foreground mt-4">Redirecting to dashboard in a few seconds...</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  <p>There was an issue confirming your payment.</p>
                  <p>If you believe this is an error, please contact our support team or try again.</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-center pt-4">
              <Button
                className="w-full max-w-xs"
                onClick={() => setLocation("/")}
              >
                {success ? (
                  <>
                    Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  "Return to Home"
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
