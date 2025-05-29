import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Use SESSION_SECRET from environment or a default one if not set
  const sessionSecret = process.env.SESSION_SECRET || 'parking-lot-analysis-secret-key';
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, firstName, lastName } = req.body;
      const { signUp } = await import('./supabase-auth');
      const { data: authData, error: authError } = await signUp(
        username, // email
        password,
        firstName,
        lastName
      );      if (authError) {
        console.error('Registration error:', authError);
        return res.status(400).json({
          error: "Registration failed",
          message: (authError as any).message || "Failed to create account"
        });
      }      console.log("Successfully authenticated user:", authData?.user?.email);
      
      // Check if user exists in our local system
      let user = await storage.getUserByUsername(username);
      
      if (!user && authData?.user) {
        // Before creating new user, check their plan in Supabase
        let userPlan = 'free';
        let hasSeenPlanSelection = false;
          try {
          const { supabase } = await import('./supabase');
          const { data: supabaseUserData } = await supabase
            .from('users')
            .select('plan, registration_status')
            .eq('email', username)
            .single();
          
          if (supabaseUserData?.plan) {
            userPlan = supabaseUserData.plan;
            console.log(`Found existing Supabase user with plan: ${userPlan}`);
            
            // If they have a paid plan, they've already seen plan selection during payment
            if (userPlan === 'pro' || userPlan === 'team') {
              hasSeenPlanSelection = true;
            }
          }
        } catch (supabaseError) {
          console.log('No existing Supabase user found or error retrieving plan:', supabaseError);
          // Continue with default 'free' plan
        }
        
        // Create new user in local system with correct plan
        user = await storage.createUser({
          username: username,
          password: await hashPassword(password),
          firstName: firstName || '',
          lastName: lastName || '',
          supabaseId: authData.user.id,
          paymentPlan: userPlan,
          hasSeenPlanSelection: hasSeenPlanSelection
        });
        console.log(`Created new user in local system with plan ${userPlan}:`, user.id);      } else if (user && authData?.user && !user.supabaseId) {
        // Update existing user with Supabase ID and sync plan
        const updatedUser = await storage.updateSupabaseId(user.id, authData.user.id);
        if (updatedUser) {
          user = updatedUser;
        }
        
        // Also sync the payment plan from Supabase if different
        if (user) {
          try {
            const { supabase } = await import('./supabase');
            const { data: supabaseUser } = await supabase
              .from('users')
              .select('plan')
              .eq('email', username)
              .single();
            
            if (supabaseUser?.plan && supabaseUser.plan !== user.paymentPlan) {
              console.log(`Syncing payment plan from Supabase: ${supabaseUser.plan} (was ${user.paymentPlan})`);
              const planUpdatedUser = await storage.updateUserPaymentPlan(user.id, supabaseUser.plan);
              if (planUpdatedUser) {
                user = planUpdatedUser;
              }
              
              // If they have a paid plan, mark that they've seen plan selection
              if (supabaseUser.plan === 'pro' || supabaseUser.plan === 'team') {
                await storage.updateUserHasSeenPlanSelection(user.id);
              }
            }
          } catch (syncError) {
            console.log('Error syncing payment plan from Supabase:', syncError);
          }
        }
        
        console.log('Updated existing user with Supabase ID and synced plan');
      }
      
      if (!user) {
        return res.status(500).json({
          error: "Registration failed",
          message: "Failed to create user account"
        });
      }
      
      // Log the user in
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
      
    } catch (error: any) {
      console.error('Error during registration:', error);
      res.status(500).json({
        error: "Registration failed",
        message: error.message || "An unexpected error occurred during registration"
      });
    }
  });

  app.post("/api/login", async (req, res, next) => {
    // Check for Supabase token in authorization header
    const authHeader = req.headers.authorization;
    let supabaseUser = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const supabaseToken = authHeader.substring(7);
        // Verify with Supabase
        const { supabase } = await import('./supabase');
        const { data, error } = await supabase.auth.getUser(supabaseToken);
        if (data?.user) {
          supabaseUser = data.user;
          console.log('Authenticated with Supabase token');
        }
      } catch (authError) {
        console.error('Error verifying Supabase token:', authError);
      }
    }
    
    try {
      const { username, password } = req.body;
      const { supabase } = await import('./supabase');
      
      // If we already have a verified Supabase user from the auth header
      if (supabaseUser) {
        // Look up our user by Supabase ID
        const userBySupabaseId = await storage.getUserBySupabaseId(supabaseUser.id);
          if (userBySupabaseId) {
          // User exists in our system, sync their payment plan from Supabase before login
          let finalUser = userBySupabaseId;
            try {
            const { supabase } = await import('./supabase');
            const { data: supabaseUserData } = await supabase
              .from('users')
              .select('plan, stripe_customer_id')
              .eq('id', supabaseUser.id)
              .single();
            
            if (supabaseUserData?.plan && supabaseUserData.plan !== finalUser.paymentPlan) {
              console.log(`Syncing payment plan from Supabase via token auth: ${supabaseUserData.plan} (was ${finalUser.paymentPlan})`);
              const updatedUser = await storage.updateUserPaymentPlan(finalUser.id, supabaseUserData.plan);
              if (updatedUser) {
                finalUser = updatedUser;
                console.log(`Successfully synced payment plan for user ${finalUser.id} to: ${supabaseUserData.plan}`);
              }
              
              // If they have a paid plan, mark that they've seen plan selection
              if (supabaseUserData.plan === 'pro' || supabaseUserData.plan === 'team') {
                await storage.updateUserHasSeenPlanSelection(finalUser.id);
              }
            }
            
            // Also sync Stripe customer ID if available
            if (supabaseUserData?.stripe_customer_id && !finalUser.stripeCustomerId) {
              console.log(`Syncing Stripe customer ID via token auth: ${supabaseUserData.stripe_customer_id}`);
              const updatedUser = await storage.updateUserStripeInfo(finalUser.id, {
                stripeCustomerId: supabaseUserData.stripe_customer_id,
                stripeSubscriptionId: finalUser.stripeSubscriptionId || ''
              });
              if (updatedUser) {
                finalUser = updatedUser;
              }
            }
          } catch (syncError) {
            console.log('Error syncing user data from Supabase via token auth:', syncError);
            // Continue with login even if sync fails
          }
          
          // User exists in our system, log them in with synced data
          req.login(finalUser, async (loginErr) => {
            if (loginErr) return next(loginErr);
            
            try {
              // Record the user sign-in for analytics
              await storage.recordUserSignIn(finalUser.id, req.ip, req.get('User-Agent'));
            } catch (trackingError) {
              console.error("Error recording user sign-in:", trackingError);
            }
            
            console.log(`User ${finalUser.id} logged in via token with payment plan: ${finalUser.paymentPlan}`);
            return res.status(200).json(finalUser);
          });
          return;
        }
        
        // User exists in Supabase but not in our system
        // Try finding by username/email
        // Use email as username if available, otherwise use an empty string
        const userEmail = typeof supabaseUser.email === 'string' ? supabaseUser.email : '';
        const userByUsername = await storage.getUserByUsername(userEmail);
        
        if (userByUsername) {
          // Link the accounts
          const supabaseUserId = typeof supabaseUser.id === 'string' ? supabaseUser.id : '';
          const updatedUser = await storage.updateSupabaseId(userByUsername.id, supabaseUserId);
          if (!updatedUser) {
            return res.status(500).json({ error: "Failed to update user with Supabase ID" });
          }
          
          req.login(updatedUser, async (loginErr) => {
            if (loginErr) return next(loginErr);
            
            try {
              // Record the user sign-in for analytics
              await storage.recordUserSignIn(updatedUser.id, req.ip, req.get('User-Agent'));
            } catch (trackingError) {
              console.error("Error recording user sign-in:", trackingError);
            }
            
            return res.status(200).json(updatedUser);
          });
          return;
        }
        
        // Create a new user in our system
        const randomPassword = Math.random().toString(36).slice(2, 10);
        // Use id from Supabase user, with fallback to empty string
        const supabaseUserId = typeof supabaseUser.id === 'string' ? supabaseUser.id : '';
        const hashedPassword = await hashPassword(randomPassword);
        
        const newUser = await storage.createUser({
          username: userEmail, // Use email from above
          password: hashedPassword, // Generate a random password for our local auth
          supabaseId: supabaseUserId,
          firstName: supabaseUser.user_metadata?.first_name || null,
          lastName: supabaseUser.user_metadata?.last_name || null,
        });
        
        req.login(newUser, async (loginErr) => {
          if (loginErr) return next(loginErr);
          
          try {
            // Record the user sign-in for analytics
            await storage.recordUserSignIn(newUser.id, req.ip, req.get('User-Agent'));
          } catch (trackingError) {
            console.error("Error recording user sign-in:", trackingError);
          }
          
          return res.status(200).json(newUser);
        });
        return;
      }
      
      // Try to authenticate with credentials via Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: username,
        password: password
      });
      
      if (authError) {
        console.log('Supabase auth failed, falling back to local auth:', authError.message);
        // Fall back to local authentication
        return passport.authenticate('local', (err: any, user: any) => {
          if (err) return next(err);
          if (!user) {
            return res.status(401).json({ error: "Invalid username or password" });
          }
          
          req.login(user, async (loginErr) => {
            if (loginErr) return next(loginErr);
            
            try {
              // Record the user sign-in for analytics
              await storage.recordUserSignIn(user.id, req.ip, req.get('User-Agent'));
            } catch (trackingError) {
              console.error("Error recording user sign-in:", trackingError);
            }
            
            res.status(200).json(user);
          });
        })(req, res, next);
      }
      
      // Supabase auth successful
      console.log('Successfully authenticated with Supabase:', authData.user?.id);
      
      // Find the user in our local system
      const user = await storage.getUserByUsername(username);
        if (!user) {
        // User exists in Supabase but not in our local system - create local record
        console.log('User exists in Supabase but not locally, creating local record');
        
        // Before creating the user, check their payment plan in Supabase
        let userPlan = 'free';
        let stripeCustomerId = null;
        let hasSeenPlanSelection = false;
        
        try {
          const { supabase } = await import('./supabase');
          const { data: supabaseUser } = await supabase
            .from('users')
            .select('plan, stripe_customer_id')
            .eq('email', username)
            .single();
          
          if (supabaseUser?.plan) {
            userPlan = supabaseUser.plan;
            stripeCustomerId = supabaseUser.stripe_customer_id;
            console.log(`Found existing Supabase user with plan: ${userPlan}`);
            
            // If they have a paid plan, they've already seen plan selection during payment
            if (userPlan === 'pro' || userPlan === 'team') {
              hasSeenPlanSelection = true;
            }
          }
        } catch (supabaseError) {
          console.log('No existing Supabase user found or error retrieving plan:', supabaseError);
          // Continue with default 'free' plan
        }
        
        const newUser = await storage.createUser({
          username: username,
          password: await hashPassword(password), // Store locally hashed password as backup
          firstName: authData.user?.user_metadata?.first_name || '',
          lastName: authData.user?.user_metadata?.last_name || '',
          supabaseId: authData.user?.id,
          paymentPlan: userPlan,
          hasSeenPlanSelection: hasSeenPlanSelection,
          stripeCustomerId: stripeCustomerId
        });
        
        req.login(newUser, async (loginErr) => {
          if (loginErr) return next(loginErr);
          
          try {
            // Record the new user sign-in
            await storage.recordUserSignIn(newUser.id, req.ip, req.get('User-Agent'));
          } catch (trackingError) {
            console.error("Error recording user sign-in:", trackingError);
          }
          
          console.log(`New user ${newUser.id} created and logged in with payment plan: ${newUser.paymentPlan}`);
          res.status(200).json(newUser);
        });
        return;
      }
        // If we get here, the user exists both in Supabase and locally
      // Update local record with Supabase ID if not already set and sync payment plan
      let finalUser = user;
      
      if (!user.supabaseId && authData.user?.id) {
        console.log('Updating Supabase ID for user', user.id, 'to', authData.user.id);
        finalUser = await storage.updateSupabaseId(user.id, authData.user.id);
        if (!finalUser) {
          console.error('Failed to update Supabase ID');
          finalUser = user;
        }
      }
      
      // CRITICAL: Sync payment plan from Supabase to local storage
      try {
        const { supabase } = await import('./supabase');
        const { data: supabaseUser } = await supabase
          .from('users')
          .select('plan, stripe_customer_id')
          .eq('email', username)
          .single();
        
        if (supabaseUser?.plan && supabaseUser.plan !== finalUser.paymentPlan) {
          console.log(`Syncing payment plan from Supabase: ${supabaseUser.plan} (was ${finalUser.paymentPlan})`);
          const updatedUser = await storage.updateUserPaymentPlan(finalUser.id, supabaseUser.plan);
          if (updatedUser) {
            finalUser = updatedUser;
            console.log(`Successfully synced payment plan for user ${finalUser.id} to: ${supabaseUser.plan}`);
          }
          
          // If they have a paid plan, mark that they've seen plan selection
          if (supabaseUser.plan === 'pro' || supabaseUser.plan === 'team') {
            await storage.updateUserHasSeenPlanSelection(finalUser.id);
          }
        }
        
        // Also sync Stripe customer ID if available
        if (supabaseUser?.stripe_customer_id && !finalUser.stripeCustomerId) {
          console.log(`Syncing Stripe customer ID: ${supabaseUser.stripe_customer_id}`);
          const updatedUser = await storage.updateUserStripeInfo(finalUser.id, {
            stripeCustomerId: supabaseUser.stripe_customer_id,
            stripeSubscriptionId: finalUser.stripeSubscriptionId || ''
          });
          if (updatedUser) {
            finalUser = updatedUser;
          }
        }
      } catch (syncError) {
        console.log('Error syncing user data from Supabase during login:', syncError);
        // Continue with login even if sync fails
      }
      
      // Log in the user with our local session using the final (potentially updated) user data
      req.login(finalUser, async (loginErr) => {
        if (loginErr) return next(loginErr);
        
        try {
          // Record the user sign-in for analytics
          await storage.recordUserSignIn(finalUser.id, req.ip, req.get('User-Agent'));
        } catch (trackingError) {
          console.error("Error recording user sign-in:", trackingError);
        }
        
        console.log(`User ${finalUser.id} logged in successfully with payment plan: ${finalUser.paymentPlan}`);
        res.status(200).json(finalUser);
      });
      
    } catch (error: any) {
      console.error("Error during login process:", error);
      res.status(500).json({ error: "Login failed", message: error.message || "An unexpected error occurred during login" });
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
  
  // Sync user data from Supabase endpoint - useful after payment completion
  app.post("/api/user/sync", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const currentUser = req.user!;
      let updatedUser = currentUser;
      
      // Sync data from Supabase
      const { supabase } = await import('./supabase');
      const { data: supabaseUser } = await supabase
        .from('users')
        .select('plan, stripe_customer_id, stripe_subscription_id')
        .eq('email', currentUser.username)
        .single();
      
      if (supabaseUser) {
        let hasUpdates = false;
        
        // Sync payment plan
        if (supabaseUser.plan && supabaseUser.plan !== currentUser.paymentPlan) {
          console.log(`Syncing payment plan from Supabase: ${supabaseUser.plan} (was ${currentUser.paymentPlan})`);
          const planUpdatedUser = await storage.updateUserPaymentPlan(currentUser.id, supabaseUser.plan);
          if (planUpdatedUser) {
            updatedUser = planUpdatedUser;
            hasUpdates = true;
            
            // If they have a paid plan, mark that they've seen plan selection
            if (supabaseUser.plan === 'pro' || supabaseUser.plan === 'team') {
              await storage.updateUserHasSeenPlanSelection(currentUser.id);
            }
          }
        }
        
        // Sync Stripe info
        if (supabaseUser.stripe_customer_id && supabaseUser.stripe_customer_id !== currentUser.stripeCustomerId) {
          console.log(`Syncing Stripe customer ID: ${supabaseUser.stripe_customer_id}`);
          const stripeUpdatedUser = await storage.updateUserStripeInfo(updatedUser.id, {
            stripeCustomerId: supabaseUser.stripe_customer_id,
            stripeSubscriptionId: supabaseUser.stripe_subscription_id || updatedUser.stripeSubscriptionId || ''
          });
          if (stripeUpdatedUser) {
            updatedUser = stripeUpdatedUser;
            hasUpdates = true;
          }
        }
        
        // Update session if there were changes
        if (hasUpdates) {
          req.login(updatedUser, (loginErr) => {
            if (loginErr) {
              console.error('Error updating session after sync:', loginErr);
              return res.status(500).json({ error: "Failed to update session" });
            }
            console.log(`Successfully synced user ${updatedUser.id} data from Supabase`);
            return res.json({ success: true, user: updatedUser });
          });
        } else {
          return res.json({ success: true, user: updatedUser, message: "No updates needed" });
        }
      } else {
        return res.json({ success: true, user: updatedUser, message: "No Supabase user found" });
      }
    } catch (error) {
      console.error('Error syncing user data:', error);
      res.status(500).json({ error: "Failed to sync user data" });
    }
  });
  
  // Password reset request endpoint
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ error: "Email address is required" });
      }
      
      // Create a reset token for the user
      const resetToken = await storage.createPasswordResetToken(username);
      
      if (!resetToken) {
        // Don't reveal if a user exists for security reasons
        return res.json({ success: true, message: "If that email exists, a password reset link has been sent" });
      }
      
      // Import the email service (done here to avoid circular dependencies)
      const { sendPasswordResetEmail } = await import('./services/email');
      
      // Send the password reset email
      const emailSent = await sendPasswordResetEmail(username, resetToken, username);
      
      if (emailSent) {
        console.log(`Password reset email sent to ${username}`);
      } else {
        console.error(`Failed to send password reset email to ${username}`);
      }
      
      // Respond with success but don't confirm if user exists
      res.json({ success: true, message: "If that email exists, a password reset link has been sent" });
    } catch (error) {
      console.error("Error processing password reset request:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });
  
  // Verify reset token endpoint
  app.get("/api/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ error: "Reset token is required" });
      }
      
      // Check if the token is valid and not expired
      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      
      // Token is valid
      res.json({ valid: true, username: user.username });
    } catch (error) {
      console.error("Error verifying reset token:", error);
      res.status(500).json({ error: "Failed to verify reset token" });
    }
  });
  
  // Reset password endpoint
  app.post("/api/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ error: "Reset token and new password are required" });
      }
      
      // Check if the token is valid and not expired
      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(password);
      
      // Update the user's password and clear the reset token
      const updatedUser = await storage.updateUserPassword(user.id, hashedPassword);
      
      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update password" });
      }
      
      // Log the user in automatically
      req.login(updatedUser, (err) => {
        if (err) {
          console.error("Error logging in after password reset:", err);
          return res.status(200).json({ success: true, message: "Password reset successful. Please log in with your new password." });
        }
        
        res.json({ success: true, message: "Password reset successful" });
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });
  
  // Update user payment plan
  app.patch("/api/user/payment-plan", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { plan, paymentVerified } = req.body;
    if (!plan || !["free", "pro", "team"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }
    
    try {
      // Current user data
      const currentUser = req.user!;
      
      // Verify payment for paid plans (unless explicitly overridden with paymentVerified flag)
      if ((plan === 'pro' || plan === 'team') && !paymentVerified) {
        // If upgrading to a paid plan, check if the user has a Stripe subscription
        if (!currentUser.stripeSubscriptionId) {
          console.log(`User ${currentUser.id} attempted to upgrade to ${plan} without a Stripe subscription`);
          return res.status(403).json({ 
            error: "Payment required", 
            message: "You must complete payment through Stripe before upgrading to a paid plan."
          });
        }
        
        // Note: In production, we should also verify the subscription is active with Stripe API
        console.log(`User ${currentUser.id} has a Stripe subscription (${currentUser.stripeSubscriptionId}), allowing upgrade to ${plan}`);
      }
      
      // For free plan, always allow downgrade
      if (plan === 'free') {
        console.log(`User ${currentUser.id} is downgrading to free plan`);
      }
      
      const updatedUser = await storage.updateUserPaymentPlan(currentUser.id, plan);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Log the change
      console.log(`Updated existing user ${updatedUser.username} with role ${plan}`);
      
      // Update the user in the session
      req.login(updatedUser, (err) => {
        if (err) return res.status(500).json({ error: "Session update failed" });
        res.json(updatedUser);
      });
    } catch (error) {
      console.error("Error updating payment plan:", error);
      res.status(500).json({ error: "Failed to update payment plan" });
    }
  });
  
  // Update user has seen plan selection
  app.patch("/api/user/seen-plan-selection", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const updatedUser = await storage.updateUserHasSeenPlanSelection(req.user!.id);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Update the user in the session
      req.login(updatedUser, (err) => {
        if (err) return res.status(500).json({ error: "Session update failed" });
        res.json(updatedUser);
      });
    } catch (error) {
      console.error("Error updating user seen plan selection:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });
}
