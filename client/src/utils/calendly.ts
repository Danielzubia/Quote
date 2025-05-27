// Calendly integration utility
import { apiRequest } from "../lib/queryClient";

// The Calendly scheduling URL for the lot-quote user
const CALENDLY_SCHEDULING_URL = 'https://calendly.com/ty-lotquote/30min';

// Function to load Calendly widget script if it hasn't been loaded yet
const loadCalendlyScript = (): Promise<void> => {
  return new Promise((resolve) => {
    if (window.Calendly) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
};

// Function to open Calendly widget in a new window/tab
export async function openCalendlyScheduler(prefill?: Record<string, string>) {
  // Open Calendly in a new tab with any prefill data
  const url = new URL(CALENDLY_SCHEDULING_URL);
  
  // Add any prefill parameters if provided
  if (prefill) {
    Object.entries(prefill).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  window.open(url.toString(), '_blank');
}

// Function to open Calendly as a popup window
export async function openCalendlyPopup(prefill?: Record<string, string>) {
  // Define popup window dimensions
  const width = 600;
  const height = 700;
  const left = (window.innerWidth - width) / 2;
  const top = (window.innerHeight - height) / 2;
  
  // Add any prefill parameters
  const url = new URL(CALENDLY_SCHEDULING_URL);
  if (prefill) {
    Object.entries(prefill).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  // Open popup window with specific dimensions
  window.open(
    url.toString(),
    'CalendlyScheduler',
    `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
  );
}

// Function to initialize Calendly inline widget in a container
export async function initCalendlyInline(container: HTMLElement, prefill?: Record<string, string>) {
  await loadCalendlyScript();
  
  if (window.Calendly) {
    window.Calendly.initInlineWidget({
      url: CALENDLY_SCHEDULING_URL,
      parentElement: container,
      prefill
    });
  }
}

// Function that handles server-side operations with Calendly (when needed)
export async function getCalendlySchedulingLink(userData?: Record<string, string>) {
  try {
    // This would typically fetch from a server endpoint that uses the CALENDLY_TOKEN
    // For now, we'll just return the direct URL since most operations can be client-side
    // In a full implementation, this would use the token to interact with Calendly API
    
    const response = await apiRequest("GET", "/api/calendly/scheduling-link", userData);
    const data = await response.json();
    return data.schedulingUrl;
  } catch (error) {
    console.error("Error getting Calendly scheduling link:", error);
    // Fallback to direct URL if API call fails
    return CALENDLY_SCHEDULING_URL;
  }
}