import { 
  users, type User, type InsertUser, 
  searchHistory, type SearchHistory, type InsertSearchHistory,
  freeQuoteRequests, type FreeQuoteRequest, type InsertFreeQuoteRequest,
  userFeedback, type UserFeedback, type InsertUserFeedback,
  userSignIns, type UserSignIn,
  quoteAnalytics, type QuoteAnalytic,
  leads, type Lead, type InsertLead,
  quotes, type Quote, type InsertQuote
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserBySupabaseId(supabaseId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateSupabaseId(userId: number, supabaseId: string): Promise<User | undefined>;
  addSearchHistory(userId: number, search: InsertSearchHistory): Promise<SearchHistory>;
  getUserSearchHistory(userId: number): Promise<SearchHistory[]>;
  createFreeQuoteRequest(request: InsertFreeQuoteRequest): Promise<FreeQuoteRequest>;
  getFreeQuoteRequests(): Promise<FreeQuoteRequest[]>;
  getFreeQuoteRequest(id: number): Promise<FreeQuoteRequest | undefined>;
  updateFreeQuoteRequestStatus(id: number, status: string): Promise<FreeQuoteRequest | undefined>;
  makeAdmin(userId: number): Promise<User | undefined>;
  isAdmin(userId: number): Promise<boolean>;
  // User payment plan methods
  updateUserPaymentPlan(userId: number, plan: string): Promise<User | undefined>;
  updateUserHasSeenPlanSelection(userId: number): Promise<User | undefined>;
  updateUserStripeInfo(userId: number, stripeInfo: { stripeCustomerId: string, stripeSubscriptionId: string }): Promise<User | undefined>;
  // User feedback methods
  createUserFeedback(feedback: InsertUserFeedback): Promise<UserFeedback>;
  getUserFeedback(): Promise<UserFeedback[]>;
  // Address usage tracking methods
  incrementAddressUsage(userId: number, address: string): Promise<number>; // Returns new count
  checkAddressUsageLimit(userId: number): Promise<{canUseMoreAddresses: boolean, usageCount: number, limit: number}>;
  resetAddressUsageIfNeeded(userId: number): Promise<void>;
  // Admin Dashboard methods
  recordUserSignIn(userId: number, ipAddress?: string, userAgent?: string): Promise<UserSignIn>;
  getAllUserSignIns(): Promise<UserSignIn[]>;
  getUserSignIns(userId: number): Promise<UserSignIn[]>;
  recordQuoteGeneration(quoteData: Partial<QuoteAnalytic>): Promise<QuoteAnalytic>;
  getQuoteAnalytics(): Promise<QuoteAnalytic[]>;
  getAllUsers(): Promise<User[]>; // Get all users for admin dashboard
  // Lead management methods (backup for when Airtable is unavailable)
  createLead(lead: InsertLead): Promise<Lead>;
  getLeads(): Promise<Lead[]>;
  updateLeadAirtableStatus(id: number, sentToAirtable: boolean, error?: string): Promise<Lead | undefined>;
  // Quote management methods
  createQuote(quote: InsertQuote): Promise<Quote>;
  getQuotes(): Promise<Quote[]>;
  getQuoteById(id: number): Promise<Quote | undefined>;
  updateQuoteStatus(id: number, status: string, notes?: string): Promise<Quote | undefined>;
  getQuotesByEmail(email: string): Promise<Quote[]>;
  // Password reset methods
  createPasswordResetToken(username: string): Promise<string | null>; // Returns the reset token or null if user not found
  getUserByResetToken(token: string): Promise<User | undefined>; // Get user by reset token if valid and not expired
  updateUserPassword(userId: number, newPassword: string): Promise<User | undefined>; // Update user's password
  
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private searchHistory: Map<number, SearchHistory>;
  private freeQuoteRequests: Map<number, FreeQuoteRequest>;
  private userFeedback: Map<number, UserFeedback>;
  private userSignIns: Map<number, UserSignIn>;
  private quoteAnalytics: Map<number, QuoteAnalytic>;
  private leads: Map<number, Lead>; // Local lead storage
  private quotes: Map<number, Quote>; // Storage for quotes
  private userUniqueAddresses: Map<number, Set<string>>; // Track unique addresses per user
  private readonly FREE_ADDRESS_LIMIT = 3; // Free users can only use 3 addresses per month
  currentId: number;
  searchHistoryId: number;
  freeQuoteRequestsId: number;
  userFeedbackId: number;
  userSignInsId: number;
  quoteAnalyticsId: number;
  leadsId: number; // For storing leads in memory
  quotesId: number; // For storing quotes
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.searchHistory = new Map();
    this.freeQuoteRequests = new Map();
    this.userFeedback = new Map();
    this.userSignIns = new Map();
    this.quoteAnalytics = new Map();
    this.leads = new Map(); // Initialize leads map
    this.quotes = new Map(); // Initialize quotes map
    this.userUniqueAddresses = new Map(); // Initialize unique addresses tracking
    this.currentId = 1;
    this.searchHistoryId = 1;
    this.freeQuoteRequestsId = 1;
    this.userFeedbackId = 1;
    this.userSignInsId = 1;
    this.quoteAnalyticsId = 1;
    this.leadsId = 1; // Initialize leads ID counter
    this.quotesId = 1; // Initialize quotes ID counter
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    console.log("Using memory store for session storage");
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  /**
   * Get a user by their Supabase ID
   * @param supabaseId The Supabase user ID to look up
   * @returns The user or undefined if not found
   */
  async getUserBySupabaseId(supabaseId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.supabaseId === supabaseId,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    
    // Check if this is the admin account
    const isAdmin = insertUser.username === 'danielalexanderzubia@gmail.com';
    
    const user: User = { 
      id, 
      isAdmin,
      // Admin users get 'pro' plan automatically and bypass plan selection screen
      paymentPlan: isAdmin ? 'pro' : 'free',
      hasSeenPlanSelection: isAdmin ? true : false,
      addressUsageCount: 0,
      lastAddressResetDate: new Date(),
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      resetToken: null,
      resetTokenExpires: null,
      username: insertUser.username,
      password: insertUser.password,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      supabaseId: insertUser.supabaseId || null
    };
    this.users.set(id, user);
    return user;
  }

  async addSearchHistory(userId: number, search: InsertSearchHistory): Promise<SearchHistory> {
    const id = this.searchHistoryId++;
    // Handle new fields from area calculations if they exist
    const record: SearchHistory = {
      id,
      userId,
      address: search.address,
      createdAt: new Date(),
      processedImageId: search.processedImageId || null,
      parkingSpaces: search.parkingSpaces || null,
      handicapSpots: search.handicapSpots || null,
      crosswalks: search.crosswalks || null,
      arrows: search.arrows || null,
      lowerEstimate: search.lowerEstimate || null,
      upperEstimate: search.upperEstimate || null,
      hasDetections: search.hasDetections || false,
      // Handle area fields if they exist
      total_area_sqft: search.total_area_sqft || null,
      total_area_sqyd: search.total_area_sqyd || null,
      // Handle map state for restoring polygons, dots, etc.
      mapState: search.mapState || null
    };
    console.log("Saving search history with data:", JSON.stringify(search));
    this.searchHistory.set(id, record);
    return record;
  }

  async getUserSearchHistory(userId: number): Promise<SearchHistory[]> {
    return Array.from(this.searchHistory.values())
      .filter(history => history.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async createFreeQuoteRequest(request: InsertFreeQuoteRequest): Promise<FreeQuoteRequest> {
    const id = this.freeQuoteRequestsId++;
    const freeQuoteRequest: FreeQuoteRequest = {
      ...request,
      id,
      status: request.status || "pending",
      createdAt: new Date(),
      phone: request.phone || null,
      additionalWork: request.additionalWork || null,
      processedImageId: request.processedImageId || null,
      arrows: request.arrows || 0,
      mode: request.mode || "spaces",
      surfaceArea: request.surfaceArea || null,
      surfaceAreaSqYd: request.surfaceAreaSqYd || null,
      polygonScreenshot: request.polygonScreenshot || null
    };
    this.freeQuoteRequests.set(id, freeQuoteRequest);
    return freeQuoteRequest;
  }
  
  async getFreeQuoteRequests(): Promise<FreeQuoteRequest[]> {
    return Array.from(this.freeQuoteRequests.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async getFreeQuoteRequest(id: number): Promise<FreeQuoteRequest | undefined> {
    return this.freeQuoteRequests.get(id);
  }
  
  async updateFreeQuoteRequestStatus(id: number, status: string): Promise<FreeQuoteRequest | undefined> {
    const freeQuoteRequest = this.freeQuoteRequests.get(id);
    if (freeQuoteRequest) {
      const updatedRequest = { ...freeQuoteRequest, status };
      this.freeQuoteRequests.set(id, updatedRequest);
      return updatedRequest;
    }
    return undefined;
  }
  
  async makeAdmin(userId: number): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (user) {
      const updatedUser = { ...user, isAdmin: true };
      this.users.set(userId, updatedUser);
      return updatedUser;
    }
    return undefined;
  }
  
  async isAdmin(userId: number): Promise<boolean> {
    const user = this.users.get(userId);
    return user?.isAdmin || false;
  }
  
  async updateUserPaymentPlan(userId: number, plan: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (user) {
      const updatedUser = { ...user, paymentplan: plan, hasSeenPlanSelection: true };
      this.users.set(userId, updatedUser);
      return updatedUser;
    }
    return undefined;
  }
  
  async updateUserHasSeenPlanSelection(userId: number): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (user) {
      const updatedUser = { ...user, hasSeenPlanSelection: true };
      this.users.set(userId, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  async updateUserStripeInfo(userId: number, stripeInfo: { stripeCustomerId: string, stripeSubscriptionId: string }): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (user) {
      const updatedUser = { 
        ...user, 
        stripeCustomerId: stripeInfo.stripeCustomerId,
        stripeSubscriptionId: stripeInfo.stripeSubscriptionId
      };
      this.users.set(userId, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  async createUserFeedback(feedback: InsertUserFeedback): Promise<UserFeedback> {
    const id = this.userFeedbackId++;
    const userFeedbackEntry: UserFeedback = {
      ...feedback,
      id,
      createdAt: new Date(),
      name: feedback.name || null,
      email: feedback.email || null,
      comment: feedback.comment || null
    };
    this.userFeedback.set(id, userFeedbackEntry);
    return userFeedbackEntry;
  }

  async getUserFeedback(): Promise<UserFeedback[]> {
    return Array.from(this.userFeedback.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Increment the address usage count for a user if the address is unique
   * @param userId The user ID
   * @param address The address to check and count
   * @returns The new address usage count
   */
  async incrementAddressUsage(userId: number, address: string): Promise<number> {
    // First check if we need to reset the usage count (new month)
    await this.resetAddressUsageIfNeeded(userId);
    
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Normalize the address by removing spaces, commas, and converting to lowercase
    const normalizedAddress = address.toLowerCase().replace(/[\s,]/g, '');
    
    // Initialize the Set for this user if it doesn't exist
    if (!this.userUniqueAddresses.has(userId)) {
      this.userUniqueAddresses.set(userId, new Set());
    }
    
    // Get the set of unique addresses for this user
    const userAddresses = this.userUniqueAddresses.get(userId)!;
    
    // Only increment if this is a new unique address
    if (!userAddresses.has(normalizedAddress)) {
      userAddresses.add(normalizedAddress);
      
      const newCount = user.addressUsageCount + 1;
      const updatedUser = { ...user, addressUsageCount: newCount };
      this.users.set(userId, updatedUser);
      
      console.log(`User ${userId} used new unique address: ${address}. Count now: ${newCount}`);
      return newCount;
    }
    
    // If address already exists, return current count without incrementing
    console.log(`User ${userId} used existing address: ${address}. Count remains: ${user.addressUsageCount}`);
    return user.addressUsageCount;
  }
  
  /**
   * Check if a user has exceeded their address usage limit based on their payment plan
   * @param userId The user ID
   * @returns Object with usage info and whether more addresses can be used
   */
  async checkAddressUsageLimit(userId: number): Promise<{canUseMoreAddresses: boolean, usageCount: number, limit: number}> {
    // First check if we need to reset the usage count (new month)
    await this.resetAddressUsageIfNeeded(userId);
    
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Admin users and paid plans have unlimited addresses
    let limit = Infinity;
    if (user.isAdmin) {
      // Admin users always have unlimited addresses
      return {
        canUseMoreAddresses: true,
        usageCount: user.addressUsageCount,
        limit: Infinity
      };
    } else if (user.paymentPlan === 'free') {
      // Only free plan users have a limit
      limit = this.FREE_ADDRESS_LIMIT;
    }
    
    return {
      canUseMoreAddresses: user.addressUsageCount < limit,
      usageCount: user.addressUsageCount,
      limit
    };
  }
  
  /**
   * Reset the user's address usage count if it's a new month
   * @param userId The user ID
   */
  async resetAddressUsageIfNeeded(userId: number): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const now = new Date();
    const lastReset = user.lastAddressResetDate;
    
    // Check if the month has changed since the last reset
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      console.log(`Resetting address usage for user ${userId}: current date ${now.toISOString()}, last reset ${lastReset.toISOString()}`);
      
      // It's a new month, reset the counter
      const updatedUser = { 
        ...user, 
        addressUsageCount: 0,
        lastAddressResetDate: now
      };
      this.users.set(userId, updatedUser);
      
      // Also reset the set of unique addresses
      this.userUniqueAddresses.set(userId, new Set());
      
      console.log(`Address usage reset to 0 for user ${userId}`);
    }
  }

  // Admin Dashboard Methods
  
  /**
   * Record a user sign-in event for tracking login activity
   */
  async recordUserSignIn(userId: number, ipAddress?: string, userAgent?: string): Promise<UserSignIn> {
    const id = this.userSignInsId++;
    const signIn: UserSignIn = {
      id,
      userId,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      createdAt: new Date()
    };
    this.userSignIns.set(id, signIn);
    return signIn;
  }

  /**
   * Get all user sign-in records across all users for the admin dashboard
   */
  async getAllUserSignIns(): Promise<UserSignIn[]> {
    return Array.from(this.userSignIns.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get sign-in history for a specific user
   */
  async getUserSignIns(userId: number): Promise<UserSignIn[]> {
    return Array.from(this.userSignIns.values())
      .filter(signIn => signIn.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Record a quote generation event (track usage)
   */
  async recordQuoteGeneration(quoteData: Partial<QuoteAnalytic>): Promise<QuoteAnalytic> {
    const id = this.quoteAnalyticsId++;
    
    // Construct a complete QuoteAnalytic object with defaults for missing values
    const quoteAnalytic: QuoteAnalytic = {
      id,
      userId: quoteData.userId || null,
      quoteType: quoteData.quoteType || 'free',
      mode: quoteData.mode || 'spaces',
      parkingSpaces: quoteData.parkingSpaces || null,
      handicapSpots: quoteData.handicapSpots || null,
      crosswalks: quoteData.crosswalks || null,
      arrows: quoteData.arrows || null,
      surfaceArea: quoteData.surfaceArea || null,
      lowerEstimate: quoteData.lowerEstimate || 0,
      upperEstimate: quoteData.upperEstimate || 0,
      createdAt: new Date()
    };
    
    this.quoteAnalytics.set(id, quoteAnalytic);
    return quoteAnalytic;
  }

  /**
   * Get all quote generation records for analytics
   */
  async getQuoteAnalytics(): Promise<QuoteAnalytic[]> {
    return Array.from(this.quoteAnalytics.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all registered users for admin dashboard
   */
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values())
      .sort((a, b) => a.id - b.id);
  }

  /**
   * Store a lead in the local database
   * Used as a backup when Airtable is not available
   */
  async createLead(lead: InsertLead): Promise<Lead> {
    const id = this.leadsId++;
    // Ensure all fields exist and have the right types
    const newLead: Lead = {
      id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone ?? null,
      address: lead.address ?? null,
      details: lead.details ?? null,
      source: lead.source ?? null,
      status: lead.status ?? null,
      quotesGenerated: lead.quotesGenerated ?? 0,
      createdAt: new Date(),
      sentToAirtable: false,
      airtableError: null
    };
    this.leads.set(id, newLead);
    return newLead;
  }

  /**
   * Get all leads from the local database
   * Used as a backup when Airtable is not available
   */
  async getLeads(): Promise<Lead[]> {
    return Array.from(this.leads.values())
      .sort((a, b) => {
        // Handle null createdAt values (shouldn't happen, but TypeScript is concerned)
        const timeA = a.createdAt?.getTime() ?? 0;
        const timeB = b.createdAt?.getTime() ?? 0;
        return timeB - timeA;
      });
  }

  /**
   * Update the Airtable sync status for a lead
   * Used to mark leads that have been successfully sent to Airtable
   */
  async updateLeadAirtableStatus(id: number, sentToAirtable: boolean, error?: string): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead) {
      return undefined;
    }

    const updatedLead: Lead = {
      ...lead,
      sentToAirtable,
      airtableError: error || null
    };
    this.leads.set(id, updatedLead);
    return updatedLead;
  }

  // Quote Management Methods

  /**
   * Store a quote with detailed data
   * @param quote The quote data to store
   * @returns The created quote with ID
   */
  async createQuote(quote: InsertQuote): Promise<Quote> {
    const id = this.quotesId++;
    
    // Create a quote with all the required fields and ensuring proper null/undefined handling
    const newQuote: Quote = {
      id,
      name: quote.name,
      email: quote.email,
      address: quote.address, 
      quoteData: quote.quoteData,
      createdAt: new Date(),
      status: quote.status || "new",
      userType: quote.userType || "free",
      notes: quote.notes || null
    };
    
    this.quotes.set(id, newQuote);
    return newQuote;
  }

  /**
   * Get all quotes
   * @returns Array of all quotes sorted by creation date (newest first)
   */
  async getQuotes(): Promise<Quote[]> {
    return Array.from(this.quotes.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get a specific quote by ID
   * @param id The quote ID to retrieve
   * @returns The quote or undefined if not found
   */
  async getQuoteById(id: number): Promise<Quote | undefined> {
    return this.quotes.get(id);
  }

  /**
   * Update the status of a quote and optionally add notes
   * @param id The quote ID to update
   * @param status The new status value
   * @param notes Optional notes to add to the quote
   * @returns The updated quote or undefined if not found
   */
  async updateQuoteStatus(id: number, status: string, notes?: string): Promise<Quote | undefined> {
    const quote = this.quotes.get(id);
    if (!quote) {
      return undefined;
    }
    const updatedQuote: Quote = {
      ...quote,
      status,
      notes: notes ?? quote.notes
    };
    this.quotes.set(id, updatedQuote);
    return updatedQuote;
  }

  /**
   * Get all quotes for a specific email address
   * @param email The email address to find quotes for
   * @returns Array of quotes for the specified email
   */
  async getQuotesByEmail(email: string): Promise<Quote[]> {
    return Array.from(this.quotes.values())
      .filter(quote => quote.email.toLowerCase() === email.toLowerCase())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  /**
   * Create a password reset token for a user
   * @param username Email address of the user
   * @returns The reset token or null if user not found
   */
  async createPasswordResetToken(username: string): Promise<string | null> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return null;
    }
    
    // Generate a random token (without requiring crypto)
    const resetToken = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15) + 
                      Date.now().toString(36);
    
    // Set token expiration to 1 hour from now
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour
    
    // Update the user with the reset token and expiration
    const updatedUser = {
      ...user,
      resetToken,
      resetTokenExpires
    };
    
    this.users.set(user.id, updatedUser);
    
    return resetToken;
  }
  
  /**
   * Get a user by their reset token
   * @param token The reset token
   * @returns The user or undefined if token is invalid or expired
   */
  async getUserByResetToken(token: string): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(
      (user) => user.resetToken === token
    );
    
    if (!user) {
      return undefined;
    }
    
    // Check if token has expired
    if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return undefined;
    }
    
    return user;
  }
  
  /**
   * Update a user's password
   * @param userId The user ID
   * @param newPassword The new hashed password
   * @returns The updated user or undefined if not found
   */
  async updateUserPassword(userId: number, newPassword: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }
    
    // Update user with new password and clear the reset token
    const updatedUser = {
      ...user,
      password: newPassword,
      resetToken: null,
      resetTokenExpires: null
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  
  /**
   * Update a user's Supabase ID
   * @param userId The user ID in our system
   * @param supabaseId The Supabase Auth user ID
   * @returns The updated user or undefined if not found
   */
  async updateSupabaseId(userId: number, supabaseId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) {
      return undefined;
    }
    
    // Update user with Supabase ID
    const updatedUser = {
      ...user,
      supabaseId: supabaseId
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
}

export const storage = new MemStorage();