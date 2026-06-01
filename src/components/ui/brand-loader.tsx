import React from 'react';
import { Compass } from 'lucide-react';
import { cn } from './utils';

interface BrandLoaderPanelProps {
  title?: string;
  message?: string;
  badge?: string;
  compact?: boolean;
  className?: string;
}

interface BrandPageLoaderProps extends BrandLoaderPanelProps {
  containerClassName?: string;
}

interface BrandSectionLoaderProps extends BrandLoaderPanelProps {
  containerClassName?: string;
}

interface BrandInlineLoaderProps {
  label?: string;
  className?: string;
}

function CompassCardinalMarks({ compact = false }: { compact?: boolean }) {
  const tickClass = compact ? 'h-2 w-0.5' : 'h-2.5 w-0.5';

  return (
    <>
      <span
        className={cn(
          'absolute left-1/2 top-1 -translate-x-1/2 rounded-full bg-[#6d28d9]/70',
          tickClass,
        )}
      />
      <span
        className={cn(
          'absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#1a1e36]/25',
          tickClass,
        )}
      />
      <span
        className={cn(
          'absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-[#1a1e36]/25',
          compact ? 'h-0.5 w-2' : 'h-0.5 w-2.5',
        )}
      />
      <span
        className={cn(
          'absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-[#1a1e36]/25',
          compact ? 'h-0.5 w-2' : 'h-0.5 w-2.5',
        )}
      />
      <span className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[8px] font-bold tracking-[0.08em] text-[#6d28d9]">
        N
      </span>
    </>
  );
}

function NavigationCompassLoader({ compact = false }: { compact?: boolean }) {
  const sizeClasses = compact ? 'h-14 w-14' : 'h-16 w-16';
  const ringInset = compact ? 'inset-[4px]' : 'inset-[5px]';
  const innerInset = compact ? 'inset-[10px]' : 'inset-[12px]';
  const coreSize = compact ? 'h-8 w-8' : 'h-9 w-9';
  const iconSize = compact ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div
      className={cn('relative flex items-center justify-center', sizeClasses)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full bg-[#6d28d9]/12 blur-xl animate-pulse" />

      <div
        className={cn(
          'absolute rounded-full border border-[#1a1e36]/10 bg-white/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)]',
          ringInset,
        )}
      />

      <div
        className={cn(
          'absolute rounded-full border border-dashed border-[#6d28d9]/25 animate-spin [animation-duration:10s]',
          ringInset,
        )}
      >
        <CompassCardinalMarks compact={compact} />
      </div>

      <div
        className={cn(
          'absolute rounded-full border-[1.5px] border-[#1a1e36]/10 border-t-[#6d28d9] border-r-[#8b5cf6] animate-spin [animation-duration:1.4s]',
          innerInset,
        )}
      />

      <div
        className={cn(
          'relative flex items-center justify-center rounded-full bg-gradient-to-br from-[#1a1e36] via-[#252a47] to-[#6d28d9] shadow-[0_16px_32px_-14px_rgba(37,42,71,0.9)] ring-2 ring-white/10',
          coreSize,
        )}
      >
        <div className="absolute inset-[4px] rounded-full bg-white/10" />
        <Compass className={cn(iconSize, 'relative text-white drop-shadow-sm')} strokeWidth={2.2} />
      </div>
    </div>
  );
}

export function BrandLoaderPanel({
  title = 'Plotting your course',
  message = 'Checking your bearing and bringing the next view into focus.',
  badge = 'Charting course',
  compact = false,
  className,
}: BrandLoaderPanelProps) {
  return (
    <div
      className={cn(
        'relative w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 text-center shadow-[0_28px_90px_-48px_rgba(26,30,54,0.6)] backdrop-blur-sm',
        compact ? 'px-6 py-7' : 'px-8 py-9',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(26, 30, 54, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(26, 30, 54, 0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[radial-gradient(circle_at_50%_120%,rgba(109,40,217,0.12),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[#6d28d9]/15 bg-[#6d28d9]/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b21b6]">
          <Compass className="h-3 w-3" aria-hidden="true" />
          {badge}
        </div>
        <div className="flex flex-col items-center">
          <NavigationCompassLoader compact={compact} />
          <h2
            className={cn(
              'mt-5 font-semibold tracking-tight text-[#1a1e36]',
              compact ? 'text-lg' : 'text-xl',
            )}
          >
            {title}
          </h2>
          <p
            className={cn(
              'mt-2 max-w-sm text-balance text-slate-600',
              compact ? 'text-sm' : 'text-sm leading-6',
            )}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

export function BrandPageLoader({ containerClassName, ...panelProps }: BrandPageLoaderProps) {
  return (
    <div
      className={cn(
        'relative min-h-screen px-4 py-8 flex items-center justify-center overflow-hidden',
        'bg-[radial-gradient(circle_at_top,rgba(109,40,217,0.1),transparent_32%),linear-gradient(180deg,#f4f7fb_0%,#e7eef6_100%)]',
        containerClassName,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(26, 30, 54, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(26, 30, 54, 0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden="true"
      />
      <div className="relative">
        <BrandLoaderPanel {...panelProps} />
      </div>
    </div>
  );
}

export function BrandSectionLoader({
  containerClassName,
  compact = true,
  ...panelProps
}: BrandSectionLoaderProps) {
  return (
    <div className={cn('flex items-center justify-center py-12', containerClassName)}>
      <BrandLoaderPanel compact={compact} {...panelProps} />
    </div>
  );
}

export function BrandInlineLoader({
  label = 'Plotting course...',
  className,
}: BrandInlineLoaderProps) {
  return (
    <div
      className={cn('inline-flex items-center gap-2 text-sm font-medium text-slate-600', className)}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border border-[#6d28d9]/20" />
        <span className="absolute inset-[1px] rounded-full border border-dashed border-[#6d28d9]/30 animate-spin [animation-duration:3s]" />
        <Compass className="h-2.5 w-2.5 text-[#6d28d9]" strokeWidth={2.4} />
      </span>
      <span>{label}</span>
    </div>
  );
}
