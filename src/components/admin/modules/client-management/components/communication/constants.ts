/**
 * Communication Tab — Shared Constants
 *
 * Category icon/color mappings and shared config used by
 * ComposeForm, HistoryDialog, and CommunicationDetailDialog.
 */

import {
  Shield,
  FileText,
  Calendar,
  AlertCircle,
  TrendingUp,
  Bell,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORIES = [
  'General',
  'Policy Update',
  'Document Required',
  'Appointment',
  'Important',
  'FNA Available',
] as const;

export type CommunicationCategory = (typeof CATEGORIES)[number];

export const PRIORITIES = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High Priority' },
  { value: 'urgent', label: 'Urgent' },
] as const;

/**
 * Category → icon mapping.
 * Config-driven per §5.3 — single source of truth.
 */
export const CATEGORY_CONFIG: Record<string, { icon: LucideIcon; color: string }> = {
  'Policy Update': { icon: Shield, color: 'text-blue-600' },
  'Document Required': { icon: FileText, color: 'text-amber-600' },
  'Appointment': { icon: Calendar, color: 'text-purple-600' },
  'Important': { icon: AlertCircle, color: 'text-red-600' },
  'FNA Available': { icon: TrendingUp, color: 'text-green-600' },
};

const DEFAULT_CATEGORY_CONFIG = { icon: Bell, color: 'text-gray-600' };

export function getCategoryIcon(category: string): LucideIcon {
  return CATEGORY_CONFIG[category]?.icon ?? DEFAULT_CATEGORY_CONFIG.icon;
}

export function getCategoryColor(category: string): string {
  return CATEGORY_CONFIG[category]?.color ?? DEFAULT_CATEGORY_CONFIG.color;
}
