import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { SearchHistory } from "@shared/schema";
import { Loader2, MapPin, History, ChevronRight, Clock } from "lucide-react";
import { Link } from "wouter";
import { format, formatDistance } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";

export default function HistoryPage() {
  const { user } = useAuth();
  
  const { data: searchHistory, isLoading: isSearchHistoryLoading } = useQuery<SearchHistory[]>({
    queryKey: ["/api/search-history"],
    // Only fetch when user is logged in
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Your Analysis History</h1>
          <p className="text-muted-foreground">
            {user?.paymentPlan === 'free' 
              ? 'View and access your previous 3 analyses' 
              : 'View and access all your previous analyses'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Address Analysis History</CardTitle>
            <CardDescription>
              Click on any address to revisit your previous analysis with all markings preserved
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSearchHistoryLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !searchHistory || searchHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No analysis history yet.</p>
                <p className="text-sm mb-4">Try searching for an address to get started!</p>
                <Button 
                  onClick={() => window.location.href = '/map'}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  Start New Analysis
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {searchHistory.map((item) => (
                  <Link to={`/map/${encodeURIComponent(item.address)}`} key={item.id}>
                    <div className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="bg-primary/10 p-2 rounded-md">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.address}</p>
                        <p className="text-sm text-muted-foreground flex items-center mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDistance(new Date(item.createdAt), new Date(), { addSuffix: true })}
                        </p>
                        {item.hasDetections && (
                          <>
                            {item.processedImageId && (
                              <div className="mt-2 mb-2">
                                <img 
                                  src={item.processedImageId.startsWith('data:') ? item.processedImageId : `/${item.processedImageId}`} 
                                  alt="Processed parking lot"
                                  className="w-full h-32 object-cover rounded-md"
                                />
                              </div>
                            )}
                            <div className="flex space-x-3 mt-2">
                              {/* Show parking spaces if in spaces mode */}
                              {item.parkingSpaces !== null && (
                                <span className="text-xs px-2 py-1 bg-secondary rounded-md">
                                  {item.parkingSpaces} spaces
                                </span>
                              )}
                              
                              {/* Show area if in area mode */}
                              {item.total_area_sqyd && (
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-md">
                                  {item.total_area_sqyd.toLocaleString()} sq. yd.
                                </span>
                              )}
                              
                              {/* Show price range */}
                              {(item.lowerEstimate || item.upperEstimate) && (
                                <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-md">
                                  ${item.lowerEstimate?.toLocaleString()} - ${item.upperEstimate?.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Free plan information */}
        {user?.paymentPlan === 'free' && (
          <div className="mt-6 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-blue-100 rounded-md">
                <History className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">Free Plan Limits</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-3">
                  On the free plan, you can access up to 3 unique addresses per month. 
                  You can always revisit and modify previous analyses even after reaching your limit.
                </p>
                <Button 
                  onClick={() => window.location.href = '/payment-plan'}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                  size="sm"
                >
                  Upgrade for Unlimited Addresses
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
