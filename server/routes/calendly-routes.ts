import { Express, Request, Response } from 'express';

/**
 * Register Calendly related routes
 */
export function registerCalendlyRoutes(app: Express) {
  // Validate if Calendly token is available
  if (!process.env.CALENDLY_TOKEN) {
    console.warn('Warning: CALENDLY_TOKEN environment variable is not set. Calendly integration may not work properly.');
  }

  // API endpoint to get a Calendly scheduling link
  app.get('/api/calendly/scheduling-link', async (req: Request, res: Response) => {
    try {
      // In a more complete implementation, we would use the token to interact with the Calendly API
      // For now, we'll just return a direct URL
      const schedulingUrl = 'https://calendly.com/ty-lotquote/30min';
      
      // Add any prefill parameters that were passed in the request
      const url = new URL(schedulingUrl);
      Object.entries(req.query).forEach(([key, value]) => {
        if (typeof value === 'string') {
          url.searchParams.append(key, value);
        }
      });
      
      res.json({ 
        schedulingUrl: url.toString(),
        success: true 
      });
    } catch (error) {
      console.error('Error generating Calendly link:', error);
      res.status(500).json({ 
        error: 'Failed to generate Calendly scheduling link',
        success: false 
      });
    }
  });

  /**
   * For a more complete implementation, additional endpoints could be added here:
   * - GET /api/calendly/available-times - to get available time slots
   * - POST /api/calendly/schedule - to schedule an appointment
   * - GET /api/calendly/events - to get scheduled events
   */
}