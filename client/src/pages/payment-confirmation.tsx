import { useEffect, useState } from 'react';
import { useLocation, useRoute, Link } from 'wouter';
import { useStripe } from '@stripe/react-stripe-js';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PaymentStatus = 'success' | 'processing' | 'error' | 'initial';

export default function PaymentConfirmationPage() {
  const [match, params] = useRoute('/payment-confirmation/:plan');
  const [, setLocation] = useLocation();
  const stripe = useStripe();
  const { user } = useAuth();
  const { toast } = useToast();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('initial');
  const [paymentMessage, setPaymentMessage] = useState('');
  const planName = match ? params.plan : 'unknown';

  // Format plan name for display
  const getPlanDisplayName = () => {
    switch (planName) {
      case 'pro':
        return 'Pro Plan';
      case 'team':
        return 'Team/Franchise Plan';
      default:
        return 'Unknown Plan';
    }
  };

  useEffect(() => {
    if (!stripe) {
      return;
    }

    // Retrieve the "payment_intent_client_secret" or "setup_intent_client_secret" query parameter
    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    ) || new URLSearchParams(window.location.search).get(
      'setup_intent_client_secret'
    );

    if (!clientSecret) {
      setPaymentStatus('error');
      setPaymentMessage('No payment information found. Please try again.');
      return;
    }

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      // Inspect the PaymentIntent `status` to indicate the status of the payment
      if (!paymentIntent) {
        setPaymentStatus('error');
        setPaymentMessage('Payment information could not be retrieved.');
        return;
      }

      switch (paymentIntent.status) {
        case "succeeded":
          setPaymentStatus('success');
          setPaymentMessage("Payment succeeded! Your subscription is now active.");
          // Show success toast
          toast({
            title: "Payment Successful",
            description: `Your ${getPlanDisplayName()} subscription is now active.`,
          });
          break;
        case "processing":
          setPaymentStatus('processing');
          setPaymentMessage("Your payment is processing. We'll update you when payment is received.");
          break;
        case "requires_payment_method":
          setPaymentStatus('error');
          setPaymentMessage("Payment failed. Please try another payment method.");
          // Show error toast
          toast({
            title: "Payment Failed",
            description: "Please try another payment method or contact support.",
            variant: "destructive",
          });
          break;
        default:
          setPaymentStatus('error');
          setPaymentMessage("Something went wrong with your payment.");
          break;
      }
    });
  }, [stripe, toast, planName]);

  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'success':
        return <Check className="h-12 w-12 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-12 w-12 text-red-500" />;
      case 'processing':
      case 'initial':
        return <Loader2 className="h-12 w-12 animate-spin text-blue-500" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-6">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-2xl text-center">
            {paymentStatus === 'success' ? 'Payment Complete' : 
             paymentStatus === 'processing' ? 'Processing Payment' : 
             paymentStatus === 'error' ? 'Payment Failed' : 'Checking Payment Status'}
          </CardTitle>
          <CardDescription className="text-center">
            {planName !== 'unknown' && 
              `Plan: ${getPlanDisplayName()}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center mb-4">{paymentMessage}</p>
          {paymentStatus === 'success' && (
            <div className="bg-green-50 p-4 rounded-md border border-green-200 mb-4">
              <h3 className="font-medium text-green-800">What's Next:</h3>
              <ul className="list-disc pl-5 mt-2 text-green-700">
                <li>You now have full access to all premium features</li>
                <li>Your subscription will renew automatically each month</li>
                <li>You can manage your subscription from your account dashboard</li>
              </ul>
            </div>
          )}
          {paymentStatus === 'error' && (
            <div className="bg-red-50 p-4 rounded-md border border-red-200 mb-4">
              <h3 className="font-medium text-red-800">Troubleshooting:</h3>
              <ul className="list-disc pl-5 mt-2 text-red-700">
                <li>Check your payment method details</li>
                <li>Ensure your card has sufficient funds</li>
                <li>Try a different payment method</li>
                <li>Contact your bank if the issue persists</li>
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          {paymentStatus === 'success' && (
            <Button 
              className="w-full" 
              onClick={() => setLocation('/')}
            >
              Go to Dashboard
            </Button>
          )}
          {paymentStatus === 'error' && (
            <div className="flex flex-col space-y-3 w-full">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setLocation(`/payment-processing/${planName}`)}
              >
                Try Again
              </Button>
              <Button 
                className="w-full" 
                variant="secondary"
                onClick={() => setLocation('/payment-plan')}
              >
                Choose Different Plan
              </Button>
            </div>
          )}
          {(paymentStatus === 'processing' || paymentStatus === 'initial') && (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}