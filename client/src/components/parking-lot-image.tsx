import React from 'react';

export function FreshParkingLotImage() {
  return (
    <div className="w-full h-full relative overflow-hidden bg-[#101010]">
      {/* Fresh sealcoat base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#121212] to-[#1a1a1a]"></div>
      
      {/* Very subtle asphalt texture */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23232323' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        backgroundSize: '100px 100px',
      }}></div>
      
      {/* Perspective container */}
      <div className="absolute inset-0" style={{ perspective: '1000px' }}>
        {/* Main parking lot container - angled in 3D space */}
        <div className="absolute inset-0 flex flex-col" 
          style={{ 
            transform: 'rotateX(60deg) translateZ(-40px) translateY(-30px) scale(1.2)',
            transformOrigin: 'center center'
          }}>
          
          {/* Row 1 - Top parking spaces */}
          <div className="flex-1 flex">
            {/* Left section with multiple spaces */}
            <div className="flex-1 flex">
              {[...Array(8)].map((_, i) => (
                <div key={`top-space-${i}`} className="flex-1 border-[3px] border-white"></div>
              ))}
            </div>
            
            {/* Right section with handicap spaces */}
            <div className="w-[20%] flex">
              <div className="flex-1 border-[3px] border-white flex items-center justify-center">
                <div className="w-[70%] h-[70%] bg-blue-600 flex items-center justify-center">
                  <div className="text-white font-bold text-4xl">♿</div>
                </div>
              </div>
              <div className="flex-1 border-[3px] border-white flex items-center justify-center">
                <div className="w-[70%] h-[70%] bg-blue-600 flex items-center justify-center">
                  <div className="text-white font-bold text-4xl">♿</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Driving lane with arrows and center line */}
          <div className="h-[25%] relative">
            {/* Center dashed line */}
            <div className="absolute top-1/2 left-0 w-full h-[6px] -translate-y-1/2">
              <div className="flex w-full">
                {[...Array(20)].map((_, i) => [
                  <div key={`dash-filled-${i}`} className="w-[5%] h-full bg-yellow-400"></div>,
                  <div key={`dash-empty-${i}`} className="w-[5%] h-full bg-transparent"></div>
                ]).flat()}
              </div>
            </div>
            
            {/* Right Arrow */}
            <div className="absolute top-1/4 left-3/4 w-[15%] h-1/2">
              <div className="w-full h-[40%] bg-yellow-400 relative top-1/2 -translate-y-1/2">
                <div className="absolute left-full top-0 w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-l-[20px] border-l-yellow-400"></div>
              </div>
            </div>
            
            {/* Left Arrow */}
            <div className="absolute top-1/4 left-1/4 w-[15%] h-1/2">
              <div className="w-full h-[40%] bg-yellow-400 relative top-1/2 -translate-y-1/2">
                <div className="absolute right-full top-0 w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-r-[20px] border-r-yellow-400"></div>
              </div>
            </div>
            
            {/* Crosswalk */}
            <div className="absolute left-[5%] top-0 bottom-0 w-[8%]">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={`crosswalk-${i}`} 
                  className="absolute w-[15%] h-full bg-white"
                  style={{ left: `${i * 20}%` }}
                ></div>
              ))}
            </div>
          </div>
          
          {/* Row 2 - Bottom parking spaces */}
          <div className="flex-1 flex">
            {[...Array(10)].map((_, i) => (
              <div key={`bottom-space-${i}`} className="flex-1 border-[3px] border-white"></div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Fresh sealcoat shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#ffffff10] via-transparent to-transparent opacity-60"></div>
      
      {/* Add a light source reflection in top corner */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)'
        }}
      ></div>
    </div>
  );
}