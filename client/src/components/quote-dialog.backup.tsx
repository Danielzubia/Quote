import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { uploadScreenshot } from "@/utils/supabase-client";

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parkingSpaces?: number;
  handicapSpots?: number;
  crosswalks?: number;
  arrows?: number;
  surfaceArea?: number;
  address: string;
  mode?: 'spaces' | 'area';
}

export function QuoteDialog({
  open,
  onOpenChange,
  parkingSpaces: initialParkingSpaces = 0,
  handicapSpots: initialHandicapSpots = 0,
  crosswalks: initialCrosswalks = 0,
  arrows: initialArrows = 0, // This should be 0 for free quote
  surfaceArea: initialSurfaceArea = 0,
  address,
  mode = 'spaces'
}: QuoteDialogProps) {
  const [parkingSpaces, setParkingSpaces] = useState<number>(initialParkingSpaces);
  const [handicapSpots, setHandicapSpots] = useState<number>(initialHandicapSpots);
  const [crosswalks, setCrosswalks] = useState<number>(initialCrosswalks);
  const [arrows, setArrows] = useState<number>(initialArrows || 0); // Default arrows to 0 if not provided
  const [surfaceArea, setSurfaceArea] = useState<number>(initialSurfaceArea);
  const [additionalWork, setAdditionalWork] = useState("");
  const [showContactForm, setShowContactForm] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [processedImageId, setProcessedImageId] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Calculate quote based on mode
  const calculateQuote = () => {
    if (mode === 'area' && surfaceArea) {
      // Surface Area mode - calculate based on square footage
      // Price range: $0.35 - $0.50 per square foot
      const lowerEstimate = Math.round(surfaceArea * 0.35);
      const upperEstimate = Math.round(surfaceArea * 0.50);
      
      // Record the quote generation for analytics
      fetch('/api/quote-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteType: 'free',
          mode: 'area',
          surfaceArea,
          lowerEstimate,
          upperEstimate,
        }),
      }).catch(err => console.error('Failed to record quote analytics:', err));
      
      return {
        surfaceArea,
        lowerRate: 0.35,
        upperRate: 0.50,
        baseEstimate: Math.round((lowerEstimate + upperEstimate) / 2),
        lowerEstimate,
        upperEstimate
      };
    } else {
      // Space Counter mode
      // Fixed mobilization fee
      const mobilizationFee = 500;
      
      // Calculate costs based on counts
      const parkingCost = parkingSpaces * 5;
      const handicapCost = handicapSpots * 25;
      const crosswalkCost = crosswalks * 20;
      const arrowsCost = arrows * 15; // $15 per arrow
      
      // Total base estimate
      const baseEstimate = mobilizationFee + parkingCost + handicapCost + crosswalkCost + arrowsCost;
      
      // Add 10% variance for quote range
      const lowerEstimate = Math.round(baseEstimate * 0.9);
      const upperEstimate = Math.round(baseEstimate * 1.1);
      
      // Record the quote generation for analytics
      fetch('/api/quote-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteType: 'free',
          mode: 'spaces',
          parkingSpaces,
          handicapSpots,
          crosswalks,
          arrows,
          lowerEstimate,
          upperEstimate,
        }),
      }).catch(err => console.error('Failed to record quote analytics:', err));
      
      return {
        mobilizationFee,
        parkingCost,
        handicapCost,
        crosswalkCost,
        arrowsCost,
        baseEstimate,
        lowerEstimate,
        upperEstimate
      };
    }
  };
  
  const quote = calculateQuote();
  
  // Function to capture screenshot and convert to base64
  const captureMapScreenshot = async () => {
    try {
      // Enhanced selector strategy to find the processed image container with markers
      // First try the map canvas with points on it
      const processedCanvas = document.querySelector("canvas.processed-map") ||
                             document.querySelector("canvas.map-canvas") ||
                             document.querySelector("#mapCanvas");
                             
      if (processedCanvas && processedCanvas instanceof HTMLCanvasElement) {
        // If we found a canvas, use its toDataURL method directly
        const base64Image = processedCanvas.toDataURL("image/png");
        console.log("Successfully captured processed map canvas directly");
        return base64Image;
      }
      
      // Fall back to container capture if no canvas found
      // Prioritize containers that are most likely to contain the processed map with markers
      const mapContainer = document.querySelector(".map-container") ||
                          document.querySelector(".relative.w-full.h-\\[600px\\]") || 
                          document.querySelector(".relative") ||
                          document.querySelector("#map");
      
      if (!mapContainer) {
        console.warn("No map container found for screenshot");
        return null;
      }
      
      // Use html2canvas to take a screenshot of the map container
      const canvas = await window.html2canvas(mapContainer as HTMLElement, {
        useCORS: true,
        scale: 1,
        logging: true,
        allowTaint: true,
        backgroundColor: null
      });
      
      // Convert the canvas to a base64 image
      const base64Image = canvas.toDataURL("image/png");
      console.log("Successfully captured map screenshot with html2canvas");
      return base64Image;
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      return null;
    }
  };

  // Function to submit the quote to Supabase
    // Use existing screenshot URL if provided, otherwise try to capture and upload a new one
    let screenshotUrl = existingScreenshotUrl || null;
    let mapScreenshot = null;
    
    if (!screenshotUrl) {
      // Get the current map canvas to include as a screenshot
      mapScreenshot = await captureMapScreenshot();
      
      if (mapScreenshot) {
        console.log('Map screenshot captured and ready for upload to Supabase');
        // Try to upload the screenshot to get a public URL
        screenshotUrl = await uploadScreenshot(mapScreenshot, name || 'anonymous');
        if (screenshotUrl) {
          console.log('Screenshot uploaded successfully:', screenshotUrl);
        } else {
          console.warn('Failed to upload screenshot, will embed in JSON instead');
        }
      } else {
        console.warn('No screenshot captured for Supabase upload');
      }
    } else {
      console.log('Using existing screenshot URL:', screenshotUrl);
    }
    
    // Prepare data for Supabase submission
    const supabaseQuoteData = {
      name,
      email,
      address,
      quoteData: {
        mode,
        parkingSpaces: mode === 'spaces' ? parkingSpaces : 0,
        handicapSpots: mode === 'spaces' ? handicapSpots : 0,
        crosswalks: mode === 'spaces' ? crosswalks : 0,
        arrows: mode === 'spaces' ? arrows : 0,
        additionalWork: additionalWork || null,
        processedImageId: processedImageId || null,
        lowerEstimate: quote.lowerEstimate,
        upperEstimate: quote.upperEstimate,
        surfaceArea: mode === 'area' ? surfaceArea : null,
        phone: phone || null,
        createdFrom: 'free-quote-dialog-supabase',
        screenshot_url: screenshotUrl || null // Use consistent field name
      },
      userType: 'free',
      screenshotUrl, // Pass the uploaded URL if we have it
      screenshot: screenshotUrl ? undefined : mapScreenshot // Only include raw screenshot if URL upload failed
    };
    
    try {
      // Submit to the Supabase quotes endpoint
      const response = await fetch('/api/supabase/submit-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(supabaseQuoteData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit quote to Supabase');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error submitting to Supabase:', error);
      throw error;
    }
  };

  // Mutation to submit the free quote request
  // Mutation to submit only to Supabase
  const submitSupabaseMutation = useMutation({
    mutationFn: submitToSupabase,
    onSuccess: (data) => {
      toast({
        title: "Quote Submitted",
        description: "Your quote has been successfully submitted.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "An error occurred while submitting your quote.",
        variant: "destructive",
      });
    },
  });

  const submitQuoteMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Prepare the quote data for the free quote request
      const freeQuoteData = {
        name,
        email,
        phone: phone || null,
        address,
        parkingSpaces: mode === 'spaces' ? parkingSpaces : 0,
        handicapSpots: mode === 'spaces' ? handicapSpots : 0,
        crosswalks: mode === 'spaces' ? crosswalks : 0,
        arrows: mode === 'spaces' ? arrows : 0,
        additionalWork: additionalWork || null,
        processedImageId: processedImageId || null,
        lowerEstimate: quote.lowerEstimate,
        upperEstimate: quote.upperEstimate,
        surfaceArea: mode === 'area' ? surfaceArea : null,
      };
      
      // Step 2: Submit to the free quote requests endpoint (legacy)
      const freeQuoteResponse = await fetch('/api/free-quote-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(freeQuoteData),
      });
      
      if (!freeQuoteResponse.ok) {
        const errorData = await freeQuoteResponse.json();
        throw new Error(errorData.error || 'Failed to submit free quote request');
      }
      
      const freeQuoteResult = await freeQuoteResponse.json();
      
      // Step 3: Also save the quote in our new quotes database
      try {
        // Get screenshot from map container using html2canvas
        let mapScreenshot = null;
        try {
          // First try to find the processed image container
          const mapContainer = document.querySelector('.relative.w-full.h-\\[600px\\]') || 
                             document.querySelector('.relative');
          
          if (mapContainer) {
            // Use html2canvas to take a screenshot of the map container
            const canvas = await window.html2canvas(mapContainer as HTMLElement, {
              useCORS: true,
              scale: 1,
              logging: true,
              allowTaint: true,
              backgroundColor: null
            });
            
            // Convert the canvas to a base64 image
            mapScreenshot = canvas.toDataURL('image/png');
            console.log('Successfully captured map screenshot with html2canvas for permanent quote database');
          } else {
            // Fallback to the old method
            const mapCanvas = document.querySelector('#mapCanvas') || document.querySelector('canvas');
            if (mapCanvas && mapCanvas instanceof HTMLCanvasElement) {
              mapScreenshot = mapCanvas.toDataURL('image/png');
              console.log('Successfully captured map screenshot using canvas.toDataURL fallback for permanent quote database');
            } else {
              console.warn('No map container or canvas found for screenshot');
            }
          }
        } catch (screenshotError) {
          console.warn('Error capturing map screenshot for permanent quote database:', screenshotError);
        }
        
        // Prepare data for the permanent quotes database
        const permanentQuoteData = {
          name,
          email,
          address,
          quoteData: {
            mode,
            parkingSpaces: mode === 'spaces' ? parkingSpaces : 0,
            handicapSpots: mode === 'spaces' ? handicapSpots : 0,
            crosswalks: mode === 'spaces' ? crosswalks : 0,
            arrows: mode === 'spaces' ? arrows : 0,
            additionalWork: additionalWork || null,
            processedImageId: processedImageId || null,
            lowerEstimate: quote.lowerEstimate,
            upperEstimate: quote.upperEstimate,
            surfaceArea: mode === 'area' ? surfaceArea : null,
            phone: phone || null,
            createdFrom: 'free-quote-dialog',
            screenshot_url: null, // Will be set later if upload succeeds
            screenshot: mapScreenshot // Store the raw screenshot data
          },
          userType: 'free',
          status: 'new'
        };
        
        // Submit to the new quotes endpoint
        const quoteResponse = await fetch('/api/quotes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(permanentQuoteData),
        });
        
        if (!quoteResponse.ok) {
          console.error('Failed to save to quotes database, but free quote request was successful');
          // Don't throw error here, as we still want to return the free quote result
          // and show success message to user
        }
        
        // Step 4: Also try submitting to Supabase in parallel with screenshot URL if possible
        try {
          // Try to get screenshot URL first
          let screenshotUrl = null;
          if (mapScreenshot) {
            try {
              // Try to upload to Supabase storage and get URL
              screenshotUrl = await uploadScreenshot(mapScreenshot, name || 'anonymous');
              console.log('Successfully uploaded screenshot to Supabase storage:', screenshotUrl);
            } catch (uploadError) {
              console.warn('Could not upload to Supabase storage:', uploadError);
            }
          }
          
          // Proceed with Supabase submission with the screenshot URL
          if (screenshotUrl) {
            // Update the permanent quote data with the screenshot URL
            try {
              // Update permanent quote data if needed
              const updateResponse = await fetch('/api/quotes', {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                  email,
                  screenshot_url: screenshotUrl 
                }),
              });
              console.log('Updated permanent quote with screenshot URL');
            } catch (updateError) {
              console.warn('Could not update permanent quote with screenshot URL');
            }
          }
          // Submit to Supabase with the screenshot URL
          await submitToSupabase(screenshotUrl || undefined);
          console.log('Successfully submitted to Supabase as well');
        } catch (supabaseError) {
          console.error('Failed to submit to Supabase, but other submissions were successful:', supabaseError);
          // Don't throw error, as we want to show success if the other submissions were successful
        }
      } catch (error) {
        console.error('Error saving to quotes database:', error);
        // Don't rethrow, as we want to show success if the free quote request was successful
      }
      
      return freeQuoteResult;
    },
    onSuccess: () => {
      toast({
        title: "Quote Submitted",
        description: "Your free quote request has been submitted successfully.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "An error occurred while submitting your quote request.",
        variant: "destructive",
      });
    },
  });
  
  // Function to handle submitting the quote request
  const handleSubmitQuoteRequest = () => {
    submitQuoteMutation.mutate();
  };
  
  // Function to handle submitting directly to Supabase
  const handleSubmitToSupabase = () => {
    // Call with no arguments to capture a new screenshot
    submitSupabaseMutation.mutate(undefined);
  };
  
  const handleSubmitContact = () => {
    if (name.trim() && email.trim() && email.includes('@')) {
      // Get the image ID from localStorage if it exists
      const storedImageId = localStorage.getItem('processedImageId');
      if (storedImageId) {
        setProcessedImageId(storedImageId);
      }
      
      setFormSubmitted(true);
      setShowContactForm(false);
    }
  };

  // Handle numeric input change
  const handleNumericChange = (setter: React.Dispatch<React.SetStateAction<number>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      setter(value);
    }
  };

  // Render different content based on the mode
  const renderAnalysisContent = () => {
    if (mode === 'area') {
      return (
        <div className="grid grid-cols-1 gap-4 mb-6">
          <div className="p-4 bg-background rounded-lg border">
            <p className="text-sm font-medium mb-1">Surface Area</p>
            <div className="flex items-center">
              <Input
                type="number"
                min="0"
                value={surfaceArea || ''}
                onChange={handleNumericChange(setSurfaceArea)}
                className="text-xl font-bold text-center"
              />
              <span className="ml-2 text-sm font-medium">sq ft</span>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-background rounded-lg border">
            <p className="text-sm font-medium mb-1">Parking Spaces</p>
            <Input
              type="number"
              min="0"
              value={parkingSpaces || ''}
              onChange={handleNumericChange(setParkingSpaces)}
              className="text-xl font-bold text-center"
            />
          </div>
          <div className="p-4 bg-background rounded-lg border">
            <p className="text-sm font-medium mb-1">Handicap Spots</p>
            <Input
              type="number"
              min="0"
              value={handicapSpots || ''}
              onChange={handleNumericChange(setHandicapSpots)}
              className="text-xl font-bold text-center"
            />
          </div>
          <div className="p-4 bg-background rounded-lg border">
            <p className="text-sm font-medium mb-1">Crosswalks</p>
            <Input
              type="number"
              min="0"
              value={crosswalks || ''}
              onChange={handleNumericChange(setCrosswalks)}
              className="text-xl font-bold text-center"
            />
          </div>
          <div className="p-4 bg-background rounded-lg border">
            <p className="text-sm font-medium mb-1">Arrows</p>
            <Input
              type="number"
              min="0"
              value={arrows || ''}
              onChange={handleNumericChange(setArrows)}
              className="text-xl font-bold text-center"
            />
          </div>
        </div>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>LotQuote Free Estimate</DialogTitle>
          <DialogDescription>
            Get a quick estimate for your parking lot services.
          </DialogDescription>
        </DialogHeader>

        {showContactForm ? (
          <div className="relative">
            {/* Distorted background image with quote */}
            <div className="absolute inset-0 overflow-hidden opacity-10 blur-sm">
              <div className="p-6 border rounded-lg bg-muted/30">
                <h3 className="text-xl font-semibold mb-4">LotQuote Service Estimate</h3>
                
                {renderAnalysisContent()}
                
                <div className="p-4 bg-background rounded-lg border">
                  <h4 className="font-medium mb-2">Estimated Price Range</h4>
                  <p className="text-3xl font-bold text-center my-4">
                    ${quote.lowerEstimate.toLocaleString()} - ${quote.upperEstimate.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Contact form - Modern, clean design */}
            <div className="relative z-10 p-6 border rounded-2xl bg-background/95 backdrop-blur-sm shadow-xl overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-gradient-to-br from-orange-400/20 to-red-500/20 rounded-full"></div>
              <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-gradient-to-tr from-orange-400/10 to-red-500/10 rounded-full"></div>
              
              <h3 className="text-xl font-semibold mb-2 text-center bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                Get Your Free Quote
              </h3>
              <p className="text-sm text-muted-foreground mb-6 text-center">
                Enter your details below to receive your personalized estimate
              </p>
              
              <div className="space-y-5">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="mt-1.5 border-muted-foreground/20 focus:border-orange-500 transition-all"
                  />
                </div>
                
                <div>
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    className="mt-1.5 border-muted-foreground/20 focus:border-orange-500 transition-all"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-sm font-medium">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                    className="mt-1.5 border-muted-foreground/20 focus:border-orange-500 transition-all"
                  />
                  <p className="text-xs text-muted-foreground mt-1 ml-1">Optional</p>
                </div>
                
                <div className="pt-3">
                  <Button 
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-md transition-all text-white font-medium py-6" 
                    onClick={handleSubmitContact}
                    disabled={!name.trim() || !email.trim() || !email.includes('@')}
                  >
                    View My Custom Quote
                  </Button>
                  
                  <div className="flex items-center justify-center mt-4 text-xs text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Your information is secure and will never be shared
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 border rounded-lg bg-muted/30">
              <h3 className="text-xl font-semibold mb-4">LotQuote Service Estimate</h3>
              
              {/* Analysis counts */}
              {renderAnalysisContent()}
              
              {/* Quote calculation */}
              <div className="space-y-4">
                
                {/* Price range */}
                <div className="p-4 bg-background rounded-lg border">
                  <h4 className="font-medium mb-2">Estimated Price Range</h4>
                  <p className="text-3xl font-bold text-center my-4">
                    ${quote.lowerEstimate.toLocaleString()} - ${quote.upperEstimate.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    This is an estimated range. Final pricing may vary based on site inspection.
                  </p>
                </div>
                
                <div className="p-4 bg-background rounded-lg border">
                  <h4 className="font-medium mb-3">Additional Work Requested</h4>
                  <Textarea
                    value={additionalWork}
                    onChange={(e) => setAdditionalWork(e.target.value)}
                    placeholder="Please specify any additional work you need (e.g., curbing linear ft, fire lanes, parking bumpers, arrows, ADA signage, etc.)..."
                    className="min-h-[100px]"
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium">Suggestions:</span> Curbing linear ft, fire lanes, parking bumpers, directional arrows, traffic flow patterns, ADA signage/compliance, surface repairs
                  </div>
                </div>
                
                <div className="p-4 bg-background rounded-lg border">
                  <h4 className="font-medium mb-3">Next Steps</h4>
                  <p className="text-sm">
                    Thank you for using our Free Quote tool! One of our partner companies will contact you shortly to discuss your parking lot service needs.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitToSupabase}
                disabled={submitSupabaseMutation.isPending}
              >
                {submitSupabaseMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Quote Request"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}