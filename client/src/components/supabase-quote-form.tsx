import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SupabaseQuoteForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  // Submit quote to Supabase
  const submitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Prepare quote data
      const quoteData = {
        name,
        email,
        address,
        quoteData: {
          mode: 'spaces',
          parkingSpaces: 50,
          handicapSpots: 5,
          crosswalks: 3,
          arrows: 2,
          lowerEstimate: 2500,
          upperEstimate: 3500,
          createdFrom: 'supabase-test'
        },
        userType: 'free'
      };
      
      // Submit to Supabase endpoint
      const response = await fetch('/api/supabase/submit-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quoteData),
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        toast({
          title: "Quote submitted successfully",
          description: "Your quote has been submitted to Supabase",
        });
      } else {
        toast({
          title: "Error submitting quote",
          description: data.error || "An unexpected error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error submitting quote:', error);
      toast({
        title: "Error submitting quote",
        description: "An unexpected error occurred while submitting your quote",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Test Supabase Quote Submission</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <form onSubmit={submitQuote}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
              
              <div>
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address" 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)} 
                  required 
                />
              </div>
              
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Quote to Supabase'
                )}
              </Button>
            </div>
          </form>
        </Card>
        
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Response</h2>
          
          {result ? (
            <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[400px]">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <div className="p-4 bg-muted rounded-md text-center">
              Submit a quote to see the response
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}