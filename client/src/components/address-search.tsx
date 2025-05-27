import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Loader2, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    google: any;
    initAutocomplete: () => void;
  }
}

interface AddressSearchProps {
  variant?: "home" | "location";
  onAddressSelect?: (address: string) => void;
  initialValue?: string;
}

export function AddressSearch({ variant = "home", onAddressSelect, initialValue = "" }: AddressSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State for user action selection
  const [selectedAction, setSelectedAction] = useState<"quote" | "contractor" | null>(null);
  
  // State for address usage tracking
  const [addressUsage, setAddressUsage] = useState<{
    usageCount: number;
    limit: number;
    canUseMoreAddresses: boolean;
  } | null>(null);

  // Initialize Google Maps autocomplete
  const initAutocomplete = () => {
    if (!inputRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ["address"],
        componentRestrictions: { country: "us" },
      }
    );

    autocompleteRef.current.addListener("place_changed", async () => {
      const place = autocompleteRef.current.getPlace();
      if (!place.formatted_address) return;

      setSelectedAddress(place.formatted_address);
      
      if (variant === 'location' && onAddressSelect) {
        onAddressSelect(place.formatted_address);
        return;
      }
      
      if (variant === 'home') {
        if (!selectedAction) {
          toast({
            title: "Action Required",
            description: "Please select 'I need a Quote' or 'I'm a Contractor' first",
            variant: "destructive",
          });
          return;
        }
        
        if (selectedAction === "quote") {
          handleFreeQuote(place.formatted_address);
        } else if (selectedAction === "contractor") {
          handleContractorSignIn(place.formatted_address);
        }
      }
    });

    setIsLoading(false);
  };

  // Load Google Maps script
  useEffect(() => {
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    
    if (!existingScript && !window.google?.maps?.places) {
      setIsLoading(true);
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.id = "google-maps-script";
      script.addEventListener("load", initAutocomplete);
      document.head.appendChild(script);

      return () => {
        const scriptToRemove = document.getElementById("google-maps-script");
        if (scriptToRemove) {
          document.head.removeChild(scriptToRemove);
        }
        
        if (autocompleteRef.current) {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
          autocompleteRef.current = null;
        }
      };
    } else if (window.google?.maps?.places) {
      initAutocomplete();
    } else if (existingScript) {
      setIsLoading(true);
      existingScript.addEventListener("load", initAutocomplete);
      
      return () => {
        existingScript.removeEventListener("load", initAutocomplete);
      };
    }
  }, []);

  // Fetch address usage info
  useEffect(() => {
    if (user) {
      const fetchAddressUsage = async () => {
        try {
          const response = await apiRequest("GET", "/api/address-usage");
          if (response.ok) {
            const data = await response.json();
            setAddressUsage(data);
          }
        } catch (error) {
          console.error("Error fetching address usage:", error);
        }
      };
      
      fetchAddressUsage();
    }
  }, [user]);

  // Scroll to solutions section
  const scrollToSolutions = () => {
    const solutionsSection = document.querySelector('#solutions');
    if (solutionsSection) {
      solutionsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Free quote handling
  const handleFreeQuote = (address: string) => {
    if (!address) return;
    
    sessionStorage.removeItem('fromHeader');
    sessionStorage.removeItem('afterLoginAction');
    sessionStorage.removeItem('pendingAddress');
    sessionStorage.removeItem('afterLoginMode');
    
    const encodedAddress = encodeURIComponent(address);
    navigate(`/map?address=${encodedAddress}&mode=spaces&returnTo=quote`);
  };
  
  // Contractor login handling
  const handleContractorSignIn = async (address: string) => {
    if (!address) return;
    
    // If they're free user with no more uses, check if address is in history
    if (user && user.paymentPlan === 'free' && addressUsage && !addressUsage.canUseMoreAddresses) {
      try {
        // Check if this address is already in user's history
        const historyResponse = await apiRequest(
          "GET", 
          `/api/search-history/check?address=${encodeURIComponent(address)}`
        );
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          
          // If the address is already in history, allow the user to continue
          if (historyData.exists) {
            console.log("Address already in history, allowing access despite limit");
          } else {
            // Address not in history, show the upgrade message
            toast({
              title: "Address Limit Reached",
              description: "You've reached your monthly limit of 3 addresses. Upgrade to continue or select a previous address.",
              variant: "destructive",
            });
            
            window.location.href = '/payment-plan';
            return;
          }
        } else {
          // If the check fails, enforce the limit for safety
          toast({
            title: "Address Limit Reached",
            description: "You've reached your monthly limit of 3 addresses. Upgrade to continue.",
            variant: "destructive",
          });
          
          window.location.href = '/payment-plan';
          return;
        }
      } catch (error) {
        console.error("Error checking address history:", error);
        // On error, fall back to restrictive behavior
        toast({
          title: "Address Limit Reached",
          description: "You've reached your monthly limit of 3 addresses. Upgrade to continue.",
          variant: "destructive",
        });
        
        window.location.href = '/payment-plan';
        return;
      }
    }
    
    sessionStorage.setItem('pendingAddress', address);
    sessionStorage.setItem('afterLoginAction', 'viewMap');
    sessionStorage.setItem('afterLoginMode', 'spaces');
    sessionStorage.removeItem('fromHeader');
    
    if (!user) {
      toast({
        title: "Contractor Login Required",
        description: "Please sign in to continue analyzing this property.",
      });
      
      window.location.href = '/payment-plan';
      // Ensure it scrolls to top
      window.scrollTo(0, 0);
    } else {
      const encodedAddress = encodeURIComponent(address);
      navigate(`/map?address=${encodedAddress}&mode=spaces`);
    }
  };
  
  // Handle manual address submission
  const handleAddressInput = () => {
    if (variant === "home" && !selectedAction) {
      toast({
        title: "Action Required",
        description: "Please select 'I need a Quote' or 'I'm a Contractor' first",
        variant: "destructive",
      });
      return;
    }
    
    if (variant === "location" && onAddressSelect && inputRef.current?.value) {
      onAddressSelect(inputRef.current.value);
      return;
    }
    
    if (inputRef.current?.value && variant === "home") {
      const address = inputRef.current.value;
      if (selectedAction === "quote") {
        handleFreeQuote(address);
      } else if (selectedAction === "contractor") {
        handleContractorSignIn(address);
      }
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto">
      <div className="flex items-center gap-4 w-full">
        {/* Action mode selection buttons stacked to the left of search bar */}
        {variant === "home" && (
          <div className="flex flex-col justify-center gap-3 shrink-0">
            <Button 
              variant={selectedAction === "quote" ? "default" : "outline"}
              size="lg"
              onClick={() => setSelectedAction("quote")}
              className={`h-12 px-4 rounded-xl transition-all font-medium w-40 ${
                selectedAction === "quote" 
                  ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-md"
                  : "bg-white/90 text-black hover:bg-white border border-slate-300"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="13" x2="15" y2="13"></line>
              </svg>
              I need a Quote
            </Button>
            
            <Button 
              variant={selectedAction === "contractor" ? "default" : "outline"}
              size="lg"
              onClick={() => setSelectedAction("contractor")}
              className={`h-12 px-4 rounded-xl transition-all font-medium w-40 ${
                selectedAction === "contractor" 
                  ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-md"
                  : "bg-white/90 text-black hover:bg-white border border-slate-300"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              I'm a Contractor
            </Button>
          </div>
        )}
        
        {/* Search bar and action buttons */}
        <div className="flex flex-1 items-center gap-2">
          <div className="flex-1">
            <Input
              ref={inputRef}
              placeholder={variant === "home" && !selectedAction 
                ? "Select an option first..." 
                : "Enter property address..."}
              defaultValue={initialValue}
              className="w-full text-lg h-12 px-6 rounded-xl bg-white/90 backdrop-blur-sm border-2 placeholder:text-gray-400 text-black"
              disabled={isLoading || (variant === "home" && !selectedAction)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddressInput();
                }
              }}
            />
          </div>
          <Button
            size="lg"
            disabled={isLoading || (variant === "home" && !selectedAction)}
            onClick={handleAddressInput}
            className={`h-12 px-6 rounded-xl transition-all ${
              variant === "location"
                ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                : selectedAction === "quote" || selectedAction === "contractor"
                  ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                  : "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Enter Address
          </Button>
          {variant === "home" && (
            <Button
              variant="outline"
              size="lg"
              onClick={scrollToSolutions}
              className="h-12 px-6 rounded-xl border-2 bg-transparent hover:bg-white/10 transition-all"
            >
              Learn More
            </Button>
          )}
        </div>
      </div>
      
      {/* Address usage information for free tier users */}
      {user && addressUsage && user.paymentPlan === 'free' && (
        <div className="mt-2 px-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Address usage: {addressUsage.usageCount} of {addressUsage.limit} this month
            </span>
            {!addressUsage.canUseMoreAddresses && (
              <span className="text-red-600 font-medium flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Limit reached
              </span>
            )}
          </div>
          <div className="w-full bg-muted rounded-full h-1 mt-1 overflow-hidden">
            <div 
              className={`h-full ${addressUsage.canUseMoreAddresses ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, (addressUsage.usageCount / addressUsage.limit) * 100)}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
