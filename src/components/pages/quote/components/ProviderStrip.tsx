/**
 * ProviderStrip — Horizontal logo strip showing providers for a given service.
 * Designed to build trust and entice the user to complete the quote form.
 */

import React from 'react';
import { OptimizedImage } from '../../../shared/OptimizedImage';
import type { QuoteProvider } from '../types';

interface ProviderStripProps {
  providers: QuoteProvider[];
  /** Display variant */
  variant?: 'light' | 'dark';
  className?: string;
}

export function ProviderStrip({ providers, variant = 'light', className = '' }: ProviderStripProps) {
  if (providers.length === 0) return null;

  return (
    <div className={className}>
      <p className={`text-xs font-medium mb-3 ${variant === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
        Compare quotes from {providers.length} trusted partner{providers.length !== 1 ? 's' : ''}
      </p>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`
              flex items-center justify-center rounded-lg px-3 py-2 transition-all duration-200
              ${variant === 'dark'
                ? 'bg-white shadow-sm'
                : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
              }
            `}
            title={provider.name}
          >
            {provider.logo ? (
              <OptimizedImage
                src={provider.logo}
                alt={provider.name}
                width={120}
                height={40}
                className="h-7 sm:h-8 w-auto max-w-[100px] object-contain high-quality-image"
                loading="lazy"
              />
            ) : (
              <span className="text-xs font-semibold text-gray-600">
                {provider.name}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}