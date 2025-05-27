import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Camera, Trash2, FileText, MousePointer, Plus, Circle, 
  RotateCcw, AlertCircle, Ruler, History 
} from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AddressSearch } from "@/components/address-search";
import { apiRequest } from "@/lib/queryClient";
import { InvoiceDialog } from "@/components/invoice-dialog";
import { QuoteDialog } from "@/components/quote-dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Add type declaration for initMap on Window object
declare global {
  interface Window {
    initMap: () => void;
  }
}

interface Polygon {
  points: Array<{ x: number; y: number }>;
  rotation?: number; // Rotation angle in degrees
  center?: { x: number; y: number }; // Center point for rotation
}

interface PolygonCounts {
  polygon_index: number;
  parking: number;
  crosswalks: number;
  handicap: number;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

// Define a type for line points
interface LinePoint {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// Interface for a line with measurement
interface Line extends LinePoint {
  lengthFt: number;
  color: 'red' | 'yellow' | 'white';
}

// Interface for current line being drawn
interface CurrentLine extends LinePoint {}

export default function MapView({ params }: { params?: { address?: string } }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedImageCanvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // State for address usage limit tracking
  const [addressUsageLimit, setAddressUsageLimit] = useState<{
    canUseMoreAddresses: boolean;
    usageCount: number;
    limit: number;
  } | null>(null);
  const [showLimitExceededDialog, setShowLimitExceededDialog] = useState(false);
  
  // Get all URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  
  // Get address from either path parameter or query parameter
  const addressFromParams = params?.address ? decodeURIComponent(params.address) : null;
  const addressFromQuery = searchParams.get('address') ? decodeURIComponent(searchParams.get('address') || '') : null;
  const initialAddress = addressFromParams || addressFromQuery || '';
  
  // Convert to state variable so it can be updated dynamically
  const [address, setAddress] = useState(initialAddress);
  
  // Function to load previous search data if available
  const loadPreviousSearchData = async (addr: string) => {
    if (!user || !addr) return;
    
    try {
      // Fetch user search history
      const response = await apiRequest("GET", "/api/search-history");
      
      if (!response.ok) {
        console.error("Failed to fetch search history");
        return;
      }
      
      const history = await response.json();
      
      // Find the search history item for this address
      const historyItem = history.find((item: any) => item.address === addr && item.hasDetections);
      
      if (historyItem && historyItem.processedImageId) {
        console.log("Found previous search data for", addr, ":", historyItem);
        
        // Set the processed image data
        setProcessedImageId(historyItem.processedImageId);
        setProcessedImageUniqueId(historyItem.processedImageId);
        
        // Set the result counts
        setResult({
          total_parking: historyItem.parkingSpaces || 0,
          total_crosswalks: historyItem.crosswalks || 0,
          total_handicap: historyItem.handicapSpots || 0,
          total_area_sqft: historyItem.total_area_sqft,
          total_area_sqyd: historyItem.total_area_sqyd
        });
        
        // Restore saved map state if available
        if (historyItem.mapState) {
          try {
            const mapState = JSON.parse(historyItem.mapState);
            console.log("Restoring saved map state:", mapState);
            
            // First, we need to make sure the image is loaded before restoring the map state
            // Set the processed image first and update state
            setCapturedImage(historyItem.processedImageId);
            setProcessedImageId(historyItem.processedImageId);
            
            // Use a timeout to ensure React state updates have been applied
            setTimeout(() => {
              // Create a new image element and wait for it to load
              const img = new Image();
              img.crossOrigin = 'Anonymous'; // Enable cross-origin image loading
              
              img.onload = () => {
                console.log("History image loaded successfully with dimensions:", img.width, "x", img.height);
                
                // Image loaded successfully, now we can restore the canvas and map state
                if (imageCanvasRef.current) {
                  // Get the canvas container dimensions for proper scaling
                  const container = document.querySelector('.canvas-container');
                  let containerWidth = 640;
                  let containerHeight = 480;
                  
                  if (container) {
                    containerWidth = container.clientWidth;
                    containerHeight = container.clientHeight;
                    console.log(`Canvas container dimensions: ${containerWidth}x${containerHeight}`);
                  }
                  
                  // Set canvas dimensions to match the loaded image while maintaining aspect ratio
                  const imageAspectRatio = img.width / img.height;
                  
                  // Use the image's intrinsic dimensions for the canvas
                  imageCanvasRef.current.width = img.width || 640;
                  imageCanvasRef.current.height = img.height || 480;
                  
                  // Set display size to fit container while maintaining aspect ratio
                  if (img.width > 0 && img.height > 0) {
                    const containerAspectRatio = containerWidth / containerHeight;
                    
                    if (imageAspectRatio > containerAspectRatio) {
                      // Image is wider than container proportionally
                      imageCanvasRef.current.style.width = `${containerWidth}px`;
                      imageCanvasRef.current.style.height = `${containerWidth / imageAspectRatio}px`;
                    } else {
                      // Image is taller than container proportionally
                      imageCanvasRef.current.style.height = `${containerHeight}px`;
                      imageCanvasRef.current.style.width = `${containerHeight * imageAspectRatio}px`;
                    }
                  } else {
                    // Fallback if image dimensions are invalid
                    imageCanvasRef.current.style.width = `${containerWidth}px`;
                    imageCanvasRef.current.style.height = `${containerHeight}px`;
                  }
                  
                  console.log("Set canvas dimensions to:", imageCanvasRef.current.width, "x", imageCanvasRef.current.height);
                  console.log("Set canvas display size to:", imageCanvasRef.current.style.width, "x", imageCanvasRef.current.style.height);
                  
                  // Prepare canvas for drawing
                  const ctx = imageCanvasRef.current.getContext('2d');
                  if (ctx) {
                    // Clear the canvas and draw the image
                    ctx.clearRect(0, 0, imageCanvasRef.current.width, imageCanvasRef.current.height);
                    ctx.drawImage(img, 0, 0, imageCanvasRef.current.width, imageCanvasRef.current.height);
                    
                    // Restore completed polygons
                    if (mapState.completedPolygons && Array.isArray(mapState.completedPolygons)) {
                      setCompletedPolygons(mapState.completedPolygons);
                      console.log("Restored polygons:", mapState.completedPolygons.length);
                    }
                    
                    // Restore manual dots
                    if (mapState.manualDots && Array.isArray(mapState.manualDots)) {
                      setManualDots(mapState.manualDots);
                      console.log("Restored manual dots:", mapState.manualDots.length);
                    }
                    
                    // Restore lines
                    if (mapState.lines && Array.isArray(mapState.lines)) {
                      setLines(mapState.lines);
                      console.log("Restored lines:", mapState.lines.length);
                    }
                    
                    // Restore mode
                    if (mapState.mode === 'spaces' || mapState.mode === 'area') {
                      setMode(mapState.mode);
                      console.log("Restored mode:", mapState.mode);
                    }
                    
                    // Force redraw after all state updates
                    setTimeout(() => {
                      drawCanvas();
                      console.log("Canvas redrawn after state restoration");
                      
                      toast({
                        title: "Map State Restored",
                        description: "Your previous map markings have been restored."
                      });
                    }, 300);
                  }
                }
              };
              
              img.onerror = (err) => {
                console.error("Error loading history image:", err);
                toast({
                  title: "Error Loading Image",
                  description: "There was a problem loading the previous analysis image.",
                  variant: "destructive"
                });
              };
              
              // Set the image source to start loading
              img.src = historyItem.processedImageId;
              
            }, 500); // Give React time to update state
          } catch (e) {
            console.error("Error parsing saved map state:", e);
            toast({
              title: "Error Restoring Analysis",
              description: "There was a problem restoring your previous analysis.",
              variant: "destructive"
            });
          }
        }
        
        // Update step to show we have processed data
        setCurrentQuoteStep(4);
        
        toast({
          title: "Previous Analysis Loaded",
          description: "Loaded your previous analysis for this address."
        });
      }
    } catch (error) {
      console.error("Error loading previous search data:", error);
    }
  };
  
  // Log the address source for debugging
  useEffect(() => {
    console.log("Address source:", addressFromParams ? "URL path" : "URL query", "Address:", address);
    
    // If no address is provided, redirect to home page after a short delay
    if (!address || address.trim() === '') {
      console.error("No address found in URL - will redirect to home");
      
      const timer = setTimeout(() => {
        toast({
          title: "Missing Address",
          description: "No property address was provided. Redirecting to home page.",
          variant: "destructive",
        });
        
        // Use timeout to allow toast to be shown before redirect
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      }, 500);
      
      return () => clearTimeout(timer);
    }
    
    // Load previous search data if we're coming from search history
    if (addressFromParams) {
      loadPreviousSearchData(address);
    }
  }, [address, toast]);
  const initialMode = searchParams.get('mode') as 'spaces' | 'area' || 'spaces';
  // Check if we're in Free Quote mode (no auth required)
  const inFreeQuoteMode = searchParams.get('returnTo') === 'quote';
  
  // Step tracker for Free Quote flow
  const [currentQuoteStep, setCurrentQuoteStep] = useState<number>(1);
  // Use state to allow switching modes without changing URL
  const [mode, setMode] = useState<'spaces' | 'area'>(initialMode);
  const [isLoading, setIsLoading] = useState(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processedImageId, setProcessedImageId] = useState<string | null>(null);
  const [processedImageUniqueId, setProcessedImageUniqueId] = useState<string | null>(null);
  const [currentPolygon, setCurrentPolygon] = useState<Array<{ x: number; y: number }>>([]);
  const [completedPolygons, setCompletedPolygons] = useState<Polygon[]>([]);
  // Add state for the map's current latitude (needed for accurate area calculation)
  const [currentLatitude, setCurrentLatitude] = useState<number | null>(null);
  
  // Update step when relevant actions are taken - for both free quote and contractor modes
  useEffect(() => {
    // Always update steps regardless of free quote or contractor mode
    if (capturedImage && !processedImageId && completedPolygons.length === 0) {
      setCurrentQuoteStep(2); // After capture, ready to draw polygons
    } else if (completedPolygons.length > 0 && !processedImageId) {
      setCurrentQuoteStep(3); // Polygons drawn, ready to detect spaces/calculate area
    } else if (processedImageId) {
      setCurrentQuoteStep(4); // Spaces detected/area calculated, ready for manual adjustment
    }
  }, [capturedImage, processedImageId, completedPolygons.length]);
  
  // Watch for mode changes and reset view when mode is changed
  useEffect(() => {
    // Only reset if we're already in an active state (with an image)
    if (capturedImage || processedImageId) {
      resetView();
      toast({
        title: `Mode changed to ${mode === 'area' ? 'Surface Area Counter' : 'Space Counter'}`,
        description: `The view has been reset to start a new ${mode === 'area' ? 'area measurement' : 'space counting'} session.`,
      });
    }
  }, [mode]);
  
  // Effect to check for address usage limits when the user is logged in and not in free quote mode
  useEffect(() => {
    // Skip if in free quote mode or not logged in
    if (inFreeQuoteMode || !user) return;
    
    // Check address usage limit
    const checkAddressUsage = async () => {
      try {
        const response = await apiRequest("GET", "/api/address-usage");
        const data = await response.json();
        setAddressUsageLimit(data);
        
        // If user is on free plan and has exceeded their limit, show warning
        if (!data.canUseMoreAddresses && user.paymentPlan === 'free') {
          setShowLimitExceededDialog(true);
        }
      } catch (error) {
        console.error("Error checking address usage:", error);
      }
    };
    
    checkAddressUsage();
  }, [user, inFreeQuoteMode]);
  const [result, setResult] = useState<{
    total_parking: number;
    total_crosswalks: number;
    total_handicap: number;
    total_area_sqft?: number;  // For Surface Area mode
    total_area_sqyd?: number;  // For Surface Area mode
  }>({
    total_parking: 0,
    total_crosswalks: 0,
    total_handicap: 0,
  });
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState<number | null>(null);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null); // Added state
  const [selectedProcessedPolygon, setSelectedProcessedPolygon] = useState<number | null>(null);
  const [polygonCounts, setPolygonCounts] = useState<PolygonCounts[]>([]);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState<boolean>(false);
  const [drawStartPoint, setDrawStartPoint] = useState<{x: number, y: number} | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const [hoveredPolygonIndex, setHoveredPolygonIndex] = useState<number | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState(0);
  
  // States for manual placement (dots and lines)
  const [isManualMode, setIsManualMode] = useState(false);
  const [selectedPlacementType, setSelectedPlacementType] = useState<'parking' | 'handicap' | 'crosswalk' | 'line'>('parking');
  const [manualDots, setManualDots] = useState<{
    type: 'parking' | 'handicap' | 'crosswalk' | 'line';
    x: number;
    y: number;
    isDeleted?: boolean;
    isAIDetected?: boolean; // Add this flag to identify AI-detected points
  }[]>([]);
  
  // States for line drawing
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [currentLine, setCurrentLine] = useState<CurrentLine | null>(null);
  const [selectedLineColor, setSelectedLineColor] = useState<'red' | 'yellow' | 'white'>('red');

  const isPointInPolygon = (point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y))
          && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };
  
  // Calculate area of a polygon using the Shoelace formula
  const calculatePolygonArea = (polygon: Array<{ x: number; y: number }>) => {
    let area = 0;
    
    // Need at least 3 points to form a polygon
    if (polygon.length < 3) {
      return {
        squareFeet: 0,
        squareYards: 0
      };
    }
    
    for (let i = 0; i < polygon.length; i++) {
      let j = (i + 1) % polygon.length;
      area += polygon[i].x * polygon[j].y;
      area -= polygon[j].x * polygon[i].y;
    }
    
    area = Math.abs(area) / 2;
    
    // Convert pixel area to square feet using latitude-adjusted scaling
    // At zoom level 19, scale varies by latitude due to map projection
    // Corrected scaling factor based on real-world measurements
    // Original value was 1.44, then 5.76, but still too large
    let pixelToSqFtRatio = 0.92; // Adjusted to match known measurements (~3300 sq ft vs 20,453 sq ft)
    
    // Adjust scale based on latitude if available (decreases as you move away from equator)
    if (currentLatitude !== null) {
      // The further from equator, the smaller the area each pixel represents
      // Use cosine adjustment to account for Mercator projection distortion
      const latRadians = currentLatitude * (Math.PI / 180);
      const latitudeAdjustment = Math.cos(latRadians);
      // Apply latitude adjustment but maintain the accurate base scale factor
      pixelToSqFtRatio = 0.92 * (latitudeAdjustment * latitudeAdjustment);
      console.log(`Improved latitude adjusted scale: ${pixelToSqFtRatio.toFixed(4)} sq ft per pixel at ${currentLatitude.toFixed(4)}° latitude`);
    } else {
      console.log('Warning: No latitude information available for accurate scaling. Using default scale factor.');
    }
    
    const areaSqFt = area * pixelToSqFtRatio;
    
    // Convert square feet to square yards
    const areaSqYd = areaSqFt / 9;
    
    return {
      squareFeet: Math.round(areaSqFt),
      squareYards: Math.round(areaSqYd)
    };
  };

  // Calculate the center of a polygon
  const calculatePolygonCenter = (polygon: Array<{ x: number; y: number }>) => {
    if (polygon.length === 0) return { x: 0, y: 0 };
    
    let sumX = 0;
    let sumY = 0;
    
    polygon.forEach(point => {
      sumX += point.x;
      sumY += point.y;
    });
    
    return {
      x: sumX / polygon.length,
      y: sumY / polygon.length
    };
  };
  
  // Rotate a point around a center by an angle in degrees
  const rotatePoint = (
    point: { x: number; y: number },
    center: { x: number; y: number },
    angleDegrees: number
  ) => {
    // Convert angle to radians
    const angleRadians = (angleDegrees * Math.PI) / 180;
    
    // Translate point to origin
    const translatedX = point.x - center.x;
    const translatedY = point.y - center.y;
    
    // Rotate point
    const rotatedX = translatedX * Math.cos(angleRadians) - translatedY * Math.sin(angleRadians);
    const rotatedY = translatedX * Math.sin(angleRadians) + translatedY * Math.cos(angleRadians);
    
    // Translate back
    return {
      x: rotatedX + center.x,
      y: rotatedY + center.y
    };
  };
  
  // Rotate all points in a polygon
  const rotatePolygon = (
    polygon: Array<{ x: number; y: number }>,
    center: { x: number; y: number },
    angleDegrees: number
  ) => {
    return polygon.map(point => rotatePoint(point, center, angleDegrees));
  };

  const initMap = () => {
    if (!mapRef.current) return;

    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      zoom: 19,
      mapTypeId: "satellite",
      tilt: 0,
      zoomControl: true,
      scrollwheel: true,
      streetViewControl: false,
      mapTypeControl: true,
      mapTypeControlOptions: {
        position: window.google.maps.ControlPosition.TOP_RIGHT,
      },
      fullscreenControl: true,
      minZoom: 18, // Limit zoom-out to 1 level from max zoom (19-1=18)
    });

    // Add a listener to enforce zoom restriction
    window.google.maps.event.addListener(mapInstanceRef.current, 'zoom_changed', () => {
      const currentZoom = mapInstanceRef.current.getZoom();
      if (currentZoom < 18) {
        mapInstanceRef.current.setZoom(18);
      }
    });

    updateMap(address);
  };

  const incrementAddressUsage = async (addressToTrack?: string, isCaptureAction: boolean = false) => {
    // If no user is logged in, allow the operation without tracking
    if (!user) return true;
    
    // If no address is provided, we can't track it
    if (!addressToTrack) {
      console.error("No address provided for incrementAddressUsage");
      return false;
    }
    
    try {
      // This function has dual purpose:
      // 1. When called from a navigation/access context, we check if it's in history and allow without incrementing
      // 2. When called from "Capture Map View", the captureMapView param will ensure we always count it
      
      // Unless we're explicitly capturing the view (which should count as a usage),
      // check if address exists in history and allow access without incrementing
      if (!isCaptureAction) {
        const historyCheckResponse = await apiRequest(
          "GET", 
          `/api/search-history/check?address=${encodeURIComponent(addressToTrack)}`
        );
        
        if (historyCheckResponse.ok) {
          const historyData = await historyCheckResponse.json();
          
          // If the address exists in history, allow access without incrementing
          if (historyData.exists) {
            console.log("Address already exists in user's history, allowing access without incrementing usage");
            return true;
          }
        }
      }
      
      // If not in history or check failed, proceed with regular address usage increment
      // Call API to increment address usage with the address for uniqueness check
      const response = await apiRequest("POST", "/api/address-usage/increment", { address: addressToTrack });
      
      // If the response status is not successful, check if it's a limit exceeded error
      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 403 && errorData.planUpgradeRequired) {
          // Show limit exceeded dialog
          setShowLimitExceededDialog(true);
          
          // Refresh address usage data
          const usageResponse = await apiRequest("GET", "/api/address-usage");
          setAddressUsageLimit(await usageResponse.json());
          
          return false; // Cannot use more addresses
        }
        
        // For other errors, show a generic error message
        toast({
          title: "Error",
          description: "An error occurred while tracking address usage.",
          variant: "destructive",
        });
        return false;
      }
      
      // Usage incremented successfully
      const data = await response.json();
      setAddressUsageLimit({
        canUseMoreAddresses: true,
        usageCount: data.usageCount,
        limit: data.limit
      });
      return true;
    } catch (error) {
      console.error("Error incrementing address usage:", error);
      return true; // Allow proceeding in case of errors to prevent blocking the user
    }
  };

  const updateMap = async (newAddress: string) => {
    if (!mapInstanceRef.current) return;
    
    // Validate address before attempting geocoding
    if (!newAddress || newAddress.trim() === '') {
      console.error("Address is empty or invalid");
      toast({
        title: "Error",
        description: "No address provided. Please enter a valid address.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // We don't increment address usage here - only increment when "Capture Map View" is clicked
    // This allows users to search for multiple addresses without using up their quota until they actually analyze one

    setIsLoading(true);
    console.log("Geocoding address:", newAddress);
    
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: newAddress }, (results: any, status: string) => {
      if (status === "OK" && results[0]) {
        console.log("Geocoding successful", results[0].geometry.location);
        
        // Store the latitude for accurate area calculations
        const lat = results[0].geometry.location.lat();
        setCurrentLatitude(lat);
        console.log("Latitude stored for area calculations:", lat);
        
        mapInstanceRef.current.setCenter(results[0].geometry.location);
        mapInstanceRef.current.setZoom(19);

        // When in free quote mode, we need to update the URL to reflect the new address
        // This ensures that the new address is maintained throughout the session
        if (inFreeQuoteMode) {
          const encodedAddress = encodeURIComponent(newAddress);
          // Keep the current mode and returnTo parameters
          const urlParams = new URLSearchParams(window.location.search);
          const currentMode = urlParams.get('mode') || 'spaces';
          
          // Update URL without causing a page reload
          window.history.replaceState(
            {}, 
            '', 
            `/map?address=${encodedAddress}&mode=${currentMode}&returnTo=quote`
          );
          
          // Update the address state variable directly
          setAddress(newAddress);
          
          toast({
            title: "Address Updated",
            description: "Now analyzing new location",
          });
        } else {
          // Outside of free quote mode, always update the address state
          setAddress(newAddress);
        }

        setIsLoading(false);
      } else {
        console.error("Geocoding failed:", status);
        setIsLoading(false);
        toast({
          title: "Error",
          description:
            "Could not find the location. Please try a different address.",
          variant: "destructive",
        });
      }
    });
  };

  // Function to properly initialize or reinitialize the Google Map
  const initializeGoogleMap = () => {
    // Clean up existing map instance if it exists
    if (mapInstanceRef.current) {
      window.google?.maps.event.clearInstanceListeners(mapInstanceRef.current);
      mapInstanceRef.current = null;
    }
    
    // Set up the map initialization function on the window object
    window.initMap = initMap;
    
    // If the Google Maps API is already loaded
    if (window.google && window.google.maps) {
      console.log("Google Maps API already loaded, initializing map directly");
      // Simply call the init function directly without reloading the script
      setTimeout(() => {
        initMap();
      }, 100);
      return;
    }
    
    // Check for existing script that might be loading
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    
    if (existingScript) {
      console.log("Found existing Google Maps script, attaching to it");
      // Add our callback to the existing script
      if (existingScript.getAttribute('callback')) {
        // The script already has a callback, we'll need to chain our init function
        const callbackName = existingScript.getAttribute('callback') || '';
        const originalCallback = window[callbackName as keyof Window] as Function;
        const newCallback = function() {
          if (typeof originalCallback === 'function') {
            originalCallback();
          }
          initMap();
        };
        
        // Create a new function name
        const newCallbackName = 'initMapChained_' + Date.now();
        // Add the callback to window
        (window as any)[newCallbackName] = newCallback;
        
        // Update the script's callback
        existingScript.setAttribute('callback', newCallbackName);
      } else {
        // Script exists but has no callback, add ours
        existingScript.addEventListener('load', initMap);
      }
    } else {
      // No existing script, add a new one
      addGoogleMapsScript();
    }
  };
  
  const addGoogleMapsScript = () => {
    console.log("Adding new Google Maps script");
    // Set up the map initialization
    window.initMap = initMap;
    
    // Add a new script tag
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    }&libraries=places&callback=initMap`;
    script.async = true;
    script.defer = true;
    script.id = "google-maps-script-map";
    document.head.appendChild(script);
  };
  
  useEffect(() => {
    // Initial map setup
    initializeGoogleMap();
    
    return () => {
      // Clean up on component unmount - only remove our specific script tag
      const mapScript = document.getElementById('google-maps-script-map');
      if (mapScript) {
        mapScript.parentNode?.removeChild(mapScript);
      }
      
      // Clean up any map instance and listeners
      if (mapInstanceRef.current) {
        window.google?.maps.event.clearInstanceListeners(mapInstanceRef.current);
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) {
      updateMap(address);
    }
  }, [address]);

  const deleteSelectedPolygon = () => {
    if (selectedPolygonIndex !== null) {
      setCompletedPolygons(prev => prev.filter((_, index) => index !== selectedPolygonIndex));
      setSelectedPolygonIndex(null);
    }
  };

  const drawCanvas = () => {
    const canvas = imageCanvasRef.current;
    if (!canvas) {
      console.error('Cannot draw canvas - canvas ref is null');
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error('Cannot draw canvas - canvas context is null');
      return;
    }

    console.log(`Drawing canvas with dimensions: ${canvas.width}x${canvas.height}`);
    console.log(`Canvas has these elements to draw: ${completedPolygons.length} polygons, ${manualDots.length} dots, ${lines.length} lines`);
    
    // First, draw the image if available
    if (capturedImage || processedImageId) {
      const imageToUse = processedImageId || capturedImage;
      console.log('Drawing image on canvas:', imageToUse?.substring(0, 30) + '...');
      
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        console.log(`Image loaded with dimensions: ${img.width}x${img.height}`);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // After image is loaded, draw the overlays
        drawPolygonsAndElements(ctx, canvas);
      };
      img.onerror = (err) => {
        console.error('Failed to load image:', err);
        // Still draw the elements even if image fails
        drawPolygonsAndElements(ctx, canvas);
      };
      img.src = imageToUse || '';
    } else {
      // No image, just draw the elements
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawPolygonsAndElements(ctx, canvas);
    }
  };
  
  const drawPolygonsAndElements = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Clear the delete button positions array before redrawing
    deleteButtonPositions.current = [];

    // Draw completed polygons
    completedPolygons.forEach((polygon, polygonIndex) => {
      ctx.beginPath();
      if (polygon.points.length > 0) {
        ctx.moveTo(polygon.points[0].x, polygon.points[0].y);
        polygon.points.forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();

        const isSelected = selectedPolygonIndex === polygonIndex;
        const isHovered = hoveredPolygonIndex === polygonIndex;
        const isBeingDragged = isSelected && dragState.isDragging;

        // Set fill and stroke styles
        if (isSelected || isHovered) {
          ctx.fillStyle = isBeingDragged ? "rgba(255, 165, 0, 0.4)" : "rgba(255, 165, 0, 0.2)";
          ctx.strokeStyle = "#FFA500";
          ctx.lineWidth = isBeingDragged ? 3 : 2;
        } else {
          ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
          ctx.strokeStyle = "#00FF00";
          ctx.lineWidth = 2;
        }

        // Draw the polygon fill and stroke
        ctx.fill();
        ctx.stroke();

        // Draw the polygon points
        polygon.points.forEach((point) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = (isSelected || isHovered) ? "#FFA500" : "#00FF00";
          ctx.fill();
        });

        // Calculate or use the stored center of the polygon
        const center = polygon.center || calculatePolygonCenter(polygon.points);
        
        // Always show delete button for polygons with at least 3 points
        if (polygon.points.length >= 3) {
          // Calculate the center of the polygon for delete button placement
          const center = polygon.center || calculatePolygonCenter(polygon.points);
          const deleteX = center.x;
          const deleteY = center.y;
          
          // Store this delete button position for hit detection with a proper radius
          deleteButtonPositions.current.push({ 
            polygonIndex, 
            x: deleteX, 
            y: deleteY,
            radius: 15 // Smaller button but still easy to click
          });
          
          // Draw a smaller but clearly visible delete button in the center of the polygon
          ctx.save();
          
          // Create a smaller delete button
          const deleteButtonRadius = 12; // Smaller radius as requested
          
          // Draw the background circle with pure red for maximum visibility
          ctx.fillStyle = "#ff0000"; // Pure bright red
          ctx.beginPath();
          ctx.arc(deleteX, deleteY, deleteButtonRadius, 0, 2 * Math.PI);
          ctx.fill();
          
          // Add a white border around delete button for contrast
          ctx.strokeStyle = "white";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(deleteX, deleteY, deleteButtonRadius, 0, 2 * Math.PI);
          ctx.stroke();
          
          // Draw a smaller, cleaner white X inside the button
          ctx.strokeStyle = "white"; // Solid white for better visibility
          ctx.lineWidth = 2; // Thinner line for smaller button
          // Make the X smaller
          ctx.beginPath();
          ctx.moveTo(deleteX - 5, deleteY - 5);
          ctx.lineTo(deleteX + 5, deleteY + 5);
          ctx.moveTo(deleteX + 5, deleteY - 5);
          ctx.lineTo(deleteX - 5, deleteY + 5);
          ctx.stroke();
          
          // Add glow effect to make it stand out (shadow)
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          ctx.restore();
          
          // Draw the rotation handle for completed polygons
          if (polygon.points.length >= 3) {
            // Get the rotation angle in radians (if any)
            const rotationRadians = polygon.rotation ? polygon.rotation * (Math.PI / 180) : 0;
            
            // Always use the second point (index 1) as the top-middle point for handle positioning
            // This assumes an 8-point polygon where the 2nd point is the top-middle
            const topMiddleIndex = 1;
            const topMiddlePoint = polygon.points[Math.min(topMiddleIndex, polygon.points.length - 1)];
            
            // Fixed distance above the top middle point
            const offsetDistance = 25;
            
            // Calculate the rotation handle position
            let handleX, handleY;
            
            // The angle for the offset (perpendicular to the rotation)
            const offsetAngle = rotationRadians - Math.PI/2; // 90 degrees counterclockwise from rotation angle
            
            // Calculate handle position using direct trigonometry
            handleX = topMiddlePoint.x + offsetDistance * Math.cos(offsetAngle);
            handleY = topMiddlePoint.y + offsetDistance * Math.sin(offsetAngle);
            
            // Draw line from center point to handle
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(handleX, handleY);
            ctx.strokeStyle = isHovered || isSelected ? "#FFA500" : "#00A500";
            ctx.lineWidth = isHovered || isSelected ? 2 : 1;
            ctx.stroke();
            
            // Draw rotation handle
            ctx.beginPath();
            ctx.arc(handleX, handleY, 10, 0, 2 * Math.PI);
            ctx.fillStyle = isHovered || isSelected ? "#FFA500" : "#00A500"; // Orange if selected/hovered, green otherwise
            ctx.fill();
            
            // Draw rotation arrow icon inside handle
            ctx.beginPath();
            ctx.arc(handleX, handleY, 6, 0, 1.5 * Math.PI);
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw arrow tip
            ctx.beginPath();
            ctx.moveTo(handleX + 3, handleY - 6);
            ctx.lineTo(handleX, handleY - 8);
            ctx.lineTo(handleX - 2, handleY - 4);
            ctx.fillStyle = "#FFFFFF";
            ctx.fill();
          }
        }
        
        // The rotation handle is now drawn for all polygons in the code above
      }
    });

    if (currentPolygon.length > 0) {
      ctx.beginPath();
      ctx.moveTo(currentPolygon[0].x, currentPolygon[0].y);
      currentPolygon.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 2;
      ctx.stroke();

      currentPolygon.forEach((point) => {
        ctx.fillStyle = "#00FF00";
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Finish editing on double click
    if (selectedPolygonIndex !== null) {
      setSelectedPolygonIndex(null);
      setDraggedPointIndex(null);
      setDragState(prev => ({
        ...prev,
        isDragging: false,
        offsetX: 0,
        offsetY: 0
      }));
      toast({
        title: "Changes saved",
        description: "Polygon shape has been updated",
      });
    }
  };

  // Store delete button positions for hit detection
  const deleteButtonPositions = useRef<Array<{polygonIndex: number; x: number; y: number; radius?: number}>>([]);
  
  // Enhanced dedicated function to delete a polygon
  const deletePolygon = (index: number) => {
    console.log(`Deleting polygon at index ${index}`);
    
    try {
      // Safety check to prevent deleting out of bounds
      if (index < 0 || index >= completedPolygons.length) {
        console.error(`Invalid polygon index: ${index}, valid range is 0-${completedPolygons.length-1}`);
        return;
      }
      
      // Make a copy of the array and remove the polygon at the specified index
      const newPolygons = [...completedPolygons];
      newPolygons.splice(index, 1);
      
      // Update state with the new array (without the deleted polygon)
      setCompletedPolygons(newPolygons);
      console.log(`Polygon at index ${index} removed. New polygon count: ${newPolygons.length}`);
      
      // Reset all interactive states to ensure clean state
      setSelectedPolygonIndex(null);
      setHoveredPolygonIndex(null);
      setDraggedPointIndex(null);
      setIsRotating(false);
      setDragState({
        isDragging: false,
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0
      });
      
      // Force immediate redraw of the canvas to update visuals
      drawCanvas();
      
      // Confirm deletion to the user
      toast({
        title: "Polygon deleted",
        description: "The selected area has been removed",
        duration: 3000, // Longer duration to ensure user sees it
      });
    } catch (error) {
      console.error("Error in deletePolygon function:", error);
      toast({
        title: "Error deleting polygon",
        description: "An error occurred while trying to delete the polygon",
        variant: "destructive",
      });
    }
  };
  
  // Function to handle delete button clicks - now uses polygon centers directly
  const handleDeleteButtonClick = (event: React.MouseEvent<HTMLCanvasElement> | React.MouseEvent<Element>): boolean => {
    // Only process left clicks (button 0)
    if (event.button !== 0) {
      console.log("Not a left click, ignoring in handleDeleteButtonClick");
      return false;
    }

    const canvas = imageCanvasRef.current;
    if (!canvas) return false;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    console.log("Checking for delete button left-click at coordinates:", x, y, "Button:", event.button);
    
    // IMPORTANT: Check for clicks on delete buttons in polygon centers
    // Process this check BEFORE any other event handling
    for (let polygonIndex = completedPolygons.length - 1; polygonIndex >= 0; polygonIndex--) {
      const polygon = completedPolygons[polygonIndex];
      
      // Calculate position for delete button in the center of the polygon
      const polygonCenter = calculatePolygonCenter(polygon.points);
      const deleteX = polygonCenter.x;
      const deleteY = polygonCenter.y;
      
      // Calculate distance from click to the delete button
      const distToDeleteBtn = Math.sqrt(Math.pow(x - deleteX, 2) + Math.pow(y - deleteY, 2));
      
      console.log(`Polygon ${polygonIndex}: delete button at (${deleteX}, ${deleteY}), distance: ${distToDeleteBtn.toFixed(2)}`);
      
      // If clicked on the delete button, use the button's radius or default to 15px
      const hitRadius = 15; // Smaller radius to match our new button size
      if (distToDeleteBtn <= hitRadius) {
        console.log("Delete button clicked for polygon:", polygonIndex);
        
        // Stop event propagation immediately to prevent any other handlers from running
        event.stopPropagation();
        event.preventDefault();
        
        try {
          // Use the existing deletePolygon function (which already calls drawCanvas)
          deletePolygon(polygonIndex);
          
          // Force immediate canvas redraw to show the update
          setTimeout(() => {
            drawCanvas();
            console.log("Polygon deleted successfully, canvas redrawn");
          }, 10);
          
          // Alert to verify the deletion happened
          toast({
            title: "Polygon Deleted",
            description: `Polygon #${polygonIndex + 1} has been removed`,
            variant: "default",
          });
        } catch (error) {
          console.error("Error deleting polygon:", error);
        }
        
        return true; // Indicate that we handled a delete button click
      }
    }
    
    return false; // No delete button was clicked
  };

  const handleImageClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // First check if we're clicking a delete button
    if (handleDeleteButtonClick(event)) {
      return; // Exit early if we handled a delete button click
    }
    
    const canvas = imageCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    // If already dragging, finish the drag operation
    if (dragState.isDragging) {
      setDragState(prev => ({
        ...prev,
        isDragging: false,
        offsetX: 0,
        offsetY: 0
      }));
      setDraggedPointIndex(null);
      setSelectedPolygonIndex(null);
      toast({
        title: "Changes saved",
        description: draggedPointIndex !== null ? "Point position updated" : "Polygon position updated",
      });
      return;
    }
    
    // If a polygon is currently selected, finish editing it with a single click
    if (selectedPolygonIndex !== null) {
      setSelectedPolygonIndex(null);
      setDraggedPointIndex(null);
      setDragState(prev => ({
        ...prev,
        isDragging: false,
        offsetX: 0,
        offsetY: 0
      }));
      toast({
        title: "Changes saved",
        description: "Polygon shape has been updated",
      });
      return;
    }

    // Use our consolidated handleDeleteButtonClick function instead of duplicating code here
    // Check for delete button clicks in polygon centers 
    const clickCoordinates = { clientX: event.clientX, clientY: event.clientY, button: 0 };
    if (handleDeleteButtonClick(clickCoordinates as React.MouseEvent<HTMLCanvasElement>)) {
      console.log("Delete button handled by handleDeleteButtonClick");
      return;
    }
    
    // Continue with the original polygon detection
    for (let polygonIndex = 0; polygonIndex < completedPolygons.length; polygonIndex++) {
      const polygon = completedPolygons[polygonIndex];
      if (polygon.points.length >= 3) {
        
        // Calculate the center of the polygon for rotation (reusing existing center if available)
        const rotationCenter = polygon.center || calculatePolygonCenter(polygon.points);
        
        // Get the rotation angle in radians (if any)
        const rotationRadians = polygon.rotation ? polygon.rotation * (Math.PI / 180) : 0;
        
        // Always use the second point (index 1) as the top-middle point for handle positioning
        // This assumes an 8-point polygon where the 2nd point is the top-middle
        const topMiddleIndex = 1;
        const topMiddlePoint = polygon.points[Math.min(topMiddleIndex, polygon.points.length - 1)];
        
        // Fixed distance above the top middle point
        const offsetDistance = 25;
        
        // Calculate the rotation handle position
        let handleX, handleY;
        
        // The angle for the offset (perpendicular to the rotation)
        const offsetAngle = rotationRadians - Math.PI/2; // 90 degrees counterclockwise from rotation angle
        
        // Calculate handle position using direct trigonometry
        handleX = topMiddlePoint.x + offsetDistance * Math.cos(offsetAngle);
        handleY = topMiddlePoint.y + offsetDistance * Math.sin(offsetAngle);
        
        // Calculate distance from click to the rotation handle
        const distToHandle = Math.sqrt(Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2));
        
        // If the click is close to the rotation handle
        if (distToHandle < 15) {
          // Select the polygon and start rotation
          setSelectedPolygonIndex(polygonIndex);
          setIsRotating(true);
          
          // Calculate initial angle for reference
          const angleRadians = Math.atan2(y - rotationCenter.y, x - rotationCenter.x);
          setRotationStartAngle(angleRadians * (180 / Math.PI));
          return;
        }
      }
    }

    // Check if clicking on any polygon point
    for (let polygonIndex = 0; polygonIndex < completedPolygons.length; polygonIndex++) {
      const polygon = completedPolygons[polygonIndex];
      for (let pointIndex = 0; pointIndex < polygon.points.length; pointIndex++) {
        const point = polygon.points[pointIndex];
        const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));

        if (distance < 10) {
          setSelectedPolygonIndex(polygonIndex);
          setDraggedPointIndex(pointIndex);
          setDragState({
            isDragging: true,
            startX: x,
            startY: y,
            offsetX: 0,
            offsetY: 0
          });
          return;
        }
      }
    }

    // Check if point is inside any existing polygon - prevent drawing there
    for (const polygon of completedPolygons) {
      if (isPointInPolygon({ x, y }, polygon.points)) {
        const polygonIndex = completedPolygons.indexOf(polygon);
        setSelectedPolygonIndex(polygonIndex);
        setDragState({
          isDragging: true,
          startX: x,
          startY: y,
          offsetX: 0,
          offsetY: 0
        });
        return;
      }
    }

    // Create a polygon with 8 control points for better shape control
    const size = 100; // Size of the polygon (adjust as needed)
    const halfSize = size / 2;
    
    // Create an octagon-like shape with 8 control points around the clicked point
    const newPolygon = {
      points: [
        { x: x - halfSize, y: y - halfSize },         // Top-left
        { x: x, y: y - halfSize },                    // Top-middle
        { x: x + halfSize, y: y - halfSize },         // Top-right
        { x: x + halfSize, y: y },                    // Right-middle
        { x: x + halfSize, y: y + halfSize },         // Bottom-right
        { x: x, y: y + halfSize },                    // Bottom-middle
        { x: x - halfSize, y: y + halfSize },         // Bottom-left
        { x: x - halfSize, y: y }                     // Left-middle
      ]
    };
    
    // Add the new multi-point polygon directly to completed polygons
    setCompletedPolygons((prev) => [...prev, newPolygon]);
    
    // Select this polygon for immediate editing
    setSelectedPolygonIndex(completedPolygons.length);
    
    // In Free Quote mode, advance to step 3 when a polygon is drawn
    if (inFreeQuoteMode) {
      setCurrentQuoteStep(3);
    }
    
    toast({
      title: "Polygon created",
      description: "Drag any of the control points to shape it around the parking area.",
    });
  };

  // Using the existing drawCanvas function defined earlier
  // Note: We removed the duplicate function that was causing the error

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // First, check if we're clicking a delete button - IMPORTANT: This must come first!
    if (handleDeleteButtonClick(event)) {
      console.log("Delete button clicked in handleMouseDown, stopping event propagation");
      event.stopPropagation();
      event.preventDefault();
      return; // Exit early if we handled a delete button click
    }
    
    const canvas = imageCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    // Check if clicking on any polygon point first
    for (let polygonIndex = 0; polygonIndex < completedPolygons.length; polygonIndex++) {
      const polygon = completedPolygons[polygonIndex];
      for (let pointIndex = 0; pointIndex < polygon.points.length; pointIndex++) {
        const point = polygon.points[pointIndex];
        const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));

        if (distance < 10) {
          setSelectedPolygonIndex(polygonIndex);
          setDraggedPointIndex(pointIndex);
          setDragState({
            isDragging: true,
            startX: x,
            startY: y,
            offsetX: 0,
            offsetY: 0
          });
          return;
        }
      }
      
      // Check if clicking on a line segment to add a new control point
      for (let i = 0; i < polygon.points.length; i++) {
        const p1 = polygon.points[i];
        const p2 = polygon.points[(i + 1) % polygon.points.length]; // Wrap around to first point
        
        // Calculate the distance from click to line segment
        const lineLength = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        if (lineLength === 0) continue;
        
        // Calculate projection of point onto line segment
        const t = ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / (lineLength * lineLength);
        
        // Check if projection is on line segment
        if (t >= 0 && t <= 1) {
          // Calculate the projected point
          const projX = p1.x + t * (p2.x - p1.x);
          const projY = p1.y + t * (p2.y - p1.y);
          
          // Calculate distance from click to projected point
          const distToLine = Math.sqrt(Math.pow(x - projX, 2) + Math.pow(y - projY, 2));
          
          // If close enough to the line
          if (distToLine <= 10) {
            // Add a new point at the projected position
            const newPoint = { x: projX, y: projY };
            
            // Insert the new point in the polygon
            setCompletedPolygons(prev => {
              const newPolygons = [...prev];
              const newPoints = [...newPolygons[polygonIndex].points];
              newPoints.splice((i + 1) % newPoints.length, 0, newPoint);
              newPolygons[polygonIndex] = { points: newPoints };
              return newPolygons;
            });
            
            // Select the polygon and set the new point as the dragged point
            setSelectedPolygonIndex(polygonIndex);
            setDraggedPointIndex((i + 1) % polygon.points.length);
            setDragState({
              isDragging: true,
              startX: x,
              startY: y,
              offsetX: 0,
              offsetY: 0
            });
            
            toast({
              title: "Control point added",
              description: "Drag to adjust the polygon shape",
              duration: 2000,
            });
            
            return;
          }
        }
      }
    }

    // Delete button checks are now handled by the handleDeleteButtonClick function
    
    // Check if rotation handle was clicked for any polygon
    for (let polygonIndex = 0; polygonIndex < completedPolygons.length; polygonIndex++) {
      const polygon = completedPolygons[polygonIndex];
      if (polygon.points.length >= 3) {
        const rotationCenter = polygon.center || calculatePolygonCenter(polygon.points);
        
        // Get the rotation angle in radians (if any)
        const rotationRadians = polygon.rotation ? polygon.rotation * (Math.PI / 180) : 0;
        
        // Always use the second point (index 1) as the top-middle point for handle positioning
        // This assumes an 8-point polygon where the 2nd point is the top-middle
        const topMiddleIndex = 1;
        const topMiddlePoint = polygon.points[Math.min(topMiddleIndex, polygon.points.length - 1)];
        
        // Fixed distance above the top middle point
        const offsetDistance = 25;
        
        // Calculate the rotation handle position
        let handleX, handleY;
        
        // The angle for the offset (perpendicular to the rotation)
        const offsetAngle = rotationRadians - Math.PI/2; // 90 degrees counterclockwise from rotation angle
        
        // Calculate handle position using direct trigonometry
        handleX = topMiddlePoint.x + offsetDistance * Math.cos(offsetAngle);
        handleY = topMiddlePoint.y + offsetDistance * Math.sin(offsetAngle);
        
        // Calculate distance from click to the rotation handle
        const distToHandle = Math.sqrt(Math.pow(x - handleX, 2) + Math.pow(y - handleY, 2));
        
        // If the click is close to the rotation handle
        if (distToHandle < 15) {
          // Select this polygon and start rotating
          setSelectedPolygonIndex(polygonIndex);
          setIsRotating(true);
          
          // Calculate initial angle for reference
          const angleRadians = Math.atan2(y - rotationCenter.y, x - rotationCenter.x);
          setRotationStartAngle(angleRadians * (180 / Math.PI));
          
          toast({
            title: "Rotating polygon",
            description: "Drag to rotate the polygon, release to finish",
            duration: 2000,
          });
          
          return;
        }
      }
    }
    
    // Then check if point is inside any polygon for dragging the whole shape
    for (const polygon of completedPolygons) {
      if (isPointInPolygon({ x, y }, polygon.points)) {
        const polygonIndex = completedPolygons.indexOf(polygon);
        setSelectedPolygonIndex(polygonIndex);
        setDragState({
          isDragging: true,
          startX: x,
          startY: y,
          offsetX: 0,
          offsetY: 0
        });
        return;
      }
    }
    
    // If not interacting with existing polygons, start drawing a new one
    setIsDrawingPolygon(true);
    setDrawStartPoint({ x, y });
    
    // Create a new polygon with four points (square shape)
    const size = 50; // Initial size 
    const newPolygon = {
      points: [
        { x: x - size, y: y - size }, // Top-left
        { x: x + size, y: y - size }, // Top-right
        { x: x + size, y: y + size }, // Bottom-right
        { x: x - size, y: y + size }  // Bottom-left
      ]
    };
    
    // Add the new polygon to the list
    setCompletedPolygons(prev => [...prev, newPolygon]);
    setSelectedPolygonIndex(completedPolygons.length); // Select the new polygon
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    // Handle rotation if in rotation mode
    if (isRotating && selectedPolygonIndex !== null) {
      const polygon = completedPolygons[selectedPolygonIndex];
      const rotationCenter = polygon.center || calculatePolygonCenter(polygon.points);
      
      // Calculate the current angle from center to mouse position
      const currentAngle = Math.atan2(y - rotationCenter.y, x - rotationCenter.x) * (180 / Math.PI);
      
      // Calculate the relative angle change
      const angleChange = currentAngle - rotationStartAngle;
      
      // Rotate the polygon points around the center
      setCompletedPolygons(prev => {
        const newPolygons = [...prev];
        if (newPolygons[selectedPolygonIndex]) {
          // Rotate all points around the center
          const rotatedPoints = rotatePolygon(
            polygon.points,
            rotationCenter,
            angleChange
          );
          
          // Create the updated polygon with rotated points
          newPolygons[selectedPolygonIndex] = {
            ...newPolygons[selectedPolygonIndex],
            points: rotatedPoints,
            center: rotationCenter,  // Keep the center fixed
            rotation: (polygon.rotation || 0) + angleChange
          };
        }
        return newPolygons;
      });
      
      // Update the starting angle for the next mouse move
      setRotationStartAngle(currentAngle);
      
      // Force canvas redraw to show rotation in real-time
      drawCanvas();
      
      return;
    }

    // Update hovered polygon
    let foundHoveredPolygon = false;
    completedPolygons.forEach((polygon, index) => {
      if (isPointInPolygon({ x, y }, polygon.points)) {
        setHoveredPolygonIndex(index);
        foundHoveredPolygon = true;
      }
    });

    if (!foundHoveredPolygon) {
      setHoveredPolygonIndex(null);
    }

    // If drawing a new polygon
    if (isDrawingPolygon && drawStartPoint && selectedPolygonIndex !== null) {
      // Calculate the width and height of the rectangle based on the draw starting point
      const width = x - drawStartPoint.x;
      const height = y - drawStartPoint.y;
      
      // Calculate the distance from start point to cursor
      const distance = Math.sqrt(width * width + height * height);
      
      // Update the polygon's points to create an 8-point shape for more control
      setCompletedPolygons(prev => {
        const newPolygons = [...prev];
        if (newPolygons[selectedPolygonIndex]) {
          newPolygons[selectedPolygonIndex] = {
            ...newPolygons[selectedPolygonIndex],
            points: [
              { x: drawStartPoint.x, y: drawStartPoint.y },          // Top-left
              { x: (drawStartPoint.x + x) / 2, y: drawStartPoint.y }, // Top-middle
              { x: x, y: drawStartPoint.y },                         // Top-right
              { x: x, y: (drawStartPoint.y + y) / 2 },               // Right-middle
              { x: x, y: y },                                        // Bottom-right
              { x: (drawStartPoint.x + x) / 2, y: y },               // Bottom-middle
              { x: drawStartPoint.x, y: y },                         // Bottom-left
              { x: drawStartPoint.x, y: (drawStartPoint.y + y) / 2 } // Left-middle
            ]
          };
        }
        return newPolygons;
      });
      
      // Auto-completion is handled in mouseUp event instead
      // for more immediate response
      return;
    }

    // Handle dragging point or polygon
    if (dragState.isDragging && selectedPolygonIndex !== null) {
      if (draggedPointIndex !== null) {
        // Dragging a single point
        setCompletedPolygons(prev => {
          const newPolygons = [...prev];
          if (newPolygons[selectedPolygonIndex]) {
            newPolygons[selectedPolygonIndex] = {
              ...newPolygons[selectedPolygonIndex],
              points: newPolygons[selectedPolygonIndex].points.map((point, index) =>
                index === draggedPointIndex ? { x, y } : point
              )
            };
          }
          return newPolygons;
        });
      } else {
        // Dragging entire polygon
        const dx = x - dragState.startX;
        const dy = y - dragState.startY;

        setCompletedPolygons(prev => {
          const newPolygons = [...prev];
          if (newPolygons[selectedPolygonIndex]) {
            // Move all points
            const newPoints = newPolygons[selectedPolygonIndex].points.map(point => ({
              x: point.x + dx,
              y: point.y + dy,
            }));
            
            // Also move the center if it exists
            const newCenter = newPolygons[selectedPolygonIndex].center 
              ? {
                  x: newPolygons[selectedPolygonIndex].center!.x + dx,
                  y: newPolygons[selectedPolygonIndex].center!.y + dy
                }
              : calculatePolygonCenter(newPoints);
              
            newPolygons[selectedPolygonIndex] = {
              ...newPolygons[selectedPolygonIndex],
              points: newPoints,
              center: newCenter
            };
          }
          return newPolygons;
        });

        setDragState(prev => ({
          ...prev,
          startX: x,
          startY: y
        }));
      }
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle rotation end
    if (isRotating) {
      setIsRotating(false);
      
      // If we were rotating a polygon, update its center
      if (selectedPolygonIndex !== null) {
        // Update the center of the polygon after rotation
        setCompletedPolygons(prev => {
          const newPolygons = [...prev];
          if (newPolygons[selectedPolygonIndex]) {
            const center = calculatePolygonCenter(newPolygons[selectedPolygonIndex].points);
            newPolygons[selectedPolygonIndex] = {
              ...newPolygons[selectedPolygonIndex],
              center
            };
          }
          return newPolygons;
        });
        
        toast({
          title: "Rotation complete",
          description: "Polygon has been rotated",
          duration: 2000
        });
      }
      return;
    }
    
    // If we were drawing a new polygon, finish it
    if (isDrawingPolygon) {
      // Immediately finalize the polygon at the current mouse position
      const canvas = imageCanvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        
        // Update the polygon with the final position
        if (selectedPolygonIndex !== null && drawStartPoint) {
          setCompletedPolygons(prev => {
            const newPolygons = [...prev];
            if (newPolygons[selectedPolygonIndex]) {
              // Create a polygon with 8 points instead of 4 for more control
              const points = [
                { x: drawStartPoint.x, y: drawStartPoint.y },          // Top-left
                { x: (drawStartPoint.x + x) / 2, y: drawStartPoint.y }, // Top-middle
                { x: x, y: drawStartPoint.y },                         // Top-right
                { x: x, y: (drawStartPoint.y + y) / 2 },               // Right-middle
                { x: x, y: y },                                        // Bottom-right
                { x: (drawStartPoint.x + x) / 2, y: y },               // Bottom-middle
                { x: drawStartPoint.x, y: y },                         // Bottom-left
                { x: drawStartPoint.x, y: (drawStartPoint.y + y) / 2 } // Left-middle
              ];
              
              // Calculate the center of the polygon
              const center = calculatePolygonCenter(points);
              
              newPolygons[selectedPolygonIndex] = {
                ...newPolygons[selectedPolygonIndex],
                points,
                center,
                rotation: 0
              };
            }
            return newPolygons;
          });
        }
      }
      
      // Complete the drawing process automatically on mouse up without requiring a click
      setIsDrawingPolygon(false);
      setDrawStartPoint(null);
      
      // Select the polygon that was just created to allow immediate editing
      const newIndex = completedPolygons.length;
      setSelectedPolygonIndex(newIndex);
      
      // In Free Quote mode, advance to step 3 when a polygon is drawn
      if (inFreeQuoteMode) {
        setCurrentQuoteStep(3);
      }

      toast({
        title: "Polygon created",
        description: "You can now drag any control points to refine the shape or use the rotation handle."
      });
    } else if (dragState.isDragging) {
      // If we were dragging a point or polygon, finish the drag
      setDragState(prev => ({
        ...prev,
        isDragging: false,
        offsetX: 0,
        offsetY: 0
      }));
      
      // Update the center of the polygon after dragging
      if (selectedPolygonIndex !== null) {
        setCompletedPolygons(prev => {
          const newPolygons = [...prev];
          if (newPolygons[selectedPolygonIndex]) {
            const center = calculatePolygonCenter(newPolygons[selectedPolygonIndex].points);
            newPolygons[selectedPolygonIndex] = {
              ...newPolygons[selectedPolygonIndex],
              center
            };
          }
          return newPolygons;
        });
      }
      
      // Keep the polygon selected after dragging to allow continued editing
      if (draggedPointIndex !== null) {
        setDraggedPointIndex(null);
      }
    } else {
      // Reset drag state
      setDragState(prev => ({
        ...prev,
        isDragging: false,
        offsetX: 0,
        offsetY: 0
      }));
    }
  };

  useEffect(() => {
    drawCanvas();
  }, [currentPolygon, completedPolygons, selectedPolygonIndex, hoveredPolygonIndex, dragState]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      if (currentPolygon.length > 2) {
        setCompletedPolygons((prev) => [...prev, { points: [...currentPolygon] }]);
        setCurrentPolygon([]);
        drawCanvas();
      } else if (selectedPolygonIndex !== null) {
        // Finish editing
        setSelectedPolygonIndex(null);
        setDraggedPointIndex(null);
        setDragState(prev => ({
          ...prev,
          isDragging: false,
          offsetX: 0,
          offsetY: 0
        }));
        toast({
          title: "Changes saved",
          description: "Polygon shape has been updated",
        });
      }
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentPolygon, selectedPolygonIndex]);

  const captureMapScreenshot = async () => {
    if (!mapRef.current || !mapInstanceRef.current) return;
    try {
      setIsLoading(true);
      
      // Check if the user is logged in and increment address usage here
      // This way we only count an address when the user actively captures it
      if (user) {
        // Pass the address to incrementAddressUsage with isCaptureAction=true
        // to ensure it counts against the user's usage limit even if it's in history
        const canProceed = await incrementAddressUsage(address, true);
        if (!canProceed) {
          // Don't proceed if the user hit their address limit
          setIsLoading(false);
          return;
        }
      }
      
      // We'll use html2canvas to capture the map directly
      // Setup a temporary canvas
      const mapElement = mapRef.current;
      const width = mapElement.clientWidth;
      const height = mapElement.clientHeight;
      
      // Method 1: Try to directly capture canvas using toDataURL if available
      try {
        // This looks for a canvas element that might be within the map container
        const mapCanvas = mapRef.current.querySelector('canvas');
        if (mapCanvas) {
          // Direct canvas method
          const base64Image = mapCanvas.toDataURL('image/png');
          setCapturedImage(base64Image);
          setCurrentPolygon([]);
          setCompletedPolygons([]);
          
          // Setup the drawing canvas with the captured image
          const img = new Image();
          img.onload = () => {
            if (imageCanvasRef.current) {
              imageCanvasRef.current.width = img.width;
              imageCanvasRef.current.height = img.height;
              imageCanvasRef.current.style.width = `${width}px`;
              imageCanvasRef.current.style.height = `${height}px`;
              
              // Draw the captured image to our editing canvas
              const ctx = imageCanvasRef.current.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, img.width, img.height);
              }
            }
          };
          img.src = base64Image;
          
          // Always advance to step 2 regardless of mode
          setCurrentQuoteStep(2);
          
          toast({
            title: "Map area captured",
            description: "You can now draw polygons on the captured image",
          });
          
          setIsLoading(false);
          return;
        }
      } catch (canvasError) {
        console.warn("Direct canvas capture failed, falling back to static map API:", canvasError);
      }
      
      // Fallback Method: Use static maps API as before
      const map = mapInstanceRef.current;
      const center = map.getCenter();
      const currentZoom = map.getZoom();
      const adjustedZoom = Math.max(currentZoom - 1, 0);
      
      const captureWidth = Math.min(Math.floor((width * 1.05) / 2), 640);
      const captureHeight = Math.min(Math.floor((height * 1.05) / 2), 640);

      const staticMapUrl =
        `https://maps.googleapis.com/maps/api/staticmap?` +
        `center=${center.lat()},${center.lng()}` +
        `&zoom=${adjustedZoom}` +
        `&size=${captureWidth}x${captureHeight}` +
        `&scale=2` +
        `&maptype=${map.getMapTypeId()}` +
        `&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(staticMapUrl);
      const blob = await response.blob();

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setCapturedImage(base64data);
        setCurrentPolygon([]);
        setCompletedPolygons([]);

        const img = new Image();
        img.onload = () => {
          if (imageCanvasRef.current) {
            imageCanvasRef.current.width = img.width;
            imageCanvasRef.current.height = img.height;
            imageCanvasRef.current.style.width = `${width}px`;
            imageCanvasRef.current.style.height = `${height}px`;
          }
        };
        img.src = base64data;
        
        // Always advance to step 2 regardless of mode
        setCurrentQuoteStep(2);
        
        toast({
          title: "Map area captured",
          description: "You can now draw polygons on the captured image",
        });
      };
    } catch (error) {
      console.error("Screenshot capture error:", error);
      toast({
        title: "Screenshot failed",
        description: "Failed to capture the map view",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processImage = async () => {
    try {
      // Check for address usage limits for free users
      if (user && user.paymentPlan === 'free' && !inFreeQuoteMode) {
        // Check current address usage
        const response = await apiRequest("GET", "/api/address-usage");
        const usageData = await response.json();
        setAddressUsageLimit(usageData);
        
        // If user has reached their limit, show the dialog and don't proceed
        if (!usageData.canUseMoreAddresses) {
          setShowLimitExceededDialog(true);
          return;
        }
      }
      
      setIsLoading(true);

      const polygons = completedPolygons.map(p => p.points);

      // If in area mode, calculate the area of all polygons
      if (mode === 'area') {
        // Calculate total area
        let totalSqFt = 0;
        let totalSqYd = 0;
        
        for (const polygon of completedPolygons) {
          const { squareFeet, squareYards } = calculatePolygonArea(polygon.points);
          totalSqFt += squareFeet;
          totalSqYd += squareYards;
        }
        
        // Update result with calculated areas
        setResult({
          total_parking: 0,
          total_crosswalks: 0,
          total_handicap: 0,
          total_area_sqft: totalSqFt,
          total_area_sqyd: totalSqYd
        });
        
        // Create a static processed image without YOLO detection
        const canvas = imageCanvasRef.current;
        if (!canvas) {
          throw new Error("Canvas not available");
        }
        
        // We need to draw the background image manually onto the canvas
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Canvas context not available");
        }
        
        // Create a temporary image to draw the background first
        const tempImage = new Image();
        tempImage.onload = () => {
          // Clear the canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw the background image first
          ctx.drawImage(tempImage, 0, 0, canvas.width, canvas.height);
          
          // Then draw all the polygons with fills
          completedPolygons.forEach((polygon, index) => {
            if (polygon.points.length > 0) {
              // Draw the polygon outline
              ctx.beginPath();
              ctx.moveTo(polygon.points[0].x, polygon.points[0].y);
              polygon.points.forEach(point => {
                ctx.lineTo(point.x, point.y);
              });
              ctx.closePath();
              
              // Fill with transparent orange (branded color) instead of green
              ctx.fillStyle = "rgba(255, 91, 0, 0.4)";
              ctx.fill();
              
              // Outline with solid orange - thicker for PDF visibility
              ctx.strokeStyle = "#FF5B00";
              ctx.lineWidth = 3;
              ctx.stroke();
              
              // Add area information for each polygon
              const { squareFeet, squareYards } = calculatePolygonArea(polygon.points);
              
              // Only process polygons of reasonable size
              if (squareFeet >= 50) {
                // Calculate polygon bounds to ensure text fits within
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                polygon.points.forEach(p => {
                  minX = Math.min(minX, p.x);
                  minY = Math.min(minY, p.y);
                  maxX = Math.max(maxX, p.x);
                  maxY = Math.max(maxY, p.y);
                });
                
                // Calculate polygon width and height
                const polygonWidth = maxX - minX;
                const polygonHeight = maxY - minY;
                
                // Find center point of polygon to place text
                const cx = minX + polygonWidth / 2;
                const cy = minY + polygonHeight / 2;
                
                // Calculate a size-appropriate font size based on polygon dimensions
                // This ensures text doesn't overflow the polygon
                const minFontSize = 10;  // Minimum readable size
                const maxFontSize = 20;  // Maximum size for aesthetics
                
                // Calculate font size as a percentage of polygon width/height (whichever is smaller)
                // The divisor (8) can be adjusted to make text larger or smaller relative to the polygon
                const calculatedFontSize = Math.min(polygonWidth, polygonHeight) / 8;
                
                // Apply min/max constraints
                const fontSize = Math.max(minFontSize, Math.min(maxFontSize, calculatedFontSize));
                
                // Estimate text width based on font size and content length
                const sqFtText = `${Math.round(squareFeet).toLocaleString()} sq ft`;
                const sqYdText = `${Math.round(squareYards).toLocaleString()} sq yd`;
                
                // Choose the longer text to calculate width
                const longerText = sqFtText.length > sqYdText.length ? sqFtText : sqYdText;
                const textWidth = longerText.length * fontSize * 0.6; // Approximate width
                
                // Only add text if it will fit within the polygon with some padding
                if (textWidth < polygonWidth * 0.8 && fontSize * 3 < polygonHeight * 0.8) {
                  const padding = fontSize * 0.5;
                  
                  // Background for text visibility 
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                  
                  // Size background to fit both lines of text
                  const bgWidth = textWidth + padding * 2;
                  const bgHeight = fontSize * 2.5; // Enough for 2 lines
                  ctx.fillRect(cx - bgWidth/2, cy - bgHeight/2, bgWidth, bgHeight);
                  
                  // Add area labels with appropriate size
                  ctx.font = `bold ${fontSize}px Arial`;
                  ctx.fillStyle = 'white';
                  ctx.textAlign = 'center';
                  
                  // Position text in the center of the polygon
                  ctx.fillText(sqFtText, cx, cy);
                  ctx.fillText(sqYdText, cx, cy + fontSize * 1.2); // Second line
                }
              }
              
              // Draw control points for this polygon
              polygon.points.forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
                ctx.fillStyle = "#00FF00";
                ctx.fill();
              });
            }
          });
          
          // Instead of adding the total area at the top, we'll add it inside the largest polygon
          // Find the largest polygon to place the total area text
          let largestPolygonIndex = 0;
          let largestPolygonArea = 0;
          
          completedPolygons.forEach((polygon, index) => {
            const { squareFeet } = calculatePolygonArea(polygon.points);
            if (squareFeet > largestPolygonArea) {
              largestPolygonArea = squareFeet;
              largestPolygonIndex = index;
            }
          });
          
          // If we have polygons, find the largest one to place the total area text
          // but only if it's large enough to fit text
          if (completedPolygons.length > 0 && largestPolygonArea >= 500) {
            const largestPolygon = completedPolygons[largestPolygonIndex];
            
            // Calculate bounds of the largest polygon
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            largestPolygon.points.forEach(p => {
              minX = Math.min(minX, p.x);
              minY = Math.min(minY, p.y);
              maxX = Math.max(maxX, p.x);
              maxY = Math.max(maxY, p.y);
            });
            
            // Calculate polygon width and height
            const polygonWidth = maxX - minX;
            const polygonHeight = maxY - minY;
            
            // Center of the largest polygon
            const centerX = minX + polygonWidth / 2;
            const centerY = minY + polygonHeight / 2;
            
            // Only add total if the polygon is large enough for the text
            const totalSqFtText = `Total Area: ${totalSqFt.toLocaleString()} sq ft`;
            const totalSqYdText = `${totalSqYd.toLocaleString()} sq yd`;
            
            // Calculate appropriate font size based on polygon dimensions
            const maxTotalFontSize = 22;
            const minTotalFontSize = 14;
            const calculatedFontSize = Math.min(polygonWidth, polygonHeight) / 10;
            const fontSize = Math.max(minTotalFontSize, Math.min(maxTotalFontSize, calculatedFontSize));
            
            // Estimate text width based on content length and font size
            const textWidth = totalSqFtText.length * fontSize * 0.6;
            
            // Only add total if it will fit
            if (textWidth < polygonWidth * 0.8 && fontSize * 3 < polygonHeight * 0.8) {
              // Create a semi-transparent background for better text visibility
              ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
              const bgWidth = textWidth + fontSize;
              const bgHeight = fontSize * 3;
              ctx.fillRect(centerX - bgWidth/2, centerY - bgHeight/2, bgWidth, bgHeight);
              
              // Add the total area text
              ctx.font = `bold ${fontSize}px Arial`;
              ctx.fillStyle = 'white';
              ctx.textAlign = 'center';
              
              // Position with slight offset for better visibility
              ctx.fillText(totalSqFtText, centerX, centerY);
              ctx.fillText(totalSqYdText, centerX, centerY + fontSize * 1.5);
            }
          }
          
          // Now create the final snapshot with everything drawn
          const imageData = canvas.toDataURL('image/jpeg');
          
          // Set this as the processed image
          setProcessedImageId(imageData);
          // We don't use the uniqueId for area mode, but set it anyway
          setProcessedImageUniqueId(Date.now().toString());
          
          console.log("Surface area image generated and saved");
          
          // Reset the canvas display for continued editing
          drawCanvas();
        };
        
        // Load the background image (the satellite view)
        tempImage.src = capturedImage as string;
        
        // Always advance to step 4 after calculating area
        setCurrentQuoteStep(4);
        
        toast({
          title: "Area calculation complete",
          description: `Total area: ${totalSqFt.toLocaleString()} sq ft (${totalSqYd.toLocaleString()} sq yd)`,
        });
        
        // Save area calculation to search history if user is logged in
        if (user) {
          // Calculate a price range based on the area
          const sqYards = totalSqYd || 0;
          const rate = 2.5; // Price per square yard
          const lowerEstimate = Math.round(sqYards * rate * 0.8);
          const upperEstimate = Math.round(sqYards * rate * 1.2);
          
          // Wait for the imageData variable to be defined before proceeding
          const canvas = imageCanvasRef.current;
          if (canvas) {
            const canvasImageData = canvas.toDataURL('image/jpeg');
            
            apiRequest("POST", "/api/search-history", {
              address: address,
              processedImageId: canvasImageData, // Using the data URL from the canvas
              total_area_sqft: totalSqFt,
              total_area_sqyd: totalSqYd,
              lowerEstimate: lowerEstimate,
              upperEstimate: upperEstimate,
              hasDetections: true,
              // Store map state for future restoration
              mapState: JSON.stringify({
                completedPolygons,
                manualDots,
                lines,
                mode,
                capturedImage
              })
            }).catch(error => {
              console.error("Error saving area calculation to search history:", error);
            });
          }
        }
      } else {
        // Default space counter mode - send to API for YOLO detection
        const response = await apiRequest("POST", "/api/process-screenshot", {
          image: capturedImage,
          polygonCoordinates: polygons,
        });

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        if (!data.width || !data.height) {
          throw new Error("Invalid image dimensions received");
        }

        setResult({
          total_parking: data.total_parking || 0,
          total_crosswalks: data.total_crosswalks || 0,
          total_handicap: data.total_handicap || 0,
        });
        setProcessedImageId(data.image_path);
        setProcessedImageUniqueId(data.unique_id);
        setPolygonCounts(data.polygon_counts || []);
        
        // Process detected points from backend and convert to manual dots format
        if (data.detected_points) {
          // Convert points to our manual dots format and add them to the existing manual dots
          const newDetectedDots: Array<{
            type: 'parking' | 'handicap' | 'crosswalk';
            x: number;
            y: number;
            isAIDetected: boolean;
          }> = [];
          
          // Process parking spots (class 0)
          if (data.detected_points.parking) {
            data.detected_points.parking.forEach((point: [number, number]) => {
              const [x, y] = point;
              newDetectedDots.push({
                type: 'parking',
                x,
                y,
                isAIDetected: true // Mark this as AI detected so we can identify it later
              });
            });
          }
          
          // Process crosswalks (class 1)
          if (data.detected_points.crosswalks) {
            data.detected_points.crosswalks.forEach((point: [number, number]) => {
              const [x, y] = point;
              newDetectedDots.push({
                type: 'crosswalk',
                x,
                y,
                isAIDetected: true
              });
            });
          }
          
          // Process handicap spots (class 2)
          if (data.detected_points.handicap) {
            data.detected_points.handicap.forEach((point: [number, number]) => {
              const [x, y] = point;
              newDetectedDots.push({
                type: 'handicap',
                x,
                y,
                isAIDetected: true
              });
            });
          }
          
          // Update the manual dots state with the new dots
          setManualDots(prev => [...prev, ...newDetectedDots]);
          
          console.log(`Added ${newDetectedDots.length} AI-detected points to the map`);
        }
        
        toast({
          title: "Image processed successfully",
          description: `Detected ${data.total_parking} parking spaces, ${data.total_crosswalks} crosswalks, and ${data.total_handicap} handicap spots`,
        });
        
        // Save detection results to search history if user is logged in
        if (user) {
          // Calculate a price range based on the detected features
          const lowerEstimate = 500 + (data.total_parking * 5) + (data.total_handicap * 15) + (data.total_crosswalks * 75);
          const upperEstimate = 800 + (data.total_parking * 8) + (data.total_handicap * 25) + (data.total_crosswalks * 120);
          
          apiRequest("POST", "/api/search-history", {
            address: address,
            processedImageId: data.image_path,
            parkingSpaces: data.total_parking,
            handicapSpots: data.total_handicap,
            crosswalks: data.total_crosswalks,
            arrows: 0, // Default to 0 for arrows since they're not detected
            lowerEstimate: lowerEstimate,
            upperEstimate: upperEstimate,
            hasDetections: true,
            // Store map state for future restoration
            mapState: JSON.stringify({
              completedPolygons,
              manualDots,
              lines,
              mode,
              capturedImage
            })
          }).catch(error => {
            console.error("Error saving detection results to search history:", error);
          });
        }
        
        // Always advance to step 4 after processing
        setCurrentQuoteStep(4);
      }
    } catch (error: any) {
      console.error("Processing error:", error);
      toast({
        title: "Processing failed",
        description: error.message || "Failed to process the image",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total linear feet from all lines
  const calculateTotalLinearFeet = () => {
    return lines.reduce((total, line) => total + line.lengthFt, 0);
  };
  
  // Capture the current state of the map including dots and lines
  const captureCanvasWithMarkings = (): string => {
    const canvas = processedImageCanvasRef.current;
    if (!canvas) return '';
    
    // Draw everything on the canvas first to ensure it's up to date
    drawProcessedImageCanvas();
    
    // Get the canvas data URL
    return canvas.toDataURL('image/png');
  };
  
  const resetView = () => {
    setCapturedImage(null);
    setProcessedImageId(null);
    setProcessedImageUniqueId(null);
    setCurrentPolygon([]);
    setCompletedPolygons([]);
    
    // Reset result based on current mode
    if (mode === 'area') {
      setResult({
        total_parking: 0,
        total_crosswalks: 0,
        total_handicap: 0,
        total_area_sqft: 0,
        total_area_sqyd: 0
      });
    } else {
      setResult({
        total_parking: 0,
        total_crosswalks: 0,
        total_handicap: 0
      });
    }
    
    setSelectedPolygonIndex(null);
    setDraggedPointIndex(null);
    
    // Reset line drawing
    setLines([]);
    setCurrentLine(null);
    setIsDrawingLine(false);
    setSelectedProcessedPolygon(null);
    setPolygonCounts([]);
    setDragState({
      isDragging: false,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
    });
    setHoveredPolygonIndex(null);
    setIsDrawingPolygon(false);
    setDrawStartPoint(null);
    
    // Reset manual dots and lines
    setManualDots([]);
    setIsManualMode(false);
    setIsDrawingLine(false);
    setLines([]);
    setCurrentLine(null);
    
    // Always reset quote step when view is reset
    setCurrentQuoteStep(1);

    // Reinitialize the map
    initializeGoogleMap();
  };

  const drawProcessedImagePolygons = () => {
    const canvas = processedImageCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // We don't clear the canvas here anymore because the background image was already drawn
    // in the drawProcessedImageCanvas function before this function is called

    completedPolygons.forEach((polygon, polygonIndex) => {
      ctx.beginPath();
      if (polygon.points.length > 0) {
        ctx.moveTo(polygon.points[0].x, polygon.points[0].y);
        polygon.points.forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();

        if (selectedProcessedPolygon === polygonIndex) {
          ctx.fillStyle = "rgba(255, 165, 0, 0.2)";
          ctx.strokeStyle = "#FFA500";
        } else {
          ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
          ctx.strokeStyle = "#00FF00";
        }

        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();

        polygon.points.forEach((point) => {
          ctx.fillStyle = selectedProcessedPolygon === polygonIndex ? "#FFA500" : "#00FF00";
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    });
  };

  const handleProcessedImageClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = processedImageCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // In surface area mode, focus on polygon selection and manipulation rather than dot-related functions
    if (mode === 'area') {
      // Find if we're clicking inside a polygon
      for (let i = 0; i < completedPolygons.length; i++) {
        if (isPointInPolygon({ x, y }, completedPolygons[i].points)) {
          setSelectedProcessedPolygon(i);
          toast({
            title: "Polygon selected",
            description: `Selected polygon ${i + 1}. You can modify this area.`,
          });
          return;
        }
      }
      
      // If didn't click on any polygon, deselect
      if (selectedProcessedPolygon !== null) {
        setSelectedProcessedPolygon(null);
      }
      
      return;
    }
    
    // Handle line drawing mode
    if (isDrawingLine) {
      // Handle two different scenarios: starting a new line or completing an existing line
      if (!currentLine) {
        // Starting a new line
        setCurrentLine({
          startX: x,
          startY: y,
          endX: x, 
          endY: y
        });
        
        // Show a helper toast
        toast({
          title: "Line Started",
          description: "Click again to end the line, or drag to draw a longer line.",
        });
        
        // Set up mouse move handler for the drag portion
        const handleMouseMove = (e: MouseEvent) => {
          const rect = canvas.getBoundingClientRect();
          if (!rect) return;
          
          const newX = (e.clientX - rect.left) * scaleX;
          const newY = (e.clientY - rect.top) * scaleY;
          
          setCurrentLine(prev => {
            if (!prev) return null;
            return {
              ...prev,
              endX: newX,
              endY: newY
            };
          });
        };
        
        // Set up mouse up handler to complete the line
        const handleMouseUp = (e: MouseEvent) => {
          // Make sure we have a current line with proper properties
          if (!currentLine || typeof currentLine !== 'object') return;
          
          const endX = (e.clientX - rect.left) * scaleX;
          const endY = (e.clientY - rect.top) * scaleY;
          
          // Type assertion to ensure TypeScript recognizes the correct structure
          const line = currentLine as LinePoint;
          const startX = line.startX;
          const startY = line.startY;
          const pixelDistance = Math.sqrt(
            Math.pow(startX - endX, 2) + 
            Math.pow(startY - endY, 2)
          );
          
          // Convert to feet (approximate conversion based on latitude)
          // At latitude 0, 1 pixel ≈ 1.2 feet at zoom level 19
          let pixelToFtRatio = 1.2;
          
          // Adjust based on latitude if we have it
          if (currentLatitude !== null) {
            const latRadians = currentLatitude * (Math.PI / 180);
            const latitudeAdjustment = Math.cos(latRadians);
            pixelToFtRatio = 1.2 * latitudeAdjustment;
          }
          
          const lengthFt = pixelDistance * pixelToFtRatio;
          
          // Add the completed line
          setLines(prev => [
            ...prev,
            {
              startX,
              startY,
              endX,
              endY,
              lengthFt: Math.round(lengthFt),
              color: selectedLineColor
            }
          ]);
          
          // Reset current line
          setCurrentLine(null);
          
          // Show toast with measurement
          toast({
            title: "Line Measurement",
            description: `Measured length: ${Math.round(lengthFt)} feet`,
          });
          
          // Clean up event listeners
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
        
        // Add event listeners
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      } else {
        // We already have a line started, so this click will end it
        const line = currentLine as LinePoint;
        const startX = line.startX;
        const startY = line.startY;
        const endX = x;
        const endY = y;
        
        const pixelDistance = Math.sqrt(
          Math.pow(startX - endX, 2) + 
          Math.pow(startY - endY, 2)
        );
        
        // Convert to feet (approximate conversion based on latitude)
        let pixelToFtRatio = 1.2;
        if (currentLatitude !== null) {
          const latRadians = currentLatitude * (Math.PI / 180);
          const latitudeAdjustment = Math.cos(latRadians);
          pixelToFtRatio = 1.2 * latitudeAdjustment;
        }
        
        const lengthFt = pixelDistance * pixelToFtRatio;
        
        // Add the completed line
        setLines(prev => [
          ...prev,
          {
            startX,
            startY,
            endX,
            endY,
            lengthFt: Math.round(lengthFt),
            color: selectedLineColor
          }
        ]);
        
        // Reset current line
        setCurrentLine(null);
        
        // Show toast with measurement
        toast({
          title: "Line Measurement",
          description: `Measured length: ${Math.round(lengthFt)} feet`,
        });
        
        // No need to remove event listeners here since they're specific to the
        // initial line drawing context and are already removed or gone
      }
      return;
    }
    
    // For space counter mode, continue with the original behavior
    // Only allow dot manipulation when in manual dot mode
    if (isManualMode) {
      // First check if we're clicking DIRECTLY on an existing manually placed dot to delete it
      // Using an extremely precise radius that requires clicking directly on the center of the dot
      // This makes it easier to place dots very close to each other without accidental deletions
      const visualDotRadius = 4; // This should match the actual radius used to draw dots
      const clickRadius = visualDotRadius * 0.5; // Only delete when clicking very close to center
      const clickedDotIndex = manualDots.findIndex(dot => 
        Math.sqrt(Math.pow(dot.x - x, 2) + Math.pow(dot.y - y, 2)) <= clickRadius
      );
      
      // If found a manually placed dot and within click distance, delete it
      if (clickedDotIndex !== -1) {
        const dotToRemove = manualDots[clickedDotIndex];
        
        // Remove the dot from the array
        setManualDots(prev => prev.filter((_, index) => index !== clickedDotIndex));
        
        // Update counts in result
        setResult(prev => {
          const newResult = { ...prev };
          if (dotToRemove.type === 'parking') {
            newResult.total_parking = Math.max(0, newResult.total_parking - 1);
          } else if (dotToRemove.type === 'handicap') {
            newResult.total_handicap = Math.max(0, newResult.total_handicap - 1);
          } else if (dotToRemove.type === 'crosswalk') {
            newResult.total_crosswalks = Math.max(0, newResult.total_crosswalks - 1);
          }
          return newResult;
        });
        
        toast({
          title: "Marker removed",
          description: `Removed ${dotToRemove.type} marker`,
        });
        
        return;
      }
      
      // If no manual dot was found, check if we should add an auto-detected dot deletion
      // Auto-detected dots from AI can't be deleted by removing them from an array since they're
      // part of the processed image. Instead, we'll add a "deletion marker" at this position.
      // This marker is a manual dot with the same type but a "deleted" flag, which will
      // effectively remove the AI-detected dot from the counts
      
      // We'll create a new manual dot of the type based on the click position with a special deleted flag.
      // First, let's identify what kind of dot might be at this position based on proximity to colors
      
      // Get pixel color at click position
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Get an extremely precise sampling area, just at the center of the dot
      // More precise detection that only finds dots when clicking directly on their center
      const aiDotRadius = 4; // This matches our visual dot size
      const sampleSize = aiDotRadius; // Sample area covering only the center of the dot
      
      // Get pixel colors in a very small area centered exactly where the user clicked
      // This makes detection extremely precise, requiring nearly exact center clicks
      const imageData = ctx.getImageData(
        Math.max(0, x-Math.floor(sampleSize/2)), 
        Math.max(0, y-Math.floor(sampleSize/2)), 
        sampleSize, 
        sampleSize
      ); 
      const pixels = imageData.data;
      
      // Count green, blue, and yellow pixels in the sampled region
      let greenCount = 0; 
      let blueCount = 0;
      let yellowCount = 0;
      
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        
        // Strict color detection that only catches AI-detected dots when clicked directly
        // Green dots (parking spaces)
        if (g > 100 && g > 1.5*r && g > 1.5*b) greenCount++;
        
        // Blue dots (handicap spaces)
        if (b > 100 && b > 1.5*r && b > 1.5*g) blueCount++;
        
        // Yellow dots (crosswalks)
        if (r > 150 && g > 150 && b < 100 && (r+g) > 2.5*b) yellowCount++;
      }
      
      // Determine if we clicked on an AI dot based on color presence
      // Higher threshold relative to the smaller sample area ensures we need a direct hit
      // Lower threshold means less pixels need to match (more precise clicking required)
      const threshold = 2; // Require at least 2 pixels to match - extremely precise click required
      let dotType: 'parking' | 'handicap' | 'crosswalk' | null = null;
      
      if (greenCount > threshold && greenCount >= blueCount && greenCount >= yellowCount) {
        dotType = 'parking';
      } else if (blueCount > threshold && blueCount >= greenCount && blueCount >= yellowCount) {
        dotType = 'handicap';
      } else if (yellowCount > threshold && yellowCount >= greenCount && yellowCount >= blueCount) {
        dotType = 'crosswalk';
      }
      
      // If we detected an AI dot, subtract it from the counts
      if (dotType) {
        // Add a manual dot with this type and position (acts as a marker for the deleted AI dot)
        const deletedDot = {
          type: dotType,
          x,
          y,
          isDeleted: true // Custom flag to mark this as a deletion, not an addition
        };
        
        // Add this deletion marker to our manual dots array
        setManualDots(prev => [...prev, deletedDot]);
        
        // Update counts by subtracting this dot
        setResult(prev => {
          const newResult = { ...prev };
          if (dotType === 'parking') {
            newResult.total_parking = Math.max(0, newResult.total_parking - 1);
          } else if (dotType === 'handicap') {
            newResult.total_handicap = Math.max(0, newResult.total_handicap - 1);
          } else if (dotType === 'crosswalk') {
            newResult.total_crosswalks = Math.max(0, newResult.total_crosswalks - 1);
          }
          return newResult;
        });
        
        toast({
          title: "Marker removed",
          description: `Removed ${dotType} marker`,
        });
        
        return;
      }
    }
    
    // If in manual placement mode and not removing a dot, add a new dot
    if (isManualMode) {
      // Add new dot
      setManualDots(prev => [
        ...prev, 
        { 
          type: selectedPlacementType,
          x,
          y
        }
      ]);
      
      // Update counts in result
      setResult(prev => {
        const newResult = { ...prev };
        if (selectedPlacementType === 'parking') {
          newResult.total_parking += 1;
        } else if (selectedPlacementType === 'handicap') {
          newResult.total_handicap += 1;
        } else if (selectedPlacementType === 'crosswalk') {
          newResult.total_crosswalks += 1;
        }
        return newResult;
      });
      
      toast({
        title: "Marker added",
        description: `Added ${selectedPlacementType} marker at position (${Math.round(x)}, ${Math.round(y)})`,
      });
      
      // Redraw the canvas with the new dot (this will happen automatically via useEffect)
      return;
    }

    // If we're in space counter mode and got here, check if we clicked within a polygon
    completedPolygons.forEach((polygon, index) => {
      if (isPointInPolygon({ x, y }, polygon.points)) {
        setSelectedProcessedPolygon(index);
      }
    });
  };

  // Function to draw the processed image canvas with polygons and dots
  const drawProcessedImageCanvas = () => {
    const canvas = processedImageCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the original map image as background first
    if (processedImageId) {
      const hiddenImg = document.getElementById('processed-image') as HTMLImageElement;
      if (hiddenImg && hiddenImg.complete && hiddenImg.naturalWidth > 0) {
        console.log('Drawing original map as background before adding markers');
        ctx.drawImage(hiddenImg, 0, 0, canvas.width, canvas.height);
      } else {
        // If hidden image isn't available yet, create one
        const imgSrc = processedImageId.startsWith('data:') ? processedImageId : `/${processedImageId}`;
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Redraw all elements after background is loaded
          setTimeout(drawProcessedImageCanvas, 50);
        };
        img.src = imgSrc;
        if (!document.getElementById('processed-image')) {
          img.id = 'processed-image';
          img.style.display = 'none';
          document.body.appendChild(img);
        }
      }
    }
    
    // Draw the polygons for area mode
    if (mode === 'area') {
      // Draw the polygons after the image is loaded
      drawProcessedImagePolygons();
    }
    
    // Draw all measurement lines
    lines.forEach(line => {
      // Set color based on line.color
      let lineColor;
      switch(line.color) {
        case 'red':
          lineColor = '#FF0000';
          break;
        case 'yellow':
          lineColor = '#FFFF00';
          break;
        case 'white':
          lineColor = '#FFFFFF';
          break;
        default:
          lineColor = '#FF0000'; // Default to red
      }
      
      // Draw the line
      ctx.beginPath();
      ctx.moveTo(line.startX, line.startY);
      ctx.lineTo(line.endX, line.endY);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // Dashed line
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash pattern
      
      // Draw endpoints
      ctx.beginPath();
      ctx.arc(line.startX, line.startY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = lineColor;
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(line.endX, line.endY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = lineColor;
      ctx.fill();
      
      // Add measurement text
      ctx.font = '12px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      
      // Position text in the middle of the line
      const textX = (line.startX + line.endX) / 2;
      const textY = (line.startY + line.endY) / 2;
      const text = `${line.lengthFt} ft`;
      
      // Add white outline to text for better visibility
      ctx.strokeText(text, textX, textY);
      ctx.fillText(text, textX, textY);
    });
    
    // Draw current line being drawn
    if (currentLine && 'startX' in currentLine && 'startY' in currentLine && 'endX' in currentLine && 'endY' in currentLine) {
      // Set color based on selectedLineColor
      let lineColor;
      switch(selectedLineColor) {
        case 'red':
          lineColor = '#FF0000';
          break;
        case 'yellow':
          lineColor = '#FFFF00';
          break;
        case 'white':
          lineColor = '#FFFFFF';
          break;
        default:
          lineColor = '#FF0000'; // Default to red
      }
      
      ctx.beginPath();
      ctx.moveTo(currentLine.startX, currentLine.startY);
      ctx.lineTo(currentLine.endX, currentLine.endY);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // Dashed line
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash pattern
      
      // Draw start point
      ctx.beginPath();
      ctx.arc(currentLine.startX, currentLine.startY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = lineColor;
      ctx.fill();
    }
    
    // Draw all manual dots (for space counter mode)
    manualDots.forEach(dot => {
      // If this is a deleted dot marker, just skip drawing it
      // This way AI dots are effectively "removed" by simply not drawing anything
      if (dot.isDeleted) {
        return;
      }
      
      // Draw a normal dot
      ctx.beginPath();
      
      // Use the same radius for both AI and manual dots
      const dotRadius = 4;
      ctx.arc(dot.x, dot.y, dotRadius, 0, 2 * Math.PI);
      
      // Set color based on dot type
      switch(dot.type) {
        case 'parking':
          ctx.fillStyle = "#00FF00"; // Green
          break;
        case 'handicap':
          ctx.fillStyle = "#0000FF"; // Blue
          break;
        case 'crosswalk':
          ctx.fillStyle = "#FFFF00"; // Yellow
          break;
      }
      
      ctx.fill();
      
      // Add a border for manually placed dots only
      // AI-detected dots don't get a border
      if (!dot.isAIDetected) {
        ctx.strokeStyle = "#FFFFFF"; // White border for manual dots
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  };

  // Reset all manual dots
  const resetManualDots = () => {
    // Deduct manual dots from results - we need to count both regular dots and deleted dots
    let parkingAdded = 0, parkingDeleted = 0;
    let handicapAdded = 0, handicapDeleted = 0;
    let crosswalkAdded = 0, crosswalkDeleted = 0;
    
    manualDots.forEach(dot => {
      if (dot.isDeleted) {
        // For deleted dots (which subtract from the count), we need to add them back
        if (dot.type === 'parking') parkingDeleted++;
        else if (dot.type === 'handicap') handicapDeleted++;
        else if (dot.type === 'crosswalk') crosswalkDeleted++;
      } else {
        // For regular added dots, we need to subtract them
        if (dot.type === 'parking') parkingAdded++;
        else if (dot.type === 'handicap') handicapAdded++;
        else if (dot.type === 'crosswalk') crosswalkAdded++;
      }
    });
    
    // Clear all dots
    setManualDots([]);
    
    // Adjust the counts - adding back deleted ones, removing added ones
    setResult(prev => ({
      ...prev,
      total_parking: prev.total_parking - parkingAdded + parkingDeleted,
      total_handicap: prev.total_handicap - handicapAdded + handicapDeleted,
      total_crosswalks: prev.total_crosswalks - crosswalkAdded + crosswalkDeleted
    }));
    
    // Turn off manual placement mode
    setIsManualMode(false);
    
    toast({
      title: "Manual markers cleared",
      description: "All manually placed and deleted markers have been reset",
    });
  };

  useEffect(() => {
    if (processedImageId && processedImageCanvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = processedImageCanvasRef.current;
        if (canvas) {
          canvas.width = img.width;
          canvas.height = img.height;
          drawProcessedImageCanvas();
        }
      };
      // Handle both data URIs (for area mode) and file paths (for space counter mode)
      img.src = processedImageId.startsWith('data:') 
        ? processedImageId 
        : `/${processedImageId}`;
    }
  }, [processedImageId, completedPolygons, selectedProcessedPolygon, manualDots, lines, currentLine, isDrawingLine]);



  // Estimate Progress Component (works for both free quote and contractor modes)
  const EstimateProgressGuide = () => {
    // Only show after an address has been entered
    if (!address) return null;
    
    // Different steps based on the selected mode
    const spaceCounterSteps = [
      {
        number: 1,
        title: "Capture Map View",
        description: "First, click the 'Capture Map View' button to take a snapshot of the current map area."
      },
      {
        number: 2,
        title: "Draw Polygon(s)",
        description: "Draw a polygon around the parking lot area you would like to analyze."
      },
      {
        number: 3,
        title: "Detect Parking Spaces",
        description: "Click 'Detect Parking Spaces' to automatically identify parking spaces in your selected area."
      },
      {
        number: 4,
        title: "Add Manual Adjustments",
        description: "Add or adjust dots as needed for parking spaces, handicap spots, or crosswalks."
      },
      {
        number: 5,
        title: "Generate " + (inFreeQuoteMode ? "Quote" : "Invoice"),
        description: "Click 'Generate " + (inFreeQuoteMode ? "Quote" : "Invoice") + "' to see LotQuote pricing based on the detected features."
      }
    ];
    
    const surfaceAreaSteps = [
      {
        number: 1,
        title: "Capture Map View",
        description: "First, click the 'Capture Map View' button to take a snapshot of the current map area."
      },
      {
        number: 2,
        title: "Draw Polygon(s)",
        description: "Draw polygons to outline the areas you need measured for surface treatment."
      },
      {
        number: 3,
        title: "Calculate Area",
        description: "The total surface area will be automatically calculated in square feet and square yards."
      },
      {
        number: 4,
        title: "Review Measurements",
        description: "Verify the calculated area matches your needs. Adjust polygons if necessary."
      },
      {
        number: 5,
        title: "Generate " + (inFreeQuoteMode ? "Quote" : "Invoice"),
        description: "Click 'Generate " + (inFreeQuoteMode ? "Quote" : "Invoice") + "' to receive pricing based on the measured surface area."
      }
    ];
    
    // Select steps based on current mode
    const steps = mode === 'area' ? surfaceAreaSteps : spaceCounterSteps;
    
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 border">
        <h3 className="font-semibold text-lg mb-3 text-center bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
          LotQuote Estimate Progress
        </h3>
        <div className="space-y-2">
          {steps.map((step) => (
            <div 
              key={step.number} 
              className={`flex items-start gap-2 p-2 rounded-md transition-colors ${
                currentQuoteStep === step.number 
                  ? "bg-orange-100 border border-orange-200" 
                  : currentQuoteStep > step.number 
                    ? "opacity-75 bg-green-50 border border-green-100" 
                    : ""
              }`}
            >
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                currentQuoteStep === step.number 
                  ? "bg-gradient-to-r from-orange-500 to-red-600 text-white" 
                  : currentQuoteStep > step.number 
                    ? "bg-green-500 text-white" 
                    : "bg-gray-200 text-gray-700"
              }`}>
                {currentQuoteStep > step.number ? "✓" : step.number}
              </div>
              <div>
                <h4 className="text-sm font-medium">{step.title}</h4>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-200 text-center">
          <p className="text-xs text-muted-foreground">
            {currentQuoteStep === 5 
              ? `Almost done! Click 'Generate ${inFreeQuoteMode ? "Quote" : "Invoice"}' to see your LotQuote pricing.` 
              : `You are on step ${currentQuoteStep} of 5`}
          </p>
        </div>
      </div>
    );
  };

  // Main component render
  // This is the main return statement for the entire MapView component
  // It needs to be part of the original MapView function, not a standalone statement
  return (
    <div className="min-h-screen">
      <Header />
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">Location Details</h1>
            <p className="text-muted-foreground mb-4">{address}</p>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="max-w-4xl">
                <AddressSearch variant="location" onAddressSelect={updateMap} initialValue="" />
              </div>
              
              {/* Mode Toggle Selector */}
              <div className="flex items-center space-x-3">
                <div className="text-sm font-medium">Analysis Mode:</div>
                <div className="flex border border-border rounded-md">
                  <button
                    className={`px-3 py-1.5 text-sm font-medium rounded-l-md transition-colors ${
                      mode === 'spaces' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setMode('spaces')}
                  >
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                        <rect width="7" height="7" x="3" y="3" rx="1" />
                        <rect width="7" height="7" x="14" y="3" rx="1" />
                        <rect width="7" height="7" x="14" y="14" rx="1" />
                        <rect width="7" height="7" x="3" y="14" rx="1" />
                      </svg>
                      Space Counter
                    </div>
                  </button>
                  <button
                    className={`px-3 py-1.5 text-sm font-medium rounded-r-md transition-colors ${
                      mode === 'area' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setMode('area')}
                  >
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                        <path d="M3 3v18h18" />
                        <path d="M3 9h18" />
                        <path d="M15 3v18" />
                      </svg>
                      Surface Area
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
            <div className="lg:col-span-2 space-y-8 relative">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg z-50">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}

              {!capturedImage && !processedImageId && (
                <div className="relative">
                  <div
                    ref={mapRef}
                    className="w-full h-[600px] rounded-lg border"
                  />
                  <div className="absolute top-6 right-6">
                    <Button
                      variant="default"
                      className="shadow-lg border-2 border-[#FF5B00]"
                      onClick={captureMapScreenshot}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Camera className="h-4 w-4 mr-2" />
                      )}
                      Capture Map View
                    </Button>
                  </div>
                </div>
              )}

              {capturedImage && !processedImageId && (
                <div className="relative">
                  <canvas
                    id="mapCanvas"
                    ref={imageCanvasRef}
                    onClick={(e) => {
                      // First check for clicks on delete buttons with highest priority
                      const canvas = imageCanvasRef.current;
                      if (!canvas) return;
                      
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      
                      const x = (e.clientX - rect.left) * scaleX;
                      const y = (e.clientY - rect.top) * scaleY;
                      
                      console.log("Canvas clicked at:", x, y);
                      
                      // ULTRA HIGH PRIORITY: Check all stored delete buttons for hits
                      // We want this to override EVERYTHING else
                      const deleteButtons = deleteButtonPositions.current;
                      console.log(`Checking ${deleteButtons.length} delete buttons`);
                      
                      for (let i = 0; i < deleteButtons.length; i++) {
                        const btn = deleteButtons[i];
                        const dist = Math.sqrt(Math.pow(x - btn.x, 2) + Math.pow(y - btn.y, 2));
                        const hitRadius = btn.radius || 15; // Use the button's specified radius
                        
                        console.log(`Button ${i} for polygon ${btn.polygonIndex}: distance=${dist.toFixed(2)}, hitRadius=${hitRadius}`);
                        
                        // If clicked on the delete button
                        if (dist <= hitRadius) {
                          console.log(`🎯 DELETE BUTTON HIT! Deleting polygon ${btn.polygonIndex}`);
                          
                          // Stop propagation and prevent default
                          e.stopPropagation();
                          e.preventDefault();
                          
                          // Delete the polygon - this is the most important part
                          try {
                            const index = btn.polygonIndex;
                            
                            // Make a copy of the array and remove the polygon at the specified index
                            const newPolygons = [...completedPolygons];
                            newPolygons.splice(index, 1);
                            
                            // This is the key part - updating state with the new array
                            setCompletedPolygons(newPolygons);
                            
                            // Clear all other interactive states
                            setSelectedPolygonIndex(null);
                            setHoveredPolygonIndex(null);
                            setDraggedPointIndex(null);
                            setIsRotating(false);
                            
                            // Force immediate canvas redraw
                            setTimeout(() => {
                              drawCanvas();
                              console.log("Polygon deleted, canvas redrawn");
                            }, 10);
                            
                            // Let the user know it worked
                            toast({
                              title: "Polygon Deleted",
                              description: `Polygon has been deleted`,
                              variant: "default",
                            });
                          } catch (error) {
                            console.error("Error directly deleting polygon:", error);
                          }
                          
                          // IMPORTANT: Return to stop event propagation
                          return;
                        }
                      }
                      
                      // If no delete button was hit, proceed with normal click handling
                      handleImageClick(e);
                    }}
                    onDoubleClick={handleDoubleClick}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onContextMenu={(e) => {
                      // Prevent browser context menu
                      e.preventDefault();
                      // Log right-click events for debugging
                      console.log("Right-click detected");
                      // Let our handlers work with left-click instead
                      return false;
                    }}
                    className="w-full h-[600px] rounded-lg border cursor-crosshair"
                    style={{
                      backgroundImage: `url(${capturedImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="absolute top-6 right-6 space-x-2">
                    <Button
                      variant="default"
                      className="shadow-lg border-2 border-[#FF5B00]"
                      onClick={processImage}
                      disabled={isLoading || completedPolygons.length === 0 || (user?.paymentPlan === 'free' && addressUsageLimit?.canUseMoreAddresses === false)}
                      title={user?.paymentPlan === 'free' && addressUsageLimit?.canUseMoreAddresses === false ? 'You have reached your monthly limit of free addresses' : ''}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : mode === 'area' ? (
                        <>Calculate Area</>
                      ) : (
                        <>Detect Parking Spaces</>
                      )}
                    </Button>
                  </div>
                  <div className="mt-4 space-y-4">
                    <div className="p-4 bg-background/90 rounded-lg border">
                      <p className="text-sm">
                        {mode === 'area' 
                          ? 'Draw polygons to measure surface area. The total area will be calculated in both square feet and square yards.'
                          : 'Draw polygons to identify parking spaces. Our system will detect parking spaces, handicap spots, and crosswalks.'
                        }
                        <br/>
                        Click and drag to create a custom-sized polygon.
                        Drag any polygon corner to resize it or the entire polygon to move it.
                        Double-click or press Enter to finish editing.
                      </p>
                      <p className="text-sm mt-2">
                        Completed polygons: {completedPolygons.length}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {processedImageId && (
                <div className="relative">
                  <div className="relative w-full h-[600px]">
                    <img
                      src={processedImageId.startsWith('data:') ? processedImageId : `/${processedImageId}`}
                      alt="Processed image with detected objects"
                      className="absolute inset-0 w-full h-full rounded-lg border object-cover"
                    />
                    <canvas
                      id="mapCanvas"
                      ref={processedImageCanvasRef}
                      onClick={handleProcessedImageClick}
                      className={`absolute inset-0 w-full h-full ${isManualMode ? "cursor-crosshair" : "cursor-pointer"}`}
                    />
                    {selectedProcessedPolygon !== null && (
                      <div className="absolute top-4 right-4 bg-background/90 p-4 rounded-lg border shadow-lg">
                        <h3 className="text-sm font-medium mb-2">Polygon {selectedProcessedPolygon + 1} Selected</h3>
                        {mode === 'area' ? (
                          // For Surface Area mode - show area calculation
                          <div className="space-y-1">
                            {completedPolygons[selectedProcessedPolygon] && (
                              <>
                                <p className="text-sm">This area can be modified or adjusted</p>
                                {calculatePolygonArea(completedPolygons[selectedProcessedPolygon].points).squareFeet > 0 && (
                                  <div className="mt-2 pt-2 border-t border-border">
                                    <p className="text-sm">Estimated area:</p>
                                    <p className="text-sm font-medium">{calculatePolygonArea(completedPolygons[selectedProcessedPolygon].points).squareFeet.toLocaleString()} sq ft</p>
                                    <p className="text-sm font-medium">{calculatePolygonArea(completedPolygons[selectedProcessedPolygon].points).squareYards.toLocaleString()} sq yd</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          // For Space Counter mode - show counts
                          <div className="space-y-1">
                            {polygonCounts[selectedProcessedPolygon] && (
                              <>
                                <p className="text-sm">Parking Spaces: {polygonCounts[selectedProcessedPolygon].parking}</p>
                                <p className="text-sm">Crosswalks: {polygonCounts[selectedProcessedPolygon].crosswalks}</p>
                                <p className="text-sm">Handicap Spots: {polygonCounts[selectedProcessedPolygon].handicap}</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">
                      Processing ID: {processedImageUniqueId}
                    </p>
                    
                    {mode === 'area' ? (
                      // Surface Area Counter results
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <p className="text-sm font-medium">Total Area (sq ft)</p>
                          <p className="text-2xl font-bold">{result.total_area_sqft?.toLocaleString() || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Total Area (sq yd)</p>
                          <p className="text-2xl font-bold">{result.total_area_sqyd?.toLocaleString() || 0}</p>
                        </div>
                      </div>
                    ) : (
                      // Space Counter results
                      <div className="grid grid-cols-3 gap-4 mt-2">
                        <div>
                          <p className="text-sm font-medium">Parking Spaces</p>
                          <p className="text-2xl font-bold">{result.total_parking}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Crosswalks</p>
                          <p className="text-2xl font-bold">{result.total_crosswalks}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Handicap Spots</p>
                          <p className="text-2xl font-bold">{result.total_handicap}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Manual placement controls (dots and lines) - only show in Space Counter mode */}
                    {mode !== 'area' && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-medium">Manual Placement Tools</h3>
                          <div className="flex items-center space-x-2">
                            <Select
                              value={selectedPlacementType}
                              onValueChange={(value: 'parking' | 'handicap' | 'crosswalk' | 'line') => {
                                setSelectedPlacementType(value);
                                // If switching to line mode, exit manual mode
                                if (value === 'line' && isManualMode) {
                                  setIsManualMode(false);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 w-[100px]">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="parking">Parking</SelectItem>
                                <SelectItem value="handicap">Handicap</SelectItem>
                                <SelectItem value="crosswalk">Crosswalk</SelectItem>
                                <SelectItem value="line">Linear Ft</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            {/* Line color selector - only show when line type is selected */}
                            {selectedPlacementType === 'line' && (
                              <Select
                                value={selectedLineColor}
                                onValueChange={(value: 'red' | 'yellow' | 'white') => {
                                  setSelectedLineColor(value);
                                }}
                              >
                                <SelectTrigger className="h-8 w-[90px]">
                                  <SelectValue placeholder="Color" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="red">Red</SelectItem>
                                  <SelectItem value="yellow">Yellow</SelectItem>
                                  <SelectItem value="white">White</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            
                            <Button 
                              variant={isManualMode || isDrawingLine ? "default" : "outline"} 
                              size="sm"
                              onClick={() => {
                                // Toggle based on selected placement type
                                if (selectedPlacementType === 'line') {
                                  // Toggle line drawing mode
                                  setIsDrawingLine(!isDrawingLine);
                                  setIsManualMode(false); // Exit manual mode
                                  
                                  if (!isDrawingLine) {
                                    toast({
                                      title: "Line Measurement Mode",
                                      description: "Click and drag to draw lines. The length will be measured in feet.",
                                    });
                                  }
                                } else {
                                  // Toggle manual placement mode
                                  const newMode = !isManualMode;
                                  setIsManualMode(newMode);
                                  setIsDrawingLine(false); // Exit line drawing mode
                                  
                                  // In any mode, when enabling manual mode, ensure we're at step 4
                                  if (newMode) {
                                    setCurrentQuoteStep(4);
                                    toast({
                                      title: "Manual Placement Mode",
                                      description: "Click on the image to add points. Shift+Click to remove.",
                                    });
                                  }
                                }
                              }}
                            >
                              {selectedPlacementType === 'line' ? (
                                isDrawingLine ? (
                                  <>
                                    <MousePointer className="h-4 w-4 mr-2" />
                                    Exit Line Mode
                                  </>
                                ) : (
                                  <>
                                    <Ruler className="h-4 w-4 mr-2" />
                                    Draw Lines
                                  </>
                                )
                              ) : isManualMode ? (
                                <>
                                  <MousePointer className="h-4 w-4 mr-2" />
                                  Exit Manual Mode
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Manual Placement
                                </>
                              )}
                            </Button>
                            
                            {manualDots.length > 0 && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={resetManualDots}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear Markers
                              </Button>
                            )}
                            
                            {lines.length > 0 && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  setLines([]);
                                  toast({
                                    title: "Lines cleared",
                                    description: "All measurement lines have been removed"
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear Lines
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {isManualMode && (
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <Button
                              variant={selectedPlacementType === 'parking' ? "default" : "outline"}
                              className="flex items-center justify-center"
                              onClick={() => setSelectedPlacementType('parking')}
                            >
                              <Circle className="h-4 w-4 mr-2 text-green-500" fill="#00FF00" />
                              Parking
                            </Button>
                            <Button
                              variant={selectedPlacementType === 'handicap' ? "default" : "outline"}
                              className="flex items-center justify-center"
                              onClick={() => setSelectedPlacementType('handicap')}
                            >
                              <Circle className="h-4 w-4 mr-2 text-blue-500" fill="#0000FF" />
                              Handicap
                            </Button>
                            <Button
                              variant={selectedPlacementType === 'crosswalk' ? "default" : "outline"}
                              className="flex items-center justify-center"
                              onClick={() => setSelectedPlacementType('crosswalk')}
                            >
                              <Circle className="h-4 w-4 mr-2 text-yellow-500" fill="#FFFF00" />
                              Crosswalk
                            </Button>
                          </div>
                        )}
                        
                        {isManualMode && (
                          <p className="text-sm text-muted-foreground mb-4">
                            Click anywhere on the image to place a {selectedPlacementType} marker. 
                            The total count will be updated automatically.
                          </p>
                        )}
                        
                        {isDrawingLine && (
                          <p className="text-sm text-muted-foreground mb-4">
                            Click and drag to measure linear distances. The measurements will appear in feet.
                            Click the "Clear Lines" button to remove all measurements.
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* In Surface Area mode, show helpful text about polygons */}
                    {mode === 'area' && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-medium">Surface Area Adjustment</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Click on any polygon to select it. This will allow you to see its specific area measurements.
                          The total area calculation includes all polygons drawn.
                        </p>
                      </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t border-border flex justify-between">
                      <Button
                        variant="outline"
                        className="border-2 border-[#FF5B00]"
                        onClick={resetView}
                        disabled={isLoading}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset View
                      </Button>
                      
                      <Button 
                        className="border-2 border-[#FF5B00]"
                        onClick={() => {
                          // Always advance to step 5 when generating quote/invoice
                          setCurrentQuoteStep(5);
                          
                          // Capture the current state of the canvas with all markings
                          const canvasWithMarkings = captureCanvasWithMarkings();
                          
                          // Store this in a hidden element that we can access later
                          const markedCanvasImg = document.getElementById('marked-canvas-image') as HTMLImageElement;
                          if (markedCanvasImg) {
                            markedCanvasImg.src = canvasWithMarkings;
                          } else {
                            // Create the element if it doesn't exist
                            const img = document.createElement('img');
                            img.id = 'marked-canvas-image';
                            img.style.display = 'none'; // Hide it
                            img.src = canvasWithMarkings;
                            document.body.appendChild(img);
                          }
                          
                          if (inFreeQuoteMode) {
                            setShowQuoteDialog(true);
                          } else {
                            setShowInvoiceDialog(true);
                          }
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {inFreeQuoteMode ? "Generate Quote" : "Generate Invoice"}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Invoice Dialog */}
                  <InvoiceDialog
                    open={showInvoiceDialog}
                    onOpenChange={setShowInvoiceDialog}
                    parkingSpaces={result.total_parking}
                    handicapSpots={result.total_handicap}
                    crosswalks={result.total_crosswalks}
                    arrows={inFreeQuoteMode ? 0 : Math.round(result.total_parking * 0.2)} // Default to 0 for free quotespaces
                    linearFeet={calculateTotalLinearFeet()} // Calculate total linear feet
                    address={address}
                    processedImageId={mode === 'area' ? processedImageId : processedImageUniqueId || ''}
                    surfaceArea={mode === 'area' ? result.total_area_sqft : undefined}
                    surfaceAreaSqYd={mode === 'area' ? result.total_area_sqyd : undefined}
                    mode={mode}
                    userPaymentPlan={user?.paymentPlan || 'free'}
                  />
                  
                  {/* Quote Dialog for Free Quote Mode */}
                  <QuoteDialog
                    open={showQuoteDialog}
                    onOpenChange={setShowQuoteDialog}
                    parkingSpaces={result.total_parking}
                    handicapSpots={result.total_handicap}
                    crosswalks={result.total_crosswalks}
                    arrows={0} // Default arrows to 0 for free quote
                    linearFeet={calculateTotalLinearFeet()} // Use the same function we use for InvoiceDialog
                    surfaceArea={result.total_area_sqft}
                    address={address}
                    mode={mode}
                    processedImageId={mode === 'area' ? processedImageId : processedImageUniqueId || ''}
                  />
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Estimate Progress Guide - shown for both free quote and contractor modes */}
              {address && <EstimateProgressGuide />}
              
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">
                  {mode === 'area' ? 'Calculate Surface Area' : 'Count Parking Spaces'}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {mode === 'area' 
                    ? 'Draw polygons to calculate the total surface area for asphalt, concrete, or other surface work. Results are shown in both square feet and square yards.'
                    : 'Our system will analyze the satellite imagery and count parking spaces, handicap spots, and crosswalks within your defined areas.'
                  }
                </p>
                <div className="space-y-2">
                  <div className="flex gap-2 mb-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-2 border-[#FF5B00]"
                      onClick={resetView}
                      disabled={isLoading}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset View
                    </Button>
                    {user && (
                      <Button
                        variant="outline"
                        className="flex-1 border-2 border-blue-500"
                        onClick={() => window.location.href = '/history'}
                        disabled={isLoading}
                      >
                        <History className="h-4 w-4 mr-2" />
                        History
                      </Button>
                    )}
                  </div>
                </div>
              </Card>


            </div>
          </div>
        </div>
      </div>
      <Footer />
      
      {/* Address Usage Limit Exceeded Dialog */}
      <AlertDialog open={showLimitExceededDialog} onOpenChange={setShowLimitExceededDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="text-red-500 h-5 w-5" />
              Address Limit Reached
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-4">
                You've reached your limit of {addressUsageLimit?.limit || 3} addresses per month on the free plan. 
                This helps us maintain the quality of our service.
              </p>
              <p className="mb-4 text-sm bg-blue-50 border border-blue-100 text-blue-700 p-3 rounded-md">
                <strong>Note:</strong> You can still view and modify your previously analyzed addresses through your history page.
                Use the "View History" button below to access your previously analyzed addresses.
              </p>
              <div className="bg-muted p-3 rounded-md mb-4">
                <p className="font-medium mb-1">Your current usage:</p>
                <p className="text-sm flex justify-between">
                  <span>Addresses used this month:</span> 
                  <span className="font-medium">{addressUsageLimit?.usageCount || 0}</span>
                </p>
                <p className="text-sm flex justify-between">
                  <span>Monthly limit:</span> 
                  <span className="font-medium">{addressUsageLimit?.limit || 3}</span>
                </p>
              </div>
              <p className="mb-2">
                You can continue working with your current address, view your previous analyses in history, or upgrade to our Pro or Enterprise plan for unlimited addresses.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto border-blue-500 text-blue-600 hover:bg-blue-50"
              onClick={() => {
                window.location.href = '/history';
              }}
            >
              <History className="mr-2 h-4 w-4" />
              View History
            </Button>
            <div className="flex-1 flex gap-2">
              <AlertDialogCancel className="flex-1">Continue with Current</AlertDialogCancel>
              <AlertDialogAction 
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                onClick={() => {
                  window.location.href = '/payment-plan';
                }}
              >
                Upgrade Plan
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}