import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Minus, Plus, RotateCcw, Download, X, Move } from 'lucide-react';

interface ImageViewerProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  alt?: string;
}

export function ImageViewer({ imageUrl, isOpen, onClose, title = 'Image Viewer', alt = 'Image' }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Reset zoom and position when opening a new image
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageUrl]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    
    // Only attempt to download if we have a valid image URL
    if (!imageUrl) return;
    
    // If it's a data URL, we can download directly
    if (imageUrl.startsWith('data:')) {
      link.href = imageUrl;
      link.download = 'parking-lot-image.jpg';
    } 
    // Otherwise fetch the image and convert to data URL for download
    else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        
        try {
          link.href = canvas.toDataURL('image/jpeg');
          link.download = 'parking-lot-image.jpg';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (e) {
          console.error('Error creating download link:', e);
        }
      };
      img.src = imageUrl;
      return; // Return early since the download will happen in the onload callback
    }
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Apply transform to the image
  const imageStyle: React.CSSProperties = {
    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
    cursor: isDragging ? 'grabbing' : 'grab',
    transition: isDragging ? 'none' : 'transform 0.15s ease-in-out',
    maxWidth: '100%',
    maxHeight: '80vh',
    objectFit: 'contain'
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription className="flex items-center mt-2">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mt-1 flex items-center">
                <Move className="h-3 w-3 mr-1" /> Drag to pan, use buttons to zoom
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow flex justify-center items-center bg-gray-900/10 overflow-hidden relative">
          <div
            ref={containerRef}
            className="h-full w-full overflow-hidden flex justify-center items-center"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <img 
              src={imageUrl} 
              alt={alt} 
              style={imageStyle}
              className="pointer-events-none" // Prevents image from interfering with mouse events
            />
          </div>
        </div>

        <div className="flex-shrink-0 border-t p-2 bg-background flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={scale <= 0.5}>
              <Minus className="h-4 w-4" />
            </Button>
            <div className="text-xs px-2 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </div>
            <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={scale >= 5}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleReset} className="ml-2">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}