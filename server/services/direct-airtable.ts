/**
 * Direct Airtable integration with local database fallback
 */
import { storage } from '../storage';
import { InsertLead } from '@shared/schema';

// Check for the required environment variable
if (!process.env.AIRTABLE_TOKEN) {
  console.warn("Warning: AIRTABLE_TOKEN environment variable is not set. Direct Airtable integration will fall back to local storage.");
}

// Define the data structure for a lead
export interface LeadData {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  details?: string;
  source?: string;
  status?: string;
  sendTo?: string; // Recipient email for support messages
}

/**
 * Directly adds a new lead to the Airtable database with local storage fallback
 */
export async function directAddLead(leadData: LeadData) {
  try {
    // First, always save to local database as a backup
    const localLead: InsertLead = {
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone || null,
      address: leadData.address || null,
      details: leadData.details || null,
      source: leadData.source || "External API",
      status: leadData.status || "New",
      quotesGenerated: 0,
      sentToAirtable: false,
      airtableError: null
    };
    
    const savedLead = await storage.createLead(localLead);
    console.log("Lead saved to local database:", savedLead);
    
    // Don't proceed with Airtable if there's no API token
    if (!process.env.AIRTABLE_TOKEN) {
      console.log("Skipping Airtable - no token available, using local storage only");
      return { 
        success: true, 
        message: "Lead saved to local database (Airtable unavailable)",
        localLeadId: savedLead.id,
        inLocalStorageOnly: true 
      };
    }

    console.log("Adding lead to Airtable via direct method:", leadData);

    // Define the API endpoint
    const baseId = "appgDI9b1jnWmYZ3E"; // Airtable base ID
    const tableName = "Leads";
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
    console.log("Airtable API URL:", url);

    console.log("Using Airtable token:", process.env.AIRTABLE_TOKEN?.substring(0, 5) + "...");

    // Create the request body according to Airtable's API with correct field names
    const requestBody = {
      fields: {
        Name: leadData.name,
        "Contact Email": leadData.email,
        "Phone Number": leadData.phone || "",
        Address: leadData.address || "",
        Details: leadData.details || "",
        Source: leadData.source || "External API",
        Status: leadData.status || "New",
        "Quotes Generated": 0,
        "Created At": new Date().toISOString(),
        "Send To": leadData.sendTo || ""
      }
    };

    console.log("Request body:", JSON.stringify(requestBody));

    // Try different authorization header formats
    const authFormats = [
      { name: "Bearer token", header: `Bearer ${process.env.AIRTABLE_TOKEN}` },
      { name: "Direct token", header: process.env.AIRTABLE_TOKEN },
      { name: "Key prefix", header: `key${process.env.AIRTABLE_TOKEN}` }
    ];

    let success = false;
    let responseData = null;
    let lastError = null;

    // Try each authorization format
    for (const format of authFormats) {
      if (success) break; // Skip if we already succeeded

      console.log(`Trying Airtable authorization format: ${format.name}`);
      
      try {
        // Make the API request
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": format.header,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        });

        // Log the response for debugging
        console.log(`Airtable response status (${format.name}):`, response.status);
        const responseText = await response.text();
        
        // Check for success
        if (response.ok) {
          success = true;
          responseData = JSON.parse(responseText);
          console.log("Successfully added lead to Airtable:", responseData);
          
          // Update the local lead record to mark it as sent to Airtable
          await storage.updateLeadAirtableStatus(savedLead.id, true);
          break;
        } else {
          console.error(`Airtable API error response (${format.name}):`, responseText);
          try {
            const errorData = JSON.parse(responseText);
            lastError = { 
              message: errorData.error?.message || `Failed with format: ${format.name}`,
              status: response.status
            };
          } catch (e) {
            lastError = { 
              message: `Failed with format: ${format.name} - ${responseText}`,
              status: response.status
            };
          }
        }
      } catch (err: any) {
        console.error(`Error with Airtable format ${format.name}:`, err);
        lastError = { message: err.message, status: null };
      }
    }

    // If we succeeded with any format
    if (success && responseData) {
      return { 
        success: true, 
        record: responseData,
        localLeadId: savedLead.id,
        inLocalStorageOnly: false
      };
    }
    
    // All formats failed, save the error to the local lead
    console.error("All Airtable authorization formats failed");
    await storage.updateLeadAirtableStatus(
      savedLead.id, 
      false, 
      lastError?.message || "All authorization formats failed"
    );
    
    return { 
      success: true, 
      message: "Lead saved to local database but failed to sync with Airtable",
      localLeadId: savedLead.id,
      inLocalStorageOnly: true,
      airtableError: lastError?.message
    };
  } catch (error: any) {
    console.error("Error handling lead:", error);
    return { 
      success: false, 
      error: error.message || "An unexpected error occurred" 
    };
  }
}