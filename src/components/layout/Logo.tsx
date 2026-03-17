import React from 'react';
import navigateWealthLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import wealthFooterLogo from 'figma:asset/8dc2892f50ecc4c5f692fd5ad52639699e2e4656.png';

interface LogoProps {
  variant?: 'default' | 'light';
  className?: string;
}

export function Logo({ variant = 'default', className = '' }: LogoProps) {
  const logoSrc = variant === 'light' ? wealthFooterLogo : navigateWealthLogo;
  const altText = variant === 'light' ? 'Wealth' : 'Navigate Wealth';
  
  return (
    <div className={`${className} flex items-center`}>
      <img
        src={logoSrc}
        alt={altText}
        className="w-auto high-quality-image"
        loading="eager"
        decoding="sync"
        style={{ 
          height: variant === 'light' ? '29.75px' : '25.5px',
          width: 'auto',
          maxWidth: 'none',
          imageRendering: 'auto',
          WebkitImageRendering: '-webkit-optimize-contrast'
        }}
      />
    </div>
  );
}
