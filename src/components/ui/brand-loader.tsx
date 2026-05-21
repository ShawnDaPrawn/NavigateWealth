import React from 'react';
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

function LoaderOrb({ compact = false }: { compact?: boolean }) {
  const sizeClasses = compact ? 'h-14 w-14' : 'h-16 w-16';
  const ringInset = compact ? 'inset-[5px]' : 'inset-[6px]';
  const spinnerInset = compact ? 'inset-[13px]' : 'inset-[15px]';
  const coreSize = compact ? 'h-7 w-7' : 'h-8 w-8';

  return (
    <div className={cn('relative flex items-center justify-center', sizeClasses)} aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-[#6d28d9]/15 blur-xl animate-pulse" />
      <div className={cn('absolute rounded-full border border-[#6d28d9]/30 animate-spin [animation-duration:3s]', ringInset)} />
      <div
        className={cn(
          'absolute rounded-full border-[1.5px] border-[#1a1e36]/10 border-t-[#6d28d9] border-r-[#8b5cf6] animate-spin [animation-duration:1.2s]',
          spinnerInset,
        )}
      />
      <div className={cn('relative rounded-full bg-gradient-to-br from-[#1a1e36] via-[#252a47] to-[#6d28d9] shadow-[0_16px_32px_-14px_rgba(37,42,71,0.9)]', coreSize)}>
        <div className="absolute inset-[5px] rounded-full bg-white/10" />
      </div>
    </div>
  );
}

export function BrandLoaderPanel({
  title = 'Loading',
  message = 'Preparing your Navigate Wealth experience.',
  badge = 'Navigate Wealth',
  compact = false,
  className,
}: BrandLoaderPanelProps) {
  return (
    <div
      className={cn(
        'w-full max-w-md rounded-[28px] border border-slate-200/80 bg-white/88 text-center shadow-[0_28px_90px_-48px_rgba(26,30,54,0.6)] backdrop-blur-sm',
        compact ? 'px-6 py-7' : 'px-8 py-9',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="mx-auto mb-4 inline-flex items-center rounded-full border border-[#6d28d9]/15 bg-[#6d28d9]/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5b21b6]">
        {badge}
      </div>
      <div className="flex flex-col items-center">
        <LoaderOrb compact={compact} />
        <h2 className={cn('mt-5 font-semibold tracking-tight text-[#1a1e36]', compact ? 'text-lg' : 'text-xl')}>
          {title}
        </h2>
        <p className={cn('mt-2 max-w-sm text-balance text-slate-600', compact ? 'text-sm' : 'text-sm leading-6')}>
          {message}
        </p>
      </div>
    </div>
  );
}

export function BrandPageLoader({
  containerClassName,
  ...panelProps
}: BrandPageLoaderProps) {
  return (
    <div
      className={cn(
        'min-h-screen bg-[radial-gradient(circle_at_top,_rgba(109,40,217,0.08),_transparent_30%),linear-gradient(180deg,_#f8f9fb_0%,_#eef2f7_100%)] px-4 py-8 flex items-center justify-center',
        containerClassName,
      )}
    >
      <BrandLoaderPanel {...panelProps} />
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
  label = 'Loading...',
  className,
}: BrandInlineLoaderProps) {
  return (
    <div className={cn('inline-flex items-center gap-2 text-sm font-medium text-slate-600', className)} role="status" aria-live="polite">
      <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border border-[#6d28d9]/20" />
        <span className="absolute inset-[2px] rounded-full border-[1.5px] border-transparent border-t-[#6d28d9] border-r-[#252a47] animate-spin" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#6d28d9]/75" />
      </span>
      <span>{label}</span>
    </div>
  );
}
