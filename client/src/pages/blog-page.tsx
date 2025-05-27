import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CalendarIcon, Clock3Icon } from "lucide-react";
import { useEffect } from "react";

export default function BlogPage() {
  // Check if we need to scroll to top (from header navigation)
  useEffect(() => {
    const shouldScrollToTop = sessionStorage.getItem('scrollBlogToTop');
    if (shouldScrollToTop) {
      window.scrollTo(0, 0);
      sessionStorage.removeItem('scrollBlogToTop');
    }
  }, []);
  const blogPosts = [
    {
      id: "parking-lot-striping-cost-2025",
      title: "How Much Does Parking Lot Line Striping Cost in 2025?",
      description: "Get the latest pricing insights and cost factors for parking lot line striping services in 2025.",
      date: "April 15, 2025",
      readTime: "7 min read",
      imageSrc: "https://i.imgur.com/L6S0wfT.png",
      imageAlt: "Worker applying fresh striping to a parking lot"
    },
    {
      id: "sealcoating-saves-money",
      title: "Why Sealcoating Your Asphalt Parking Lot Saves You Thousands",
      description: "Learn how preventative maintenance through sealcoating can extend your parking lot's life and save significant repair costs.",
      date: "April 10, 2025",
      readTime: "5 min read",
      imageSrc: "https://i.imgur.com/FWMzrYq.png",
      imageAlt: "Worker applying sealcoat to a parking lot"
    },
    {
      id: "when-to-restripe-parking-lot",
      title: "Top 5 Signs It's Time to Re-Stripe Your Parking Lot",
      description: "Identify the key indicators that your parking lot needs restriping to maintain safety and aesthetics.",
      date: "March 28, 2025",
      readTime: "4 min read",
      imageSrc: "https://i.imgur.com/BLpHg6H.png",
      imageAlt: "Worker applying fresh striping to a parking lot"
    },
    {
      id: "ada-parking-lot-compliance-guide",
      title: "Understanding ADA Compliance for Parking Lot Striping",
      description: "A comprehensive guide to ADA regulations for commercial parking lots and how to ensure your property remains compliant.",
      date: "March 22, 2025",
      readTime: "8 min read",
      imageSrc: "https://i.imgur.com/ojUWnBl.png",
      imageAlt: "ADA compliant handicap parking space with proper markings"
    },
    {
      id: "best-time-for-parking-lot-maintenance",
      title: "The Best Times of Year to Repaint or Seal Your Parking Lot",
      description: "Strategic timing for parking lot maintenance projects to maximize durability and minimize business disruption.",
      date: "March 15, 2025",
      readTime: "6 min read",
      imageSrc: "https://i.imgur.com/NUBEUf3.png",
      imageAlt: "Seasonal maintenance worker with checklist in safety vest"
    }
  ];

  return (
    <Layout>
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-4">LotQuote Blog</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Expert insights on parking lot striping, maintenance, and pavement solutions for property managers and contractors.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {blogPosts.map((post) => (
            <Card key={post.id} className="overflow-hidden flex flex-col h-full">
              <div className="h-56 overflow-hidden flex items-center justify-center">
                <img 
                  src={post.imageSrc} 
                  alt={post.imageAlt} 
                  className="w-[95%] h-[95%] object-contain bg-[#c9e5f7] p-2 rounded-lg transition-transform hover:scale-105 duration-300"
                />
              </div>
              <CardHeader>
                <CardTitle className="text-xl">{post.title}</CardTitle>
                <CardDescription>{post.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <CalendarIcon className="mr-1 h-4 w-4" />
                  {post.date}
                </div>
                <div className="flex items-center">
                  <Clock3Icon className="mr-1 h-4 w-4" />
                  {post.readTime}
                </div>
              </CardContent>
              <CardFooter className="mt-auto pt-4 flex gap-2">
                <Link href={`/blog/${post.id}`} onClick={() => setTimeout(() => window.scrollTo(0, 0), 100)}>
                  <Button variant="outline" className="w-full">Read Article</Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        <div className="mt-20 py-12 bg-muted/50 rounded-lg">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Transform your parking lot with professional services tailored to your needs. 
              Get an instant quote and see how affordable quality can be.
            </p>
            <Button 
              size="lg"
              onClick={() => {
                window.location.href = '/';
                // Ensure the page scrolls to the top after navigation
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
              }}
            >
              Get a Free Quote
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}