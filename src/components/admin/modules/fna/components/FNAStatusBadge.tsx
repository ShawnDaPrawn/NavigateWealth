/**
 * FNA Status Badge Component
 * Displays the publication status of an FNA with appropriate styling
 *
 * Guidelines §7.1 — Uses config-driven status from constants.ts
 */

import React from 'react';
import { Badge } from '../../../../ui/badge';
import { CheckCircle, FileEdit, Archive } from 'lucide-react';
import { FNA_STATUS_CONFIG, FNA_BADGE_SIZE_CLASSES } from '../constants';
import type { FNAStatus } from '../types';

const ICON_MAP = {
  'check-circle': CheckCircle,
  'file-edit': FileEdit,
  'archive': Archive,
} as const;

interface FNAStatusBadgeProps {
  status: FNAStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function FNAStatusBadge({ status, size = 'md' }: FNAStatusBadgeProps) {
  const config = FNA_STATUS_CONFIG[status] ?? FNA_STATUS_CONFIG.draft;
  const Icon = ICON_MAP[config.iconSlug as keyof typeof ICON_MAP] ?? FileEdit;
  const sizeClass = FNA_BADGE_SIZE_CLASSES[size];

  return (
    <Badge className={`${config.badgeClass} ${sizeClass.text} gap-1.5`}>
      <Icon className={sizeClass.icon} />
      {config.label}
    </Badge>
  );
}
