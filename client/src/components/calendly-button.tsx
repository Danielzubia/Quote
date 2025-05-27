import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { openCalendlyScheduler } from '@/utils/calendly';

interface CalendlyButtonProps extends ButtonProps {
  /**
   * Text to display on the button
   */
  buttonText?: string;
  
  /**
   * Optional pre-filled fields for the Calendly form
   */
  prefill?: Record<string, string>;
  
  /**
   * Whether to show the calendar icon
   */
  showIcon?: boolean;
}

/**
 * A button component that opens the Calendly scheduler when clicked
 */
export function CalendlyButton({
  buttonText = "Request a Demo",
  prefill,
  showIcon = true,
  className,
  variant = "default",
  size = "default",
  ...props
}: CalendlyButtonProps) {
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    await openCalendlyScheduler(prefill);
  };
  
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      {...props}
    >
      {showIcon && <Calendar className="mr-2 h-4 w-4" />}
      {buttonText}
    </Button>
  );
}