/**
 * This file contains public API endpoints that don't require authentication
 */
import express from 'express';
import { directAddLead, LeadData } from './services/direct-airtable';
import { storage } from './storage';

const router = express.Router();

// Public endpoint for footer contact messages sent to support@lotquote.com
router.post('/contact-support', async (req, res) => {
  console.log("Received support contact message:", req.body);
  try {
    const { name, email, phone, details } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    
    const leadData: LeadData = {
      name,
      email,
      phone,
      details: `[Message to support@lotquote.com]\n${details || ''}`,
      source: "Footer Contact Form",
      status: "Support Request",
      sendTo: "support@lotquote.com" // Explicitly set the destination email
    };
    
    console.log("Processing support contact via direct Airtable method:", leadData);
    const result = await directAddLead(leadData);
    console.log("Support contact Airtable result:", result);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    console.error("Error adding support contact to Airtable:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "An unexpected error occurred" 
    });
  }
});

// Public endpoint for adding leads without authentication
router.post('/public-add-lead', async (req, res) => {
  console.log("Received lead submission to public endpoint:", req.body);
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
      source: source || "External API",
      status: status || "New"
    };
    
    console.log("Processing lead data via direct Airtable method:", leadData);
    const result = await directAddLead(leadData);
    console.log("Airtable result:", result);
    
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
});

// Test endpoint for retrieving locally stored leads
// This is just for development/testing and should be removed in production
router.get('/test-local-leads', async (req, res) => {
  try {
    const localLeads = await storage.getLeads();
    res.json({
      total: localLeads.length,
      leads: localLeads.map(lead => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        details: lead.details,
        source: lead.source,
        createdAt: lead.createdAt,
        sentToAirtable: lead.sentToAirtable,
        airtableError: lead.airtableError
      }))
    });
  } catch (error: any) {
    console.error("Error fetching local leads:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred" });
  }
});

export default router;