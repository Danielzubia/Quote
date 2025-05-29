import { pgTable, text, serial, integer, boolean, timestamp, json, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userFeedback = pgTable("user_feedback", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // Used as email address
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  paymentPlan: text("payment_plan").default("free"), // Options: free, pro, team
  hasSeenPlanSelection: boolean("has_seen_plan_selection").default(false),
  addressUsageCount: integer("address_usage_count").default(0).notNull(), // Track number of addresses used this month
  lastAddressResetDate: timestamp("last_address_reset_date").defaultNow().notNull(), // Date when the address count was last reset
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID for paid plans
  stripeSubscriptionId: text("stripe_subscription_id"), // Stripe subscription ID for paid plans
  resetToken: text("reset_token"), // Password reset token
  resetTokenExpires: timestamp("reset_token_expires"), // When the reset token expires
  supabaseId: text("supabase_id"), // Supabase Auth user ID
});

export const searchHistory = pgTable("search_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedImageId: text("processed_image_id"),
  parkingSpaces: integer("parking_spaces"),
  handicapSpots: integer("handicap_spots"),
  crosswalks: integer("crosswalks"),
  arrows: integer("arrows"),
  lowerEstimate: integer("lower_estimate"),
  upperEstimate: integer("upper_estimate"),
  hasDetections: boolean("has_detections").default(false),
  // Fields for area mode
  total_area_sqft: integer("total_area_sqft"),
  total_area_sqyd: integer("total_area_sqyd"),
  // Store complete map state (polygons, dots, etc.)
  mapState: text("map_state"),
});

export const freeQuoteRequests = pgTable("free_quote_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address").notNull(),
  parkingSpaces: integer("parking_spaces").notNull(),
  handicapSpots: integer("handicap_spots").notNull(),
  crosswalks: integer("crosswalks").notNull(),
  arrows: integer("arrows").default(0),
  additionalWork: text("additional_work"),
  processedImageId: text("processed_image_id"),
  polygonScreenshot: text("polygon_screenshot"),
  lowerEstimate: integer("lower_estimate").notNull(),
  upperEstimate: integer("upper_estimate").notNull(),
  surfaceArea: integer("surface_area"),
  surfaceAreaSqYd: integer("surface_area_sq_yd"),
  mode: text("mode").default("spaces").notNull(), // spaces, area
  status: text("status").default("pending").notNull(), // pending, contacted, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Table to track user login/sign-in activities
export const userSignIns = pgTable("user_sign_ins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Table to track quote generations (usage analytics)
export const quoteAnalytics = pgTable("quote_analytics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  quoteType: text("quote_type").notNull(), // "free", "standard", etc.
  mode: text("mode").notNull(), // "spaces", "area"
  parkingSpaces: integer("parking_spaces"),
  handicapSpots: integer("handicap_spots"),
  crosswalks: integer("crosswalks"),
  arrows: integer("arrows"),
  surfaceArea: integer("surface_area"),
  lowerEstimate: integer("lower_estimate").notNull(),
  upperEstimate: integer("upper_estimate").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Create schema with email validation for the username field
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  firstName: true,
  lastName: true,
  supabaseId: true,
  paymentPlan: true,
  hasSeenPlanSelection: true,
});

// Modified validation schema with more lenient email validation
export const userValidationSchema = insertUserSchema.extend({
  username: z.string().refine(val => val.includes('@') && val.includes('.'), {
    message: "Please enter a valid email address"
  })
});

export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertFreeQuoteRequestSchema = createInsertSchema(freeQuoteRequests).omit({
  id: true,
  createdAt: true,
});

export const insertUserFeedbackSchema = createInsertSchema(userFeedback).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type FreeQuoteRequest = typeof freeQuoteRequests.$inferSelect;
export type InsertFreeQuoteRequest = z.infer<typeof insertFreeQuoteRequestSchema>;
export type UserFeedback = typeof userFeedback.$inferSelect;
export type InsertUserFeedback = z.infer<typeof insertUserFeedbackSchema>;
export type UserSignIn = typeof userSignIns.$inferSelect;
export type QuoteAnalytic = typeof quoteAnalytics.$inferSelect;

// Local lead storage backup for when Airtable isn't available
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  details: text("details"),
  source: text("source").default("Website"),
  status: text("status").default("New"),
  quotesGenerated: integer("quotes_generated").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  sentToAirtable: boolean("sent_to_airtable").default(false),
  airtableError: text("airtable_error")
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// Store quotes with detailed data
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  quoteData: json("quote_data").notNull(), // Store all quote data as JSON
  userType: text("user_type").default("free"), // free, pro, team
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: text("status").default("new").notNull(), // new, reviewed, contacted, completed
  notes: text("notes") // Internal notes about the quote
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true
});

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;