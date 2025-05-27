import React from 'react';

// This is the direct base64 encoded image
const parkingStripingImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zUAAEXeWNhQlgAARd5anVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNbHiwACu0AQlTAAFJx';

export function ParkingLotStripingCostsImage() {
  // This component uses inline styles to display a background image
  return (
    <div className="w-full h-full">
      <div 
        className="w-full h-64 md:h-80 lg:h-96 bg-cover bg-center rounded-md"
        style={{
          backgroundImage: "url('/images/parking-lot-striping-costs.png')",
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat"
        }}
        role="img"
        aria-label="Worker applying fresh striping to a parking lot"
      />
    </div>
  );
}