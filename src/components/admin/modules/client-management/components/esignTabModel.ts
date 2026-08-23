/**
 * View-mode, status-filter, and stat-card vocabulary for the client e-sign
 * tab. Moved verbatim from EsignTab.tsx.
 */
import { CheckCircle2, Clock, FileText, XCircle } from 'lucide-react';
import type { Client } from '../types';
import type { EnvelopeStatus } from '../../esign/types';

export interface EsignTabProps {
  selectedClient: Client;
}

/** View modes -- 'list' is the envelope table, others are wizard steps */
export type ViewMode = 'list' | 'wizard-upload' | 'wizard-recipients' | 'prepare';

/** Logical status groups for the filter dropdown */
export type StatusFilter =
  | 'all'
  | 'draft'
  | 'pending'
  | 'completed'
  | 'rejected'
  | 'expired'
  | 'voided';

export const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'voided', label: 'Voided' },
];

/** Maps each logical filter group to the raw EnvelopeStatus values it covers */
export const STATUS_FILTER_MAP: Record<StatusFilter, EnvelopeStatus[] | null> = {
  all: null,
  draft: ['draft'],
  pending: ['sent', 'viewed', 'partially_signed'],
  completed: ['completed'],
  rejected: ['rejected', 'declined'],
  expired: ['expired'],
  voided: ['voided'],
};

// ==================== STAT CARD CONFIG (SS8.3) ====================

export const STAT_CONFIG = {
  total: { label: 'Total', icon: FileText, iconColor: 'text-blue-600', bgColor: 'bg-blue-50' },
  pending: { label: 'Pending', icon: Clock, iconColor: 'text-amber-600', bgColor: 'bg-amber-50' },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  rejected: { label: 'Rejected', icon: XCircle, iconColor: 'text-red-600', bgColor: 'bg-red-50' },
} as const;
