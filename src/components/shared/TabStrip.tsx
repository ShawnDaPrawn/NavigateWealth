/**
 * TabStrip — Shared pill-tab navigation component for service pages.
 *
 * Features:
 *   - Horizontal scrollable pill tabs with icon support
 *   - Flanking chevron buttons for mobile tab navigation
 *   - Light and dark variants for different section backgrounds
 *   - ARIA-compliant tab markup (role="tablist", role="tab", aria-selected)
 *
 * Used by: RiskManagementPage, MedicalAidPage, and other service pages.
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TabStripOption {
  id: string;
  label: string;
}

export interface TabStripProps {
  options: TabStripOption[];
  activeId: string;
  icons: Record<string, React.ComponentType<{ className?: string }>>;
  onSelect: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  variant?: 'light' | 'dark';
  /** Accessible label describing the tab group, e.g. "Individual cover types" */
  ariaLabel?: string;
}

export function TabStrip({
  options,
  activeId,
  icons,
  onSelect,
  onPrev,
  onNext,
  scrollRef,
  variant = 'light',
  ariaLabel = 'Product categories',
}: TabStripProps) {
  const isDark = variant === 'dark';

  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {/* Left arrow — mobile only */}
      <button
        onClick={onPrev}
        aria-label="Previous tab"
        className={`sm:hidden flex-shrink-0 w-9 h-9 rounded-full border shadow-sm flex items-center justify-center transition-all duration-150 ${
          isDark
            ? 'border-white/15 bg-white/8 text-gray-300 hover:text-white hover:border-white/30 hover:shadow-md'
            : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 hover:shadow-md'
        }`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/*
        IMPORTANT: Do NOT use flex/justify-center on the inner wrapper.
        flex justify-center splits overflow equally on both sides, clipping the first tab on the left.
        A plain block div overflows to the RIGHT only — the first tab is always fully visible.
        Desktop centering is handled by the outer justify-center flex container.
      */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide flex-1 sm:flex-none py-2 -my-2"
      >
        <div className="px-3">
          <div
            role="tablist"
            aria-label={ariaLabel}
            className={`rounded-full p-1.5 inline-flex gap-1 min-w-max ${
              isDark
                ? 'bg-white/8 border border-white/10 shadow-sm'
                : 'bg-white border border-gray-200 shadow-sm'
            }`}
          >
            {options.map((option) => {
              const Icon = icons[option.id];
              const active = activeId === option.id;
              return (
                <button
                  key={option.id}
                  role="tab"
                  aria-selected={active}
                  data-active={active ? 'true' : 'false'}
                  onClick={() => onSelect(option.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                    active
                      ? 'bg-purple-600 text-white shadow-sm'
                      : isDark
                        ? 'text-gray-300 hover:text-white hover:bg-white/8'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right arrow — mobile only */}
      <button
        onClick={onNext}
        aria-label="Next tab"
        className={`sm:hidden flex-shrink-0 w-9 h-9 rounded-full border shadow-sm flex items-center justify-center transition-all duration-150 ${
          isDark
            ? 'border-white/15 bg-white/8 text-gray-300 hover:text-white hover:border-white/30 hover:shadow-md'
            : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 hover:shadow-md'
        }`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
