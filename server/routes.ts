import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { spawn } from "child_process";
import path from "path";
import express from 'express';
import fs from 'fs';
import { insertFreeQuoteRequestSchema, insertUserFeedbackSchema, insertQuoteSchema } from "@shared/schema";
import { z } from "zod";
import { addLead, getLeads, LeadData } from "./services/airtable";
import publicRoutes from "./public-routes";
import supabaseRoutes from "./routes/supabase-routes";
import stripeRoutes from "./routes/stripe-routes";
import { stripeWebhookHandler } from "./controllers/stripe-webhook";
import { registerCalendlyRoutes } from "./routes/calendly-routes";
import axios from 'axios';
import { createTestHistory } from "./test-history";

// Admin middleware
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const isAdmin = await storage.isAdmin(req.user!.id);
  if (!isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  
  // Register public routes that don't require authentication
  app.use('/api', publicRoutes);
  
  // Register Supabase routes
  app.use('/api/supabase', supabaseRoutes);
  
  // Register Calendly routes
  registerCalendlyRoutes(app);
  
  // Register Stripe routes
  app.use('/api/stripe', stripeRoutes);
  
  // Convenience endpoint for confirming subscription at the API root level
  app.get('/api/confirm-subscription', async (req, res) => {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    try {
      // Call the stripe service endpoint
      const response = await fetch(`${req.protocol}://${req.get('host')}/api/stripe/confirm-subscription?session_id=${session_id}`);
      const data = await response.json();
      
      // Forward the response
      res.status(response.status).json(data);
    } catch (error) {
      console.error('Error confirming subscription:', error);
      res.status(500).json({
        error: 'Failed to confirm subscription',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
  
  // Stripe webhook endpoint - needs raw body
  app.post('/api/webhook/stripe', express.raw({type: 'application/json'}), stripeWebhookHandler);

  // Serve processed images from tmp directory
  app.use('/tmp', express.static(path.join(process.cwd(), 'tmp')));

  // Search history endpoints
  app.post("/api/search-history", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    console.log("Saving search history with data:", JSON.stringify(req.body));
    const result = await storage.addSearchHistory(req.user!.id, req.body);
    res.json(result);
  });

  app.get("/api/search-history", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const history = await storage.getUserSearchHistory(req.user!.id);
    console.log(`Retrieving search history for user ${req.user!.id}, found ${history.length} entries`);
    res.json(history);
  });
  
  // Test endpoint for creating history data (temporary)
  app.get("/api/test/create-history", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });
    
    try {
      const result = await createTestHistory(req.user!.id);
      return res.json(result);
    } catch (error) {
      console.error("Error creating test history:", error);
      return res.status(500).json({ error: "Failed to create test history" });
    }
  });
  
  // Check if address exists in user's history
  app.get("/api/search-history/check", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { address } = req.query;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: "Address parameter is required" });
    }
    
    const history = await storage.getUserSearchHistory(req.user!.id);
    const existingEntry = history.find(entry => entry.address.toLowerCase() === address.toLowerCase());
    
    res.json({
      exists: !!existingEntry,
      entry: existingEntry || null
    });
  });

  // Free quote request endpoints
  app.post("/api/free-quote-requests", async (req, res) => {
    try {
      // Validate the request body
      const validatedData = insertFreeQuoteRequestSchema.parse(req.body);
      const result = await storage.createFreeQuoteRequest(validatedData);
      
      // Also send the quote data to Airtable as a lead
      try {
        const { name, email } = validatedData;
        
        // Format the detection information for details
        const quoteDetails = `
          Spaces: ${validatedData.parkingSpaces ?? 0}
          Handicap: ${validatedData.handicapSpots ?? 0}
          Crosswalks: ${validatedData.crosswalks ?? 0}
          Arrows: ${validatedData.arrows ?? 0}
          Total Price Range: $${validatedData.lowerEstimate}-$${validatedData.upperEstimate}
        `;
        
        // Create lead data for Airtable
        const leadData: LeadData = {
          name,
          email,
          phone: validatedData.phone ?? undefined,
          address: validatedData.address,
          details: quoteDetails,
          source: "Free Quote",
          status: "New Lead"
        };
        
        // Send to Airtable
        await addLead(leadData);
      } catch (airtableError) {
        // Log error but don't fail the request if Airtable integration fails
        console.error("Error sending quote to Airtable:", airtableError);
      }
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating free quote request:", error);
      res.status(500).json({ error: "Failed to create free quote request" });
    }
  });

  // Admin endpoints - Get all free quote requests
  app.get("/api/admin/free-quote-requests", requireAdmin, async (req, res) => {
    try {
      const requests = await storage.getFreeQuoteRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching free quote requests:", error);
      res.status(500).json({ error: "Failed to fetch free quote requests" });
    }
  });

  // Admin endpoints - Get a specific free quote request
  app.get("/api/admin/free-quote-requests/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }
      
      const request = await storage.getFreeQuoteRequest(id);
      if (!request) {
        return res.status(404).json({ error: "Free quote request not found" });
      }
      
      res.json(request);
    } catch (error) {
      console.error("Error fetching free quote request:", error);
      res.status(500).json({ error: "Failed to fetch free quote request" });
    }
  });

  // Admin endpoints - Update free quote request status
  app.patch("/api/admin/free-quote-requests/:id/status", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }
      
      const { status } = req.body;
      if (!status || !["pending", "contacted", "completed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      const updatedRequest = await storage.updateFreeQuoteRequestStatus(id, status);
      if (!updatedRequest) {
        return res.status(404).json({ error: "Free quote request not found" });
      }
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Error updating free quote request status:", error);
      res.status(500).json({ error: "Failed to update free quote request status" });
    }
  });

  // Admin check endpoint
  app.get("/api/admin/check", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ isAdmin: false });
    }
    
    const isAdmin = await storage.isAdmin(req.user!.id);
    res.json({ isAdmin });
  });

  // Screenshot processing endpoint
  app.post("/api/process-screenshot", async (req, res) => {
    try {
      const { image, polygonCoordinates } = req.body;

      if (!image) {
        return res.status(400).json({ error: 'No image data provided' });
      }

      // Spawn Python process
      const pythonProcess = spawn("python3", [
        path.join(process.cwd(), "server", "process_image.py")
      ]);

      let outputData = '';

      // Collect output from Python process
      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      // Send image data to Python process
      pythonProcess.stdin.write(JSON.stringify({ image, polygonCoordinates }));
      pythonProcess.stdin.end();

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Python process error, exit code:', code);
          res.status(500).json({ error: 'Processing failed' });
          return;
        }

        try {
          // Log the raw output for debugging
          console.log('Raw Python output:', outputData);

          // Get the last line which should be our JSON
          const lines = outputData.trim().split('\n');
          const jsonLine = lines[lines.length - 1];

          console.log('Attempting to parse JSON from:', jsonLine);

          // Parse the JSON output directly from Python's stdout
          const result = JSON.parse(jsonLine);

          if (result.error) {
            res.status(500).json({ error: result.error });
            return;
          }

          // The unique_id is already in the result object from Python
          res.json(result);
        } catch (e: any) {
          console.error('Error processing result:', e);
          res.status(500).json({ 
            error: 'Failed to process result',
            details: e.message 
          });
        }
      });
    } catch (error) {
      console.error('Route error:', error);
      res.status(500).json({ error: 'Failed to process screenshot' });
    }
  });

  // User feedback endpoints
  app.post("/api/feedback", async (req, res) => {
    try {
      // Validate the request body
      const validatedData = insertUserFeedbackSchema.parse(req.body);
      const result = await storage.createUserFeedback(validatedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating user feedback:", error);
      res.status(500).json({ error: "Failed to create user feedback" });
    }
  });

  // Admin endpoints - Get all feedback
  app.get("/api/admin/feedback", requireAdmin, async (req, res) => {
    try {
      const feedback = await storage.getUserFeedback();
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching user feedback:", error);
      res.status(500).json({ error: "Failed to fetch user feedback" });
    }
  });
  
  // Admin endpoint - Get all users
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Admin endpoint - Get all user sign-ins
  app.get("/api/admin/user-sign-ins", requireAdmin, async (req, res) => {
    try {
      const signIns = await storage.getAllUserSignIns();
      res.json(signIns);
    } catch (error) {
      console.error("Error fetching user sign-ins:", error);
      res.status(500).json({ error: "Failed to fetch user sign-ins" });
    }
  });

  // User payment plan update endpoint
  app.patch("/api/user/payment-plan", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { plan } = req.body;
      
      if (!plan || !['free', 'pro', 'team'].includes(plan)) {
        return res.status(400).json({ error: "Valid plan is required (free, pro, or team)" });
      }
      
      const updatedUser = await storage.updateUserPaymentPlan(req.user!.id, plan);
      
      // Also update hasSeenPlanSelection
      await storage.updateUserHasSeenPlanSelection(req.user!.id);
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating payment plan:", error);
      res.status(500).json({ error: "Failed to update payment plan" });
    }
  });
  
  // Admin endpoint - Get sign-ins for a specific user
  app.get("/api/admin/user-sign-ins/:userId", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      const signIns = await storage.getUserSignIns(userId);
      res.json(signIns);
    } catch (error) {
      console.error("Error fetching user sign-ins:", error);
      res.status(500).json({ error: "Failed to fetch user sign-ins" });
    }
  });

  // Admin endpoint - Get all quote analytics
  app.get("/api/admin/quote-analytics", requireAdmin, async (req, res) => {
    try {
      const analytics = await storage.getQuoteAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching quote analytics:", error);
      res.status(500).json({ error: "Failed to fetch quote analytics" });
    }
  });
  
  // Airtable token test endpoint
  app.post('/api/test-token', async (req, res) => {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const BASE_ID = 'appgDI9b1jnWmYZ3E';
    const TABLE_NAME = req.query.table?.toString() || 'Leads';
    const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;

    // Log token format but keep it secure
    if (AIRTABLE_TOKEN) {
      const tokenPrefix = AIRTABLE_TOKEN.substring(0, 5);
      const tokenLength = AIRTABLE_TOKEN.length;
      console.log(`Testing token: ${tokenPrefix}... (length: ${tokenLength})`);
    } else {
      console.log("No token found in environment variables!");
      return res.status(500).json({ 
        success: false, 
        error: "No Airtable token found in environment variables" 
      });
    }
    
    console.log("Base ID:", BASE_ID);
    console.log("Table Name:", TABLE_NAME);
    console.log("URL:", AIRTABLE_URL);

    // First try a direct GET request to test authentication (less invasive)
    console.log("Trying GET request first to test authentication...");
    try {
      const getResponse = await axios.get(
        AIRTABLE_URL,
        {
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return res.json({ 
        success: true, 
        method: "GET",
        message: "Successfully authenticated with Airtable!",
        data: getResponse.data
      });
    } catch (getErr: any) {
      console.log("GET request failed:", getErr.response?.status, getErr.response?.data || getErr.message);
      // Continue with POST attempts
    }

    // Try different authorization header formats
    const authHeaders = [
      { format: "Bearer with token", header: `Bearer ${AIRTABLE_TOKEN}` },
      { format: "Direct token", header: AIRTABLE_TOKEN || "" },
      { format: "key prefix", header: `key${AIRTABLE_TOKEN}` },
      { format: "keySomething", header: `keyNeedsPrefix${AIRTABLE_TOKEN?.replace(/^pat/, "")}` }
    ];

    let lastError = null;
    
    for (const authHeader of authHeaders) {
      console.log(`Trying auth format: ${authHeader.format}`);
      try {
        const response = await axios.post(
          AIRTABLE_URL,
          {
            fields: {
              Name: 'Token Test',
              "Contact Email": 'checktoken@airtable.com',
              "Phone Number": '000-000-0000',
              "Quotes Generated": 0
            }
          },
          {
            headers: {
              Authorization: authHeader.header,
              'Content-Type': 'application/json'
            }
          }
        );

        // If we get here, it worked!
        return res.json({ 
          success: true, 
          data: response.data,
          workingFormat: authHeader.format 
        });
      } catch (err: any) {
        console.error(`Format ${authHeader.format} failed:`, err.response?.data || err.message);
        lastError = err;
      }
    }
    
    // If we got here, none of the formats worked
    return res.status(500).json({ 
      success: false, 
      error: lastError?.message || "All authorization formats failed",
      response: lastError?.response?.data || null
    });
  });

  // Admin endpoint - Make a user an admin
  app.post("/api/admin/make-admin/:userId", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      const updatedUser = await storage.makeAdmin(userId);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error making user admin:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });
  
  // Record quote generation for analytics
  app.post("/api/quote-analytics", async (req, res) => {
    try {
      // If user is logged in, associate with their userId
      if (req.isAuthenticated()) {
        req.body.userId = req.user!.id;
      }
      
      const result = await storage.recordQuoteGeneration(req.body);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error recording quote analytics:", error);
      res.status(500).json({ error: "Failed to record quote analytics" });
    }
  });
  
  // Address usage tracking endpoints
  app.get("/api/address-usage", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Check if the user is an admin
      const isAdmin = await storage.isAdmin(req.user!.id);
      
      // Admins have unlimited access - return a special unlimited response
      if (isAdmin) {
        return res.json({
          canUseMoreAddresses: true,
          usageCount: 0,
          limit: Infinity,
          isAdmin: true
        });
      }
      
      // For regular users, proceed with normal flow
      
      // First reset usage if it's a new month
      await storage.resetAddressUsageIfNeeded(req.user!.id);
      
      // Then get the usage info
      const usageInfo = await storage.checkAddressUsageLimit(req.user!.id);
      res.json(usageInfo);
    } catch (error) {
      console.error("Error checking address usage:", error);
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  });
  
  app.post("/api/address-usage/increment", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Get address from request body
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: "Address is required" });
      }
      
      // Check if the user is an admin
      const isAdmin = await storage.isAdmin(req.user!.id);
      
      // Admins have unlimited access - always return success without incrementing
      if (isAdmin) {
        return res.json({
          success: true,
          usageCount: 0,
          limit: Infinity,
          isAdmin: true
        });
      }
      
      // For regular users, proceed with normal flow
      
      // First reset usage if it's a new month
      await storage.resetAddressUsageIfNeeded(req.user!.id);
      
      // Check if user can use more addresses
      const usageInfo = await storage.checkAddressUsageLimit(req.user!.id);
      
      if (!usageInfo.canUseMoreAddresses) {
        return res.status(403).json({ 
          error: "Address usage limit reached", 
          usageCount: usageInfo.usageCount,
          limit: usageInfo.limit,
          planUpgradeRequired: true
        });
      }
      
      // If we can use more addresses, increment the count with the address
      const newCount = await storage.incrementAddressUsage(req.user!.id, address);
      res.json({ 
        success: true, 
        usageCount: newCount,
        limit: usageInfo.limit
      });
    } catch (error) {
      console.error("Error incrementing address usage:", error);
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  });

  // Airtable Leads Integration
  const handleLeadSubmission = async (req: Request, res: Response) => {
    try {
      const { name, email, phone, address, details, source, status } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" });
      }
      
      const leadData: LeadData = {
        name,
        email,
        phone,
        address,
        details,
        source: source || "Website",
        status: status || "New"
      };
      
      const result = await addLead(leadData);
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error: any) {
      console.error("Error adding lead to Airtable:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "An unexpected error occurred" 
      });
    }
  };

  // Authenticated endpoint for internal use
  app.post("/api/leads", (req, res, next) => {
    if (req.isAuthenticated()) {
      next();
    } else {
      res.status(401).json({ success: false, error: "Authentication required" });
    }
  }, handleLeadSubmission);
  
  // Admin-only: Get all leads from Airtable
  app.get("/api/admin/leads", requireAdmin, async (req, res) => {
    try {
      const result = await getLeads();
      
      if (result.success) {
        // Include any extra metadata about the source in the response
        const response: any = {
          records: result.records,
          fromLocalStorage: result.fromLocalStorage || false
        };
        // Add error info if available
        if ('airtableError' in result && result.airtableError) {
          response.airtableError = result.airtableError;
        }
        res.json(response);
      } else {
        // This shouldn't happen with our new implementation due to local storage fallback
        res.status(500).json({ 
          error: "Failed to retrieve leads", 
          details: "Unknown error with lead retrieval"
        });
      }
    } catch (error: any) {
      console.error("Error fetching leads from Airtable:", error);
      res.status(500).json({ error: error.message || "An unexpected error occurred" });
    }
  });

  // Quote Management Routes
  
  // Create a new quote
  app.post("/api/quotes", async (req, res) => {
    try {
      // Validate the request body
      const validatedData = insertQuoteSchema.parse(req.body);
      
      // Check if user is authenticated and set userType if so
      if (req.isAuthenticated()) {
        const user = req.user!;
        validatedData.userType = user.paymentPlan;
      } else {
        // If not authenticated, make sure it's marked as a free user quote
        validatedData.userType = 'free';
      }
      
      const result = await storage.createQuote(validatedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating quote:", error);
      res.status(500).json({ error: "Failed to create quote" });
    }
  });
  
  // Get all quotes (admin only)
  app.get("/api/admin/quotes", requireAdmin, async (req, res) => {
    try {
      const quotes = await storage.getQuotes();
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });
  
  // Get a specific quote by ID
  app.get("/api/quotes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }
      
      const quote = await storage.getQuoteById(id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      // If not admin, only allow access to quotes with matching username/owner
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const isAdmin = await storage.isAdmin(req.user!.id);
      if (!isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });
  
  // Update quote status (admin only)
  app.patch("/api/admin/quotes/:id/status", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }
      
      const { status, notes } = req.body;
      if (!status || !["new", "reviewed", "contacted", "completed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      const updatedQuote = await storage.updateQuoteStatus(id, status, notes);
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      res.json(updatedQuote);
    } catch (error) {
      console.error("Error updating quote status:", error);
      res.status(500).json({ error: "Failed to update quote status" });
    }
  });
  
  // Get quotes by email (admin only)
  app.get("/api/quotes/email/:email", requireAdmin, async (req, res) => {
    try {
      const { email } = req.params;
      
      const quotes = await storage.getQuotesByEmail(email);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes by email:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });
  
  // Create a quote from an existing free quote request (admin only)
  app.post("/api/admin/free-quote-requests/:id/convert", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }
      
      // Get the free quote request
      const freeQuoteRequest = await storage.getFreeQuoteRequest(id);
      if (!freeQuoteRequest) {
        return res.status(404).json({ error: "Free quote request not found" });
      }
      
      // Convert the free quote request to a quote
      const quoteData = {
        name: freeQuoteRequest.name,
        email: freeQuoteRequest.email,
        address: freeQuoteRequest.address,
        quoteData: {
          mode: freeQuoteRequest.mode,
          parkingSpaces: freeQuoteRequest.parkingSpaces,
          handicapSpots: freeQuoteRequest.handicapSpots,
          crosswalks: freeQuoteRequest.crosswalks,
          arrows: freeQuoteRequest.arrows,
          lowerEstimate: freeQuoteRequest.lowerEstimate,
          upperEstimate: freeQuoteRequest.upperEstimate,
          surfaceArea: freeQuoteRequest.surfaceArea,
          surfaceAreaSqYd: freeQuoteRequest.surfaceAreaSqYd,
          additionalWork: freeQuoteRequest.additionalWork,
          polygonScreenshot: freeQuoteRequest.polygonScreenshot
        },
        userType: 'free',
        status: 'new',
        notes: `Converted from free quote request #${id}`
      };
      
      // Create the quote
      const quote = await storage.createQuote(quoteData);
      
      // Update the free quote request status
      await storage.updateFreeQuoteRequestStatus(id, "completed");
      
      res.status(201).json({
        success: true,
        quote,
        message: "Free quote request successfully converted to quote"
      });
    } catch (error) {
      console.error("Error converting free quote request to quote:", error);
      res.status(500).json({ 
        error: "Failed to convert free quote request", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}