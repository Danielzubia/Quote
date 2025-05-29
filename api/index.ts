import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import path from "path";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// Increase body size limit to handle larger images (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve attached assets
app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));

// Handle PayloadTooLargeError specifically
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 413) {
    return res.status(413).json({
      error: 'Request entity too large',
      message: 'The image file size is too large. Please try a smaller image.'
    });
  }
  next(err);
});

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

// Initialize routes
const initializeApp = async () => {
  try {
    await registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error(`Error ${status}: ${message}`, err);
      res.status(status).json({ message });
    });

    return app;
  } catch (error) {
    console.error('Failed to initialize app:', error);
    throw error;
  }
};

// Export the app for Vercel
export default async (req: any, res: any) => {
  const initializedApp = await initializeApp();
  return initializedApp(req, res);
};
