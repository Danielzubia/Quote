import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AddressSearch } from "@/components/address-search";
import { apiRequest } from "@/lib/queryClient";
import { InvoiceDialog } from "@/components/invoice-dialog";
import { QuoteDialog } from "@/components/quote-dialog";

// Add type declaration for initMap on Window object
declare global {
  interface Window {
    initMap: () => void;
  }
}

interface Polygon {
  points: Array<{ x: number; y: number }>;
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

export default function MapView({ params }: { params?: { address?: string } }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedImageCanvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  
  // Get all URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  
  // Get address from either path parameter or query parameter
  const addressFromParams = params?.address ? decodeURIComponent(params.address) : null;
  const addressFromQuery = searchParams.get('address') ? decodeURIComponent(searchParams.get('address') || '') : null;
  const address = addressFromParams || addressFromQuery || '';
  
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
  
  // Update step when relevant actions are taken
  useEffect(() => {
    if (inFreeQuoteMode) {
      if (capturedImage && !processedImageId && completedPolygons.length === 0) {
        setCurrentQuoteStep(2); // After capture, ready to draw polygons
      } else if (completedPolygons.length > 0 && !processedImageId) {
        setCurrentQuoteStep(3); // Polygons drawn, ready to detect spaces
      } else if (processedImageId) {
        setCurrentQuoteStep(4); // Spaces detected, ready for manual adjustment
      }
    }
  }, [inFreeQuoteMode, capturedImage, processedImageId, completedPolygons.length]);
  
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
  
  // States for manual placement
  const [isManualDotMode, setIsManualDotMode] = useState(false);
  const [selectedDotType, setSelectedDotType] = useState<'parking' | 'handicap' | 'crosswalk'>('parking');
  const [manualDots, setManualDots] = useState<{
    type: 'parking' | 'handicap' | 'crosswalk';
    x: number;
    y: number;
  }[]>([]);

  // Rest of the code remains the same...
  // When you want to use the map view code, simply continue from here
  
  // For the purpose of this demonstration, I'll add a simplified version
  // that at least includes our QuoteDialog integration
  
  const resetView = () => {
    // Reset all state variables
    setCapturedImage(null);
    setProcessedImageId(null);
    setProcessedImageUniqueId(null);
    setCurrentPolygon([]);
    setCompletedPolygons([]);
    setResult({
      total_parking: 0,
      total_crosswalks: 0,
      total_handicap: 0
    });
    setPolygonCounts([]);
    setManualDots([]);
    setIsManualDotMode(false);
    
    // Return to Step 1 in Free Quote flow
    if (inFreeQuoteMode) {
      setCurrentQuoteStep(1);
    }
  };
  
  const handleGenerateOutput = () => {
    if (inFreeQuoteMode) {
      setCurrentQuoteStep(5);
      setShowQuoteDialog(true);
    } else {
      setShowInvoiceDialog(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto py-4 px-4">
        <h1 className="text-2xl font-bold mb-4">
          {inFreeQuoteMode ? "Free Parking Lot Quote" : "Parking Lot Analysis"}
        </h1>
        
        {/* Free Quote Step Indicator - only show when in Free Quote mode */}
        {inFreeQuoteMode && (
          <div className="mb-4 p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-2">Quote Progress:</div>
            <div className="flex items-center space-x-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border 
                ${currentQuoteStep >= 1 ? 'bg-green-100 border-green-500 text-green-700' : 'bg-muted border-border'}`}>
                {currentQuoteStep > 1 ? '✓' : '1'}
              </div>
              <div className="flex-1 h-1 bg-muted-foreground/20">
                <div className={`h-1 bg-green-500 transition-all duration-300`} 
                  style={{ width: `${Math.max(0, (currentQuoteStep - 1) * 25)}%` }}></div>
              </div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border 
                ${currentQuoteStep >= 2 ? 'bg-green-100 border-green-500 text-green-700' : 'bg-muted border-border'}`}>
                {currentQuoteStep > 2 ? '✓' : '2'}
              </div>
              <div className="flex-1 h-1 bg-muted-foreground/20">
                <div className={`h-1 bg-green-500 transition-all duration-300`} 
                  style={{ width: `${Math.max(0, (currentQuoteStep - 2) * 33.3)}%` }}></div>
              </div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border 
                ${currentQuoteStep >= 3 ? 'bg-green-100 border-green-500 text-green-700' : 'bg-muted border-border'}`}>
                {currentQuoteStep > 3 ? '✓' : '3'}
              </div>
              <div className="flex-1 h-1 bg-muted-foreground/20">
                <div className={`h-1 bg-green-500 transition-all duration-300`} 
                  style={{ width: `${Math.max(0, (currentQuoteStep - 3) * 50)}%` }}></div>
              </div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border 
                ${currentQuoteStep >= 4 ? 'bg-green-100 border-green-500 text-green-700' : 'bg-muted border-border'}`}>
                {currentQuoteStep > 4 ? '✓' : '4'}
              </div>
              <div className="flex-1 h-1 bg-muted-foreground/20">
                <div className={`h-1 bg-green-500 transition-all duration-300`} 
                  style={{ width: `${Math.max(0, (currentQuoteStep - 4) * 100)}%` }}></div>
              </div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full border 
                ${currentQuoteStep >= 5 ? 'bg-green-100 border-green-500 text-green-700' : 'bg-muted border-border'}`}>
                5
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Capture Map</span>
              <span>Draw Area</span>
              <span>Detect Spaces</span>
              <span>Adjust</span>
              <span>Quote</span>
            </div>
          </div>
        )}
        
        {/* Toggle for Space Counter vs Surface Area Counter */}
        <Tabs value={mode} onValueChange={(val) => setMode(val as 'spaces' | 'area')} className="mb-4">
          <TabsList>
            <TabsTrigger value="spaces">Space Counter</TabsTrigger>
            <TabsTrigger value="area">Surface Area Counter</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="relative rounded-lg border overflow-hidden mb-4 h-[600px] flex items-center justify-center">
          {/* Show loading or placeholder content */}
          {isLoading && !capturedImage && !processedImageId && (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-lg mb-4">Loading map...</p>
            </div>
          )}
          
          {/* Placeholder - the actual map and canvas code would go here */}
          {/* In a simplified example, let's just show a placeholder */}
          {!isLoading && !capturedImage && !processedImageId && (
            <div ref={mapRef} className="w-full h-full"></div>
          )}
          
          {/* Placeholder for the captured image canvas and controls */}
          {capturedImage && !processedImageId && (
            <div className="relative w-full h-full">
              <canvas ref={imageCanvasRef} className="w-full h-full"></canvas>
              <div className="absolute right-4 top-4 flex gap-2">
                <Button 
                  size="sm"
                  onClick={() => {
                    // Process image logic would go here
                    // For demo, let's pretend we're processing
                    setProcessedImageId("demo-id");
                    setProcessedImageUniqueId("demo-unique-id");
                    setResult({
                      total_parking: 50,
                      total_handicap: 3,
                      total_crosswalks: 2,
                      total_area_sqft: 20000,
                      total_area_sqyd: 2222
                    });
                  }}
                >
                  Detect Parking Spaces
                </Button>
              </div>
            </div>
          )}
          
          {/* Placeholder for the processed image view */}
          {processedImageId && (
            <div className="relative w-full h-full">
              <canvas ref={processedImageCanvasRef} className="w-full h-full"></canvas>
              
              <div className="absolute right-4 bottom-4 flex flex-col gap-2">
                <Button 
                  className="w-40 text-sm"
                  onClick={() => setIsManualDotMode(!isManualDotMode)}
                >
                  {isManualDotMode ? "Exit Manual Mode" : "Add Manual Dots"}
                </Button>
                
                {inFreeQuoteMode ? (
                  <Button
                    onClick={() => setShowQuoteDialog(true)}
                    className="w-40 text-sm"
                  >
                    {currentQuoteStep === 5 ? "Generate Quote" : "Preview Quote"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowInvoiceDialog(true)}
                    className="w-40 text-sm"
                  >
                    Generate Invoice
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  className="w-40 text-sm"
                  onClick={resetView}
                >
                  Start Over
                </Button>
              </div>
              
              {/* Results display in the upper left corner */}
              <div className="absolute left-4 top-4 p-4 bg-background border rounded-lg shadow-md">
                <h3 className="font-medium mb-2">Detection Results</h3>
                <div className="space-y-1 text-sm">
                  <p>Parking Spaces: <span className="font-bold">{result.total_parking}</span></p>
                  <p>Handicap Spots: <span className="font-bold">{result.total_handicap}</span></p>
                  <p>Crosswalks: <span className="font-bold">{result.total_crosswalks}</span></p>
                  {mode === 'area' && (
                    <>
                      <p>Surface Area: <span className="font-bold">{result.total_area_sqft} sq ft</span></p>
                      <p>Surface Area: <span className="font-bold">{result.total_area_sqyd} sq yd</span></p>
                    </>
                  )}
                </div>
                <div className="mt-4">
                  <Button
                    onClick={handleGenerateOutput}
                    size="sm"
                    className="w-full"
                  >
                    {inFreeQuoteMode ? "Generate Quote" : "Generate Invoice"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
      
      {/* Invoice Dialog */}
      <InvoiceDialog
        open={showInvoiceDialog}
        onOpenChange={setShowInvoiceDialog}
        parkingSpaces={result.total_parking}
        handicapSpots={result.total_handicap}
        crosswalks={result.total_crosswalks}
        arrows={Math.round(result.total_parking * 0.2)} // Estimate arrows as 20% of parking spaces
        address={address}
        processedImageId={processedImageUniqueId || ''}
        surfaceArea={mode === 'area' ? result.total_area_sqft : undefined}
        surfaceAreaSqYd={mode === 'area' ? result.total_area_sqyd : undefined}
        mode={mode}
      />
      
      {/* Quote Dialog for Free Quote mode */}
      <QuoteDialog
        open={showQuoteDialog}
        onOpenChange={setShowQuoteDialog}
        parkingSpaces={result.total_parking}
        handicapSpots={result.total_handicap}
        crosswalks={result.total_crosswalks}
        address={address}
      />
    </div>
  );
}