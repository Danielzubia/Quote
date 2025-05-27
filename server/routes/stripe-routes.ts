import express, { Request, Response } from 'express';
import * as stripeService from '../services/stripe';
import { stripe } from '../services/stripe';
import type { Stripe } from 'stripe';
import { storage } from '../storage';
import { stripeWebhookHandler } from '../controllers/stripe-webhook';

const router = express.Router();

// Create a payment intent (for one-time payments)
router.post('/create-payment-intent', async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const { amount, currency = 'usd', metadata = {} } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    
    // Include user information in the metadata
    const userMetadata = {
      ...metadata,
      userId: String(req.user!.id),
      userEmail: req.user!.username, // Using username as email
    };
    
    const paymentIntent = await stripeService.createPaymentIntent(
      amount,
      currency,
      userMetadata
    );
    
    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Create a subscription (for recurring payments)
router.post('/create-subscription', async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const { plan } = req.body;
    
    if (!plan || (plan !== 'pro' && plan !== 'team')) {
      return res.status(400).json({ error: 'Valid plan is required (pro or team)' });
    }
    
    const email = req.user!.username; // Using username as email
    // Use username as name if no name exists
    const name = req.user!.username;
    
    const subscription = await stripeService.createSubscription(
      plan,
      email,
      name
    );
    
    // Update the user record with Stripe customer and subscription IDs
    try {
      await storage.updateUserStripeInfo(req.user!.id, {
        stripeCustomerId: subscription.customerId,
        stripeSubscriptionId: subscription.subscriptionId
      });
    } catch (storageError) {
      console.error('Error updating user with Stripe info:', storageError);
      // Continue anyway - we'll handle this later
    }
    
    res.json({
      subscriptionId: subscription.subscriptionId,
      clientSecret: subscription.clientSecret,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      error: 'Failed to create subscription',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Create a checkout session for the Stripe Checkout redirect flow
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  console.log('Received checkout session request:', req.body);
  console.log('User authenticated:', req.isAuthenticated());
  
  try {
    let { email, plan } = req.body;
    
    // If user is authenticated, use their stored email
    if (req.isAuthenticated() && req.user?.username) {
      // Override email with authenticated user's email
      email = email || req.user.username;
      console.log(`Using authenticated user's email: ${email}`);
    }
    
    if (!email) {
      console.log('Email is missing in request');
      return res.status(400).json({ error: 'Email is required' });
    }
    
    if (!plan || (plan !== 'pro' && plan !== 'team')) {
      console.log(`Invalid plan: ${plan}`);
      return res.status(400).json({ error: 'Valid plan is required (pro or team)' });
    }
    
    // Log Stripe keys availability (first character only for security)
    console.log('STRIPE_SECRET_KEY available:', process.env.STRIPE_SECRET_KEY ? `Key starts with ${process.env.STRIPE_SECRET_KEY.charAt(0)}` : 'Not available');
    
    // Get the origin from the request for consistent URLs
    let origin = req.headers.origin || req.headers.host || process.env.APP_URL || 'http://localhost:3000';
    console.log('Origin headers:', { origin: req.headers.origin, host: req.headers.host, appUrl: process.env.APP_URL });
    
    // Remove protocol if it's included in the origin
    if (origin.startsWith('http://')) {
      origin = origin.substring(7);
    } else if (origin.startsWith('https://')) {
      origin = origin.substring(8);
    }
    
    const protocol = req.headers.origin ? 'https' : 'http'; // If origin header exists, assume https
    
    const baseUrl = `${protocol}://${origin}`;
    console.log(`Creating checkout session with base URL: ${baseUrl}`);
    
    try {
      const session = await stripeService.createCheckoutSession(
        email, 
        plan, 
        `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/payment-plan?from=stripe_cancel`
      );
      
      console.log('Checkout session created successfully:', { 
        sessionId: session.id,
        sessionUrl: session.url,
        paymentStatus: session.payment_status
      });
      
      if (!session.url) {
        console.error('Stripe session created but URL is missing!');
        return res.status(500).json({
          error: 'Checkout session created but URL is missing',
          sessionId: session.id
        });
      }
      
      res.json({ url: session.url });
    } catch (stripeError) {
      console.error('Stripe API error creating checkout session:', stripeError);
      return res.status(500).json({
        error: 'Stripe API error',
        message: stripeError instanceof Error ? stripeError.message : String(stripeError),
      });
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Webhook endpoint to handle events from Stripe
router.post('/webhook', express.raw({type: 'application/json'}), stripeWebhookHandler);

// Get subscription status for the current user
// Verify a Stripe checkout session
router.get('/verify-session', async (req: Request, res: Response) => {
  const { session_id } = req.query;
  
  if (!session_id) {
    return res.status(400).json({ error: 'Session ID is required' });
  }
  
  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id as string);
    
    // Check payment status
    const status = session.payment_status;
    const plan = session.client_reference_id || 'pro'; // Default to pro if not available
    
    // If this is a successful payment, update the user's subscription info
    if (status === 'paid' && req.isAuthenticated()) {
      try {
        // Save the customer and subscription IDs if available
        if (session.customer && session.subscription) {
          await storage.updateUserStripeInfo(req.user!.id, {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string
          });
        }
        
        // CRITICAL: Update the user's payment plan
        await storage.updateUserPaymentPlan(req.user!.id, plan);
        console.log(`Updated user ${req.user!.id} payment plan to: ${plan}`);
        
      } catch (storageError) {
        console.error('Error updating user with Stripe info after successful payment:', storageError);
        // Continue anyway - we'll handle this later
      }
    }
    
    // Return session details to the client
    res.json({
      status: status === 'paid' ? 'complete' : status,
      plan: plan
    });
  } catch (error) {
    console.error('Error verifying Stripe session:', error);
    res.status(500).json({
      error: 'Failed to verify payment session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get subscription status for the current user
router.get('/subscription', async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const user = req.user!;
    
    // If user has no subscription ID, they're not subscribed
    if (!user.stripeSubscriptionId) {
      return res.json({ subscribed: false });
    }
    
    // Otherwise, retrieve the subscription from Stripe
    const subscription = await stripeService.getSubscription(user.stripeSubscriptionId);
    
    // Get payment method information if customer ID exists
    let paymentMethod = undefined;
    if (user.stripeCustomerId) {
      try {
        // Get customer's payment methods
        const paymentMethods = await stripe.paymentMethods.list({
          customer: user.stripeCustomerId,
          type: 'card',
        });
        
        // Use the default payment method if available
        if (paymentMethods.data.length > 0) {
          const defaultPaymentMethod = paymentMethods.data[0];
          paymentMethod = {
            brand: defaultPaymentMethod.card?.brand,
            last4: defaultPaymentMethod.card?.last4,
            expMonth: defaultPaymentMethod.card?.exp_month,
            expYear: defaultPaymentMethod.card?.exp_year,
          };
        }
      } catch (error) {
        console.error('Error retrieving payment methods:', error);
        // Continue without payment method information
      }
    }
    
    res.json({
      subscribed: true,
      status: subscription.status,
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
      plan: user.paymentPlan,
      paymentMethod,
    });
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    res.status(500).json({
      error: 'Failed to retrieve subscription',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Confirm subscription after successful payment
router.get('/confirm-subscription', async (req: Request, res: Response) => {
  console.log('Confirming subscription with query params:', req.query);
  const { session_id } = req.query;
  
  if (!session_id) {
    console.log('No session ID provided in request');
    return res.status(400).json({ error: 'Session ID is required' });
  }
  
  try {
    console.log(`Retrieving session ${session_id} from Stripe`);
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id as string, {
      expand: ['subscription', 'customer']
    });
    
    console.log('Session retrieved successfully:', {
      id: session.id,
      paymentStatus: session.payment_status,
      customerId: typeof session.customer === 'string' ? session.customer : (session.customer?.id || null),
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : (session.subscription?.id || null),
      clientReference: session.client_reference_id
    });
    
    // Verify payment status
    if (session.payment_status !== 'paid') {
      console.log(`Payment not completed. Status: ${session.payment_status}`);
      return res.status(400).json({
        error: 'Payment not completed',
        status: session.payment_status
      });
    }
    
    console.log('Payment verified successfully. Processing subscription details...');
    
    // Get plan from session metadata/client reference
    const plan = session.client_reference_id || 'pro';
    
    // Extract customer details
    const customerId = session.customer ? (typeof session.customer === 'string' ? session.customer : session.customer.id) : null;
    
    // Get customer email - first check session.customer_email which is most reliable
    // Then try to extract from customer object if it's expanded
    let email = session.customer_email; 
    if (!email && session.customer && typeof session.customer !== 'string') {
      // We need to check if this is a Customer object with an email property
      const customerObj = session.customer;
      if ('email' in customerObj) {
        email = customerObj.email;
      }
    }
    
    // Optional: retrieve default payment method if we have a customer ID
    let cardDetails = null;
    if (customerId) {
      try {
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        });
        
        if (paymentMethods.data.length > 0) {
          const card = paymentMethods.data[0];
          cardDetails = {
            last4: card.card?.last4,
            brand: card.card?.brand
          };
        }
      } catch (pmError) {
        console.error('Error retrieving payment methods:', pmError);
        // Continue anyway, this is optional information
      }
    }
    
    // If user is authenticated, update their local account immediately
    if (req.user) {
      console.log(`Authenticated user ${req.user.id} completed payment for plan: ${plan}`);
      
      try {
        // Update user's payment plan in local database
        const updatedUser = await storage.updateUserPaymentPlan(req.user.id, plan);
        console.log(`Successfully updated user ${req.user.id} to plan: ${plan}`);
        
        // Update Stripe info if available
        if (customerId && session.subscription) {
          const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          await storage.updateUserStripeInfo(req.user.id, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId
          });
          console.log(`Updated Stripe info for user ${req.user.id}`);
        }
        
        // Mark that they've seen plan selection
        await storage.updateUserHasSeenPlanSelection(req.user.id);
        
      } catch (updateError) {
        console.error('Error updating authenticated user after payment:', updateError);
        return res.status(500).json({
          error: 'Payment successful but failed to update account',
          message: 'Please contact support'
        });
      }
    }
    // If user is not authenticated but we have email, store in Supabase for later
    else if (email) {
      console.log(`User not authenticated, but we have email ${email}. Storing subscription details in Supabase.`);
      
      try {
        const { supabase } = await import('../supabase');
        // Check if a user with this email already exists in Supabase
        const { data: existingUsers } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', email)
          .limit(1);
        
        if (existingUsers && existingUsers.length > 0) {
          // Update existing user
          console.log(`Found existing user in Supabase with email ${email}, updating subscription info`);
          await supabase
            .from('users')
            .update({
              plan: plan,
              stripe_customer_id: customerId,
//              stripe_subscription_id: session.subscription ? (typeof session.subscription === 'string' ? session.subscription : session.subscription.id) : undefined,
              ...(cardDetails?.last4 ? { card_last4: cardDetails.last4 } : {}),
              ...(cardDetails?.brand ? { card_brand: cardDetails.brand } : {})
            })
            .eq('email', email);
        } else {
          // Insert new user with pending status
          console.log(`No user found in Supabase with email ${email}, creating pending subscription record`);
          await supabase
            .from('users')
            .insert({
              email: email,
              plan: plan,
              stripe_customer_id: customerId,
//              stripe_subscription_id: session.subscription ? (typeof session.subscription === 'string' ? session.subscription : session.subscription.id) : undefined,
              registration_status: 'payment_completed',
              ...(cardDetails?.last4 ? { card_last4: cardDetails.last4 } : {}),
              ...(cardDetails?.brand ? { card_brand: cardDetails.brand } : {})
            });
        }
        
        console.log(`Successfully stored subscription details in Supabase for email ${email}`);
      } catch (supabaseError) {
        console.error('Error storing subscription in Supabase for unauthenticated user:', supabaseError);
        // Continue anyway - they can register later and we can link the subscription then
      }
    } else {
      console.warn('User not authenticated and no email available, cannot store subscription details');
    }
    
    // Return subscription details
    res.json({
      success: true,
      plan: plan,
      subscriptionId: session.subscription ? (typeof session.subscription === 'string' ? session.subscription : session.subscription.id) : null,
      customerId: session.customer ? (typeof session.customer === 'string' ? session.customer : session.customer.id) : null,
      email: email, // Include the customer email in the response
      paymentStatus: session.payment_status,
      paymentMethod: cardDetails ? {
        brand: cardDetails.brand,
        last4: cardDetails.last4
      } : null,
      user: req.isAuthenticated() ? {
        id: req.user!.id,
        username: req.user!.username,
        paymentPlan: plan
      } : null
    });
  } catch (error) {
    console.error('Error confirming subscription:', error);
    res.status(500).json({
      error: 'Failed to confirm subscription',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Admin endpoint to update Stripe price IDs
router.post('/update-price-ids', async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if user is an admin
  const isAdmin = await storage.isAdmin(req.user!.id);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  
  try {
    const { proPriceId, teamPriceId } = req.body;
    
    // Validate that price IDs are provided and in correct format
    if (!proPriceId || !teamPriceId) {
      return res.status(400).json({ error: 'Both pro and team price IDs are required' });
    }
    
    if (!proPriceId.startsWith('price_') || !teamPriceId.startsWith('price_')) {
      return res.status(400).json({ error: 'Price IDs should start with "price_"' });
    }
    
    // Save the price IDs to environment variables
    process.env.STRIPE_PRICE_PRO = proPriceId;
    process.env.STRIPE_PRICE_TEAM = teamPriceId;
    
    res.json({
      success: true,
      message: 'Price IDs updated successfully',
      proPriceId,
      teamPriceId
    });
  } catch (error) {
    console.error('Error updating price IDs:', error);
    res.status(500).json({
      error: 'Failed to update price IDs',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Cancel subscription endpoint
router.post('/cancel-subscription', async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const user = req.user!;
    
    // If user has no subscription ID, they're not subscribed
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }
    
    // Cancel the subscription at period end
    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );
    
    // Update user record to reflect cancellation
    // Note: We don't change the plan immediately, as they still have access until end of billing period
    // We'll rely on a webhook to downgrade them when the subscription actually ends
    
    res.json({
      success: true,
      message: 'Subscription canceled successfully',
      willEndOn: new Date((subscription as any).current_period_end * 1000).toISOString()
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
