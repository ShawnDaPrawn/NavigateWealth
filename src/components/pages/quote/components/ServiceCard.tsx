/**
 * ServiceCard — Clickable service selection card for the Quote Gateway.
 */

import React from 'react';
import {
  Shield,
  Stethoscope,
  Target,
  TrendingUp,
  Briefcase,
  Calculator,
  FileText,
} from 'lucide-react';
import type { QuoteServiceConfig } from '../types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Stethoscope,
  Target,
  TrendingUp,
  Briefcase,
  Calculator,
  FileText,
};

interface ServiceCardProps {
  service: QuoteServiceConfig;
  isSelected: boolean;
  onSelect: () => void;
}

export function ServiceCard({ service, isSelected, onSelect }: ServiceCardProps) {
  const Icon = ICON_MAP[service.icon] ?? Shield;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        group relative flex flex-col items-center text-center p-4 sm:p-5 rounded-xl border-2 
        transition-all duration-200 cursor-pointer w-full
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        ${
          isSelected
            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 scale-[1.02]'
            : 'border-gray-200 bg-white hover:border-primary/40 hover:shadow-md hover:bg-primary/[0.02]'
        }
      `}
      aria-pressed={isSelected}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div
        className={`
          w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-3 transition-colors duration-200
          ${isSelected ? 'bg-primary/10' : 'bg-gray-50 group-hover:bg-primary/5'}
        `}
      >
        <Icon
          className={`h-6 w-6 sm:h-7 sm:w-7 transition-colors duration-200 ${
            isSelected ? 'text-primary' : 'text-gray-500 group-hover:text-primary/70'
          }`}
        />
      </div>

      <span
        className={`text-sm font-semibold leading-tight transition-colors duration-200 ${
          isSelected ? 'text-primary' : 'text-gray-800'
        }`}
      >
        {service.label}
      </span>
      <span className="text-[11px] text-gray-500 mt-1 leading-snug hidden sm:block">
        {service.description}
      </span>
    </button>
  );
}
