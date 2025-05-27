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
      );

      if (authError) {
        console.error('Registration error:', authError);
        return res.status(400).json({
          error: "Registration failed",
          message: authError.message || "Failed to create account"
        });
      }

      console.log("Successfully authenticated user:", authData?.user?.email);
      
      // Check if user exists in our local system
      let user = await storage.getUserByUsername(username);
      
      if (!user && authData?.user) {
        // Create new user in local system
        user = await storage.createUser({
          username: username,
          password: await hashPassword(password),
          firstName: firstName || '',
          lastName: lastName || '',
          supabaseId: authData.user.id,
          paymentPlan: 'free',
          hasSeenPlanSelection: false
        });
        console.log('Created new user in local system:', user.id);
      } else if (user && authData?.user && !user.supabaseId) {
        // Update existing user with Supabase ID
        user = await storage.updateSupabaseId(user.id, authData.user.id);
        console.log('Updated existing user with Supabase ID');
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
          // User exists in our system, log them in
          req.login(userBySupabaseId, async (loginErr) => {
            if (loginErr) return next(loginErr);
            
            try {
              // Record the user sign-in for analytics
              await storage.recordUserSignIn(userBySupabaseId.id, req.ip, req.get('User-Agent'));
            } catch (trackingError) {
              console.error("Error recording user sign-in:", trackingError);
            }
            
            return res.status(200).json(userBySupabaseId);
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
        const newUser = await storage.createUser({
          username: username,
          password: await hashPassword(password), // Store locally hashed password as backup
          firstName: authData.user?.user_metadata?.first_name || '',
          lastName: authData.user?.user_metadata?.last_name || '',
          supabaseId: authData.user?.id,
        });
        
        req.login(newUser, async (loginErr) => {
          if (loginErr) return next(loginErr);
          
          try {
            // Record the new user sign-in
            await storage.recordUserSignIn(newUser.id, req.ip, req.get('User-Agent'));
          } catch (trackingError) {
            console.error("Error recording user sign-in:", trackingError);
          }
          
          res.status(200).json(newUser);
        });
        return;
      }
      
      // If we get here, the user exists both in Supabase and locally
      // Update local record with Supabase ID if not already set
      // Update logic for the Supabase ID - since it's not yet implemented in our storage
      // In a full implementation, we would update the user record with the Supabase ID
      if (!user.supabaseId && authData.user?.id) {
        console.log('Would update Supabase ID for user', user.id, 'to', authData.user.id);
        // Commented out until we implement this method
        // await storage.updateSupabaseId(user.id, authData.user.id);
      }
      
      // Log in the user with our local session
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
