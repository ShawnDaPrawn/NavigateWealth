/**
 * Publications Feature - CategoryBadge Component
 * 
 * Display category with icon and styling.
 */

import React from 'react';
import { Badge } from '../../../../ui/badge';
import * as Icons from 'lucide-react';

interface CategoryBadgeProps {
  name: string;
  iconKey?: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'md';
  className?: string;
}

export function CategoryBadge({
  name,
  iconKey,
  variant = 'outline',
  size = 'md',
  className
}: CategoryBadgeProps) {
  // Get icon component from lucide-react
  const IconComponent = iconKey ? (Icons as Record<string, React.ComponentType<{ className?: string }>>)[iconKey] : null;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5'
  };

  return (
    <Badge 
      variant={variant}
      className={`${sizeClasses[size]} ${className || ''}`}
    >
      {IconComponent && <IconComponent className="w-3 h-3 mr-1" />}
      {name}
    </Badge>
  );
}

/**
 * Category filter button
 */
export function CategoryFilterButton({
  name,
  count,
  isActive,
  onClick,
  className
}: {
  name: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      } ${className || ''}`}
    >
      {name}
      {count !== undefined && (
        <span className={`ml-2 ${isActive ? 'text-blue-200' : 'text-gray-500'}`}>
          ({count})
        </span>
      )}
    </button>
  );
}