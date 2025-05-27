import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, MapPin, Search, ArrowLeft } from "lucide-react";

interface QuoteFormProps {
  onSubmit?: (data: QuoteFormData) => void;
}

export interface QuoteFormData {
  address: string;
  newLayout: boolean;
  includeADA: boolean;
  contactName: string;
  email: string;
  phone: string;
  timestamp?: string;
  totalSpaces?: number;
  handicapSpaces?: number;
  crosswalks?: number;
  polygonScreenshot?: string; // Base64 encoded image data
  polygonCoordinates?: string; // JSON string of polygon coordinates
}

export function QuoteForm({ onSubmit }: QuoteFormProps) {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteResult, setQuoteResult] = useState<string | null>(null);
  const [showAnalysisPrompt, setShowAnalysisPrompt] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    totalSpaces: number;
    handicapSpaces: number;
    crosswalks: number;
  } | null>(null);
  const [formData, setFormData] = useState<QuoteFormData>({
    address: "",
    newLayout: false,
    includeADA: false,
    contactName: "",
    email: "",
    phone: "",
  });
  
  // Check for analysis results from URL parameters when returning from map view
  useEffect(() => {
    // Example URL with results: /quote?totalSpaces=50&handicapSpaces=5&crosswalks=2&screenshot=base64data
    const params = new URLSearchParams(window.location.search);
    const totalSpaces = params.get('totalSpaces');
    const handicapSpaces = params.get('handicapSpaces');
    const crosswalks = params.get('crosswalks');
    const address = params.get('address');
    const screenshot = params.get('screenshot');
    const polygonCoords = params.get('polygonCoords');
    
    if (totalSpaces && handicapSpaces && crosswalks) {
      const result = {
        totalSpaces: parseInt(totalSpaces, 10),
        handicapSpaces: parseInt(handicapSpaces, 10),
        crosswalks: parseInt(crosswalks, 10)
      };
      
      handleAnalysisComplete(result);
      
      // Update form data with all received information
      const updates: Partial<QuoteFormData> = {
        totalSpaces: result.totalSpaces,
        handicapSpaces: result.handicapSpaces,
        crosswalks: result.crosswalks
      };
      
      // Add address if provided
      if (address) {
        updates.address = decodeURIComponent(address);
      }
      
      // Add screenshot if provided
      if (screenshot) {
        updates.polygonScreenshot = screenshot;
      }
      
      // Add polygon coordinates if provided
      if (polygonCoords) {
        updates.polygonCoordinates = polygonCoords;
      }
      
      // Update all form data at once
      setFormData(prev => ({
        ...prev,
        ...updates
      }));
      
      // Remove params from URL to prevent duplicated processing
      window.history.replaceState({}, document.title, "/quote");
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate form
      if (!formData.address || !formData.contactName || !formData.email) {
        throw new Error("Please fill in all required fields.");
      }

      // Calculate quote based on inputs and analysis results
      const basePrice = 800; // Base price for basic service
      let quote = basePrice;
      
      // Add $300 for new layout (vs re-stripe)
      if (formData.newLayout) {
        quote += 300;
      }
      
      // Add $200 for ADA spaces
      if (formData.includeADA) {
        quote += 200;
      }
      
      // Add pricing based on analysis results if available
      if (analysisResult) {
        // $5 per regular parking space
        if (analysisResult.totalSpaces > 0) {
          quote += analysisResult.totalSpaces * 5;
        }
        
        // $20 per handicap space (additional complexity)
        if (analysisResult.handicapSpaces > 0) {
          quote += analysisResult.handicapSpaces * 20;
        }
        
        // $50 per crosswalk (more complex painting)
        if (analysisResult.crosswalks > 0) {
          quote += analysisResult.crosswalks * 50;
        }
      }
      
      // Create a price range (90% - 110% of calculated price)
      const rangeLow = Math.round(quote * 0.9);
      const rangeHigh = Math.round(quote * 1.1);
      
      // Display result exactly like the HTML version
      const resultText = `Estimated Price: $${rangeLow}–$${rangeHigh}. We'll connect you with a local pro soon!`;
      setQuoteResult(resultText);

      // Prepare lead data - matching the HTML version
      const leadData = {
        ...formData,
        timestamp: new Date().toISOString()
      };
      
      // Log lead data to console - matching the HTML version
      console.log("Sending lead:", leadData);

      // Call the onSubmit callback if provided
      if (onSubmit) {
        onSubmit(leadData);
      }

      // Show success notification
      toast({
        title: "Quote Generated",
        description: resultText,
      });

      // Don't reset the form after submission so user can see their inputs with the result
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnalysisComplete = (result: { totalSpaces: number; handicapSpaces: number; crosswalks: number }) => {
    setAnalysisResult(result);
    setFormData(prev => ({
      ...prev,
      totalSpaces: result.totalSpaces,
      handicapSpaces: result.handicapSpaces,
      crosswalks: result.crosswalks
    }));
    toast({
      title: "Analysis Complete",
      description: `We've detected ${result.totalSpaces} total spaces, ${result.handicapSpaces} handicap spots, and ${result.crosswalks} crosswalks.`
    });
  };

  return (
    <>
      <AlertDialog open={showAnalysisPrompt} onOpenChange={setShowAnalysisPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Draw Area for Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Use our polygon drawing tool to outline exactly which areas of your parking lot need 
              line striping. This will provide a precise quote and help our contractors understand your specific needs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="flex items-start space-x-2 p-3 rounded-md border hover:bg-muted/50 transition-colors">
                <MapPin className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <h4 className="font-medium">Outline your lot at this address</h4>
                  <p className="text-sm text-muted-foreground">{formData.address}</p>
                </div>
              </div>
              
              <div className="rounded-md border overflow-hidden">
                <div className="p-3 bg-muted/30">
                  <h4 className="text-sm font-medium flex items-center">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white mr-2">1</span>
                    Draw a polygon around your parking area
                  </h4>
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted-foreground">Use the drawing tool to create a polygon shape around the exact area that needs line striping.</p>
                </div>
              </div>
              
              <div className="rounded-md border overflow-hidden">
                <div className="p-3 bg-muted/30">
                  <h4 className="text-sm font-medium flex items-center">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white mr-2">2</span>
                    Automatic space detection
                  </h4>
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted-foreground">Our system will automatically count parking spaces, handicap spots, and crosswalks in your selected area.</p>
                </div>
              </div>
              
              <div className="rounded-md border overflow-hidden">
                <div className="p-3 bg-muted/30">
                  <h4 className="text-sm font-medium flex items-center">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white mr-2">3</span>
                    Screenshot included with quote
                  </h4>
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted-foreground">A screenshot of your selection will be included with your quote request so contractors know exactly which areas to price.</p>
                </div>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link 
                href={`/map?address=${encodeURIComponent(formData.address)}&mode=spaces&returnTo=quote`} 
                target="_blank"
              >
                <Button onClick={() => setShowAnalysisPrompt(false)} className="gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                    <line x1="8" y1="2" x2="8" y2="18"></line>
                    <line x1="16" y1="6" x2="16" y2="22"></line>
                  </svg>
                  Open Map & Draw Polygon
                </Button>
              </Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Get a Parking Lot Line Striping Quote</CardTitle>
          <CardDescription>
            Fill out this form to receive an instant quote for your parking lot services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Lot Address *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    id="address"
                    placeholder="Enter lot address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>
                <Button 
                  type="button"
                  variant="outline"
                  className="flex items-center gap-1"
                  onClick={() => setShowAnalysisPrompt(true)}
                  disabled={!formData.address}
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Draw Polygon</span>
                </Button>
              </div>
              {analysisResult && (
                <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm border">
                  <div className="flex items-center mb-2">
                    <div className="h-5 w-5 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center mr-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                        <path d="M20 6L9 17l-5-5"></path>
                      </svg>
                    </div>
                    <p className="font-medium">Polygon Analysis Complete</p>
                  </div>
                  
                  {formData.polygonScreenshot ? (
                    <div className="space-y-3">
                      <div className="relative w-full h-[180px] bg-muted rounded-md overflow-hidden">
                        <img 
                          src={formData.polygonScreenshot} 
                          alt="Analyzed parking area" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 right-2 bg-background/80 text-xs px-2 py-1 rounded-sm">
                          Selected Area
                        </div>
                      </div>
                      
                      <div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-background p-2 rounded border text-center">
                            <div className="text-lg font-semibold">{analysisResult.totalSpaces}</div>
                            <div className="text-xs text-muted-foreground">Parking Spaces</div>
                          </div>
                          <div className="bg-background p-2 rounded border text-center">
                            <div className="text-lg font-semibold">{analysisResult.handicapSpaces}</div>
                            <div className="text-xs text-muted-foreground">Handicap Spots</div>
                          </div>
                          <div className="bg-background p-2 rounded border text-center">
                            <div className="text-lg font-semibold">{analysisResult.crosswalks}</div>
                            <div className="text-xs text-muted-foreground">Crosswalks</div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          This map view with polygon selection will be included with your quote request 
                          so contractors know exactly which areas to price.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <span className="font-medium">Total spaces:</span> {analysisResult.totalSpaces}
                      </div>
                      <div>
                        <span className="font-medium">Handicap:</span> {analysisResult.handicapSpaces}
                      </div>
                      <div>
                        <span className="font-medium">Crosswalks:</span> {analysisResult.crosswalks}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="newLayout"
                  checked={formData.newLayout}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, newLayout: !!checked }))
                  }
                />
                <Label htmlFor="newLayout" className="cursor-pointer text-sm">
                  New Layout (vs. Re-stripe)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeADA"
                  checked={formData.includeADA}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, includeADA: !!checked }))
                  }
                />
                <Label htmlFor="includeADA" className="cursor-pointer text-sm">
                  Include ADA Spaces
                </Label>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <h4 className="text-sm font-medium mb-3">Contact Information</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Your Name *</Label>
                  <Input
                    id="contactName"
                    placeholder="Your Name"
                    value={formData.contactName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Your Email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Phone Number (optional)"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Get Instant Quote"
              )}
            </Button>
            
            {quoteResult && (
              <div id="quoteResult" className="mt-4 p-4 bg-muted rounded-lg border border-border">
                <div className="font-medium text-center mb-2">{quoteResult}</div>
                
                {analysisResult && (
                  <div className="text-sm mt-3 pt-3 border-t border-border">
                    <p className="mb-2 text-xs text-muted-foreground">Price breakdown based on your analysis:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div className="flex justify-between">
                        <span>Base price:</span>
                        <span className="font-medium">$800</span>
                      </div>
                      {formData.newLayout && (
                        <div className="flex justify-between">
                          <span>New layout:</span>
                          <span className="font-medium">+$300</span>
                        </div>
                      )}
                      {formData.includeADA && (
                        <div className="flex justify-between">
                          <span>ADA spaces:</span>
                          <span className="font-medium">+$200</span>
                        </div>
                      )}
                      {analysisResult.totalSpaces > 0 && (
                        <div className="flex justify-between">
                          <span>{analysisResult.totalSpaces} parking spaces:</span>
                          <span className="font-medium">+${analysisResult.totalSpaces * 5}</span>
                        </div>
                      )}
                      {analysisResult.handicapSpaces > 0 && (
                        <div className="flex justify-between">
                          <span>{analysisResult.handicapSpaces} handicap spaces:</span>
                          <span className="font-medium">+${analysisResult.handicapSpaces * 20}</span>
                        </div>
                      )}
                      {analysisResult.crosswalks > 0 && (
                        <div className="flex justify-between">
                          <span>{analysisResult.crosswalks} crosswalks:</span>
                          <span className="font-medium">+${analysisResult.crosswalks * 50}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </>
  );
}