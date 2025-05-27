// Type definitions for Calendly Widget
interface CalendlyWidget {
  initInlineWidget: (options: {
    url: string;
    parentElement: HTMLElement;
    prefill?: Record<string, string>;
  }) => void;
  
  initPopupWidget: (options: {
    url: string;
    prefill?: Record<string, string>;
  }) => void;
}

// Extending the Window interface to include Calendly
interface Window {
  Calendly?: CalendlyWidget;
}