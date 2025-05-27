import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export function Header() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Check URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const inFreeQuoteMode = location.startsWith('/map') && searchParams.get('returnTo') === 'quote';
  const isPaymentPlanPage = location === '/payment-plan';
  const fromStripeCancel = location === '/payment-plan' && searchParams.get('from') === 'stripe_cancel';
  
  // For handling navigation on payment plan page
  const handlePaymentPlanNavigation = (destination: string) => {
    // If coming back from Stripe, don't show confirmation dialog
    if (fromStripeCancel || window.confirm("Leaving this page will cancel your plan selection. Are you sure you want to continue?")) {
      // Use the special redirect route to break the navigation cycle
      if (destination === '/') {
        window.location.href = '/redirect-home';
      } else {
        // Directly navigate to other destinations
        window.location.href = destination;
      }
      return true;
    }
    return false;
  };

  // Query the admin status when user is logged in
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: !!user,
  });

  // Update admin status when the query completes
  useEffect(() => {
    if (adminCheck) {
      setIsAdmin(adminCheck.isAdmin);
    }
  }, [adminCheck]);

  // Function to scroll to section by ID or navigate to home page section
  const scrollToSection = (id: string) => {
    // If on home page, just scroll
    if (location === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      // If on any other page, navigate to home page with section hash
      window.location.href = `/#${id}`;
    }
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <Link 
            href="/redirect-home" 
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            onClick={(e) => {
              // If we're already at the home page, just scroll to top
              if (location === '/') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-white">L</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
              LotQuote
            </h1>
          </Link>
          
          {/* Main Navigation Links */}
          <div className="hidden md:flex ml-10 space-x-8">
            <Link 
              href="/#solutions"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={(e) => {
                if (location === '/') {
                  e.preventDefault();
                  scrollToSection('solutions');
                }
              }}
            >
              How It Works
            </Link>
            <Link 
              href="/#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={(e) => {
                if (location === '/') {
                  e.preventDefault();
                  scrollToSection('pricing');
                }
              }}
            >
              Pricing
            </Link>
            <Link 
              href="/blog"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={(e) => {
                if (location === '/blog') {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  // If navigating from another page, pass a hash to ensure it scrolls to top
                  // We'll set a sessionStorage flag to scroll to top after navigation
                  sessionStorage.setItem('scrollBlogToTop', 'true');
                }
              }}
            >
              Blog
            </Link>
            <Link 
              href="/#contact"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={(e) => {
                if (location === '/') {
                  e.preventDefault();
                  // Try to find the footer and scroll to it
                  const footer = document.querySelector('footer');
                  if (footer) {
                    footer.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              }}
            >
              Contact
            </Link>
          </div>
        </div>
        
        <div className="flex gap-2">
          {isPaymentPlanPage ? (
            // On payment plan page, allow going to homepage
            <Link href="/redirect-home">
              <Button variant="ghost">
                Return Home
              </Button>
            </Link>
          ) : inFreeQuoteMode ? (
            // In Free Quote mode, show "Return to Home" and Sign Up option
            <>
              <Link href="/">
                <Button variant="ghost">Return Home</Button>
              </Link>
              <Link href="/auth?tab=register">
                <Button>Sign Up</Button>
              </Link>
            </>
          ) : user ? (
            // Regular user logged in
            <>
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="ghost">Admin Dashboard</Button>
                </Link>
              )}
              <Link href="/history">
                <Button variant="ghost">History</Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost">Profile</Button>
              </Link>
            </>
          ) : (
            // Regular not logged in
            <>
              <Link href="/auth?tab=login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/auth?tab=register">
                <Button>Sign Up</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}