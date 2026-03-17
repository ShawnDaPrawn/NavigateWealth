import { SUPER_ADMIN_EMAIL } from '../../../../utils/auth/constants';

export const ENDPOINTS = {
  ALL_USERS: 'profile/all-users',
  PERSONAL_INFO: 'profile/personal-info',
  USER_METADATA: (userId: string) => `profile/users/${userId}/metadata`,
  CLIENT_CLEANUP: 'clients/maintenance/cleanup',
  KV_CLEANUP: 'kv-cleanup/run',
} as const;

export const CONFIG = {
  SUPER_ADMIN_EMAIL,
} as const;

/**
 * Personnel (staff) roles — users with any of these roles are staff accounts
 * and must be excluded from the Client Management module.
 *
 * Guidelines §5.3 — Centralised, typed constant. Mirrors the server-side
 * PERSONNEL_ROLES in constants.tsx.
 */
export const PERSONNEL_ROLES = [
  'super_admin',
  'admin',
  'adviser',
  'paraplanner',
  'compliance',
  'viewer',
] as const;

/** Account status badge styling — maps derived status to visual tokens. */
export const ACCOUNT_STATUS_CONFIG = {
  active: {
    label: 'Active',
    badgeClass: 'bg-green-600 hover:bg-green-700 text-white',
    dotClass: 'bg-green-500',
  },
  suspended: {
    label: 'Suspended',
    badgeClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    dotClass: 'bg-amber-500',
  },
  closed: {
    label: 'Closed',
    badgeClass: 'bg-red-600 hover:bg-red-700 text-white',
    dotClass: 'bg-red-500',
  },
} as const;

export const ACCOUNT_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'closed', label: 'Closed' },
] as const;

// ── Health Score Sub-Categories ──────────────────────────────────────────

/**
 * Health score sub-categories — aligned with the five strategic pillars
 * displayed as Pillar Cards in the Client Overview (§8/§9).
 *
 * Each sub-score maps 1:1 to a pillar card: Risk, Medical Aid,
 * Retirement, Investments, Estate Planning.
 */
export const HEALTH_SUB_SCORE_CONFIG = {
  risk: {
    label: 'Risk',
    description: 'Risk cover adequacy relative to FNA recommendations',
    color: '#6d28d9',   // brand purple
    bgClass: 'bg-[#6d28d9]/10',
    textClass: 'text-[#6d28d9]',
  },
  medicalAid: {
    label: 'Medical Aid',
    description: 'Medical aid coverage and FNA completeness',
    color: '#2563eb',   // blue-600
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-600',
  },
  retirement: {
    label: 'Retirement',
    description: 'Retirement funding adequacy and shortfall analysis',
    color: '#16a34a',   // green-600
    bgClass: 'bg-green-50',
    textClass: 'text-green-600',
  },
  investments: {
    label: 'Investments',
    description: 'Investment planning and portfolio coverage',
    color: '#f59e0b',   // amber-500
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-600',
  },
  estatePlanning: {
    label: 'Estate',
    description: 'Estate planning completeness and coverage',
    color: '#64748b',   // slate-500
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-600',
  },
} as const;

export type HealthSubCategory = keyof typeof HEALTH_SUB_SCORE_CONFIG;

/**
 * KPI definitions for the Monthly Summary table (spec §20/§54).
 * Each KPI has a target/benchmark and status derivation logic.
 *
 * Guidelines §5.3 — Centralised, typed constant for data presentation.
 */
export interface KPIDefinition {
  id: string;
  label: string;
  /** Short client-friendly description shown below the KPI */
  description: string;
  /** How to format the value: 'currency' | 'percentage' | 'months' | 'ratio' */
  format: 'currency' | 'percentage' | 'months' | 'ratio';
  /** Target text (displayed as-is) */
  targetText: string;
  /** Icon slug — resolved at render time via Lucide */
  iconSlug: string;
}

export const KPI_DEFINITIONS: KPIDefinition[] = [
  {
    id: 'net_worth',
    label: 'Net Worth',
    description: 'Everything you own minus everything you owe',
    format: 'currency',
    targetText: 'More assets than debts — and growing',
    iconSlug: 'scale',
  },
  {
    id: 'dti',
    label: 'Debt Load',
    description: 'How much of your monthly income goes to debt repayments',
    format: 'percentage',
    targetText: 'Below 36% of your income',
    iconSlug: 'trending-down',
  },
  {
    id: 'savings_rate',
    label: 'Retirement Saving',
    description: 'How much of your income you\'re putting towards retirement',
    format: 'percentage',
    targetText: 'At least 15% of your income',
    iconSlug: 'piggy-bank',
  },
  {
    id: 'emergency_fund',
    label: 'Rainy Day Buffer',
    description: 'How long your savings could cover expenses in an emergency',
    format: 'months',
    targetText: '3 to 6 months of expenses saved up',
    iconSlug: 'shield',
  },
  {
    id: 'insurance_coverage',
    label: 'Life Cover',
    description: 'How your current life cover compares to what you actually need',
    format: 'percentage',
    targetText: 'Fully covers what\'s recommended',
    iconSlug: 'shield-check',
  },
  {
    id: 'retirement_progress',
    label: 'Retirement Readiness',
    description: 'How close you are to having enough saved for retirement',
    format: 'percentage',
    targetText: 'On track to meet your retirement goal',
    iconSlug: 'target',
  },
] as const;

/** KPI status thresholds — determines green/amber/red badge */
export type KPIStatus = 'good' | 'caution' | 'gap' | 'no-data';

export const KPI_STATUS_CONFIG: Record<KPIStatus, {
  label: string;
  badgeClass: string;
  dotClass: string;
  textClass: string;
}> = {
  good: {
    label: 'On Track',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
    dotClass: 'bg-green-500',
    textClass: 'text-green-600',
  },
  caution: {
    label: 'Review',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-600',
  },
  gap: {
    label: 'Shortfall',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    dotClass: 'bg-red-500',
    textClass: 'text-red-600',
  },
  'no-data': {
    label: 'No Data',
    badgeClass: 'bg-gray-50 text-gray-500 border-gray-200',
    dotClass: 'bg-gray-300',
    textClass: 'text-gray-400',
  },
} as const;