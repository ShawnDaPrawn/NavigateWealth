/**
 * Publications Feature - ErrorState Component
 * 
 * Displays error messages with optional retry action.
 */

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../../../ui/button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  fullPage?: boolean;
}

export function ErrorState({ 
  title = 'Something went wrong',
  message, 
  onRetry,
  fullPage = false 
}: ErrorStateProps) {
  const containerClasses = fullPage
    ? 'flex flex-col items-center justify-center min-h-[400px]'
    : 'flex flex-col items-center justify-center py-12';

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      
      <h3 className="text-lg mb-2 text-gray-900">{title}</h3>
      <p className="text-gray-600 text-center mb-6 max-w-md">{message}</p>
      
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
}

/**
 * Inline error message (for forms, etc.)
 */
export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600 text-sm">
      <AlertCircle className="w-4 h-4" />
      <span>{message}</span>
    </div>
  );
}