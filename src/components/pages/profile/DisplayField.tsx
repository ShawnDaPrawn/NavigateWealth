/**
 * Display Field Component
 * Shows read-only field values with consistent styling
 */

import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface DisplayFieldProps {
  label: string;
  value: string | number | boolean;
  type?: 'text' | 'boolean' | 'badge';
  badgeColor?: string;
  className?: string;
}

export const DisplayField: React.FC<DisplayFieldProps> = ({
  label,
  value,
  type = 'text',
  badgeColor = 'bg-gray-100 text-gray-800',
  className = '',
}) => {
  const renderValue = () => {
    if (type === 'boolean') {
      return (
        <div className="flex items-center gap-2">
          {value ? (
            <div className="contents">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Yes</span>
            </div>
          ) : (
            <div className="contents">
              <XCircle className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">No</span>
            </div>
          )}
        </div>
      );
    }

    if (type === 'badge') {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${badgeColor}`}>
          {String(value)}
        </span>
      );
    }

    return <span className="text-gray-900">{String(value) || '—'}</span>;
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <div className="text-sm">
        {renderValue()}
      </div>
    </div>
  );
};

interface DisplayGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export const DisplayGrid: React.FC<DisplayGridProps> = ({
  children,
  columns = 2,
  className = '',
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>
      {children}
    </div>
  );
};