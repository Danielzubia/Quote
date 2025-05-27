import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Redirect } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { formatDistance } from 'date-fns';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

// Types for the dashboard
type User = {
  id: number;
  username: string;
  isAdmin: boolean;
  paymentPlan: string;
  addressUsageCount: number;
  lastAddressResetDate: string;
  createdAt?: string;
};

type UserSignIn = {
  id: number;
  userId: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

type QuoteAnalytic = {
  id: number;
  userId: number | null;
  quoteType: string;
  mode: string;
  parkingSpaces: number | null;
  handicapSpots: number | null;
  crosswalks: number | null;
  arrows: number | null;
  surfaceArea: number | null;
  lowerEstimate: number;
  upperEstimate: number;
  createdAt: string;
};

type FreeQuoteRequest = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string;
  parkingSpaces: number;
  handicapSpots: number;
  crosswalks: number;
  arrows: number;
  additionalWork: string | null;
  estimatedPrice: number;
  highEstimatedPrice: number;
  status: string;
  createdAt: string;
  mode: string;
  surfaceArea: number | null;
  surfaceAreaSqYd: number | null;
};

type Feedback = {
  id: number;
  userId: number | null;
  rating: number;
  comment: string | null;
  name: string | null;
  email: string | null;
  createdAt: string;
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('overview');
  
  // Get the current user to check if they're an admin
  const { 
    data: currentUser,
    isLoading: isLoadingUser,
    error: userError 
  } = useQuery<User>({
    queryKey: ['/api/user'],
  });
  
  // Fetch users for the admin dashboard
  const {
    data: users,
    isLoading: isLoadingUsers
  } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    enabled: !!currentUser?.isAdmin,
  });
  
  // Fetch sign-ins for the admin dashboard
  const {
    data: signIns,
    isLoading: isLoadingSignIns
  } = useQuery<UserSignIn[]>({
    queryKey: ['/api/admin/user-sign-ins'],
    enabled: !!currentUser?.isAdmin,
  });
  
  // Fetch quotes for the admin dashboard
  const {
    data: quotes,
    isLoading: isLoadingQuotes
  } = useQuery<QuoteAnalytic[]>({
    queryKey: ['/api/admin/quote-analytics'],
    enabled: !!currentUser?.isAdmin,
  });
  
  // Fetch free quote requests for the admin dashboard
  const {
    data: freeQuoteRequests,
    isLoading: isLoadingFreeQuoteRequests
  } = useQuery<FreeQuoteRequest[]>({
    queryKey: ['/api/free-quote-requests'],
    enabled: !!currentUser?.isAdmin,
  });
  
  // Fetch feedback for the admin dashboard
  const {
    data: feedback,
    isLoading: isLoadingFeedback
  } = useQuery<Feedback[]>({
    queryKey: ['/api/admin/feedback'],
    enabled: !!currentUser?.isAdmin,
  });
  
  // Check if user is admin and handle error appropriately
  useEffect(() => {
    if (userError) {
      toast({
        title: 'Authentication Error',
        description: 'You need to be logged in to view this page.',
        variant: 'destructive',
      });
    } else if (currentUser && !currentUser.isAdmin) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to view the admin dashboard.',
        variant: 'destructive',
      });
    }
  }, [currentUser, userError, toast]);
  
  // If user is not an admin, redirect to home page
  if (!isLoadingUser && (!currentUser || !currentUser.isAdmin)) {
    return <Redirect to="/" />;
  }
  
  if (isLoadingUser) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  // Calculate some basic stats for the overview
  const totalUsers = users?.length || 0;
  const totalQuotes = quotes?.length || 0;
  const totalSignIns = signIns?.length || 0;
  const totalFreeQuoteRequests = freeQuoteRequests?.length || 0;
  
  // Count users by payment plan
  const usersByPlan = users?.reduce((acc: Record<string, number>, user: User) => {
    acc[user.paymentPlan] = (acc[user.paymentPlan] || 0) + 1;
    return acc;
  }, {}) || {};
  
  // Count quotes by type
  const quotesByType = quotes?.reduce((acc: Record<string, number>, quote: QuoteAnalytic) => {
    acc[quote.quoteType] = (acc[quote.quoteType] || 0) + 1;
    return acc;
  }, {}) || {};
  
  // Count quotes by mode (spaces vs. surface area)
  const quotesByMode = quotes?.reduce((acc: Record<string, number>, quote: QuoteAnalytic) => {
    acc[quote.mode] = (acc[quote.mode] || 0) + 1;
    return acc;
  }, {}) || {};
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="container py-10 flex-grow">
      
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="signins">Sign-ins</TabsTrigger>
          <TabsTrigger value="quotes">Quote Analytics</TabsTrigger>
          <TabsTrigger value="free-quotes">Free Quote Requests</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsers}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {usersByPlan.free || 0} Free, {usersByPlan.pro || 0} Pro, {usersByPlan.team || 0} Team
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Sign-ins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalSignIns}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Since tracking began
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Quotes Generated</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalQuotes}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {quotesByType.free || 0} Free, {quotesByType.pro || 0} Pro
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Free Quote Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalFreeQuoteRequests}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {freeQuoteRequests?.filter((q: FreeQuoteRequest) => q.status === 'pending').length || 0} Pending
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>The most recent user sign-ins and quote generations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Recent Sign-ins</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingSignIns ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center">Loading...</TableCell>
                        </TableRow>
                      ) : signIns && signIns.length > 0 ? (
                        signIns.slice(0, 5).map((signIn: UserSignIn) => (
                          <TableRow key={signIn.id}>
                            <TableCell>{signIn.userId}</TableCell>
                            <TableCell>{formatDistance(new Date(signIn.createdAt), new Date(), { addSuffix: true })}</TableCell>
                            <TableCell>{signIn.ipAddress || 'N/A'}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center">No sign-ins recorded</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium">Recent Quotes</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Estimate</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingQuotes ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                        </TableRow>
                      ) : quotes && quotes.length > 0 ? (
                        quotes.slice(0, 5).map((quote: QuoteAnalytic) => (
                          <TableRow key={quote.id}>
                            <TableCell>{quote.id}</TableCell>
                            <TableCell>{quote.mode}</TableCell>
                            <TableCell>{quote.quoteType}</TableCell>
                            <TableCell>${quote.lowerEstimate.toFixed(2)} - ${quote.upperEstimate.toFixed(2)}</TableCell>
                            <TableCell>{formatDistance(new Date(quote.createdAt), new Date(), { addSuffix: true })}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center">No quotes recorded</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>All registered users and their details</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Admin Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Address Usage</TableHead>
                    <TableHead>Last Reset</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingUsers ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : users && users.length > 0 ? (
                    users.map((user: User) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.id}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>
                          {user.isAdmin ? (
                            <Badge variant="default">Admin</Badge>
                          ) : (
                            <Badge variant="outline">Regular User</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.paymentPlan === 'free' ? 'outline' : (user.paymentPlan === 'pro' ? 'default' : 'secondary')}>
                            {user.paymentPlan.charAt(0).toUpperCase() + user.paymentPlan.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.addressUsageCount}</TableCell>
                        <TableCell>{formatDistance(new Date(user.lastAddressResetDate), new Date(), { addSuffix: true })}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">No users found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Sign-ins Tab */}
        <TabsContent value="signins">
          <Card>
            <CardHeader>
              <CardTitle>User Sign-in Activity</CardTitle>
              <CardDescription>All user login events</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>User Agent</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingSignIns ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : signIns && signIns.length > 0 ? (
                    signIns.map((signIn: UserSignIn) => (
                      <TableRow key={signIn.id}>
                        <TableCell>{signIn.id}</TableCell>
                        <TableCell>{signIn.userId}</TableCell>
                        <TableCell>{signIn.ipAddress || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate">{signIn.userAgent || 'N/A'}</TableCell>
                        <TableCell>{formatDistance(new Date(signIn.createdAt), new Date(), { addSuffix: true })}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">No sign-ins recorded</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Quotes Tab */}
        <TabsContent value="quotes">
          <Card>
            <CardHeader>
              <CardTitle>Quote Generation Analytics</CardTitle>
              <CardDescription>All quote generation events</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Spaces</TableHead>
                    <TableHead>Handicap</TableHead>
                    <TableHead>Crosswalks</TableHead>
                    <TableHead>Estimate</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingQuotes ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : quotes && quotes.length > 0 ? (
                    quotes.map((quote: QuoteAnalytic) => (
                      <TableRow key={quote.id}>
                        <TableCell>{quote.id}</TableCell>
                        <TableCell>{quote.userId || 'Anonymous'}</TableCell>
                        <TableCell>{quote.quoteType}</TableCell>
                        <TableCell>{quote.mode}</TableCell>
                        <TableCell>{quote.parkingSpaces || 'N/A'}</TableCell>
                        <TableCell>{quote.handicapSpots || 'N/A'}</TableCell>
                        <TableCell>{quote.crosswalks || 'N/A'}</TableCell>
                        <TableCell>${quote.lowerEstimate} - ${quote.upperEstimate}</TableCell>
                        <TableCell>{formatDistance(new Date(quote.createdAt), new Date(), { addSuffix: true })}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">No quotes recorded</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Free Quote Requests Tab */}
        <TabsContent value="free-quotes">
          <Card>
            <CardHeader>
              <CardTitle>Free Quote Requests</CardTitle>
              <CardDescription>Contact requests from the free quote form</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Estimate</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingFreeQuoteRequests ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : freeQuoteRequests && freeQuoteRequests.length > 0 ? (
                    freeQuoteRequests.map((request: FreeQuoteRequest) => (
                      <TableRow key={request.id}>
                        <TableCell>{request.id}</TableCell>
                        <TableCell>{request.name}</TableCell>
                        <TableCell>{request.email}</TableCell>
                        <TableCell>{request.phone || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate">{request.address}</TableCell>
                        <TableCell>
                          <Badge variant={
                            request.status === 'pending' ? 'outline' : 
                            request.status === 'contacted' ? 'default' : 
                            request.status === 'completed' ? 'secondary' : 'destructive'
                          }>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>${request.estimatedPrice} - ${request.highEstimatedPrice}</TableCell>
                        <TableCell>{formatDistance(new Date(request.createdAt), new Date(), { addSuffix: true })}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center">No free quote requests found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Feedback Tab */}
        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle>User Feedback</CardTitle>
              <CardDescription>Feedback submitted by users</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingFeedback ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                    </TableRow>
                  ) : feedback && feedback.length > 0 ? (
                    feedback.map((item: Feedback) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.id}</TableCell>
                        <TableCell>{item.userId || 'Anonymous'}</TableCell>
                        <TableCell>{item.name || 'N/A'}</TableCell>
                        <TableCell>{item.email || 'N/A'}</TableCell>
                        <TableCell>{item.rating} / 5</TableCell>
                        <TableCell className="max-w-xs truncate">{item.comment || 'N/A'}</TableCell>
                        <TableCell>{formatDistance(new Date(item.createdAt), new Date(), { addSuffix: true })}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">No feedback found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
      <Footer />
    </div>
  );
}