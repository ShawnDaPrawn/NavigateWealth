/**
 * Client Communication Module — Constants
 *
 * Config-driven category mappings, example lists, and UI tokens.
 * Guidelines refs: §5.3, §7.1, §8.3 (status colour vocabulary)
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
import type { CommunicationCategory } from './types';

// ── Category Config (§5.3 — config-driven status indicators) ────────────────

interface CategoryConfig {
  label: string;
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
  badgeClass: string;
}

export const CATEGORY_CONFIG: Record<CommunicationCategory, CategoryConfig> = {
  'Policy Update': {
    label: 'Policy Update',
    icon: Shield,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  'Document Required': {
    label: 'Document Required',
    icon: FileText,
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  'Appointment': {
    label: 'Appointment',
    icon: Calendar,
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-50',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  'Important': {
    label: 'Important',
    icon: AlertCircle,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
  'FNA Available': {
    label: 'FNA Available',
    icon: TrendingUp,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
  },
  'General': {
    label: 'General',
    icon: Bell,
    iconColor: 'text-gray-600',
    bgColor: 'bg-gray-50',
    badgeClass: 'bg-gray-50 text-gray-700 border-gray-200',
  },
} as const;

/** All categories for filter dropdowns and legends */
export const ALL_CATEGORIES: CommunicationCategory[] = [
  'Policy Update',
  'Document Required',
  'Appointment',
  'Important',
  'FNA Available',
  'General',
];

// ── Date Range Filters ──────────────────────────────────────────────────────

export const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
] as const;

export const DATE_RANGE_DAYS: Record<string, number> = {
  week: 7,
  month: 30,
};

// ── Pagination ──────────────────────────────────────────────────────────────

export const ITEMS_PER_PAGE = 10;

// ── Contact Info ────────────────────────────────────────────────────────────

export const CONTACT = {
  email: 'info@navigatewealth.co',
  emailHref: 'mailto:info@navigatewealth.co',
  phoneNumber: '012 667 2025',
  phoneTel: 'tel:0126672025',
} as const;

// ── Retention ───────────────────────────────────────────────────────────────

export const MESSAGE_RETENTION_DAYS = 60;

// ── Preferences Page Constants ──────────────────────────────────────────────

export const TRANSACTIONAL_EXAMPLES = [
  'Account login notifications',
  'Investment transaction confirmations',
  'Portfolio performance reports',
  'Document upload confirmations',
  'Appointment reminders',
  'Account security alerts',
  'Payment confirmations',
  'Policy updates and changes',
] as const;

export const MARKETING_EXAMPLES = [
  'Monthly market insights newsletter',
  'New investment opportunity alerts',
  'Educational webinar invitations',
  'Product launch announcements',
  'Seasonal financial planning tips',
  'Client success stories',
  'Industry research reports',
  'Promotional offers and discounts',
] as const;

export const DEFAULT_PREFERENCES: import('./types').CommunicationSettings = {
  transactional: { email: true, sms: true },
  marketing: { email: false, sms: false },
  frequency: 'realtime',
};