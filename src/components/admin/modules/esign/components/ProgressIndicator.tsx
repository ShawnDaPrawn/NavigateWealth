/**
 * Progress Indicator Component
 * Visual progress bar for envelope signing status
 */

import React from 'react';
import type { EsignEnvelope } from '../types';
import { calculateSigningProgress, getProgressMessage } from '../utils/esignHelpers';

interface ProgressIndicatorProps {
  envelope: EsignEnvelope;
  showLabel?: boolean;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressIndicator({ 
  envelope, 
  showLabel = true,
  showPercentage = true,
  size = 'md'
}: ProgressIndicatorProps) {
  const progress = calculateSigningProgress(envelope);
  const message = getProgressMessage(envelope);

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const getProgressColor = () => {
    if (progress.isComplete) return 'bg-green-500';
    if (progress.percentComplete >= 50) return 'bg-blue-500';
    if (progress.percentComplete > 0) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{message}</span>
          {showPercentage && (
            <span className="font-medium">{progress.percentComplete}%</span>
          )}
        </div>
      )}
      
      <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size]} overflow-hidden`}>
        <div
          className={`${sizeClasses[size]} rounded-full transition-all duration-300 ${getProgressColor()}`}
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>

      {showLabel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{progress.signedCount} of {progress.totalSigners} signed</span>
          {progress.pendingCount > 0 && (
            <span>• {progress.pendingCount} pending</span>
          )}
        </div>
      )}
    </div>
  );
}