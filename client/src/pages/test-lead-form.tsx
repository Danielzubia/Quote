import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

export default function TestLeadForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    details: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiRequest('POST', '/api/public/add-lead', formData);
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success!",
          description: "Your lead information has been successfully submitted.",
          variant: "default",
        });
        
        // Reset form
        setFormData({
          name: '',
          email: '',
          phone: '',
          address: '',
          details: ''
        });
      } else {
        throw new Error(data.error || 'Failed to submit lead information');
      }
    } catch (error: any) {
      toast({
        title: "Submission Error",
        description: error.message || "There was a problem submitting your information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Test Lead Submission Form</h1>
      
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Submit Lead Information</CardTitle>
            <CardDescription>
              Use this form to test the Airtable lead tracking integration
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input 
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input 
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="john.doe@example.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="123 Main St, City, State, Zip"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="details">Additional Details</Label>
                <Textarea 
                  id="details"
                  name="details"
                  value={formData.details}
                  onChange={handleInputChange}
                  placeholder="Please include any additional information..."
                  rows={4}
                />
              </div>
            </CardContent>
            
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Lead"}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>* Required fields</p>
          <p className="mt-2">This data will be sent to Airtable for lead tracking.</p>
        </div>
      </div>
    </div>
  );
}