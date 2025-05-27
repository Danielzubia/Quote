import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LeadForm } from "./lead-form";
import { ReactNode, useState } from "react";
import { Mail } from "lucide-react";

interface LeadDialogProps {
  trigger?: ReactNode;
  title?: string;
  description?: string;
  defaultAddress?: string;
  defaultDetails?: string;
  source?: string;
  buttonText?: string;
  buttonVariant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

export function LeadDialog({
  trigger,
  title = "Contact Us",
  description = "Fill out the form below and we'll get back to you as soon as possible.",
  defaultAddress = "",
  defaultDetails = "",
  source = "Website",
  buttonText = "Contact Us",
  buttonVariant = "default"
}: LeadDialogProps) {
  const [open, setOpen] = useState(false);

  // Handle successful form submission by closing the dialog
  const handleSuccess = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={buttonVariant as any}>
            {buttonText}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {source === "Footer Contact" ? "Send us a message" : description}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <LeadForm
            onSuccess={handleSuccess}
            defaultAddress={defaultAddress}
            defaultDetails={defaultDetails}
            source={source}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}