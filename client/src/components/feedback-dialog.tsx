import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Star, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InsertUserFeedback } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const { toast } = useToast();

  const feedbackMutation = useMutation({
    mutationFn: async (feedback: InsertUserFeedback) => {
      const res = await apiRequest("POST", "/api/feedback", feedback);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit feedback");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Thank you for your feedback!",
        description: "Your feedback has been submitted successfully.",
      });
      // Reset form
      setRating(0);
      setName("");
      setEmail("");
      setComment("");
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast({
        title: "Please provide a rating",
        description: "Select at least 1 star to submit your feedback.",
        variant: "destructive",
      });
      return;
    }

    feedbackMutation.mutate({
      rating,
      name: name || undefined,
      email: email || undefined,
      comment: comment || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-muted-foreground">
          <Star className="mr-2 h-4 w-4" />
          Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Your Feedback</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rating">Your Rating</Label>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="focus:outline-none"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                >
                  <Star
                    size={24}
                    className={`${
                      (hoverRating || rating) >= star
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name (Optional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (Optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment">Comments</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what you think about LotQuote"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={feedbackMutation.isPending}>
              {feedbackMutation.isPending ? (
                "Submitting..."
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Feedback
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}