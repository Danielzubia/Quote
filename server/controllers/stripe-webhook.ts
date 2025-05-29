import { Request, Response } from 'express';
import Stripe from 'stripe';
import { storage } from '../storage';
import { stripe } from '../services/stripe';

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const handleSubscriptionCreated = async (subscription: Stripe.Subscription) => {
  try {
    const customerId = subscription.customer as string;
    
    // Find all users with this stripeCustomerId
    // In a production environment, you'd typically have better tracking to map customers to users
    const users = await storage.getAllUsers();
    const matchedUser = users.find(user => user.stripeCustomerId === customerId);
    
    if (matchedUser) {
      // Update user with subscription details
      await storage.updateUserStripeInfo(matchedUser.id, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id
      });
      
      // Determine and update plan
      const items = subscription.items.data;
      if (items.length > 0) {
        const priceId = items[0].price.id;
        let plan = 'free';
        
        if (priceId === process.env.STRIPE_PRICE_PRO || 
            priceId === 'price_1PDCVjEtSCIE3SCW2WJmxJnF') {
          plan = 'pro';
        } else if (priceId === process.env.STRIPE_PRICE_TEAM || 
                   priceId === 'price_1PDCVxEtSCIE3SCWqizdK0h4') {
          plan = 'team';
        }
          if (plan !== 'free') {
          await storage.updateUserPaymentPlan(matchedUser.id, plan);
          console.log(`Updated user ${matchedUser.id} to ${plan} plan based on subscription webhook`);
          
          // Also update Supabase to keep it in sync
          try {
            const { supabase } = await import('../supabase');
            await supabase
              .from('users')
              .upsert({
                email: matchedUser.username,
                plan: plan,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscription.id,
                registration_status: 'active'
              });
            console.log(`Updated Supabase user ${matchedUser.username} to ${plan} plan via webhook`);
          } catch (supabaseError) {
            console.error('Error updating Supabase via webhook:', supabaseError);
            // Continue anyway - local DB is primary
          }
        }
      }
    } else {
      console.log(`No user found for Stripe customer ID: ${customerId}`);
    }
  } catch (error) {
    console.error('Error handling subscription created webhook:', error);
  }
};

const handleSubscriptionUpdated = async (subscription: Stripe.Subscription) => {
  try {
    const customerId = subscription.customer as string;
    
    // Find all users with this stripeCustomerId
    const users = await storage.getAllUsers();
    const matchedUser = users.find(user => user.stripeCustomerId === customerId);
    
    if (matchedUser) {
      // If subscription has cancel_at_period_end set to true, it means the user has cancelled
      // but the subscription is still active until the end of the period
      if (subscription.cancel_at_period_end) {
        // Log that the subscription is pending cancellation
        console.log(`Subscription ${subscription.id} for user ${matchedUser.id} will be cancelled at period end: ${new Date((subscription as any).current_period_end * 1000).toISOString()}`);
        
        // Optionally, you could update a status in the user record to display "Cancelling" in UI
        // We're handling this with the subscription status from Stripe API instead
      } else {
        // Regular subscription update, handle like a creation
        await handleSubscriptionCreated(subscription);
      }
    } else {
      console.log(`No user found for Stripe customer ID: ${customerId}`);
    }
  } catch (error) {
    console.error('Error handling subscription updated webhook:', error);
  }
};

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  try {
    const customerId = subscription.customer as string;
    
    // Find all users with this stripeCustomerId
    const users = await storage.getAllUsers();
    const matchedUser = users.find(user => user.stripeCustomerId === customerId);
      if (matchedUser) {
      // Update user to free plan
      await storage.updateUserPaymentPlan(matchedUser.id, 'free');
      console.log(`Updated user ${matchedUser.id} to free plan based on subscription deleted webhook`);
      
      // Also update Supabase to keep it in sync
      try {
        const { supabase } = await import('../supabase');
        await supabase
          .from('users')
          .update({
            plan: 'free',
            stripe_subscription_id: null
          })
          .eq('email', matchedUser.username);
        console.log(`Updated Supabase user ${matchedUser.username} to free plan via deletion webhook`);
      } catch (supabaseError) {
        console.error('Error updating Supabase via deletion webhook:', supabaseError);
        // Continue anyway - local DB is primary
      }
    } else {
      console.log(`No user found for Stripe customer ID: ${customerId}`);
    }
  } catch (error) {
    console.error('Error handling subscription deleted webhook:', error);
  }
};

export const stripeWebhookHandler = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  
  let event: Stripe.Event;
  
  // If we have a webhook secret, verify the signature
  if (sig && endpointSecret) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log('Webhook signature verified successfully');
    } catch (err) {
      const error = err as Error;
      console.error(`Webhook Error: ${error.message}`);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
  } else {
    // For testing purposes, we'll allow webhook events without signature verification
    // This is NOT secure for production, but allows development testing
    console.warn('WARNING: Processing webhook without signature verification - ONLY FOR TESTING');
    try {
      // Get the event from the raw body
      event = JSON.parse(req.body.toString());
    } catch (err) {
      const error = err as Error;
      console.error(`Webhook Error: ${error.message}`);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
  
  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
      const subscriptionCreated = event.data.object as Stripe.Subscription;
      await handleSubscriptionCreated(subscriptionCreated);
      break;
    case 'customer.subscription.updated':
      const subscriptionUpdated = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscriptionUpdated);
      break;
    case 'customer.subscription.deleted':
      const subscriptionDeleted = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscriptionDeleted);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  // Return a 200 response to acknowledge receipt of the event
  res.send();
};
