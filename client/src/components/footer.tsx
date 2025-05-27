import { Mail, Github, Twitter, Linkedin, Facebook } from "lucide-react";
import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { LeadDialog } from "@/components/lead-dialog";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  // Get current location
  const currentPath = window.location.pathname;
  
  // Function to scroll to section by ID or navigate to home page with section
  const scrollToSection = (id: string) => {
    // If on home page, just scroll to the section
    if (currentPath === '/' || currentPath === '') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      // If on another page like map view, navigate to home with section hash
      window.location.href = `/#${id}`;
    }
  };
  
  return (
    <footer id="contact" className="bg-gray-50 border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-white">L</span>
              </div>
              <h2 className="text-xl font-bold">LotQuote</h2>
            </div>
            <p className="text-gray-600">
              Professional parking lot analysis using advanced computer vision technology.
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => {
                    if (currentPath === '/' || currentPath === '') {
                      // If on home page, just scroll to top
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else {
                      // If on another page, navigate to home
                      window.location.href = '/';
                    }
                  }}
                  className="text-gray-600 hover:text-primary transition-colors cursor-pointer"
                >
                  Home
                </button>
              </li>
              <li>
                <button 
                  onClick={() => {
                    if (currentPath === '/' || currentPath === '') {
                      // If on home page, scroll to solutions section
                      scrollToSection('solutions');
                    } else {
                      // If on any other page, navigate directly to home page solutions section
                      window.location.href = '/#solutions';
                    }
                  }}
                  className="text-gray-600 hover:text-primary transition-colors cursor-pointer"
                >
                  Features
                </button>
              </li>
              <li>
                <button 
                  onClick={() => {
                    if (currentPath === '/' || currentPath === '') {
                      // If on home page, scroll to top where the quote section is
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else {
                      // If on another page, navigate to home top section
                      window.location.href = '/';
                    }
                  }}
                  className="text-gray-600 hover:text-primary transition-colors cursor-pointer"
                >
                  Get a Quote
                </button>
              </li>
              <li>
                <Link href="/auth?tab=login" className="text-gray-600 hover:text-primary transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/auth?tab=register" className="text-gray-600 hover:text-primary transition-colors">
                  Sign Up
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-lg mb-4">Services</h3>
            <ul className="space-y-2">
              <li className="text-gray-600">Parking Space Counting</li>
              <li className="text-gray-600">Surface Area Measurement</li>
              <li className="text-gray-600">Instant Quote Generation</li>
              <li className="text-gray-600">Custom Invoice Creation</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-lg mb-4">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-600">
                <Mail className="h-4 w-4" />
                support@lotquote.com
              </li>
              <li className="mt-2">
                <LeadDialog 
                  buttonText="Send Us a Message" 
                  buttonVariant="outline"
                  source="Footer Contact"
                  title="Contact Us"
                />
              </li>
            </ul>
          </div>
        </div>
        
        <Separator className="my-8" />
        
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <p className="text-gray-600 text-sm">
              © {currentYear} LotQuote. All rights reserved.
            </p>
            <FeedbackDialog />
          </div>
          
          <div className="flex space-x-4">
            <a href="#" className="text-gray-500 hover:text-gray-700">
              <Facebook className="h-5 w-5" />
              <span className="sr-only">Facebook</span>
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-700">
              <Twitter className="h-5 w-5" />
              <span className="sr-only">Twitter</span>
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-700">
              <Linkedin className="h-5 w-5" />
              <span className="sr-only">LinkedIn</span>
            </a>
            <a href="#" className="text-gray-500 hover:text-gray-700">
              <Github className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}