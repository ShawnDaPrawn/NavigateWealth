/**
 * Publications Feature - StatusBadge Component
 * 
 * Displays article status with appropriate styling.
 */

import React from 'react';
import { Badge } from '../../../../ui/badge';
import { STATUS_LABELS, STATUS_COLORS } from '../constants';
import type { ArticleStatus } from '../types';

interface StatusBadgeProps {
  status: ArticleStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = STATUS_LABELS[status];
  const colorClass = STATUS_COLORS[status];

  return (
    <Badge className={`${colorClass} ${className || ''}`}>
      {label}
    </Badge>
  );
}
