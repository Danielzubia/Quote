import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Header } from "@/components/header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { SearchHistory } from "@shared/schema";
import { 
  Loader2, MapPin, LogOut, User, Clock, Badge, Settings, History, ChevronRight, 
  FileText, CreditCard, CalendarIcon, AlertTriangle, CheckCircle2, Zap,
  PackageCheck, BarChart3, Edit
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format, formatDistance } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge as UIBadge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

export default function ProfilePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  
  const { data: searchHistory, isLoading: isSearchHistoryLoading } = useQuery<SearchHistory[]>({
    queryKey: ["/api/search-history"],
  });
  
  // Define the type for subscription data
  interface SubscriptionData {
    subscribed: boolean;
    status?: string;
    currentPeriodEnd?: string;
    plan?: string;
    paymentMethod?: {
      brand?: string;
      last4?: string;
      expMonth?: number;
      expYear?: number;
    };
  }
  
  // Query to get the user's Stripe subscription data
  const { data: subscriptionData, isLoading: isSubscriptionLoading } = useQuery<SubscriptionData>({
    queryKey: ["/api/stripe/subscription"],
    enabled: !!user && user.paymentPlan !== 'free', // Only fetch if user is on a paid plan
  });
  
  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Logged out",
          description: "You have been successfully logged out.",
        });
        setLocation('/');
        // Ensure it scrolls to top
        window.scrollTo(0, 0);
      }
    });
  };

  // Helper for tab selection
  const selectTab = (tabValue: string) => {
    const tabElement = document.querySelector(`[data-value="${tabValue}"]`) as HTMLElement;
    if (tabElement) tabElement.click();
  };

  // Get user's address usage (safely)
  const getAddressUsage = () => {
    if (typeof user?.addressUsageCount === 'number') return user.addressUsageCount;
    return 0;
  };

  // Get the user's initials for the avatar
  const getUserInitials = () => {
    if (!user?.username) return "U";
    return user.username.slice(0, 2).toUpperCase();
  };

  // Get the formatted subscription plan name
  const getPlanName = () => {
    if (!user?.paymentPlan) return "Free";
    if (user.paymentPlan === "team") return "Enterprise";
    return user.paymentPlan.charAt(0).toUpperCase() + user.paymentPlan.slice(1);
  };

  // Get the badge color based on plan
  const getPlanBadgeColor = () => {
    switch (user?.paymentPlan) {
      case "pro": return "bg-orange-500";
      case "team": return "bg-indigo-500";
      default: return "bg-slate-500";
    }
  };

  // Get plan features based on the current plan
  const getPlanFeatures = () => {
    switch(user?.paymentPlan) {
      case "pro":
        return [
          { feature: "Unlimited estimates", included: true },
          { feature: "Branded quote exports", included: true },
          { feature: "Lead capture", included: true },
          { feature: "Priority support", included: true },
        ];
      case "team":
        return [
          { feature: "Multi-user access", included: true },
          { feature: "Priority Zip Code leads", included: true },
          { feature: "Custom branding", included: true },
          { feature: "Integration with QuickBooks, Jobber, etc.", included: true },
        ];
      default: // free
        return [
          { feature: "3 estimates per month", included: true },
          { feature: "Draw & count spaces", included: true },
          { feature: "Basic quote preview", included: true },
          { feature: "Email support", included: true },
        ];
    }
  };

  // Get plan price
  const getPlanPrice = () => {
    switch(user?.paymentPlan) {
      case "pro": return "$49";
      case "team": return "$149+";
      default: return "$0";
    }
  };

  // Get next billing date from subscription data
  const getNextBillingDate = () => {
    if (user?.paymentPlan === "free") return null;
    
    // Check if we have subscription data from Stripe
    if (subscriptionData?.currentPeriodEnd) {
      return new Date(subscriptionData.currentPeriodEnd);
    }
    
    // Fallback to one month from now if no data
    return new Date(new Date().setMonth(new Date().getMonth() + 1));
  };
  
  // Get payment method details
  const getPaymentMethodDetails = () => {
    // Default values
    let brand = 'card';
    let last4 = '4242'; // Default last4 digits
    
    // Check if we have actual payment method data from Stripe
    if (subscriptionData?.paymentMethod?.brand) {
      brand = subscriptionData.paymentMethod.brand;
    }
    
    if (subscriptionData?.paymentMethod?.last4) {
      last4 = subscriptionData.paymentMethod.last4;
    }
    
    return { brand, last4 };
  };

  // Get most recent searches (limit to 5)
  const recentSearches = searchHistory?.slice(0, 5) || [];

  // Handle plan cancellation via Stripe
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to cancel subscription');
      }
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled. You'll have access until the end of your billing period.",
      });
      setShowCancelConfirmation(false);
      // Refetch user data to show updated plan status
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stripe/subscription'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription. Please try again.",
        variant: "destructive"
      });
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Left sidebar - User info */}
          <div className="md:col-span-1">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center mb-6">
                  <Avatar className="h-24 w-24 mb-4">
                    <AvatarFallback className="text-xl bg-primary/10 text-primary">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-bold">{user?.username}</h2>
                  <div className="mt-2">
                    <UIBadge className={`${getPlanBadgeColor()} hover:${getPlanBadgeColor()}`}>
                      {getPlanName()} Plan
                    </UIBadge>
                  </div>
                </div>
                
                <div className="space-y-2 mb-6">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      const tabElement = document.querySelector('[data-value="subscription"]') as HTMLElement;
                      if (tabElement) tabElement.click();
                    }}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Manage Subscription
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {logoutMutation.isPending ? "Logging out..." : "Log out"}
                  </Button>
                </div>

                {user?.paymentPlan === 'free' && (
                  <div className="p-3 bg-primary/10 rounded-md mt-4">
                    <p className="text-sm font-medium mb-2">Free Plan Limits</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      You've used {getAddressUsage()} of 3 monthly addresses
                    </p>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full"
                        style={{ width: `${Math.min(100, (getAddressUsage() / 3) * 100)}%` }}
                      ></div>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => setLocation('/payment-plan')}
                    >
                      Upgrade Plan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right content area - Tabs */}
          <div className="md:col-span-3">
            <Tabs defaultValue="recent" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="recent">Recent Activity</TabsTrigger>
                <TabsTrigger value="all">All History</TabsTrigger>
                <TabsTrigger value="subscription">Subscription</TabsTrigger>
              </TabsList>
              
              {/* Recent Activity Tab */}
              <TabsContent value="recent">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Your latest searches and quotes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isSearchHistoryLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : recentSearches.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No recent activity yet.</p>
                        <p className="text-sm">Try searching for an address to get started!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {recentSearches.map((item) => (
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
                                      {item.parkingSpaces !== null && (
                                        <span className="text-xs px-2 py-1 bg-secondary rounded-md">
                                          {item.parkingSpaces} spaces
                                        </span>
                                      )}
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
                        
                        {searchHistory && searchHistory.length > 5 && (
                          <div className="text-center pt-2">
                            <Button variant="ghost" size="sm" onClick={() => selectTab("all")}>
                              View all {searchHistory.length} searches
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-md">New Quote</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create a new quote from satellite imagery
                      </p>
                      <Button 
                        className="w-full" 
                        onClick={() => {
                          setLocation('/map');
                          // Ensure it scrolls to top
                          window.scrollTo(0, 0);
                        }}
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        Start New Quote
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-md">Free Quote Tool</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Use our quick quote estimator
                      </p>
                      <Button 
                        variant="secondary"
                        className="w-full"
                        onClick={() => setLocation('/map?returnTo=quote')}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Free Quote Tool
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              {/* All History Tab */}
              <TabsContent value="all">
                <Card>
                  <CardHeader>
                    <CardTitle>Complete History</CardTitle>
                    <CardDescription>All your past searches and quotes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isSearchHistoryLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : searchHistory?.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No search history yet.</p>
                        <p className="text-sm">Try searching for an address to get started!</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px] pr-4">
                        <div className="space-y-4">
                          {searchHistory?.map((item) => (
                            <div key={item.id} className="border rounded-lg overflow-hidden">
                              <div className="p-4">
                                <Link to={`/map/${encodeURIComponent(item.address)}`}>
                                  <div className="flex items-center gap-2 hover:text-primary cursor-pointer">
                                    <MapPin className="h-5 w-5" />
                                    <p className="font-medium">{item.address}</p>
                                  </div>
                                </Link>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {format(new Date(item.createdAt), "PPP 'at' pp")}
                                </p>
                                
                                {item.hasDetections && (
                                  <div className="mt-4 border-t pt-4">
                                    <div className="flex flex-wrap gap-3">
                                      {item.processedImageId && (
                                        <img 
                                          src={item.processedImageId.startsWith('data:') ? item.processedImageId : `/${item.processedImageId}`} 
                                          alt="Processed parking lot"
                                          className="w-full h-48 object-cover rounded-md mb-3"
                                        />
                                      )}
                                      
                                      <div className="grid grid-cols-4 w-full gap-2">
                                        {item.parkingSpaces !== null && (
                                          <div className="bg-muted p-2 rounded text-center">
                                            <p className="text-xs text-muted-foreground">Parking</p>
                                            <p className="text-lg font-semibold">{item.parkingSpaces}</p>
                                          </div>
                                        )}
                                        {item.handicapSpots !== null && (
                                          <div className="bg-muted p-2 rounded text-center">
                                            <p className="text-xs text-muted-foreground">Handicap</p>
                                            <p className="text-lg font-semibold">{item.handicapSpots}</p>
                                          </div>
                                        )}
                                        {item.crosswalks !== null && (
                                          <div className="bg-muted p-2 rounded text-center">
                                            <p className="text-xs text-muted-foreground">Crosswalks</p>
                                            <p className="text-lg font-semibold">{item.crosswalks}</p>
                                          </div>
                                        )}
                                        {item.arrows !== null && (
                                          <div className="bg-muted p-2 rounded text-center">
                                            <p className="text-xs text-muted-foreground">Arrows</p>
                                            <p className="text-lg font-semibold">{item.arrows}</p>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {(item.lowerEstimate || item.upperEstimate) && (
                                        <div className="w-full mt-2 p-3 bg-green-50 text-green-800 rounded-md">
                                          <p className="text-sm font-medium">Estimated Price</p>
                                          <p className="text-xl font-bold">
                                            ${item.lowerEstimate?.toLocaleString()} - ${item.upperEstimate?.toLocaleString()}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Subscription Management Tab */}
              <TabsContent value="subscription">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Current Plan Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Current Plan</CardTitle>
                      <CardDescription>Your active subscription details</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                              {getPlanName()} Plan
                              <UIBadge className={`${getPlanBadgeColor()} hover:${getPlanBadgeColor()}`}>
                                {subscriptionData?.status ? 
                                  subscriptionData.status.charAt(0).toUpperCase() + subscriptionData.status.slice(1) : 
                                  'Active'}
                              </UIBadge>
                            </h3>
                            <p className="text-muted-foreground mt-1">{getPlanPrice()}/month</p>
                          </div>
                          {user?.paymentPlan !== 'free' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setShowCancelConfirmation(true)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>

                        {user?.paymentPlan !== 'free' && (
                          <div className="border-t border-b py-4 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Next billing date</span>
                              <span className="font-medium flex items-center">
                                <CalendarIcon className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                {getNextBillingDate() ? format(getNextBillingDate()!, "MMMM d, yyyy") : "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Payment method</span>
                              <span className="font-medium flex items-center">
                                <CreditCard className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                {subscriptionData?.paymentMethod?.brand && subscriptionData?.paymentMethod?.last4 ? 
                                  `${subscriptionData.paymentMethod.brand.charAt(0).toUpperCase() + subscriptionData.paymentMethod.brand.slice(1)} •••• ${subscriptionData.paymentMethod.last4}` : 
                                  'Card •••• 4242'}
                              </span>
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="font-medium mb-2">Included Features</h4>
                          <ul className="space-y-2">
                            {getPlanFeatures().map((feature, index) => (
                              <li key={index} className="flex items-start text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                                <span>{feature.feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {user?.paymentPlan === 'free' && (
                          <div className="flex items-center justify-center">
                            <Button 
                              className="w-full"
                              onClick={() => {
                                setLocation('/payment-plan?upgrade=true');
                                // Ensure it scrolls to top
                                window.scrollTo(0, 0);
                              }}
                            >
                              <Zap className="mr-2 h-4 w-4" />
                              Upgrade Now
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Plan Management Card */}
                  <div className="space-y-6">
                    {/* Billing Settings Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Billing Settings</CardTitle>
                        <CardDescription>Manage your payment methods and billing preferences</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {user?.paymentPlan !== 'free' ? (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 border rounded-md">
                              <div className="flex items-center">
                                <div className="bg-primary/10 p-2 rounded-md mr-3">
                                  <CreditCard className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {subscriptionData?.paymentMethod?.brand ? 
                                      `${subscriptionData.paymentMethod.brand.charAt(0).toUpperCase() + subscriptionData.paymentMethod.brand.slice(1)}` : 
                                      'Visa'} 
                                    {subscriptionData?.paymentMethod?.last4 ? 
                                      `•••• ${subscriptionData.paymentMethod.last4}` : 
                                      '•••• 4242'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {subscriptionData?.paymentMethod?.expMonth && subscriptionData?.paymentMethod?.expYear ? 
                                      `Expires ${subscriptionData.paymentMethod.expMonth}/${String(subscriptionData.paymentMethod.expYear).slice(-2)}` : 
                                      'Active payment method'}
                                  </p>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch id="auto-renew" defaultChecked />
                              <Label htmlFor="auto-renew">Auto-renew subscription</Label>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <PackageCheck className="h-12 w-12 text-muted-foreground opacity-20 mx-auto mb-3" />
                            <p className="text-muted-foreground mb-4">
                              You're currently on the Free plan with no billing information
                            </p>
                            <Button onClick={() => {
                              setLocation('/payment-plan?upgrade=true');
                              // Ensure it scrolls to top
                              window.scrollTo(0, 0);
                            }}>
                              Add Payment Method
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Usage Statistics Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Usage Statistics</CardTitle>
                        <CardDescription>Your account activity this billing period</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between mb-1">
                              <p className="text-sm font-medium">Addresses Used</p>
                              <p className="text-sm font-medium">
                                {getAddressUsage()} / {user?.paymentPlan === 'free' ? '3' : '∞'}
                              </p>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${user?.paymentPlan === 'free' ? 'bg-primary' : 'bg-green-500'}`}
                                style={{ 
                                  width: user?.paymentPlan === 'free' 
                                    ? `${Math.min(100, (getAddressUsage() / 3) * 100)}%`
                                    : '100%'
                                }}
                              ></div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="border rounded-md p-3 text-center">
                              <p className="text-xs text-muted-foreground mb-1">Quotes Generated</p>
                              <p className="text-2xl font-bold">{searchHistory?.filter(h => h.hasDetections).length || 0}</p>
                            </div>
                            <div className="border rounded-md p-3 text-center">
                              <p className="text-xs text-muted-foreground mb-1">Total Searches</p>
                              <p className="text-2xl font-bold">{searchHistory?.length || 0}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Available plans card */}
                {user?.paymentPlan !== 'team' && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Available Plans</CardTitle>
                      <CardDescription>
                        Explore other subscription options that might better suit your needs
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {user?.paymentPlan !== 'pro' && (
                          <div className="border rounded-lg p-4 flex flex-col">
                            <div className="mb-4">
                              <h3 className="text-lg font-semibold">Pro Plan</h3>
                              <p className="text-2xl font-bold mb-1">$49<span className="text-muted-foreground text-sm">/month</span></p>
                              <p className="text-sm text-muted-foreground">For active striping businesses</p>
                            </div>
                            <div className="space-y-2 mb-6">
                              <div className="flex items-start">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                                <span className="text-sm">Unlimited estimates</span>
                              </div>
                              <div className="flex items-start">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                                <span className="text-sm">Branded quote exports</span>
                              </div>
                              <div className="flex items-start">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                                <span className="text-sm">Lead capture</span>
                              </div>
                            </div>
                            <div className="mt-auto">
                              <Button 
                                className="w-full" 
                                onClick={() => {
                                  console.log('Upgrade button clicked, redirecting to payment-plan?upgrade=true');
                                  // Use replace instead of href assignment to force a full page reload
                                  setLocation('/payment-plan?upgrade=true');
                                  // Don't scroll here, let page completely reload first
                                }}
                              >
                                Upgrade to Pro
                              </Button>
                            </div>
                          </div>
                        )}
                  
                        {user?.paymentPlan !== 'team' && (
                          <div className="border rounded-lg p-4 flex flex-col">
                            <div className="mb-4">
                              <h3 className="text-lg font-semibold">Enterprise Plan</h3>
                              <p className="text-2xl font-bold mb-1">$149+<span className="text-muted-foreground text-sm">/month</span></p>
                              <p className="text-sm text-muted-foreground">For high volume users and lead generation</p>
                            </div>
                            <div className="space-y-2 mb-6">
                              <div className="flex items-start">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                                <span className="text-sm">Multi-user access</span>
                              </div>
                              <div className="flex items-start">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                                <span className="text-sm">Priority Zip Code leads</span>
                              </div>
                              <div className="flex items-start">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                                <span className="text-sm">Integration with QuickBooks, Jobber, etc.</span>
                              </div>
                            </div>
                            <div className="mt-auto">
                              <Button 
                                variant="outline"
                                className="w-full" 
                                onClick={() => window.open('https://calendly.com/ty-lotquote/30min', '_blank')}
                              >
                                Request a Demo
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Cancellation Confirmation Dialog */}
      <Dialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start space-x-3 p-3 bg-amber-50 text-amber-800 rounded-md mb-4">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Important Information</p>
                <p className="text-sm mt-1">
                  Your subscription will remain active until the end of your current billing period.
                  After that, you'll be downgraded to the Free plan with limited features.
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">You'll lose access to:</p>
              <ul className="space-y-1 text-sm">
                {user?.paymentPlan === 'pro' ? (
                  <>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Unlimited estimates</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Branded quote exports</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Lead capture</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Multi-user access</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Priority Zip Code leads</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Custom branding and integrations</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="ghost" 
              onClick={() => setShowCancelConfirmation(false)}
            >
              Keep Subscription
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Processing..." : "Cancel Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </div>
  );
}
