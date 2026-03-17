/**
 * Status Badge Component (§7.1 — Config-driven)
 * Visual status indicators for envelopes and signers.
 * Icons, labels, and colours are resolved from ENVELOPE_STATUS_CONFIG /
 * SIGNER_STATUS_CONFIG — no inline switch statements.
 */

import React from 'react';
import { Badge } from '../../../../ui/badge';
import type { EnvelopeStatus, SignerStatus } from '../types';
import {
  ENVELOPE_STATUS_CONFIG,
  SIGNER_STATUS_CONFIG,
} from '../constants';

interface StatusBadgeProps {
  status: EnvelopeStatus | SignerStatus;
  type: 'envelope' | 'signer';
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({
  status,
  type,
  showIcon = false,
  size = 'md',
}: StatusBadgeProps) {
  const config =
    type === 'envelope'
      ? ENVELOPE_STATUS_CONFIG[status as EnvelopeStatus]
      : SIGNER_STATUS_CONFIG[status as SignerStatus];

  // Fallback for any unknown status values
  const colorClass = config?.badgeClass ?? 'bg-gray-100 text-gray-800 border-gray-200';
  const label = config?.label ?? status;
  const Icon = config?.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge className={`${colorClass} ${sizeClasses[size]} font-medium`}>
      {showIcon && Icon && <Icon className="h-3.5 w-3.5 mr-1.5" />}
      {label}
    </Badge>
  );
}
