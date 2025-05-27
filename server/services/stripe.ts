import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

export const stripe = new Stripe('sk_test_51RRKheFP7ZuSUs6fL7vh5OvaSmNRqqPKY4NCTmPpyOjS4abCYpNt4TsZO1hBYV4UUFud413KfCWnSiJzlQb8fGPs00BoOnxMo4', {
  apiVersion: '2023-10-16' as any,
});

// Price IDs for different plans
const PRICE_IDS = {
  // Use environment variables if set, otherwise use Stripe test price IDs
  // These are standard test price IDs that work with Stripe's test mode
  pro: process.env.STRIPE_PRICE_PRO || 'price_1OeC4jEtSCIE3SCWutc3XKch', // Pro plan price ID
  team: process.env.STRIPE_PRICE_TEAM || 'price_1OeC58EtSCIE3SCWZkIssgHP', // Team plan price ID
};

/**
 * Create a payment intent for one-time payment
 */
export async function createPaymentIntent(amount: number, currency: string = 'usd', metadata: Record<string, string> = {}) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata,
    });
    
    return paymentIntent;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
}

/**
 * Create a subscription for recurring payments
 */
export async function createSubscription(plan: 'pro' | 'team', email: string, name?: string) {
  try {
    // First create or retrieve a customer
    const customerParams: Stripe.CustomerCreateParams = {
      email,
      name,
    };
    
    const customers = await stripe.customers.list({ email });
    let customer: Stripe.Customer;
    
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create(customerParams);
    }
    
    // Attempt to use predefined price ID if available
    let priceId = PRICE_IDS[plan];
    
    // Check if we need to create a new price ID
    let needNewPrice = false;
    try {
      // Try to retrieve the price to see if it exists
      if (priceId) {
        await stripe.prices.retrieve(priceId);
        console.log(`Using existing price ID: ${priceId}`);
      } else {
        needNewPrice = true;
      }
    } catch (error) {
      // If we get here, the price doesn't exist or there was an error
      console.log(`Price ID ${priceId} not found or error retrieving it. Creating new product and price.`);
      needNewPrice = true;
    }
    
    if (needNewPrice) {
      
      // Create a new product based on the plan
      const productName = plan === 'pro' ? 'Pro Plan' : 'Enterprise Plan';
      const unitAmount = plan === 'pro' ? 4900 : 14900; // $49 or $149
      
      const product = await stripe.products.create({
        name: productName,
        description: `${productName} - Monthly Subscription`,
      });
      
      // Create a price for the product
      const price = await stripe.prices.create({
        unit_amount: unitAmount,
        currency: 'usd',
        recurring: { interval: 'month' },
        product: product.id,
      });
      
      priceId = price.id;
      
      // Store the price ID for future use
      if (plan === 'pro') {
        process.env.STRIPE_PRICE_PRO = priceId;
      } else {
        process.env.STRIPE_PRICE_TEAM = priceId;
      }
      
      console.log(`Created new ${plan} plan price: ${priceId}`);
    }
    
    // Now create the subscription with the price ID
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
    
    return {
      subscriptionId: subscription.id,
      customerId: customer.id,
      clientSecret: ((subscription.latest_invoice as any)?.payment_intent as any)?.client_secret,
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
}

/**
 * Retrieve customer by ID
 */
export async function getCustomer(customerId: string) {
  try {
    return await stripe.customers.retrieve(customerId);
  } catch (error) {
    console.error('Error retrieving customer:', error);
    throw error;
  }
}

/**
 * Retrieve subscription information from Stripe
 */
export async function getSubscription(subscriptionId: string) {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    throw error;
  }
}

/**
 * Create a checkout session for subscription payment
 * @returns A Stripe Checkout Session object with URL for redirect
 */
export async function createCheckoutSession(
  email: string, 
  plan: 'pro' | 'team',
  successUrl?: string,
  cancelUrl?: string
) {
  try {
    // Get the appropriate price ID for the plan
    let priceId = PRICE_IDS[plan];
    
    // Check if we need to create a new price ID
    let needNewPrice = false;
    try {
      // Try to retrieve the price to see if it exists
      if (priceId) {
        await stripe.prices.retrieve(priceId);
        console.log(`Using existing price ID: ${priceId}`);
      } else {
        needNewPrice = true;
      }
    } catch (error) {
      // If we get here, the price doesn't exist or there was an error
      console.log(`Price ID ${priceId} not found or error retrieving it. Creating new product and price.`);
      needNewPrice = true;
    }
    
    if (needNewPrice) {
      // Create a new product based on the plan
      const productName = plan === 'pro' ? 'Pro Plan' : 'Enterprise Plan';
      const unitAmount = plan === 'pro' ? 4900 : 14900; // $49 or $149
      
      const product = await stripe.products.create({
        name: productName,
        description: `${productName} - Monthly Subscription`,
      });
      
      // Create a price for the product
      const price = await stripe.prices.create({
        unit_amount: unitAmount,
        currency: 'usd',
        recurring: { interval: 'month' },
        product: product.id,
      });
      
      priceId = price.id;
      
      // Store the price ID for future use
      if (plan === 'pro') {
        process.env.STRIPE_PRICE_PRO = priceId;
      } else {
        process.env.STRIPE_PRICE_TEAM = priceId;
      }
      
      console.log(`Created new ${plan} plan price: ${priceId}`);
    }
    
    // Set default URLs if not provided
    const finalSuccessUrl = successUrl || `${process.env.APP_URL || 'http://localhost:3000'}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${process.env.APP_URL || 'http://localhost:3000'}/payment-plan?from=stripe_cancel`;
    
    // Log URLs for debugging
    console.log('Creating checkout session with URLs:');
    console.log('Success URL:', finalSuccessUrl);
    console.log('Cancel URL:', finalCancelUrl);
    
    console.log('Creating Stripe checkout session with params:', {
      paymentMethodTypes: ['card'],
      lineItems: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      successUrl: finalSuccessUrl,
      cancelUrl: finalCancelUrl,
      customerEmail: email,
      clientReferenceId: plan
    });
    
    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      customer_email: email,
      client_reference_id: plan, // Store the plan in the session for reference
    });
    
    console.log('Checkout session created successfully:', {
      id: session.id,
      url: session.url,
      object: session.object,
      status: session.status,
      paymentStatus: session.payment_status
    });
    
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}
