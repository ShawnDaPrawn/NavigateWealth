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
  const chips = service.topicChips?.length ? service.topicChips : [];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        group relative flex flex-col items-stretch text-left sm:text-center rounded-xl border-2 
        transition-all duration-200 cursor-pointer w-full min-h-[min-content]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        ${
          isSelected
            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 sm:scale-[1.02]'
            : 'border-gray-200 bg-white hover:border-primary/40 hover:shadow-md hover:bg-primary/[0.02]'
        }
      `}
      aria-pressed={isSelected}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div
          className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center z-[1]"
          aria-hidden
        >
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="flex flex-row sm:flex-col sm:items-center gap-3 p-3 sm:p-4 md:p-5">
        <div
          className={`
            flex-shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-colors duration-200
            ${isSelected ? 'bg-primary/10' : 'bg-gray-50 group-hover:bg-primary/5'}
          `}
        >
          <Icon
            className={`h-5 w-5 sm:h-7 sm:w-7 transition-colors duration-200 ${
              isSelected ? 'text-primary' : 'text-gray-500 group-hover:text-primary/70'
            }`}
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col sm:items-center">
          <span
            className={`text-sm font-semibold leading-tight transition-colors duration-200 ${
              isSelected ? 'text-primary' : 'text-gray-800'
            }`}
          >
            {service.label}
          </span>
          <span className="text-[11px] text-gray-500 mt-0.5 sm:mt-1 leading-snug line-clamp-2 sm:line-clamp-none">
            {service.description}
          </span>

          {chips.length > 0 && (
            <div
              className="flex flex-wrap gap-1 sm:gap-1.5 mt-2.5 sm:mt-3 sm:justify-center w-full"
              aria-label={`Includes: ${chips.join(', ')}`}
            >
              {chips.map((chip) => (
                <span
                  key={chip}
                  className={`
                    inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-left
                    text-[10px] sm:text-[11px] font-medium leading-tight tracking-tight
                    ${
                      isSelected
                        ? 'border-primary/25 bg-primary/[0.08] text-primary'
                        : 'border-gray-200 bg-gray-50/90 text-gray-700 group-hover:border-primary/20'
                    }
                  `}
                >
                  <span className="truncate sm:whitespace-normal sm:break-words">{chip}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
