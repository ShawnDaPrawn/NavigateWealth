import React from 'react';
import navigateWealthLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import wealthFooterLogo from 'figma:asset/8dc2892f50ecc4c5f692fd5ad52639699e2e4656.png';

interface LogoProps {
  variant?: 'default' | 'light' | 'admin-white';
  className?: string;
}

export function Logo({ variant = 'default', className = '' }: LogoProps) {
  let logoSrc = navigateWealthLogo;
  let altText = 'Navigate Wealth';
  let height = '25.5px';

  if (variant === 'light') {
    logoSrc = wealthFooterLogo;
    altText = 'Wealth';
    height = '29.75px';
  } else if (variant === 'admin-white') {
    logoSrc = '/brand-assets/navigate-wealth-admin-logo-transparent.png';
    altText = 'Navigate Wealth';
    height = '36px';
  }

  return (
    <div className={`${className} flex items-center`}>
      <img
        src={logoSrc}
        alt={altText}
        className="w-auto high-quality-image"
        loading="eager"
        decoding="sync"
        style={{ 
          height,
          width: 'auto',
          maxWidth: 'none',
          imageRendering: 'auto',
          WebkitImageRendering: '-webkit-optimize-contrast'
        }}
      />
    </div>
  );
}
