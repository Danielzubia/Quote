import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function TestQuoteStorage() {
  const [name, setName] = useState('Test User');
  const [email, setEmail] = useState('test@example.com');
  const [address, setAddress] = useState('123 Main St, Anytown, USA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch('/api/admin/check');
        const data = await response.json();
        setIsAdmin(data.isAdmin);
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    
    checkAdmin();
  }, []);
  
  // Create a test quote
  const createTestQuote = async () => {
    setIsSubmitting(true);
    
    try {
      const quoteData = {
        name,
        email,
        address,
        quoteData: {
          mode: 'spaces',
          parkingSpaces: 50,
          handicapSpots: 5,
          crosswalks: 3,
          arrows: 10,
          lowerEstimate: 2500,
          upperEstimate: 3500,
          createdFrom: 'test-page'
        },
        userType: 'free',
        status: 'new'
      };
      
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quoteData),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const result = await response.json();
      
      toast({
        title: 'Quote Created',
        description: `New quote created with ID: ${result.id}`,
      });
      
      // Refresh quotes list
      fetchQuotes();
    } catch (error) {
      console.error('Error creating quote:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create test quote',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Fetch quotes (admin only)
  const fetchQuotes = async () => {
    if (!isAdmin) {
      toast({
        title: 'Permission Denied',
        description: 'You need admin privileges to view all quotes',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoadingQuotes(true);
    
    try {
      const response = await fetch('/api/admin/quotes');
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      setQuotes(data);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch quotes',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingQuotes(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Quote Storage Test</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Create Test Quote</h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              
              <Button
                onClick={createTestQuote}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Test Quote'
                )}
              </Button>
            </div>
          </Card>
        </div>
        
        <div>
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Quotes List</h2>
              <Button
                variant="outline"
                onClick={fetchQuotes}
                disabled={isLoadingQuotes || !isAdmin}
              >
                {isLoadingQuotes ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>
            
            {!isAdmin && (
              <div className="p-4 bg-muted rounded-md text-center">
                Admin access required to view quotes
              </div>
            )}
            
            {isAdmin && quotes.length === 0 && !isLoadingQuotes && (
              <div className="p-4 bg-muted rounded-md text-center">
                No quotes found. Click 'Refresh' to check for quotes.
              </div>
            )}
            
            {isAdmin && quotes.length > 0 && (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {quotes.map((quote) => (
                  <Card key={quote.id} className="p-4">
                    <div className="flex justify-between">
                      <span className="font-medium">#{quote.id}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(quote.createdAt)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p><span className="font-medium">Name:</span> {quote.name}</p>
                      <p><span className="font-medium">Email:</span> {quote.email}</p>
                      <p><span className="font-medium">Address:</span> {quote.address}</p>
                      <p><span className="font-medium">Status:</span> {quote.status}</p>
                      <p><span className="font-medium">Type:</span> {quote.userType}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}