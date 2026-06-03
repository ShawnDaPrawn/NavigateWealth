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
  Activity,
} from 'lucide-react';
import { api } from '../../../../../utils/api/client';
import type { SchemaField } from './clientOverviewUtils';

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
  investments: 'investment',
  investments_voluntary: 'investment',
  investments_guaranteed: 'investment',
  employee_benefits: 'employee',
  employee_benefits_risk: 'employee',
  employee_benefits_retirement: 'employee',
  tax_planning: 'tax',
  estate_planning: 'estate',
};

// ── Schema cache + batch fetch ───────────────────────────────────────────

/** Module-level schema cache — schemas are config and rarely change,
 *  so we cache them for the lifetime of the session to avoid repeated calls. */
let _schemaCache: Record<string, SchemaField[]> | null = null;

/**
 * Fetch ALL schemas in a single batch call and cache the result.
 * Collapses ~13 individual schema calls into 1 KV batch read on the server.
 */
export async function fetchAllSchemas(): Promise<Record<string, SchemaField[]>> {
  if (_schemaCache) return _schemaCache;

  try {
    const data = await api.get<{ schemas?: Record<string, { fields?: SchemaField[] }> }>(
      '/integrations/schemas/batch',
    );
    const schemas = data?.schemas || {};
    const result: Record<string, SchemaField[]> = {};
    for (const [catId, schema] of Object.entries(schemas)) {
      const fields = (schema as { fields?: SchemaField[] })?.fields;
      if (Array.isArray(fields) && fields.length > 0) {
        result[catId] = fields;
      }
    }
    _schemaCache = result;
    return result;
  } catch {
    // Batch endpoint unavailable — return empty, normalization will be skipped
  }
  return {};
}
