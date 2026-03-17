/**
 * Publications Feature - EmptyState Component
 * 
 * Displays empty state with optional action button.
 */

import React from 'react';
import { FileText, Plus } from 'lucide-react';
import { Button } from '../../../../ui/button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  fullPage?: boolean;
}

export function EmptyState({ 
  icon,
  title, 
  description,
  actionLabel,
  onAction,
  fullPage = false 
}: EmptyStateProps) {
  const containerClasses = fullPage
    ? 'flex flex-col items-center justify-center min-h-[400px]'
    : 'flex flex-col items-center justify-center py-12';

  const defaultIcon = <FileText className="w-12 h-12 text-gray-400" />;

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
        {icon || defaultIcon}
      </div>
      
      <h3 className="text-lg mb-2 text-gray-900">{title}</h3>
      
      {description && (
        <p className="text-gray-600 text-center mb-6 max-w-md">{description}</p>
      )}
      
      {actionLabel && onAction && (
        <Button onClick={onAction}>
          <Plus className="w-4 h-4 mr-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/**
 * Compact empty state for tables/lists
 */
export function EmptyList({ 
  message = 'No items found',
  className
}: { 
  message?: string;
  className?: string;
}) {
  return (
    <div className={`text-center py-8 text-gray-500 ${className || ''}`}>
      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
      <p>{message}</p>
    </div>
  );
}
