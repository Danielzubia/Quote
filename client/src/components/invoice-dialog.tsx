import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Upload, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  editable: boolean;
}

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parkingSpaces: number;
  handicapSpots: number;
  crosswalks: number;
  arrows: number;
  linearFeet?: number; // Add linear feet parameter
  address: string;
  processedImageId: string;
  surfaceArea?: number;
  surfaceAreaSqYd?: number;
  mode?: 'spaces' | 'area';
  inFreeQuoteMode?: boolean;
  userPaymentPlan?: string;
}

export function InvoiceDialog({
  open,
  onOpenChange,
  parkingSpaces,
  handicapSpots,
  crosswalks,
  arrows,
  linearFeet = 0, // Default to 0 if not provided
  address,
  processedImageId,
  surfaceArea,
  surfaceAreaSqYd,
  mode = 'spaces',
  inFreeQuoteMode = false,
  userPaymentPlan = 'pro' // Default to 'pro' if not specified
}: InvoiceDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Invoice information
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Math.floor(Math.random() * 10000)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [companyName, setCompanyName] = useState("LotQuote Contractor");
  const [companyTagline, setCompanyTagline] = useState("Professional Parking Lot Services");
  const [clientName, setClientName] = useState("Client Name");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [notes, setNotes] = useState("Thank you for your business. Payment is due within 30 days.");
  
  // Custom item fields for adding new items
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);
  const [newItemRate, setNewItemRate] = useState<number>(100);
  
  // Option to hide quantity and rate columns
  const [hideDetailColumns, setHideDetailColumns] = useState(false);
  
  // For Free Quote mode
  const [additionalWork, setAdditionalWork] = useState("");
  
  // Calculate basic invoice items based on detection results
  const calculateBasicItems = () => {
    const baseItems: InvoiceItem[] = [];
    
    // Standard items for Space Counter mode - add these regardless of detection count 
    if (mode === 'spaces') {
      // Add items in the specific required order:
      // 1. Mobilization Fee (now moved to first position)
      // 2. Parking Spaces, 3. ADA Spaces, 4. Crosswalks, 5. Arrows, 6. Curbing Linear ft
      
      // 1. Mobilization Fee (now first per user request)
      baseItems.push({
        id: uuidv4(),
        description: "Mobilization Fee",
        quantity: 1,
        rate: 500,
        amount: 500,
        editable: true
      });
      
      // 2. Parking Spaces
      baseItems.push({
        id: uuidv4(),
        description: "Parking Spaces",
        quantity: parkingSpaces,
        rate: 5,
        amount: parkingSpaces * 5,
        editable: true
      });
      
      // 3. ADA Spaces
      baseItems.push({
        id: uuidv4(),
        description: "ADA Spaces",
        quantity: handicapSpots,
        rate: 25,
        amount: handicapSpots * 25,
        editable: true
      });
      
      // 4. Crosswalks
      baseItems.push({
        id: uuidv4(),
        description: "Crosswalks",
        quantity: crosswalks,
        rate: 20,
        amount: crosswalks * 20,
        editable: true
      });
      
      // 5. Arrows - blank by default
      baseItems.push({
        id: uuidv4(),
        description: "Arrows",
        quantity: 0,
        rate: 0,
        amount: 0,
        editable: true
      });
      
      // 6. Curbing Linear ft - use the measured linear feet with a rate of $2/ft
      baseItems.push({
        id: uuidv4(),
        description: "Curbing Linear ft",
        quantity: linearFeet,
        rate: 2, // $2 per linear foot
        amount: linearFeet * 2,
        editable: true
      });
    } 
    // For Surface Area mode
    else if (mode === 'area' && surfaceArea && surfaceAreaSqYd) {
      // Add base fee
      baseItems.push({
        id: uuidv4(),
        description: "Base Fee",
        quantity: 1,
        rate: 500,
        amount: 500,
        editable: true
      });
      
      // Add sealcoating
      baseItems.push({
        id: uuidv4(),
        description: "Sealcoating",
        quantity: surfaceArea,
        rate: 0.45, // Mid-point of $0.35-$0.50 range
        amount: Math.round(surfaceArea * 0.45),
        editable: true
      });
    }
    
    // Add custom item row (always at the end)
    baseItems.push({
      id: uuidv4(),
      description: "",
      quantity: 0,
      rate: 0,
      amount: 0,
      editable: true
    });
    
    return baseItems;
  };
  
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  
  // Initialize the invoice items when the dialog opens
  useEffect(() => {
    if (open) {
      setInvoiceItems(calculateBasicItems());
    }
  }, [open, parkingSpaces, handicapSpots, crosswalks, arrows, linearFeet, mode, surfaceArea, surfaceAreaSqYd]);
  
  // Calculate total
  const calculateTotal = () => {
    return invoiceItems.reduce((sum, item) => sum + item.amount, 0);
  };
  
  // Calculate quote price range
  const calculateQuote = () => {
    // Handle area mode calculation
    if (mode === 'area' && surfaceArea) {
      // Surface Area mode - calculate based on square footage plus base fee
      // $500 base fee + $0.35 - $0.50 per square foot
      const baseFee = 500;
      const lowerEstimate = Math.round(baseFee + (surfaceArea * 0.35));
      const upperEstimate = Math.round(baseFee + (surfaceArea * 0.50));
      const baseEstimate = Math.round((lowerEstimate + upperEstimate) / 2);
      
      return {
        surfaceArea,
        baseFee,
        lowerRate: 0.35,
        upperRate: 0.50,
        baseEstimate,
        lowerEstimate,
        upperEstimate
      };
    } else {
      // Space Counter mode
      // Fixed mobilization fee
      const mobilizationFee = 500;
      
      // Calculate costs based on counts
      const parkingCost = parkingSpaces * 5;
      const handicapCost = handicapSpots * 25;
      const crosswalkCost = crosswalks * 20;
      const arrowsCost = 0; // Arrows field is blank by default
      const linearFeetCost = linearFeet * 2; // $2 per linear foot
      
      // Total base estimate including linear feet
      const baseEstimate = mobilizationFee + parkingCost + handicapCost + crosswalkCost + linearFeetCost;
      
      // Add 10% variance for quote range
      const lowerEstimate = Math.round(baseEstimate * 0.9);
      const upperEstimate = Math.round(baseEstimate * 1.1);
      
      return {
        mobilizationFee,
        parkingCost,
        handicapCost,
        crosswalkCost,
        arrowsCost,
        linearFeetCost,
        baseEstimate,
        lowerEstimate,
        upperEstimate
      };
    }
  };
  
  // Handle changes to existing items
  const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setInvoiceItems(prevItems => {
      return prevItems.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          
          // Recalculate amount if necessary
          if (field === 'quantity' || field === 'rate') {
            updatedItem.amount = updatedItem.quantity * updatedItem.rate;
          }
          
          return updatedItem;
        }
        return item;
      });
    });
  };
  
  // Add a custom item
  const handleAddCustomItem = () => {
    const newItem: InvoiceItem = {
      id: uuidv4(),
      description: newItemDescription,
      quantity: newItemQuantity,
      rate: newItemRate,
      amount: newItemQuantity * newItemRate,
      editable: true // Make all items editable
    };
    
    // Add the new item and reset form
    setInvoiceItems(prev => [
      ...prev.filter(item => !item.editable), // Remove the edit row
      newItem,
      {
        id: uuidv4(),
        description: "",
        quantity: 0,
        rate: 0,
        amount: 0,
        editable: true
      }
    ]);
    
    // Reset the form fields
    setNewItemDescription("");
    setNewItemQuantity(1);
    setNewItemRate(100);
  };
  
  // Handle logo upload
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Function to preload image and return a promise
  const preloadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // Only set crossOrigin for URLs that aren't data URLs
      if (!src.startsWith('data:')) {
        img.crossOrigin = "Anonymous";
      }
      
      img.onload = () => {
        console.log("Image loaded successfully:", img.width, "x", img.height);
        resolve(img);
      };
      
      img.onerror = (e) => {
        console.error("Error loading image:", e);
        console.error("Image source:", src.substring(0, 50) + (src.length > 50 ? '...' : ''));
        console.error("Image source type:", src.startsWith('data:') ? 'data URL' : 'file path');
        reject(new Error("Failed to load image"));
      };
      
      img.src = src;
    });
  };

  // Download invoice as PDF
  const downloadInvoice = async () => {
    const invoiceContent = document.getElementById('invoice-content');
    if (!invoiceContent) return;
    
    try {
      // Create a clone of the invoice content to modify for PDF generation
      const tempInvoiceContent = invoiceContent.cloneNode(true) as HTMLElement;
      
      // First, remove the checkbox control
      const checkboxDiv = tempInvoiceContent.querySelector('[id="hide-detail-columns"]')?.closest('div.flex');
      if (checkboxDiv) {
        checkboxDiv.remove();
      }
      
      // Remove the empty "new item" row (any row with class editable-row)
      const emptyRows = tempInvoiceContent.querySelectorAll('.editable-row');
      emptyRows.forEach(row => {
        row.remove();
      });
      
      // Remove all elements with action-column class
      const actionColumns = tempInvoiceContent.querySelectorAll('.action-column');
      actionColumns.forEach(col => {
        col.remove();
      });
      
      // Make sure the total row has the right structure
      const totalRow = tempInvoiceContent.querySelector('tr.font-bold');
      if (totalRow) {
        // Add a class to ensure we can style it properly
        totalRow.classList.add('total-row');
        
        // Make sure the total amount is visible
        const totalAmountCell = totalRow.querySelector('td:nth-child(2)');
        if (totalAmountCell) {
          (totalAmountCell as HTMLElement).style.fontWeight = 'bold';
          (totalAmountCell as HTMLElement).style.textAlign = 'right';
        }
      }
      
      // If hiding detail columns, remove those columns
      if (hideDetailColumns) {
        // Make a copy of the total amount before removing columns
        const totalRow = tempInvoiceContent.querySelector('tr.font-bold');
        let totalAmount = '';
        
        if (totalRow) {
          // Get the last cell containing the total amount
          const totalAmountCell = totalRow.querySelector('td:last-child');
          if (totalAmountCell) {
            totalAmount = totalAmountCell.textContent || '';
          }
          
          // Adjust the colspan of the total label
          const totalLabel = totalRow.querySelector('td:first-child');
          if (totalLabel) {
            totalLabel.setAttribute('colspan', '1');
          }
        }
        
        // Hide quantity and rate columns
        const quantityRateColumns = tempInvoiceContent.querySelectorAll('th:nth-child(2), th:nth-child(3), td:nth-child(2), td:nth-child(3)');
        quantityRateColumns.forEach(col => {
          col.remove();
        });
        
        // Restore the total amount after removing columns
        if (totalRow) {
          const newTotalRow = tempInvoiceContent.querySelector('tr.font-bold');
          if (newTotalRow) {
            const newTotalAmountCell = newTotalRow.querySelector('td:last-child');
            if (newTotalAmountCell && totalAmount) {
              newTotalAmountCell.textContent = totalAmount;
              (newTotalAmountCell as HTMLElement).style.textAlign = 'right';
              (newTotalAmountCell as HTMLElement).style.fontWeight = 'bold';
            }
          }
        }
      }
      
      // Add the temp element to the DOM but make it invisible
      tempInvoiceContent.style.position = 'absolute';
      tempInvoiceContent.style.left = '-9999px';
      tempInvoiceContent.style.top = '-9999px';
      document.body.appendChild(tempInvoiceContent);
      
      // Properly remove blank columns caused by removed cells
      const tableElement = tempInvoiceContent.querySelector('table');
      if (tableElement) {
        // Fix any spacing issues by rebuilding the column structure
        const colgroup = tableElement.querySelector('colgroup');
        if (colgroup) {
          // Remove existing colgroup
          colgroup.remove();
          
          // Create a new colgroup with proper structure
          const newColgroup = document.createElement('colgroup');
          
          if (hideDetailColumns) {
            // When hiding detail columns, we just need 2 columns (description and amount)
            const descCol = document.createElement('col');
            (descCol as HTMLElement).style.width = '70%';
            newColgroup.appendChild(descCol);
            
            const amountCol = document.createElement('col');
            (amountCol as HTMLElement).style.width = '30%';
            newColgroup.appendChild(amountCol);
          } else {
            // All columns showing - description, quantity, rate, amount
            const descCol = document.createElement('col');
            (descCol as HTMLElement).style.width = '45%';
            newColgroup.appendChild(descCol);
            
            const qtyCol = document.createElement('col');
            (qtyCol as HTMLElement).style.width = '15%';
            newColgroup.appendChild(qtyCol);
            
            const rateCol = document.createElement('col');
            (rateCol as HTMLElement).style.width = '15%';
            newColgroup.appendChild(rateCol);
            
            const amountCol = document.createElement('col');
            (amountCol as HTMLElement).style.width = '25%';
            newColgroup.appendChild(amountCol);
          }
          
          // Insert the new colgroup at the beginning of the table
          tableElement.insertBefore(newColgroup, tableElement.firstChild);
        }
      }
      
      // Apply PDF-friendly styles before capturing
      const pdfStylesElement = document.createElement('style');
      pdfStylesElement.textContent = `
        #temp-invoice-content {
          padding: 40px !important;
          font-size: 14px !important;
          background-color: white !important;
        }
        #temp-invoice-content td, 
        #temp-invoice-content th, 
        #temp-invoice-content p, 
        #temp-invoice-content span,
        #temp-invoice-content div {
          line-height: 1.5 !important;
          word-break: break-word !important;
          font-size: 12px !important;
        }
        #temp-invoice-content h3, 
        #temp-invoice-content h4 {
          font-size: 16px !important;
          margin-bottom: 12px !important;
        }
        #temp-invoice-content table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        #temp-invoice-content th,
        #temp-invoice-content td {
          border: 1px solid #ddd !important;
          padding: 8px !important;
        }
      `;
      document.head.appendChild(pdfStylesElement);
      
      // Set ID for the temp element
      tempInvoiceContent.id = 'temp-invoice-content';
      
      // Set a fixed width for the temp element to ensure proper PDF width
      tempInvoiceContent.style.width = '800px';
      
      // Create canvas from temp invoice with generous settings
      const canvas = await html2canvas(tempInvoiceContent, {
        scale: 2.5, // Higher resolution for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 800,  // Consistent width
        height: tempInvoiceContent.offsetHeight  // Maintain aspect ratio
      });
      
      // Remove the temporary styles and element
      document.head.removeChild(pdfStylesElement);
      document.body.removeChild(tempInvoiceContent);
      
      // Create PDF with more generous settings
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: false // Avoid compression artifacts
      });
      
      // Calculate dimensions with even more generous margins
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 25; // 25mm margin all around
      const imgWidth = pageWidth - (margin * 2); // Available width with margins
      
      // Calculate height while maintaining aspect ratio
      const imgHeight = canvas.height * imgWidth / canvas.width;
      
      // Add invoice to PDF with increased margins
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight); // Add 25mm margins
      
      // If processed image exists, add it as second page
      if (processedImageId) {
        try {
          console.log("Handling processed image in PDF generation");
          
          // Add a new page for the image
          pdf.addPage();
          
          // First look for the marked canvas image (with dots and lines)
          const markedCanvasImg = document.getElementById('marked-canvas-image') as HTMLImageElement;
          
          // Use marked canvas image if available
          if (markedCanvasImg && markedCanvasImg.complete && markedCanvasImg.naturalWidth > 0) {
            console.log('Using captured canvas with markings for PDF');
            
            // Create an offscreen canvas for the marked image
            const canvas = document.createElement('canvas');
            canvas.width = markedCanvasImg.naturalWidth || 800;
            canvas.height = markedCanvasImg.naturalHeight || 600;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Draw the image to canvas
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(markedCanvasImg, 0, 0, canvas.width, canvas.height);
              
              // Get the image data and dimensions
              let imageData = canvas.toDataURL('image/png');
              const imgWidth = pageWidth - (margin * 2); // Same margins as invoice
              const imgHeight = canvas.height * imgWidth / canvas.width;
              
              // Add the image to the PDF with same margins as the invoice
              pdf.addImage(imageData, 'PNG', margin, margin, imgWidth, imgHeight);
              
              // Add caption below the image
              pdf.setFontSize(12);
              pdf.setTextColor(0, 0, 0);
              const captionY = margin + imgHeight + 10; // 10mm below the image
              pdf.text(`Parking lot analysis for ${address}`, pageWidth / 2, captionY, { align: 'center' });
            }
          } 
          // Fallback to the original processed image
          else {
            const hiddenImg = document.getElementById('processed-image') as HTMLImageElement;
            
            if (hiddenImg && hiddenImg.complete && hiddenImg.naturalWidth > 0) {
              console.log(`Using direct DOM image for PDF (${mode === 'area' ? 'Surface Area' : 'Space Counter'} mode)`,
                hiddenImg.naturalWidth, "x", hiddenImg.naturalHeight);
              
              // Create an offscreen canvas to prepare the image
              const canvas = document.createElement('canvas');
              canvas.width = hiddenImg.naturalWidth || 800;
              canvas.height = hiddenImg.naturalHeight || 600;
              
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // Draw the image to canvas
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(hiddenImg, 0, 0, canvas.width, canvas.height);
                
                // Get the image data and dimensions
                let imageData;
                try {
                  // Try to get as JPEG
                  imageData = canvas.toDataURL('image/jpeg', 0.85); // Use compression for large images
                } catch (e) {
                  console.log("Error converting to JPEG, falling back to PNG");
                  try {
                    // Fall back to PNG
                    imageData = canvas.toDataURL('image/png');
                  } catch (e2) {
                    console.error("Error converting to any format", e2);
                    throw new Error("Could not convert image data");
                  }
                }
                
                // Calculate dimensions that fit on the page
                const aspectRatio = canvas.width / canvas.height;
                let processedImgWidth = imgWidth - 20; // 10mm margin on each side
                let processedImgHeight = processedImgWidth / aspectRatio;
                
                // If height exceeds page, scale down but maintain aspect ratio
                if (processedImgHeight > pageHeight - 60) {
                  processedImgHeight = pageHeight - 60;
                  processedImgWidth = processedImgHeight * aspectRatio;
                }
                
                // Center the image on the page
                const xOffset = margin + ((imgWidth - processedImgWidth) / 2);
                const yOffset = margin;
                
                // Add to PDF
                pdf.addImage(
                  imageData, 
                  'JPEG', 
                  xOffset, 
                  yOffset, 
                  processedImgWidth, 
                  processedImgHeight
                );
                
                // Add caption below the image
                pdf.setFontSize(12);
                
                if (mode === 'area') {
                  // For Surface Area mode, only show the surface area measurements
                  pdf.text('Surface Area Analysis Results', pageWidth / 2, yOffset + processedImgHeight + 15, { align: 'center' });
                  
                  // Only include surface area measurements for area mode
                  const results = [
                    `Total Surface Area: ${surfaceArea?.toLocaleString() || 0} sq ft`,
                    `Total Surface Area: ${surfaceAreaSqYd?.toLocaleString() || 0} sq yd`
                  ];
                  
                  // Add text results with spacing
                  results.forEach((text, index) => {
                    pdf.text(text, pageWidth / 2, yOffset + processedImgHeight + 30 + (index * 10), { align: 'center' });
                  });
                } else {
                  // For Space Counter mode, show all parking space details
                  pdf.text('Parking Space Analysis Results', pageWidth / 2, yOffset + processedImgHeight + 15, { align: 'center' });
                  
                  // Add detection results - use standard order for space counter mode
                  const results = [
                    `Parking Spaces: ${parkingSpaces}`,
                    `ADA Spaces: ${handicapSpots}`,
                    `Crosswalks: ${crosswalks}`,
                    `Arrows: ${arrows || 0}`
                  ];
                  
                  // Add text results with spacing
                  results.forEach((text, index) => {
                    pdf.text(text, pageWidth / 2, yOffset + processedImgHeight + 30 + (index * 10), { align: 'center' });
                  });
                }
              }
            } else {
              // If no hidden image, show error
              console.error("Hidden image element not ready");
              throw new Error("Hidden image not available");
            }
          }
        } catch (imgError) {
          console.error("Error adding image to PDF:", imgError);
          // Add error text on the second page
          pdf.setFontSize(12);
          pdf.text('Unable to load the processed image.', imgWidth / 2, 20, { align: 'center' });
          
          // Still add the analysis results even if image fails
          pdf.setFontSize(12);
          
          if (mode === 'area') {
            // For Surface Area mode, only show the surface area measurements
            pdf.text('Surface Area Analysis Results', pageWidth / 2, 20, { align: 'center' });
            
            // Only include surface area measurements for area mode
            const results = [
              `Total Surface Area: ${surfaceArea?.toLocaleString() || 0} sq ft`,
              `Total Surface Area: ${surfaceAreaSqYd?.toLocaleString() || 0} sq yd`
            ];
            
            // Add text results with spacing
            results.forEach((text, index) => {
              pdf.text(text, pageWidth / 2, 40 + (index * 10), { align: 'center' });
            });
          } else {
            // For Space Counter mode, show all parking space details
            pdf.text('Parking Space Analysis Results', pageWidth / 2, 20, { align: 'center' });
            
            // Add detection results for space counter mode
            const results = [
              `Parking Spaces: ${parkingSpaces}`,
              `ADA Spaces: ${handicapSpots}`,
              `Crosswalks: ${crosswalks}`,
              `Arrows: ${arrows || 0}`
            ];
            
            // Add text results with spacing
            results.forEach((text, index) => {
              pdf.text(text, pageWidth / 2, 40 + (index * 10), { align: 'center' });
            });
          }
        }
      }
      
      // Save the PDF
      pdf.save(`Invoice-${invoiceNumber}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('There was an error generating the PDF. Please try again.');
    }
  };
  
  // Add CSS to hide elements from printing
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        .print-hidden {
          display: none !important;
        }
        .pdf-hidden {
          display: none !important;
        }
        .action-column {
          display: none !important;
        }
        .editable-row {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Hidden image for PDF generation only - not shown in the UI */}
        {processedImageId && (
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <img 
              id="processed-image" 
              src={processedImageId.startsWith('data:') 
                ? processedImageId 
                : `/tmp/processed/${processedImageId}.jpg`}
              alt={mode === 'area' ? "Surface area measurement" : "Processed parking lot"}
              width="800"
              height="600"
              style={{ maxWidth: 'none', display: 'none' }}
              crossOrigin={processedImageId.startsWith('data:') ? undefined : "anonymous"}
              onError={(e) => {
                console.error("Error loading processed image:", e);
                console.error("Image source type:", processedImageId.startsWith('data:') ? 'data URL' : 'file path');
                console.error("Image source preview:", processedImageId.substring(0, 30) + '...');
                console.error("Mode:", mode); // Log the current mode
              }}
              onLoad={() => {
                console.log("Hidden image loaded successfully");
                console.log("Current mode:", mode);
                console.log("Image source:", processedImageId.startsWith('data:') ? 'data URL (Area mode)' : 'file path (Space Counter mode)');
              }}
            />
          </div>
        )}
        <DialogHeader>
          <DialogTitle>
            {inFreeQuoteMode ? "LotQuote Free Estimate" : "LotQuote Professional Invoice"}
          </DialogTitle>
          <DialogDescription>
            {inFreeQuoteMode 
              ? "Review your quote details based on the analysis."
              : "Create a professional invoice based on your parking lot analysis."}
          </DialogDescription>
        </DialogHeader>


      
        <div className="space-y-4 my-4">
          {inFreeQuoteMode ? (
            // Free Quote Mode UI
            <div className="p-6 border rounded-lg bg-muted/30">
              <h3 className="text-xl font-semibold mb-4">LotQuote Service Estimate</h3>
              
              {/* Analysis counts based on mode */}
              {mode === 'area' ? (
                // Surface Area mode counts
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-background rounded-lg border text-center">
                    <p className="text-sm font-medium mb-1">Surface Area</p>
                    <p className="text-2xl font-bold">{surfaceArea?.toLocaleString()} sq ft</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border text-center">
                    <p className="text-sm font-medium mb-1">Area in Square Yards</p>
                    <p className="text-2xl font-bold">{surfaceAreaSqYd?.toLocaleString()} sq yd</p>
                  </div>
                </div>
              ) : (
                // Space Counter mode counts
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-background rounded-lg border text-center">
                    <p className="text-sm font-medium mb-1">Parking Spaces</p>
                    <p className="text-2xl font-bold">{parkingSpaces}</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border text-center">
                    <p className="text-sm font-medium mb-1">ADA Spaces</p>
                    <p className="text-2xl font-bold">{handicapSpots}</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border text-center">
                    <p className="text-sm font-medium mb-1">Crosswalks</p>
                    <p className="text-2xl font-bold">{crosswalks}</p>
                  </div>
                </div>
              )}
              
              {/* Quote calculation */}
              {(() => {
                const quote = calculateQuote();
                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-background rounded-lg border">
                      <h4 className="font-medium mb-2">Price Breakdown</h4>
                      <div className="space-y-1 text-sm">
                        {mode === 'area' ? (
                          // Surface Area mode - show only the total range, not line items
                          <div className="text-center py-2">
                            <p className="text-sm">Based on {surfaceArea?.toLocaleString()} sq ft of surface area</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Includes $500 base fee plus $0.35-$0.50 per sq ft
                            </p>
                          </div>
                        ) : (
                          // Space Counter mode
                          <>
                            <div className="flex justify-between">
                              <span>Mobilization Fee:</span>
                              <span>${quote.mobilizationFee?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Parking Spaces ({parkingSpaces} × $5):</span>
                              <span>${quote.parkingCost?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>ADA Spaces ({handicapSpots} × $25):</span>
                              <span>${quote.handicapCost?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Crosswalks ({crosswalks} × $20):</span>
                              <span>${quote.crosswalkCost?.toFixed(2) || '0.00'}</span>
                            </div>
                            {arrows > 0 && (
                              <div className="flex justify-between">
                                <span>Directional Arrows ({arrows} × $15):</span>
                                <span>${quote.arrowsCost?.toFixed(2) || '0.00'}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-4 bg-background rounded-lg border">
                      <h4 className="font-medium mb-2">Estimated Price Range</h4>
                      <p className="text-3xl font-bold text-center my-4">
                        ${quote.lowerEstimate?.toLocaleString() || '0'} - ${quote.upperEstimate?.toLocaleString() || '0'}
                      </p>
                      <p className="text-xs text-muted-foreground text-center">
                        This is an estimated range. Final pricing may vary based on site inspection.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-background rounded-lg border">
                      <h4 className="font-medium mb-3">Additional Work Requested</h4>
                      <Textarea
                        value={additionalWork}
                        onChange={(e) => setAdditionalWork(e.target.value)}
                        placeholder="Please describe any additional work you would like included in your quote..."
                        className="min-h-[100px]"
                      />
                    </div>
                    
                    <div className="p-4 bg-background rounded-lg border">
                      <h4 className="font-medium mb-3">Next Steps</h4>
                      <p className="text-sm">
                        Thank you for using our Free Quote tool! For a detailed quote and to schedule 
                        service, please create an account or sign in. Our team will contact you 
                        within 1 business day to discuss your parking lot service needs.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            // Regular Invoice UI
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="companyName">Your Company</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="companyTagline">Company Tagline</Label>
                  <Input
                    id="companyTagline"
                    value={companyTagline}
                    onChange={(e) => setCompanyTagline(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="invoiceDate">Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="companyLogo">Company Logo</Label>
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {companyLogo ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                    {companyLogo && (
                      <Button 
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => setCompanyLogo(null)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <input 
                      type="file" 
                      id="logo" 
                      ref={fileInputRef}
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleLogoUpload} 
                    />
                  </div>
                </div>
              </div>

              <div id="invoice-content" className="bg-white p-8 rounded-lg border">
                {/* Company Header with Logo */}
                <div className="flex justify-between mb-8">
                  <div className="flex gap-4 items-center">
                    {companyLogo && (
                      <div className="w-16 h-16 flex-shrink-0">
                        <img 
                          src={companyLogo} 
                          alt="Company Logo" 
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-bold">{companyName}</h2>
                      <p className="text-muted-foreground">{companyTagline}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-xl font-bold">INVOICE</h3>
                    <p>#{invoiceNumber}</p>
                    <p>Date: {new Date(invoiceDate).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="font-medium">Bill To:</p>
                  <p>{clientName}</p>
                  <p className="text-sm">{address}</p>
                </div>
                
                {/* Surface Area Measurements - image only in PDF */}
                {mode === 'area' && (
                  <div className="mb-6">
                    <p className="font-medium">Surface Area Analysis:</p>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="border p-2 rounded-md text-center">
                        <p className="text-sm font-medium">Square Feet:</p>
                        <p>{surfaceArea?.toLocaleString() || 0} sq ft</p>
                      </div>
                      <div className="border p-2 rounded-md text-center">
                        <p className="text-sm font-medium">Square Yards:</p>
                        <p>{surfaceAreaSqYd?.toLocaleString() || 0} sq yd</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">Surface area map will be included in the PDF document</p>
                  </div>
                )}

                <div className="flex items-center mb-4 pdf-hidden print-hidden">
                  <Checkbox 
                    id="hide-detail-columns"
                    checked={hideDetailColumns}
                    onCheckedChange={(checked) => setHideDetailColumns(checked as boolean)}
                    className="mr-2"
                  />
                  <label 
                    htmlFor="hide-detail-columns" 
                    className="text-sm cursor-pointer"
                  >
                    Hide Rate and Quantity columns in PDF
                  </label>
                </div>
                
                <table className="w-full border-collapse mb-6">
                  <colgroup>
                    <col style={{width: hideDetailColumns ? "70%" : "45%"}} /> {/* Description column wider when hiding details */}
                    <col style={{width: "15%"}} className={hideDetailColumns ? "pdf-hidden" : ""} /> {/* Quantity column */}
                    <col style={{width: "15%"}} className={hideDetailColumns ? "pdf-hidden" : ""} /> {/* Rate column */}
                    <col style={{width: hideDetailColumns ? "30%" : "15%"}} /> {/* Amount column */}
                    <col className="print-hidden" style={{width: "10%"}} /> {/* Action column - hidden in print */}
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Description</th>
                      <th className={`border p-2 text-right ${hideDetailColumns ? "pdf-hidden" : ""}`}>Quantity</th>
                      <th className={`border p-2 text-right ${hideDetailColumns ? "pdf-hidden" : ""}`}>Rate</th>
                      <th className="border p-2 text-right">Amount</th>
                      <th className="border p-2 text-center action-column print-hidden">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((item) => (
                      <tr key={item.id} className={item.editable && !item.description ? "editable-row" : ""}>
                        <td className="border p-2">
                          {item.editable && !item.description ? (
                            (inFreeQuoteMode || userPaymentPlan === 'free') ? (
                              <div className="text-muted-foreground italic">
                                Preview only
                              </div>
                            ) : (
                              <Input
                                value={newItemDescription}
                                onChange={(e) => setNewItemDescription(e.target.value)}
                                placeholder="New item description"
                                className="my-1 print-hidden"
                              />
                            )
                          ) : (
                            <div 
                              className={`text-left px-1 ${(inFreeQuoteMode || userPaymentPlan === 'free') ? '' : 'cursor-pointer'}`}
                              onClick={() => {
                                if (!(inFreeQuoteMode || userPaymentPlan === 'free')) {
                                  const newValue = window.prompt("Enter description:", item.description);
                                  if (newValue !== null) {
                                    handleItemChange(item.id, 'description', newValue);
                                  }
                                }
                              }}
                              style={{ maxWidth: "250px", whiteSpace: "normal", wordWrap: "break-word" }}
                            >
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className={`border p-2 text-right ${hideDetailColumns ? "pdf-hidden" : ""}`}>
                          {item.editable && !item.description ? (
                            (inFreeQuoteMode || userPaymentPlan === 'free') ? (
                              <div className="text-right text-muted-foreground">
                                -
                              </div>
                            ) : (
                              <Input
                                type="number"
                                value={newItemQuantity || ""}
                                onChange={(e) => 
                                  setNewItemQuantity(parseInt(e.target.value) || 0)
                                }
                                min="0"
                                className="my-1 w-20 ml-auto"
                              />
                            )
                          ) : (
                            <div 
                              className={`text-right p-1 ${(inFreeQuoteMode || userPaymentPlan === 'free') ? '' : 'cursor-pointer'}`}
                              onClick={() => {
                                if (!(inFreeQuoteMode || userPaymentPlan === 'free')) {
                                  const newValue = window.prompt("Enter quantity:", item.quantity.toString());
                                  if (newValue !== null) {
                                    handleItemChange(item.id, 'quantity', parseInt(newValue) || 0);
                                  }
                                }
                              }}
                            >
                              {item.quantity}
                            </div>
                          )}
                        </td>
                        <td className={`border p-2 text-right ${hideDetailColumns ? "pdf-hidden" : ""}`}>
                          {item.editable && !item.description ? (
                            (inFreeQuoteMode || userPaymentPlan === 'free') ? (
                              <div className="text-right text-muted-foreground">
                                -
                              </div>
                            ) : (
                              <Input
                                type="number"
                                value={newItemRate || ""}
                                onChange={(e) => 
                                  setNewItemRate(parseInt(e.target.value) || 0)
                                }
                                min="0"
                                className="my-1 w-20 ml-auto"
                              />
                            )
                          ) : (
                            <div 
                              className={`text-right p-1 ${(inFreeQuoteMode || userPaymentPlan === 'free') ? '' : 'cursor-pointer'}`}
                              onClick={() => {
                                if (!(inFreeQuoteMode || userPaymentPlan === 'free')) {
                                  const newValue = window.prompt("Enter rate:", item.rate.toString());
                                  if (newValue !== null) {
                                    handleItemChange(item.id, 'rate', parseInt(newValue) || 0);
                                  }
                                }
                              }}
                            >
                              ${item.rate}
                            </div>
                          )}
                        </td>
                        <td className="border p-2 text-right">
                          ${item.amount.toFixed(2)}
                        </td>
                        {/* Action column - only visible in UI, not in PDF */}
                        <td className="border p-2 text-center action-column print-hidden">
                          {item.editable && !item.description ? (
                            (inFreeQuoteMode || userPaymentPlan === 'free') ? (
                              <div className="text-xs text-muted-foreground italic">
                                Preview only
                              </div>
                            ) : (
                              <Button 
                                size="sm" 
                                onClick={handleAddCustomItem}
                                disabled={!newItemDescription || newItemRate <= 0 || newItemQuantity <= 0}
                              >
                                Add
                              </Button>
                            )
                          ) : (
                            (inFreeQuoteMode || userPaymentPlan === 'free') ? (
                              <span></span>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => setInvoiceItems(prev => prev.filter(i => i.id !== item.id))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td colSpan={hideDetailColumns ? 1 : 3} className="border p-2 text-right">
                        Total:
                      </td>
                      <td className="border p-2 text-right">
                        ${calculateTotal().toFixed(2)}
                      </td>
                      <td className="border p-2 action-column print-hidden"></td>
                    </tr>
                  </tbody>
                </table>

                <div className="border-t pt-4">
                  <p className="font-medium">Notes:</p>
                  {(inFreeQuoteMode || userPaymentPlan === 'free') ? (
                    <div className="mt-2 min-h-[80px] text-sm text-muted-foreground border rounded-md p-3">
                      {notes}
                      {notes.length === 0 && <span className="italic">Preview only - notes cannot be edited in free version</span>}
                    </div>
                  ) : (
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-2 min-h-[80px] text-sm text-muted-foreground"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {inFreeQuoteMode || userPaymentPlan === 'free' ? (
            <div className="flex gap-2">
              <Button onClick={() => onOpenChange(false)}>
                {inFreeQuoteMode ? 'Submit Quote Request' : 'Close Preview'}
              </Button>
              {userPaymentPlan === 'free' && !inFreeQuoteMode && (
                <Button 
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                  onClick={() => {
                    window.location.href = '/payment-plan';
                  }}
                >
                  Upgrade Plan
                </Button>
              )}
            </div>
          ) : (
            <Button onClick={downloadInvoice}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF Invoice
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}