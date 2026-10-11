/**
 * clientOverviewConstants.ts
 *
 * Shared constants and data-fetching helpers for the Client Overview Tab.
 * Extracted from ClientOverviewTab.tsx to keep that file under 800 lines.
 */

import React from 'react';
import {
  Shield,
  Heart,
  PiggyBank,
  TrendingUp,
  Briefcase,
  FileText,
  Landmark,
  LogIn,
  ShieldAlert,
  KeyRound,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  UserPlus,
} from 'lucide-react';

// ── Dashboard display mode ──────────────────────────────────────────────

/** Dashboard display mode — controls language, visibility, and CTAs */
export type DashboardMode = 'adviser' | 'client';

// ── Category definition ─────────────────────────────────────────────────

export interface CategoryDef {
  id: string;
  categoryId: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

// ── Constants ───────────────────────────────────────────────────────────

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'risk',
    categoryId: 'risk_planning',
    label: 'Risk Planning',
    icon: Shield,
    color: 'text-gray-600',
  },
  {
    id: 'medical',
    categoryId: 'medical_aid',
    label: 'Medical Aid',
    icon: Heart,
    color: 'text-gray-600',
  },
  {
    id: 'retirement',
    categoryId: 'retirement_planning',
    label: 'Retirement',
    icon: PiggyBank,
    color: 'text-gray-600',
  },
  {
    id: 'investment',
    categoryId: 'investments',
    label: 'Investments',
    icon: TrendingUp,
    color: 'text-gray-600',
  },
  {
    id: 'employee',
    categoryId: 'employee_benefits',
    label: 'Employee Benefits',
    icon: Briefcase,
    color: 'text-gray-600',
  },
  {
    id: 'tax',
    categoryId: 'tax_planning',
    label: 'Tax Planning',
    icon: FileText,
    color: 'text-gray-600',
  },
  {
    id: 'estate',
    categoryId: 'estate_planning',
    label: 'Estate Planning',
    icon: Landmark,
    color: 'text-gray-600',
  },
];

/** FNA module definitions — display config only; data is fetched via batch endpoint */
export const FNA_MODULES: Array<{
  key: string;
  name: string;
  icon: React.ElementType;
}> = [
  { key: 'risk', name: 'Risk Planning FNA', icon: Shield },
  { key: 'medical', name: 'Medical Aid FNA', icon: Heart },
  { key: 'retirement', name: 'Retirement FNA', icon: PiggyBank },
  { key: 'investment', name: 'Investment INA', icon: TrendingUp },
  { key: 'tax', name: 'Tax Planning FNA', icon: FileText },
  { key: 'estate', name: 'Estate Planning FNA', icon: Landmark },
];

/** Map auth event types to display labels and icons */
export const ACTIVITY_TYPE_MAP: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  login_success: { label: 'Successful login', icon: LogIn, color: 'text-green-600' },
  login_failure: { label: 'Failed login attempt', icon: ShieldAlert, color: 'text-red-500' },
  login_attempt: { label: 'Login attempt', icon: LogIn, color: 'text-amber-500' },
  password_reset_request: {
    label: 'Password reset requested',
    icon: KeyRound,
    color: 'text-amber-500',
  },
  password_reset_success: {
    label: 'Password reset completed',
    icon: KeyRound,
    color: 'text-green-600',
  },
  password_change: { label: 'Password changed', icon: KeyRound, color: 'text-blue-600' },
  session_refresh: { label: 'Session refreshed', icon: RefreshCw, color: 'text-gray-500' },
  forced_logout: { label: 'Forced logout', icon: ShieldAlert, color: 'text-red-500' },
  email_verification_success: {
    label: 'Email verified',
    icon: CheckCircle,
    color: 'text-green-600',
  },
  account_locked: { label: 'Account locked', icon: ShieldAlert, color: 'text-red-600' },
  suspicious_activity: {
    label: 'Suspicious activity detected',
    icon: AlertTriangle,
    color: 'text-red-600',
  },
  session_expired: { label: 'Session expired', icon: Clock, color: 'text-gray-500' },
  signup: { label: 'Account created', icon: UserPlus, color: 'text-gray-500' },
};

/** Category ID → overview bucket mapping for client-side policy grouping.
 *  Mirrors the server-side category aliasing logic so we can fetch ALL
 *  policies in one call and group them client-side. */
export const CATEGORY_GROUP_MAP: Record<string, string> = {
  risk_planning: 'risk',
  medical_aid: 'medical',
  retirement_planning: 'retirement',
  retirement_pre: 'retirement',
  retirement_post: 'retirement',
  retirement_post_fixed: 'retirement',
  investments: 'investment',
  investments_voluntary: 'investment',
  investments_guaranteed: 'investment',
  employee_benefits: 'employee',
  employee_benefits_risk: 'employee',
  employee_benefits_retirement: 'employee',
  tax_planning: 'tax',
  estate_planning: 'estate',
};
