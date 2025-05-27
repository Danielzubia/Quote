import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useParams } from "wouter";
import { CalendarIcon, Clock3Icon, ArrowLeftIcon, Share2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";

interface BlogPost {
  id: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  imageSrc: string;
  imageAlt: string;
  content: string;
}

// Static content for our blog posts
const blogPosts: Record<string, BlogPost> = {
  "parking-lot-striping-cost-2025": {
    id: "parking-lot-striping-cost-2025",
    title: "How Much Does Parking Lot Line Striping Cost in 2025?",
    description: "Get the latest pricing insights and cost factors for parking lot line striping services in 2025.",
    date: "April 15, 2025",
    readTime: "7 min read",
    imageSrc: "https://i.imgur.com/L6S0wfT.png",
    imageAlt: "Worker applying fresh striping to a parking lot",
    content: `
      <h2>Understanding Parking Lot Striping Costs in 2025</h2>
      <p>Maintaining a well-marked parking lot is essential for safety, compliance, and aesthetics. As we move through 2025, property managers and business owners are facing evolving costs for parking lot striping services.</p>
      
      <p>In this comprehensive guide, we'll break down the current pricing landscape and help you understand what factors influence the cost of your next parking lot striping project.</p>
      
      <h3>National Average Costs</h3>
      <p>For 2025, the national average cost for parking lot striping ranges from $0.30 to $1.50 per linear foot, with most property owners paying between $500 and $1,500 for a standard commercial lot.</p>
      
      <h3>Key Factors Affecting Striping Costs</h3>
      <ul>
        <li><strong>Lot Size:</strong> Naturally, larger lots require more paint and labor, increasing the overall cost.</li>
        <li><strong>Project Complexity:</strong> Standard parking spaces cost less than specialized markings such as ADA spaces, fire lanes, or custom stenciling.</li>
        <li><strong>Surface Condition:</strong> Rough or damaged asphalt requires more paint and preparation work.</li>
        <li><strong>Regional Variations:</strong> Labor costs vary significantly by region, with urban areas typically commanding higher rates.</li>
        <li><strong>Material Quality:</strong> Water-based paints are more affordable but less durable than thermoplastic or epoxy-based options.</li>
      </ul>
      
      <h3>Cost Breakdown by Feature</h3>
      <p>Here's what you can expect to pay for specific parking lot features in 2025:</p>
      <ul>
        <li>Standard parking space: $5-15 per space</li>
        <li>ADA-compliant handicap space: $25-50 per space (including the symbol and access aisle)</li>
        <li>Fire lane: $0.40-1.00 per linear foot</li>
        <li>Directional arrows: $10-25 each</li>
        <li>Stop bars: $15-30 each</li>
        <li>Custom stenciling: $50-150 depending on size and complexity</li>
      </ul>
      
      <h3>Ways to Save on Parking Lot Striping</h3>
      <p>While quality shouldn't be compromised, there are several ways to manage costs:</p>
      <ul>
        <li><strong>Bundle Services:</strong> Combine striping with sealcoating or minor repairs for package discounts.</li>
        <li><strong>Off-Season Scheduling:</strong> Book during less busy periods (typically late fall or winter in warmer climates).</li>
        <li><strong>Maintenance Planning:</strong> Regular maintenance extends the life of your markings and prevents complete restriping.</li>
        <li><strong>Get Multiple Quotes:</strong> Always compare at least three contractors to ensure competitive pricing.</li>
      </ul>
      
      <h3>DIY vs. Professional Striping</h3>
      <p>While DIY striping may seem cost-effective initially, professional services offer several advantages:</p>
      <ul>
        <li>Proper equipment for clean, straight lines</li>
        <li>Knowledge of ADA compliance requirements</li>
        <li>Efficient completion with minimal disruption</li>
        <li>Superior materials with better durability</li>
        <li>Warranty protection</li>
      </ul>
      
      <h3>Conclusion</h3>
      <p>Investing in professional parking lot striping delivers value beyond just the visual appeal. For an accurate estimate tailored to your specific property, consider using LotQuote's instant quote tool, which factors in your exact lot dimensions and requirements.</p>
      
      <p>Remember that while cost is important, the safety of your visitors and compliance with local regulations should remain top priorities when planning your parking lot maintenance.</p>
    `
  },
  "sealcoating-saves-money": {
    id: "sealcoating-saves-money",
    title: "Why Sealcoating Your Asphalt Parking Lot Saves You Thousands",
    description: "Learn how preventative maintenance through sealcoating can extend your parking lot's life and save significant repair costs.",
    date: "April 10, 2025",
    readTime: "5 min read",
    imageSrc: "https://i.imgur.com/FWMzrYq.png",
    imageAlt: "Worker applying sealcoat to a parking lot",
    content: `
      <h2>The Financial Benefits of Regular Sealcoating</h2>
      <p>Many property managers view parking lot maintenance as an expense rather than an investment. This perspective often leads to deferred maintenance and eventually, costly repairs or complete replacement. Sealcoating, while requiring an upfront cost, delivers substantial long-term savings.</p>
      
      <h3>How Sealcoating Protects Your Investment</h3>
      <p>Asphalt pavement is constantly exposed to damaging elements:</p>
      <ul>
        <li>UV radiation that breaks down binder materials</li>
        <li>Water penetration that weakens the base structure</li>
        <li>Oil and chemical spills that deteriorate the surface</li>
        <li>Freeze-thaw cycles that create cracks and potholes</li>
      </ul>
      
      <p>Sealcoating creates a protective barrier against these elements, significantly extending your pavement's lifespan.</p>
      
      <h3>The Cost Comparison: Maintenance vs. Replacement</h3>
      <p>Let's look at the numbers for a typical 50,000 square foot commercial parking lot:</p>
      
      <p><strong>Option 1: No Regular Maintenance</strong></p>
      <ul>
        <li>Complete asphalt replacement after 8-10 years: $150,000-$275,000</li>
        <li>Business disruption costs during replacement: $5,000-$15,000</li>
        <li>Total cost over 20 years (with two replacements): $310,000-$580,000</li>
      </ul>
      
      <p><strong>Option 2: Regular Sealcoating and Crack Filling</strong></p>
      <ul>
        <li>Sealcoating every 3-5 years ($0.15-$0.25/sq ft): $7,500-$12,500 per application</li>
        <li>Crack filling as needed ($1-$3 per linear foot): $1,000-$3,000 every other year</li>
        <li>Minor repairs: $5,000-$10,000 every 5 years</li>
        <li>Potential single replacement after 20+ years: $150,000-$275,000</li>
        <li>Total cost over 20 years: $89,000-$162,500</li>
      </ul>
      
      <p>The difference is clear: proper maintenance with regular sealcoating can save $220,000-$417,500 over a 20-year period for this size lot.</p>
      
      <h3>Additional Financial Benefits</h3>
      <ul>
        <li><strong>Improved Property Value:</strong> Well-maintained pavement enhances overall property value and curb appeal.</li>
        <li><strong>Reduced Liability:</strong> Fewer cracks and potholes mean reduced risk of trips, falls, and vehicle damage claims.</li>
        <li><strong>Better Drainage:</strong> Properly maintained surfaces prevent water pooling and resultant structural damage.</li>
        <li><strong>Enhanced Aesthetics:</strong> A well-maintained lot creates positive first impressions for customers and visitors.</li>
      </ul>
      
      <h3>Best Practices for Maximum Savings</h3>
      <p>To get the most financial benefit from your sealcoating program:</p>
      <ul>
        <li>Start sealcoating within 1-2 years of new pavement installation</li>
        <li>Develop a consistent maintenance schedule</li>
        <li>Address cracks and minor damage promptly</li>
        <li>Use high-quality materials and experienced contractors</li>
        <li>Consider climate factors when scheduling applications</li>
      </ul>
      
      <h3>Conclusion</h3>
      <p>Sealcoating is not just about aesthetics—it's a crucial financial strategy for property managers looking to protect their asphalt investment. The upfront costs are significantly outweighed by the long-term savings realized through extended pavement life and avoided major repairs.</p>
      
      <p>For a personalized assessment of how a sealcoating program could benefit your specific property, contact LotQuote today for a comprehensive pavement maintenance plan.</p>
    `
  },
  "when-to-restripe-parking-lot": {
    id: "when-to-restripe-parking-lot",
    title: "Top 5 Signs It's Time to Re-Stripe Your Parking Lot",
    description: "Identify the key indicators that your parking lot needs restriping to maintain safety and aesthetics.",
    date: "March 28, 2025",
    readTime: "4 min read",
    imageSrc: "https://i.imgur.com/BLpHg6H.png",
    imageAlt: "Worker applying fresh striping to a parking lot",
    content: `
      <h2>Is It Time to Refresh Your Parking Lot Lines?</h2>
      <p>Parking lot striping is often overlooked until it becomes a significant problem. Well-maintained striping is not merely about aesthetics—it's essential for traffic flow, safety, and compliance. Here are the five key indicators that it's time to restripe your parking lot.</p>
      
      <h3>1. Visible Fading</h3>
      <p>The most obvious sign is when your parking lines have faded to the point where they're difficult to see, especially in low light conditions. Factors that accelerate fading include:</p>
      <ul>
        <li>Consistent exposure to harsh sunlight</li>
        <li>Frequent traffic wearing down the paint</li>
        <li>Harsh winters with salt and snowplow damage</li>
        <li>Lower quality paint used in previous striping</li>
      </ul>
      
      <p>If drivers need to guess where parking spaces begin and end, it's definitely time to restripe.</p>
      
      <h3>2. Safety Concerns or Near-Misses</h3>
      <p>When you start noticing:</p>
      <ul>
        <li>Cars parked haphazardly outside designated areas</li>
        <li>Confusion at intersections within your lot</li>
        <li>Near-miss incidents or minor fender benders</li>
        <li>Pedestrians walking through traffic areas rather than designated walkways</li>
      </ul>
      
      <p>These safety concerns often stem from unclear markings and should prompt immediate restriping consideration.</p>
      
      <h3>3. ADA Compliance Issues</h3>
      <p>ADA requirements for parking lots can change, and non-compliance can result in complaints or even legal action. Signs you may have ADA compliance issues include:</p>
      <ul>
        <li>Faded or missing handicap symbols</li>
        <li>Access aisles that are too narrow or unmarked</li>
        <li>Insufficient number of accessible spaces based on lot size</li>
        <li>Missing or improperly placed signage for accessible spaces</li>
      </ul>
      
      <p>Regular restriping provides an opportunity to ensure your lot remains compliant with current accessibility standards.</p>
      
      <h3>4. Recent Pavement Maintenance</h3>
      <p>If you've recently completed any of these pavement maintenance projects, restriping should follow:</p>
      <ul>
        <li>Sealcoating application</li>
        <li>Asphalt repair or patching</li>
        <li>Resurfacing or overlay installation</li>
        <li>Full pavement replacement</li>
      </ul>
      
      <p>Fresh pavement deserves fresh striping to maximize both functionality and appearance.</p>
      
      <h3>5. Layout Efficiency Problems</h3>
      <p>Over time, your property's needs may change. Consider restriping when you notice:</p>
      <ul>
        <li>Consistent parking capacity issues</li>
        <li>Oversized spaces that waste valuable real estate</li>
        <li>Traffic flow bottlenecks during peak hours</li>
        <li>Changed business needs (more customer parking vs. employee parking)</li>
      </ul>
      
      <p>Restriping provides an opportunity to reconfigure your layout for maximum efficiency and accommodating changing needs.</p>
      
      <h3>How Often Should You Restripe?</h3>
      <p>While there's no one-size-fits-all answer, most commercial properties benefit from restriping every 12-24 months. Factors affecting this timeline include:</p>
      <ul>
        <li>Traffic volume (high-traffic areas need more frequent restriping)</li>
        <li>Climate conditions (extreme weather accelerates fading)</li>
        <li>Paint quality from previous application</li>
        <li>Whether the lot has been sealed recently</li>
      </ul>
      
      <h3>Planning Your Restriping Project</h3>
      <p>When you identify these signs, consider these next steps:</p>
      <ul>
        <li>Schedule during off-peak business hours to minimize disruption</li>
        <li>Consider combining with sealcoating for maximum pavement protection</li>
        <li>Consult with a professional about optimizing your layout</li>
        <li>Request higher-durability paint options for longer-lasting results</li>
      </ul>
      
      <h3>Conclusion</h3>
      <p>Don't wait until your parking lot striping is completely illegible to take action. Proactive restriping maintains safety, compliance, and property appearance. For a professional assessment of your parking lot's striping needs, contact LotQuote today.</p>
    `
  },
  "ada-parking-lot-compliance-guide": {
    id: "ada-parking-lot-compliance-guide",
    title: "Understanding ADA Compliance for Parking Lot Striping",
    description: "A comprehensive guide to ADA regulations for commercial parking lots and how to ensure your property remains compliant.",
    date: "March 22, 2025",
    readTime: "8 min read",
    imageSrc: "https://i.imgur.com/ojUWnBl.png",
    imageAlt: "ADA compliant handicap parking space with proper markings",
    content: `
      <h2>The Essential Guide to ADA Compliant Parking Lots</h2>
      <p>The Americans with Disabilities Act (ADA) established crucial standards for accessible parking that apply to virtually all businesses and public facilities. Non-compliance can result in complaints, legal action, and significant penalties. This guide covers everything property managers need to know about maintaining ADA compliance in their parking facilities.</p>
      
      <h3>Required Number of Accessible Spaces</h3>
      <p>The ADA specifies the minimum number of accessible parking spaces required based on the total number of spaces in your parking lot:</p>
      <ul>
        <li>1-25 total spaces: 1 accessible space required</li>
        <li>26-50 total spaces: 2 accessible spaces required</li>
        <li>51-75 total spaces: 3 accessible spaces required</li>
        <li>76-100 total spaces: 4 accessible spaces required</li>
        <li>101-150 total spaces: 5 accessible spaces required</li>
        <li>151-200 total spaces: 6 accessible spaces required</li>
        <li>201-300 total spaces: 7 accessible spaces required</li>
        <li>301-400 total spaces: 8 accessible spaces required</li>
        <li>401-500 total spaces: 9 accessible spaces required</li>
        <li>501-1000 total spaces: 2% of total spaces</li>
        <li>1001+ total spaces: 20 plus 1 for each 100 over 1000</li>
      </ul>
      
      <p>Additionally, for every six accessible spaces (or fraction thereof), at least one must be van-accessible.</p>
      
      <h3>Accessible Space Dimensions and Markings</h3>
      <p>Standard accessible spaces must meet these requirements:</p>
      <ul>
        <li>Minimum width: 8 feet (96 inches)</li>
        <li>Access aisle: At least 5 feet wide</li>
        <li>Van-accessible spaces: 8-foot space with 8-foot access aisle OR 11-foot space with 5-foot access aisle</li>
        <li>Access aisles must be marked with diagonal striping</li>
        <li>The international symbol of accessibility (wheelchair symbol) must be painted within each space</li>
        <li>Surface slope must not exceed 1:48 (2.08%) in any direction</li>
      </ul>
      
      <h3>Signage Requirements</h3>
      <p>Each accessible space must have a sign that:</p>
      <ul>
        <li>Is mounted at least 60 inches above the ground (measured to the bottom of the sign)</li>
        <li>Shows the International Symbol of Accessibility</li>
        <li>States "Van Accessible" on signs for van spaces</li>
        <li>Cannot be obstructed by vehicles parked in the space</li>
        <li>May include enforcement language as permitted by local ordinances</li>
      </ul>
      
      <p>Note that some states have additional signage requirements beyond federal ADA standards.</p>
      
      <h3>Location of Accessible Spaces</h3>
      <p>Accessible parking spaces must be:</p>
      <ul>
        <li>Located on the shortest accessible route to an accessible entrance</li>
        <li>Evenly distributed if there are multiple accessible entrances</li>
        <li>Connected to the accessible entrance by an accessible route that does not require travel behind parked vehicles</li>
        <li>As level as possible with surface slopes not exceeding 1:48 in any direction</li>
      </ul>
      
      <h3>2025 Updates and Common Misconceptions</h3>
      <p>While the ADA standards were last significantly updated in 2010, there are some important clarifications and court rulings that affect implementation in 2025:</p>
      <ul>
        <li>Access aisles must connect to an accessible route to the building entrance</li>
        <li>Both the parking space and access aisle must be properly marked</li>
        <li>Accessible routes must remain clear of snow, debris, and other obstructions</li>
        <li>Maintenance of accessible features is as important as initial compliance</li>
        <li>Temporary events with temporary parking must also provide accessible spaces</li>
      </ul>
      
      <h3>Compliance Checklist for Property Managers</h3>
      <p>Use this checklist to evaluate your parking lot's ADA compliance:</p>
      <ul>
        <li>Correct number of accessible spaces based on total parking capacity</li>
        <li>Proper number of van-accessible spaces</li>
        <li>Spaces and access aisles meet dimension requirements</li>
        <li>All required signage is present and properly mounted</li>
        <li>Accessible route connects to building entrance without obstructions</li>
        <li>Slope requirements met throughout accessible parking areas</li>
        <li>Regular maintenance program to ensure continued compliance</li>
        <li>Staff training to prevent temporary blockages of accessible routes</li>
      </ul>
      
      <h3>Penalties for Non-Compliance</h3>
      <p>Failing to meet ADA requirements can result in:</p>
      <ul>
        <li>Federal civil penalties up to $75,000 for a first violation</li>
        <li>Up to $150,000 for subsequent violations</li>
        <li>Private lawsuits resulting in legal fees and mandated remediation</li>
        <li>Damage to reputation and potential loss of customers</li>
      </ul>
      
      <h3>Conclusion</h3>
      <p>ADA compliance is not just a legal requirement—it's a commitment to accessibility for all customers and visitors. Regular evaluation and maintenance of your parking lot's accessible features ensures continued compliance and demonstrates your business's dedication to inclusivity.</p>
      
      <p>For a professional assessment of your parking lot's ADA compliance or to schedule compliant restriping, contact LotQuote for a consultation.</p>
    `
  },
  "best-time-for-parking-lot-maintenance": {
    id: "best-time-for-parking-lot-maintenance",
    title: "The Best Times of Year to Repaint or Seal Your Parking Lot",
    description: "Strategic timing for parking lot maintenance projects to maximize durability and minimize business disruption.",
    date: "March 15, 2025",
    readTime: "6 min read",
    imageSrc: "https://i.imgur.com/NUBEUf3.png",
    imageAlt: "Seasonal maintenance worker with checklist in safety vest",
    content: `
      <h2>Strategic Timing for Parking Lot Maintenance</h2>
      <p>Scheduling parking lot maintenance isn't just about finding a convenient time—it's about choosing the optimal conditions for durability, cost-effectiveness, and minimal disruption. This guide will help you identify the ideal times to schedule your parking lot striping and sealcoating projects.</p>
      
      <h3>Weather Considerations for Optimal Results</h3>
      <p>Both sealcoating and striping are heavily dependent on weather conditions:</p>
      
      <p><strong>Temperature Requirements:</strong></p>
      <ul>
        <li>Ideal daytime temperature: 50°F to 90°F (10°C to 32°C)</li>
        <li>Overnight temperatures should remain above 50°F (10°C) for proper curing</li>
        <li>Surface temperature is often higher than air temperature in direct sunlight</li>
      </ul>
      
      <p><strong>Moisture Considerations:</strong></p>
      <ul>
        <li>No rain forecasted for 24-48 hours after application</li>
        <li>Low humidity levels promote faster drying</li>
        <li>Pavement must be completely dry before application</li>
      </ul>
      
      <h3>Seasonal Breakdown by Region</h3>
      
      <p><strong>Northern/Colder Regions:</strong></p>
      <ul>
        <li>Best months: Late May through early October</li>
        <li>Prime time: July and August when temperatures are most reliable</li>
        <li>Avoid: Late fall through early spring due to freezing temperatures</li>
      </ul>
      
      <p><strong>Southern/Warmer Regions:</strong></p>
      <ul>
        <li>Best months: March through November</li>
        <li>Prime time: Spring (March-May) and Fall (September-November)</li>
        <li>Caution period: Mid-summer when extreme heat can affect drying time and application quality</li>
      </ul>
      
      <p><strong>Coastal Areas:</strong></p>
      <ul>
        <li>Best months: Determined more by dry periods than temperature</li>
        <li>Considerations: Higher humidity requires additional drying time</li>
        <li>Schedule around typical fog patterns in coastal areas</li>
      </ul>
      
      <h3>Business Timing Considerations</h3>
      <p>Beyond weather, consider your business operations:</p>
      <ul>
        <li><strong>Retail Properties:</strong> Schedule during slower business periods (typically January-February or mid-week)</li>
        <li><strong>Office Complexes:</strong> Weekends or holiday periods when fewer employees are present</li>
        <li><strong>Educational Facilities:</strong> Summer breaks or extended holiday periods</li>
        <li><strong>Industrial Properties:</strong> Coordinate with shipping/receiving schedules</li>
        <li><strong>Hotels:</strong> During lowest occupancy seasons specific to your location</li>
      </ul>
      
      <h3>Project Sequencing for Multiple Maintenance Tasks</h3>
      <p>If you're planning comprehensive parking lot maintenance, proper sequencing is crucial:</p>
      <ol>
        <li>Asphalt repairs and crack filling (allow 1-2 days to cure)</li>
        <li>Sealcoating application (allow 24-48 hours to cure completely)</li>
        <li>Parking lot striping (allow 24 hours before allowing traffic)</li>
      </ol>
      
      <p>This sequence ensures each layer properly bonds and creates a comprehensive protection system.</p>
      
      <h3>Advanced Planning Tips</h3>
      <ul>
        <li>Schedule maintenance 4-6 weeks in advance to secure preferred timing</li>
        <li>Have contingency dates planned in case of unfavorable weather</li>
        <li>Consider night work for busy commercial properties to minimize disruption</li>
        <li>Plan phased approaches for larger lots to keep portions accessible</li>
        <li>Communicate with tenants, customers, and employees well in advance</li>
      </ul>
      
      <h3>Signs You Shouldn't Delay Maintenance</h3>
      <p>While timing is important, some situations call for immediate attention regardless of season:</p>
      <ul>
        <li>Safety hazards from extremely faded lines</li>
        <li>ADA compliance issues</li>
        <li>Water penetrating through cracks before winter freeze in northern climates</li>
        <li>Property sale or major tenant inspections</li>
      </ul>
      
      <h3>Conclusion</h3>
      <p>Strategic timing of your parking lot maintenance projects ensures maximum durability and value for your investment. By considering both optimal weather conditions and business operations, you can minimize disruption while maximizing the lifespan of your pavement markings and sealcoating.</p>
      
      <p>For professional guidance on scheduling your specific parking lot maintenance needs, contact LotQuote for a personalized consultation and maintenance plan.</p>
    `
  }
};

export default function BlogPostPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [post, setPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    // Scroll to top when navigating to a blog post
    window.scrollTo(0, 0);
    
    // Check if the blog post exists
    if (id && blogPosts[id]) {
      setPost(blogPosts[id]);
      // Set page title and meta description
      document.title = `${blogPosts[id].title} | LotQuote Blog`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute("content", blogPosts[id].description);
      }
    } else {
      // Redirect to blog index if post doesn't exist
      setLocation("/blog");
    }
  }, [id, setLocation]);

  // Handle share functionality
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: post?.title,
        text: post?.description,
        url: window.location.href,
      }).catch((error) => console.log('Error sharing', error));
    } else {
      // Fallback - copy to clipboard
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('Link copied to clipboard!'))
        .catch(err => console.error('Could not copy text: ', err));
    }
  };

  if (!post) {
    return (
      <Layout>
        <div className="container mx-auto py-12 px-4">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/blog" className="inline-flex items-center text-primary hover:text-primary/80 transition-colors">
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back to all articles
          </Link>
        </div>

        <article className="max-w-4xl mx-auto">
          <div className="h-[24rem] w-full flex items-center justify-center overflow-hidden rounded-lg mb-8 bg-[#c9e5f7]">
            <img 
              src={post.imageSrc}
              alt={post.imageAlt}
              className="w-[95%] h-[95%] object-contain p-2 rounded-lg"
            />
          </div>

          <div className="prose prose-orange lg:prose-lg max-w-none">
            <h1 className="text-4xl font-bold text-foreground mb-4">{post.title}</h1>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
              <div className="flex items-center">
                <CalendarIcon className="mr-1 h-4 w-4" />
                {post.date}
              </div>
              <div className="flex items-center">
                <Clock3Icon className="mr-1 h-4 w-4" />
                {post.readTime}
              </div>
              <button 
                onClick={handleShare}
                className="flex items-center text-primary hover:text-primary/80 transition-colors"
              >
                <Share2Icon className="mr-1 h-4 w-4" />
                Share
              </button>
            </div>

            <Separator className="my-6" />
            
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          </div>

          <Separator className="my-12" />

          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Ready to improve your parking lot?</h3>
            <p className="text-muted-foreground mb-6">Get an instant quote for your parking lot maintenance needs.</p>
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
        </article>
      </div>
    </Layout>
  );
}