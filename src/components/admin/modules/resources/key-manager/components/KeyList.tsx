/**
 * KeyList Component
 * Renders a list of keys with empty state handling
 */

import React from 'react';
import { Key } from 'lucide-react';
import { ProductKey } from '../types';
import { KeyCard } from './KeyCard';

interface KeyListProps {
  keys: ProductKey[];
  showUsage?: boolean;
  showDependencies?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  className?: string;
}

export function KeyList({
  keys,
  showUsage = true,
  showDependencies = true,
  emptyStateTitle = 'No keys found',
  emptyStateDescription = 'Try adjusting your search filters',
  className = ''
}: KeyListProps) {
  // Empty state
  if (keys.length === 0) {
    return (
      <div className={`text-center py-12 text-muted-foreground ${className}`}>
        <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">{emptyStateTitle}</p>
        <p className="text-sm">{emptyStateDescription}</p>
      </div>
    );
  }

  // Render key list
  return (
    <div className={`space-y-3 ${className}`}>
      {keys.map((key) => (
        <KeyCard
          key={key.id}
          keyData={key}
          showUsage={showUsage}
          showDependencies={showDependencies}
        />
      ))}
    </div>
  );
}
