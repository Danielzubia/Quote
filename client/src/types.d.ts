// Add type definitions for 3rd party libraries without types

interface Html2CanvasOptions {
  useCORS?: boolean;
  scale?: number;
  logging?: boolean;
  allowTaint?: boolean;
  backgroundColor?: string | null;
}

declare global {
  interface Window {
    html2canvas: (element: HTMLElement, options?: Html2CanvasOptions) => Promise<HTMLCanvasElement>;
  }
}

// This is needed to make this a module
export {};
