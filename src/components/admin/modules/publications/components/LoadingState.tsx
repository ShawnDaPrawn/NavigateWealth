/**
 * Publications Feature - LoadingState Component
 *
 * Consistent loading UI across the feature.
 */

import { Loader2 } from 'lucide-react';
import { Skeleton } from '../../../../ui/skeleton';

interface LoadingStateProps {
  /** Read out to screen readers; the page shows a skeleton, not a spinner. */
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

/**
 * Loading = a skeleton in the shape of a list (design system: States), with
 * `aria-busy`. `message` is the accessible name.
 */
export function LoadingState({ message = 'Loading…', fullPage = false }: LoadingStateProps) {
  return (
    <div
      aria-busy="true"
      aria-label={message}
      role="status"
      data-testid="loading-skeleton"
      className={`space-y-3 ${fullPage ? 'min-h-[400px]' : ''}`}
    >
      <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

/**
 * Inline loading spinner (for buttons, etc.)
 */
export function LoadingSpinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
  };

  return <Loader2 className={`${sizeClasses[size]} animate-spin`} />;
}

/**
 * Skeleton loader for content
 */
export function SkeletonLoader({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`animate-pulse ${className || ''}`}>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}
