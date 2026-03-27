import React from 'react';
import navigateWealthLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import wealthFooterLogo from 'figma:asset/8dc2892f50ecc4c5f692fd5ad52639699e2e4656.png';

interface LogoProps {
  variant?: 'default' | 'light' | 'admin-white';
  className?: string;
}

export function Logo({ variant = 'default', className = '' }: LogoProps) {
  // --- ROLLBACK CODE (Uncomment to restore original logo) ---
  // let logoSrc = navigateWealthLogo;
  // let height = '25.5px';
  // let filterStyle = 'none';
  // ----------------------------------------------------------

  // --- NEW LOGO CODE ---
  let logoSrc = '/brand-assets/navigate-wealth-logo-main-v2.png';
  let altText = 'Navigate Wealth';
  let height = '29.5px'; // ~15% larger
  let filterStyle = 'contrast(1.05) drop-shadow(0px 1px 2px rgba(0,0,0,0.08))'; // Slight enhancement
  // ---------------------

  if (variant === 'light') {
    logoSrc = wealthFooterLogo;
    altText = 'Wealth';
    height = '29.75px';
    filterStyle = 'none';
  } else if (variant === 'admin-white') {
    logoSrc = '/brand-assets/navigate-wealth-admin-logo-transparent.png';
    altText = 'Navigate Wealth';
    height = '36px';
    filterStyle = 'none';
  }

  return (
    <div className={`${className} flex items-center`}>
      <img
        src={logoSrc}
        alt={altText}
        className={`w-auto high-quality-image ${variant === 'admin-white' ? 'mix-blend-screen' : ''}`}
        loading="eager"
        decoding="sync"
        style={{ 
          height,
          width: 'auto',
          maxWidth: 'none',
          imageRendering: 'auto',
          WebkitImageRendering: '-webkit-optimize-contrast',
          filter: filterStyle
        }}
      />
    </div>
  );
}
