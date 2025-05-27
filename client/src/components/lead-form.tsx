import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

// Form validation schema
const leadFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  phone: z.string().optional(),
  address: z.string().optional(),
  details: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

interface LeadFormProps {
  onSuccess?: () => void;
  defaultAddress?: string;
  defaultDetails?: string;
  source?: string;
}

export function LeadForm({ 
  onSuccess, 
  defaultAddress = "",
  defaultDetails = "",
  source = "Website"
}: LeadFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default values for the form
  const defaultValues: Partial<LeadFormValues> = {
    name: "",
    email: "",
    phone: "",
    address: defaultAddress,
    details: defaultDetails,
  };

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues,
  });

  const onSubmit = async (data: LeadFormValues) => {
    setIsSubmitting(true);
    try {
      // Check if this is a footer contact message (to support@lotquote.com)
      const isFooterContact = source === "Footer Contact";
      let response;
      
      if (isFooterContact) {
        // Use the public endpoint for footer contact messages
        response = await fetch("/api/contact-support", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
      } else {
        // For all other lead forms, use the standard leads endpoint
        const leadData = { 
          ...data, 
          source
        };
        response = await apiRequest("POST", "/api/leads", leadData);
      }
      
      if (response.ok) {
        toast({
          title: "Success!",
          description: "Your information has been submitted. We'll be in touch soon!",
        });
        
        // Reset form
        form.reset();
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit your information");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "There was a problem submitting the form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm">Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} className="h-8 text-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm">Email</FormLabel>
              <FormControl>
                <Input placeholder="your.email@example.com" {...field} className="h-8 text-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm">Phone (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="(123) 456-7890" {...field} className="h-8 text-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm">Property Address (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St, City, State" {...field} className="h-8 text-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="details"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm">Additional Details (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Tell us more about your project or requirements" 
                  {...field} 
                  rows={3}
                  className="text-sm min-h-[60px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Information"}
        </Button>
      </form>
    </Form>
  );
}