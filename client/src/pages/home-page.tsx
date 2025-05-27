import { ServiceCard } from "@/components/service-card";
import { AddressSearch } from "@/components/address-search";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CalendlyButton } from "@/components/calendly-button";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useLocation } from "wouter";

const features = [
  {
    title: "Auto Space Counting",
    description: "Detects standard + ADA spaces instantly",
    image: "/images/auto-space-counting.png",
    bulletPoints: [
      "Recognizes standard parking spaces automatically",
      "Identifies ADA/handicap spaces with high accuracy",
      "Detects crosswalks and traffic markings",
      "Provides detailed space counts by section"
    ]
  },
  {
    title: "Polygon Mapping Tool",
    description: "Draw any lot shape on the map",
    image: "/videos/polygon-mapping-demo.mp4",
    isVideo: true,
    bulletPoints: [
      "Versatile drawing tools for any parking lot shape",
      "Multiple control points for precise outlining",
      "Easy point-and-click edge modification",
      "Area calculation for surface projects"
    ]
  },
  {
    title: "Instant Quote/Invoice Generator",
    description: "Produces pricing based on inputs",
    image: "/images/quote-generator-screenshot.png",
    isVideo: false,
    bulletPoints: [
      "Works from satellite view - no site visit required",
      "Customizable pricing and line items",
      "Downloadable PDF quotes with images",
      "Editable invoice generation"
    ]
  }
];

const stats = [
  {
    value: "98%",
    label: "Accuracy Rate",
    description: "Accurate lot estimates"
  },
  {
    value: "2.5M+",
    label: "Spaces Analyzed",
    description: "Across the country"
  },
  {
    value: "5,000+",
    label: "Projects Completed",
    description: "Satisfied customers"
  },
  {
    value: "4.9/5",
    label: "Customer Rating",
    description: "Based on reviews"
  }
];

export default function HomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Check if user is logged in and hasn't seen the payment plan selection page
  useEffect(() => {
    // Check if the user has specifically chosen to skip the plan selection
    const skipPlanRedirect = sessionStorage.getItem('skipPlanRedirect') === 'true';
    console.log("skipPlanRedirect",skipPlanRedirect);
    console.log("user",user);
    if (user && user.hasSeenPlanSelection === false /* && !skipPlanRedirect */) {
      console.log('Home page: User has not seen plan selection, redirecting');
      setLocation("/payment-plan");
    }
  }, [user, setLocation]);
  
  // Check if we need to scroll to top after navigating from another page
  useEffect(() => {
    const shouldScrollToTop = sessionStorage.getItem('scrollHomeToTop');
    if (shouldScrollToTop) {
      window.scrollTo(0, 0);
      sessionStorage.removeItem('scrollHomeToTop');
    }
  }, []);
  
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-orange-500 to-red-600 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Instant Parking Lot Quotes. Powered by AI.
            </h1>
            <p className="text-lg md:text-xl opacity-90 mb-8">
              Draw your lot. Get an accurate quote in seconds.
            </p>
            <AddressSearch />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold">{stat.value}</div>
                  <div className="text-sm mt-1 opacity-90">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="solutions" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">
              🚀 Features
            </h2>
            <p className="text-center text-muted-foreground mb-16">
              Everything you need for quick, accurate parking lot estimates
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto mb-4">
              {features.map((feature) => (
                <ServiceCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>
        
        <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-2">
              Simple pricing. Built for pros.
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              Choose the plan that's right for your business
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-4">
              {/* Free Tier */}
              <div className="bg-background rounded-lg border shadow-sm overflow-hidden">
                <div className="p-6">
                  <h3 className="text-2xl font-bold">Free</h3>
                  <div className="mt-3 flex items-baseline">
                    <span className="text-4xl font-extrabold">$0</span>
                    <span className="ml-1 text-xl text-muted-foreground">/mo</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    For new users and small operators
                  </p>
                </div>
                <div className="px-6 pb-6">
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">3 estimates per month</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">Draw & count spaces</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">Basic quote preview</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">Email support</span>
                    </li>
                  </ul>
                  <button 
                    onClick={() => {
                      // Redirect to auth page
                      window.location.href = '/auth';
                      // Ensure it scrolls to top
                      window.scrollTo(0, 0);
                    }}
                    className="mt-6 block w-full rounded-md py-2 text-sm font-semibold text-white text-center bg-muted-foreground hover:bg-foreground"
                  >
                    Get started
                  </button>
                </div>
              </div>
              
              {/* Pro Tier */}
              <div className="bg-background rounded-lg border shadow-sm overflow-hidden ring-2 ring-orange-500 relative">
                <div className="absolute top-0 inset-x-0 bg-orange-500 text-white text-xs font-medium text-center py-1">
                  MOST POPULAR
                </div>
                <div className="p-6 pt-9">
                  <h3 className="text-2xl font-bold">Pro</h3>
                  <div className="mt-3 flex items-baseline">
                    <span className="text-4xl font-extrabold">$49</span>
                    <span className="ml-1 text-xl text-muted-foreground">/mo</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    For active striping businesses
                  </p>
                </div>
                <div className="px-6 pb-6">
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">Unlimited estimates</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">Branded quote exports (PDF/Excel)</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">Lead capture</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">Priority support</span>
                    </li>
                  </ul>
                  <button 
                    onClick={() => {
                      // Redirect to auth page
                      window.location.href = '/auth';
                      // Ensure it scrolls to top
                      window.scrollTo(0, 0);
                    }}
                    className="mt-6 block w-full rounded-md py-2 text-sm font-semibold text-white text-center bg-orange-500 hover:bg-orange-600"
                  >
                    Subscribe
                  </button>
                </div>
              </div>
              
              {/* Enterprise Plan */}
              <div className="bg-background rounded-lg border shadow-sm overflow-hidden">
                <div className="p-6">
                  <h3 className="text-2xl font-bold">Enterprise</h3>
                  <div className="mt-3 flex items-baseline">
                    <span className="text-4xl font-extrabold">$149</span>
                    <span className="ml-1 text-xl text-muted-foreground">+/mo</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    For high volume users and lead generation
                  </p>
                </div>
                <div className="px-6 pb-6">
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">Multi-user access</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">Priority Zip Code leads</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">Custom branding</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="ml-2 text-sm">Integration with QuickBooks, Jobber, etc.</span>
                    </li>
                  </ul>
                  <button 
                    onClick={() => window.open('https://calendly.com/ty-lotquote/30min', '_blank')}
                    className="mt-6 block w-full rounded-md py-2 text-sm font-semibold text-white text-center bg-muted-foreground hover:bg-foreground"
                  >
                    Request a Demo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}