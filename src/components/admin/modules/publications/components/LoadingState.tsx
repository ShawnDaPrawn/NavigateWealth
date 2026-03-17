/**
 * Publications Feature - LoadingState Component
 * 
 * Consistent loading UI across the feature.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

export function LoadingState({ 
  message = 'Loading...', 
  size = 'md',
  fullPage = false 
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const containerClasses = fullPage
    ? 'flex flex-col items-center justify-center min-h-[400px]'
    : 'flex flex-col items-center justify-center py-12';

  return (
    <div className={containerClasses}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600 mb-4`} />
      <p className="text-gray-600">{message}</p>
    </div>
  );
}

/**
 * Inline loading spinner (for buttons, etc.)
 */
export function LoadingSpinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6'
  };

  return <Loader2 className={`${sizeClasses[size]} animate-spin`} />;
}

/**
 * Skeleton loader for content
 */
export function SkeletonLoader({ 
  count = 3,
  className
}: { 
  count?: number;
  className?: string;
}) {
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
