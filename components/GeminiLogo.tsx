import React from 'react';

interface GeminiLogoProps {
  size?: number;
  isAnimating?: boolean;
}

const GeminiLogo: React.FC<GeminiLogoProps> = ({ size = 80, isAnimating = false }) => {
  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ 
        width: size, 
        height: size
      }}
    >
      {/* Centered spinning logo - rotates from center like a spinning top */}
      <img 
        src="/gemini-google-logo.png" 
        alt="Gemini Logo" 
        className={`${isAnimating ? 'animate-spin' : ''}`}
        style={{ 
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transformOrigin: 'center center',
          animationDuration: isAnimating ? '3s' : undefined,
          animationTimingFunction: 'linear'
        }}
      />
      
      {/* Subtle glow effect when animating */}
      {isAnimating && (
        <>
          <div 
            className="absolute inset-0 animate-pulse pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(164, 67, 228, 0.2) 0%, transparent 70%)',
              filter: 'blur(20px)',
              transformOrigin: 'center center'
            }}
          />
          <div 
            className="absolute inset-0 animate-ping pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(77, 157, 224, 0.15) 0%, transparent 60%)',
              animationDuration: '2s',
              transformOrigin: 'center center'
            }}
          />
        </>
      )}
    </div>
  );
};

export default GeminiLogo;

