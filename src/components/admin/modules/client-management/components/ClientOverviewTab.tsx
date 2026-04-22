/**
 * CLIENT OVERVIEW TAB — Financial Health Dashboard
 *
 * Redesigned for clarity and client-friendliness. Surfaces the most
 * important information first, with progressive detail below.
 *
 * Above the fold:
 *  1.  Welcome Banner + Integrated Financial Snapshot + Health Score + Sub-Score Breakdown
 *  2.  Five Pillar Cards (Risk Planning, Medical Aid, Retirement Annuity, Investment Planning, Estate Planning)
 *      — each shows current cover with a thin health strip as the single status signal
 *  3.  Action Items (derived from pillar health — what needs attention)
 *
 * Below the fold (accordion — expandable detail sections):
 *  5.  KPI Dashboard & Charts (KPI table, asset allocation, coverage, cashflow)
 *  6.  Policies (full portfolio overview)
 *  7.  Net Worth & Balance Sheet + History (Phase 4 trend chart)
 *  8.  Financial Reviews (FNA status cards)
 *  9.  Documents & Compliance (checklist)
 *  10. Dependants & Family
 *  11. Recent Activity Timeline
 *
 * Each detail panel has an inline summary visible in its collapsed header,
 * allowing users to scan key metrics without expanding. Panels are
 * independently expandable (Radix Accordion, type="multiple").
 *
 * Phase C — `mode` prop ('adviser' | 'client'):
 *  - Adviser mode (default): full admin context, internal jargon, compliance items
 *  - Client mode: softer language, hides compliance/security items, reframes CTAs
 *  - Welcome Banner: "Welcome back, {first}" vs full name + status badge
 *  - Action items: client-friendly titles/detail, compliance category hidden
 *  - FNA cards: "Complete"/"In Progress" vs "Published"/"Draft"
 *  - Activity timeline: security events filtered out
 *  - Category labels: "Analysis" vs "FNA"
 *  - Accordion headers: "My Policies", "My Net Worth", etc.
 *  - Print footer: informational vs advisory
 *
 * Data-fetching, derived calculations, and PDF generation are unchanged.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Separator } from '../../../../ui/separator';
import { Badge } from '../../../../ui/badge';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../../../../ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  User,
  Phone,
  Briefcase,
  Shield,
  Heart,
  PiggyBank,
  TrendingUp,
  Scale,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  Calendar,
  DollarSign,
  Landmark,
  Activity,
  ClipboardCheck,
  Clock,
  LogIn,
  KeyRound,
  ShieldAlert,
  UserPlus,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Zap,
  ArrowRight,
  Download,
  Loader2,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { createClient as createSupabaseClient } from '../../../../../utils/supabase/client';
import { getClientProfileQueryOptions } from '../api';
import { Client, ProfileData } from '../types';
import { PolicyOverviewTab } from '../../../../admin/profile-sections/PolicyOverviewTab';

// Phase 1 KPI / Sub-Score imports
import { HealthScoreBreakdown } from './overview/HealthScoreBreakdown';
import { KPISummaryTable } from './overview/KPISummaryTable';
import type { KPIValue } from './overview/KPISummaryTable';
// Phase 2 Chart imports
import {
  AssetAllocationChart,
  InsuranceCoverageChart,
  CashflowWaterfallChart,
  ActionPriorityBar,
} from './overview/OverviewCharts';
import type {
  AssetAllocationData,
  InsuranceCoverageItem,
  CashflowWaterfallData,
  ActionDistribution,
} from './overview/OverviewCharts';
// Phase 3 imports
import { DocumentsChecklist, deriveDocumentChecklist } from './overview/DocumentsChecklist';
import type { DocumentItem } from './overview/DocumentsChecklist';
import { CategoryPolicyKPIs, deriveCategoryKPIs } from './overview/CategoryPolicyKPIs';
import type { CategoryKPI } from './overview/CategoryPolicyKPIs';
// Phase 4 imports
import { NetWorthHistory } from './overview/NetWorthHistory';
import {
  deriveHealthSubScores,
  calcDTI,
  deriveDTIStatus,
  calcEmergencyFundMonths,
  deriveEmergencyFundStatus,
  calcInsuranceCoverageRatio,
  deriveInsuranceCoverageStatus,
  calcRetirementProgress,
  deriveRetirementProgressStatus,
  deriveSavingsRateStatus,
  deriveNetWorthStatus,
} from '../utils';
import type { HealthSubScores } from '../utils';

// FNA API — uses batch endpoint via React Query hook for cache control
import { useFnaBatchStatus } from '../hooks/useFnaBatchStatus';

// ── Types ───────────────────────────────────────────────────────────────

interface Policy {
  id: string;
  providerName: string;
  categoryId: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

interface CategoryDef {
  id: string;
  categoryId: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

type GapStatus = 'good' | 'caution' | 'gap' | 'none';

interface GapItem {
  label: string;
  status: GapStatus;
  current: string;
  recommended: string;
  detail?: string;
}

/** Normalised FNA status for display */
interface FNAStatusItem {
  key: string;
  name: string;
  icon: React.ElementType;
  status: 'published' | 'draft' | 'not_started' | 'error';
  updatedAt?: string;
  publishedAt?: string;
  nextReviewDue?: string;
  loading: boolean;
}

/** Priority-ordered action item (mode-aware: adviser vs client language) */
type ActionPriority = 'urgent' | 'attention' | 'recommended';

interface ActionItem {
  id: string;
  priority: ActionPriority;
  category: 'fna' | 'coverage' | 'renewal' | 'profile' | 'compliance';
  title: string;
  detail?: string;
  icon: React.ElementType;
}

/** Normalised activity event for timeline */
interface ActivityEvent {
  id: string;
  type: string;
  label: string;
  timestamp: string;
  icon: React.ElementType;
  iconColor: string;
  success?: boolean;
  detail?: string;
}

/** Pillar health status derived from gap analysis */
type PillarHealth = 'healthy' | 'attention' | 'critical' | 'no-data';

interface PillarData {
  id: string;
  title: string;
  icon: React.ElementType;
  health: PillarHealth;
  primaryValue: string;
  primaryLabel: string;
  metrics: Array<{ label: string; value: string; recommended?: string; highlight?: boolean }>;
  policyCount: number;
  monthlyPremium: number;
  fnaStatus?: 'published' | 'draft' | 'not_started' | 'error' | 'loading';
}

// ── Constants ───────────────────────────────────────────────────────────

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

const CATEGORIES: CategoryDef[] = [
  { id: 'risk', categoryId: 'risk_planning', label: 'Risk Planning', icon: Shield, color: 'text-gray-600' },
  { id: 'medical', categoryId: 'medical_aid', label: 'Medical Aid', icon: Heart, color: 'text-gray-600' },
  { id: 'retirement', categoryId: 'retirement_planning', label: 'Retirement', icon: PiggyBank, color: 'text-gray-600' },
  { id: 'investment', categoryId: 'investments', label: 'Investments', icon: TrendingUp, color: 'text-gray-600' },
  { id: 'employee', categoryId: 'employee_benefits', label: 'Employee Benefits', icon: Briefcase, color: 'text-gray-600' },
  { id: 'tax', categoryId: 'tax_planning', label: 'Tax Planning', icon: FileText, color: 'text-gray-600' },
  { id: 'estate', categoryId: 'estate_planning', label: 'Estate Planning', icon: Landmark, color: 'text-gray-600' },
];

/** FNA module definitions — display config only; data is fetched via batch endpoint */
const FNA_MODULES: Array<{
  key: string;
  name: string;
  icon: React.ElementType;
}> = [
  { key: 'risk', name: 'Risk Planning FNA', icon: Shield },
  { key: 'medical', name: 'Medical Aid FNA', icon: Heart },
  { key: 'retirement', name: 'Retirement FNA', icon: PiggyBank },
  { key: 'investment', name: 'Investment INA', icon: TrendingUp },
  { key: 'estate', name: 'Estate Planning FNA', icon: Landmark },
];

/** Map auth event types to display labels and icons */
const ACTIVITY_TYPE_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  login_success: { label: 'Successful login', icon: LogIn, color: 'text-green-600' },
  login_failure: { label: 'Failed login attempt', icon: ShieldAlert, color: 'text-red-500' },
  login_attempt: { label: 'Login attempt', icon: LogIn, color: 'text-amber-500' },
  password_reset_request: { label: 'Password reset requested', icon: KeyRound, color: 'text-amber-500' },
  password_reset_success: { label: 'Password reset completed', icon: KeyRound, color: 'text-green-600' },
  password_change: { label: 'Password changed', icon: KeyRound, color: 'text-blue-600' },
  session_refresh: { label: 'Session refreshed', icon: RefreshCw, color: 'text-gray-500' },
  forced_logout: { label: 'Forced logout', icon: ShieldAlert, color: 'text-red-500' },
  email_verification_success: { label: 'Email verified', icon: CheckCircle, color: 'text-green-600' },
  account_locked: { label: 'Account locked', icon: ShieldAlert, color: 'text-red-600' },
  suspicious_activity: { label: 'Suspicious activity detected', icon: AlertTriangle, color: 'text-red-600' },
  session_expired: { label: 'Session expired', icon: Clock, color: 'text-gray-500' },
  signup: { label: 'Account created', icon: UserPlus, color: 'text-gray-500' },
};

const INITIAL_ACTIVITY_COUNT = 8;

/** Known inception date field IDs — includes both keyIds AND schema field IDs
 *  so we find the date regardless of how the policy data is keyed. */
const INCEPTION_FIELD_IDS = [
  // keyIds (keyManagerConstants.ts)
  'risk_date_of_inception',
  'medical_aid_date_of_inception',
  'retirement_date_of_inception',
  'post_retirement_date_of_inception',
  'invest_date_of_inception',
  'invest_guaranteed_date_of_inception',
  'eb_date_of_inception',
  'eb_risk_date_of_inception',
  'eb_retirement_date_of_inception',
  'estate_date_of_inception',
  // Schema field IDs (default-schemas.ts)
  'rp_inception', 'ma_inception', 'ret_inception', 'ret_pre_inception',
  'ret_post_inception', 'inv_inception', 'inv_vol_inception', 'inv_gua_inception',
  'eb_inception', 'eb_risk_inception', 'eb_ret_inception', 'est_inception',
];

/** Renewal warning window in days */
const RENEWAL_WINDOW_DAYS = 90;

/** Activity types to EXCLUDE from overview (noise — belongs in Security tab) */
const ACTIVITY_NOISE_TYPES = new Set([
  'session_refresh',
  'session_expired',
]);

// ── Helpers ─────────────────────────────────────────────────────────────

const fmt = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return 'R 0';
  return `R ${Number(n).toLocaleString('en-ZA')}`;
};

const pct = (n: number): string => `${n.toFixed(1)}%`;

/** Compact currency for pillar cards: R 1.2m / R 450k / R 5 000 */
const fmtCompact = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return 'R 0';
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000) return `R ${(v / 1_000_000).toFixed(1)}m`;
  if (Math.abs(v) >= 100_000) return `R ${(v / 1_000).toFixed(0)}k`;
  return fmt(v);
};

const calcAge = (dob: string | undefined): number | null => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const fmtDate = (d: string | undefined): string => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateTime = (d: string | undefined): string => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fmtRelative = (d: string): string => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
};

/** Add months to a date string, return ISO string */
const addMonths = (d: string, months: number): string => {
  const dt = new Date(d);
  dt.setMonth(dt.getMonth() + months);
  return dt.toISOString();
};

/** Is the date in the past? */
const isPast = (d: string): boolean => new Date(d).getTime() < Date.now();

/** Get the next anniversary of a date (next occurrence in the future) */
const nextAnniversary = (isoDate: string): Date | null => {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const thisYear = now.getFullYear();
  const candidate = new Date(thisYear, d.getMonth(), d.getDate());
  if (candidate.getTime() < now.getTime()) {
    candidate.setFullYear(thisYear + 1);
  }
  return candidate;
};

/** Days between two dates */
const daysBetween = (a: Date, b: Date): number =>
  Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

const addressLine = (p: ProfileData | undefined): string => {
  if (!p) return '-';
  const parts = [p.residentialAddressLine1, p.residentialSuburb, p.residentialCity, p.residentialProvince, p.residentialPostalCode].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '-';
};

/**
 * Normalize policy data by converting schema field-ID keys to keyIds.
 *
 * Policy data is stored keyed by the schema's field.id (e.g. 'rp_6'),
 * NOT by keyManagerConstants keyIds (e.g. 'risk_monthly_premium').
 * The schema defines the mapping: each field has .id and optional .keyId.
 *
 * This function fetches the actual schema (custom or default) for a
 * category and re-keys the policy data so downstream code can look up
 * values by keyId directly.
 */
interface SchemaField { id: string; keyId?: string; name?: string; type?: string }

/** Module-level schema cache — schemas are config and rarely change,
 *  so we cache them for the lifetime of the session to avoid repeated calls. */
let _schemaCache: Record<string, SchemaField[]> | null = null;

/**
 * Fetch ALL schemas in a single batch call and cache the result.
 * Collapses ~13 individual schema calls into 1 KV batch read on the server.
 */
async function fetchAllSchemas(): Promise<Record<string, SchemaField[]>> {
  if (_schemaCache) return _schemaCache;

  try {
    const res = await fetch(
      `${API_BASE}/integrations/schemas/batch`,
      { headers: { Authorization: `Bearer ${publicAnonKey}` } }
    );
    if (res.ok) {
      const data = await res.json();
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
    }
  } catch {
    // Batch endpoint unavailable — return empty, normalization will be skipped
  }
  return {};
}

/** Category ID → overview bucket mapping for client-side policy grouping.
 *  Mirrors the server-side category aliasing logic so we can fetch ALL
 *  policies in one call and group them client-side. */
const CATEGORY_GROUP_MAP: Record<string, string> = {
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

/**
 * Given a policy and the schema fields for its category, return a new
 * data object where every entry that has a keyId is ALSO keyed by that
 * keyId. Original field-ID entries are preserved for backward compat.
 */
function normalizePolicyData(
  data: Record<string, unknown>,
  schemaFields: SchemaField[],
): Record<string, unknown> {
  const out = { ...data };
  for (const field of schemaFields) {
    if (field.keyId && data[field.id] !== undefined) {
      out[field.keyId] = data[field.id];
    }
  }
  return out;
}

/**
 * Read a numeric value from policy.data by key.
 * After normalisation the data contains both field-ID and keyId entries,
 * so a simple direct lookup is sufficient.
 */
const numVal = (policy: Policy, key: string): number => {
  const v = policy.data?.[key];
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/**
 * Read a string value from policy.data by key.
 */
const strVal = (policy: Policy, key: string): string | undefined => {
  const v = policy.data?.[key];
  if (v !== undefined && v !== null && v !== '' && typeof v === 'string') return v;
  return undefined;
};

const sumField = (pols: Policy[], keyId: string): number =>
  pols.reduce((s, p) => s + numVal(p, keyId), 0);

/**
 * Sum investment monthly contributions, excluding lump-sum policies.
 *
 * When an investment policy's "Premium" field (invest_monthly_contribution)
 * equals its "Current Value" field (invest_current_value), the premium
 * represents the initial lump-sum investment — not a recurring monthly
 * contribution. This commonly happens when the AI extraction maps the
 * total investment amount to the schema's "Premium" field.
 *
 * Guard: skip the contribution when it matches the current value.
 */
const sumInvestmentPremiums = (pols: Policy[]): number =>
  pols.reduce((s, p) => {
    const contribution = numVal(p, 'invest_monthly_contribution');
    if (contribution <= 0) return s;
    const currentValue = numVal(p, 'invest_current_value');
    // If the "premium" is >= the current portfolio value, it's almost
    // certainly a lump-sum initial investment, not a recurring monthly
    // contribution.  A genuine monthly contribution accumulates over time,
    // so the portfolio value will always exceed a single month's payment.
    if (currentValue > 0 && contribution >= currentValue) return s;
    return s + contribution;
  }, 0);

/** Sum the first non-zero value from a list of candidate keyIds per policy
 *  (avoids double-counting when e.g. retirement_fund_value and retirement_current_value
 *   both exist on the same policy) */
const sumFirstNonZero = (pols: Policy[], ...keyIds: string[]): number =>
  pols.reduce((s, p) => {
    for (const k of keyIds) {
      const v = numVal(p, k);
      if (v > 0) return s + v;
    }
    return s;
  }, 0);

/** Sum all specified keyIds per policy (for additive fields, e.g. EB premiums) */
const sumMultiField = (pols: Policy[], keyIds: string[]): number =>
  pols.reduce((s, p) => s + keyIds.reduce((fs, k) => fs + numVal(p, k), 0), 0);

/** Dashboard display mode — controls language, visibility, and CTAs */
export type DashboardMode = 'adviser' | 'client';

/** Activity types to hide from client view (security / internal) */
const CLIENT_HIDDEN_ACTIVITY_TYPES = new Set([
  'login_failure',
  'login_attempt',
  'password_reset_request',
  'password_change',
  'forced_logout',
  'account_locked',
  'suspicious_activity',
]);

/** Derive worst gap status from a set of statuses */
function worstGapStatus(statuses: GapStatus[]): PillarHealth {
  const filtered = statuses.filter(s => s !== 'none');
  if (filtered.length === 0) return 'no-data';
  if (filtered.some(s => s === 'gap')) return 'critical';
  if (filtered.some(s => s === 'caution')) return 'attention';
  return 'healthy';
}

// ── Props ───────────────────────────────────────────────────────────────

interface ClientOverviewTabProps {
  client: Client;
  /** Display mode: 'adviser' (default) shows full admin context;
   *  'client' uses softer language, hides internal items, and reframes CTAs. */
  mode?: DashboardMode;
}

// ── Component ───────────────────────────────────────────────────────────

export function ClientOverviewTab({ client, mode = 'adviser' }: ClientOverviewTabProps) {
  const queryClient = useQueryClient();
  const isClient = mode === 'client';
  // ── Phase 1 state ───────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [policiesByCategory, setPoliciesByCategory] = useState<Record<string, Policy[]>>({});
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Phase 2 state ───────────────────────────────────────────────────
  // FNA statuses via React Query hook — replaces manual useState/useCallback/useEffect
  const {
    data: batchFnaData,
    isLoading: loadingFna,
    refetch: refetchFna,
  } = useFnaBatchStatus(client.id);

  /** Raw FNA result data keyed by module key — only populated for published FNAs */
  const fnaResultsMap = useMemo<Record<string, Record<string, unknown> | null>>(() => {
    if (!batchFnaData) return {};
    const map: Record<string, Record<string, unknown> | null> = {};
    batchFnaData.forEach((item) => {
      map[item.key] = item.status === 'published' ? item.data : null;
    });
    return map;
  }, [batchFnaData]);

  /** Normalised FNA statuses for display — derived from batch hook data + FNA_MODULES config */
  const fnaStatuses = useMemo<FNAStatusItem[]>(() => {
    return FNA_MODULES.map((m) => {
      if (!batchFnaData) {
        return {
          key: m.key,
          name: m.name,
          icon: m.icon,
          status: 'not_started' as const,
          loading: true,
        };
      }

      const match = batchFnaData.find((r) => r.key === m.key);
      if (!match) {
        return {
          key: m.key,
          name: m.name,
          icon: m.icon,
          status: 'not_started' as const,
          loading: false,
        };
      }

      const data = match.data;
      const updatedAt = data?.updatedAt || data?.updated_at;
      const publishedAt = data?.publishedAt || data?.published_at;
      const createdAt = data?.createdAt || data?.created_at;

      const reviewBase = publishedAt || updatedAt || createdAt;
      const nextReviewDue = reviewBase ? addMonths(reviewBase as string, 12) : undefined;

      return {
        key: m.key,
        name: m.name,
        icon: m.icon,
        status: match.status === 'error' ? 'error' as const : match.status,
        updatedAt: (updatedAt || createdAt) as string | undefined,
        publishedAt: publishedAt as string | undefined,
        nextReviewDue,
        loading: false,
      };
    });
  }, [batchFnaData]);

  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [activityExpanded, setActivityExpanded] = useState(false);

  // ── Phase 4 state ───────────────────────────────────────────────────
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // ── Phase 1: Data fetching ────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const profile = await queryClient.fetchQuery(getClientProfileQueryOptions(client.id));
      setProfile(profile || client.profile?.personalInformation || null);
    } catch {
      setProfile(client.profile?.personalInformation || null);
    } finally {
      setLoadingProfile(false);
    }
  }, [client.id, client.profile?.personalInformation, queryClient]);

  const fetchPolicies = useCallback(async () => {
    setLoadingPolicies(true);
    try {
      // Fetch schemas (cached after first load) and ALL policies in parallel.
      // Previously this was a waterfall: 13 schema calls → wait → 7 policy calls.
      // Now: 1 batch schema call (cached) + 1 policy call, both in parallel.
      const [schemaMap, rawPolicies] = await Promise.all([
        fetchAllSchemas(),
        fetch(
          `${API_BASE}/integrations/policies?clientId=${client.id}`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        ).then(async (res) => {
          if (!res.ok) return [] as Policy[];
          const data = await res.json();
          return (data.policies || []) as Policy[];
        }),
      ]);

      // Normalise each policy's data using its category's schema
      // and group by overview bucket (client-side filtering replaces 7 server calls)
      const byCategory: Record<string, Policy[]> = {};
      const flat: Policy[] = [];

      for (const pol of rawPolicies) {
        // Normalise field-ID keys to keyIds using the schema
        const fields = schemaMap[pol.categoryId];
        const normalised = (fields && pol.data)
          ? { ...pol, data: normalizePolicyData(pol.data, fields) }
          : pol;

        // Group into the overview category bucket
        const bucket = CATEGORY_GROUP_MAP[pol.categoryId];
        if (bucket) {
          if (!byCategory[bucket]) byCategory[bucket] = [];
          byCategory[bucket].push(normalised);
        }
        flat.push(normalised);
      }

      setPoliciesByCategory(byCategory);
      setAllPolicies(flat);
    } catch (err) {
      console.error('Error loading policies for overview:', err);
      setError('Failed to load policy data.');
    } finally {
      setLoadingPolicies(false);
    }
  }, [client.id]);

  // ── Phase 2: Activity log fetching ────────────────────────────────────

  const fetchActivityLogs = useCallback(async () => {
    setLoadingActivity(true);
    try {
      const res = await fetch(
        `${API_BASE}/security/${client.id}/activity?limit=50`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      const events: ActivityEvent[] = [];

      events.push({
        id: 'account-created',
        type: 'signup',
        label: 'Account created',
        timestamp: client.createdAt,
        icon: UserPlus,
        iconColor: 'text-gray-500',
        success: true,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          data.logs.forEach((log: { id?: string; type: string; timestamp?: string; success?: boolean; errorMessage?: string; [key: string]: unknown }) => {
            const typeCfg = ACTIVITY_TYPE_MAP[log.type] || {
              label: log.type?.replace(/_/g, ' ') || 'Unknown event',
              icon: Activity,
              color: 'text-gray-500',
            };
            events.push({
              id: log.id || `evt-${events.length}`,
              type: log.type,
              label: typeCfg.label,
              timestamp: log.timestamp || '',
              icon: typeCfg.icon,
              iconColor: typeCfg.color,
              success: log.success,
              detail: log.errorMessage || undefined,
            });
          });
        }
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivityEvents(events);
    } catch (err) {
      console.error('Error loading activity logs for overview:', err);
      setActivityEvents([{
        id: 'account-created',
        type: 'signup',
        label: 'Account created',
        timestamp: client.createdAt,
        icon: UserPlus,
        iconColor: 'text-gray-500',
        success: true,
      }]);
    } finally {
      setLoadingActivity(false);
    }
  }, [client.id, client.createdAt]);

  // ── Effects ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetchProfile().catch(() => { /* handled internally */ });
    fetchPolicies().catch(() => { /* handled internally */ });
    // FNA statuses are managed by useFnaBatchStatus (React Query) — no manual fetch needed
    fetchActivityLogs().catch(() => { /* handled internally */ });
  }, [fetchProfile, fetchPolicies, fetchActivityLogs]);

  const refreshAll = useCallback(() => {
    setError(null);
    queryClient.invalidateQueries({ queryKey: getClientProfileQueryOptions(client.id).queryKey });
    fetchProfile().catch(() => { /* handled internally */ });
    fetchPolicies().catch(() => { /* handled internally */ });
    refetchFna(); // React Query handles cache invalidation and re-fetch
    fetchActivityLogs().catch(() => { /* handled internally */ });
  }, [client.id, fetchProfile, fetchPolicies, refetchFna, fetchActivityLogs, queryClient]);

  // ── Derived data ──────────────────────────────────────────────────────

  const p = profile;

  const age = useMemo(() => calcAge(p?.dateOfBirth), [p?.dateOfBirth]);

  const riskPolicies = policiesByCategory.risk || [];
  const medicalPolicies = policiesByCategory.medical || [];
  const retirementPolicies = policiesByCategory.retirement || [];
  const investmentPolicies = policiesByCategory.investment || [];
  const employeePolicies = policiesByCategory.employee || [];
  const estatePolicies = policiesByCategory.estate || [];
  const taxPolicies = policiesByCategory.tax || [];

  const grossMonthly = p?.grossMonthlyIncome || p?.grossIncome || 0;
  const grossAnnual = p?.grossAnnualIncome || grossMonthly * 12;
  const netMonthly = p?.netMonthlyIncome || p?.netIncome || 0;

  // Premium field IDs from the Universal Key Manager (keyManagerConstants.ts)
  const totalRiskPremium = sumField(riskPolicies, 'risk_monthly_premium');
  const totalMedicalPremium = sumField(medicalPolicies, 'medical_aid_monthly_premium');
  const totalRetirementPremium = sumField(retirementPolicies, 'retirement_monthly_contribution');
  const totalInvestmentPremium = sumInvestmentPremiums(investmentPolicies);
  const totalEmployeePremium = sumMultiField(employeePolicies, [
    'eb_monthly_premium',
    'eb_risk_monthly_premium',
    'eb_retirement_contribution_employee',
    'eb_retirement_contribution_employer',
  ]);
  // Estate fee is annual — convert to monthly equivalent for the premium total
  const totalEstatePremium = sumField(estatePolicies, 'estate_annual_fee') / 12;
  const totalAllPremiums = totalRiskPremium + totalMedicalPremium + totalRetirementPremium
    + totalInvestmentPremium + totalEmployeePremium + totalEstatePremium;

  // Risk cover field IDs from keyManagerConstants.ts
  const totalLifeCover = sumField(riskPolicies, 'risk_life_cover');
  const totalSevereIllness = sumField(riskPolicies, 'risk_severe_illness');
  const totalDisability = sumField(riskPolicies, 'risk_disability');
  const totalIncomeProtection = sumField(riskPolicies, 'risk_temporary_icb') + sumField(riskPolicies, 'risk_permanent_icb');

  // Retirement lump sum capital: pre-retirement fund value OR post-retirement capital value
  // (sumFirstNonZero avoids double-counting when multiple value fields exist on the same policy)
  const retirementCurrentValue = sumFirstNonZero(
    retirementPolicies,
    'retirement_fund_value', 'retirement_current_value', 'post_retirement_capital_value',
  );
  // Investment lump sum capital: discretionary current value OR guaranteed capital
  const investmentCurrentValue = sumFirstNonZero(
    investmentPolicies,
    'invest_current_value', 'invest_guaranteed_capital',
  );

  const totalAssets = useMemo(() => (p?.assets || []).reduce((s: number, a: { value?: number }) => s + (Number(a.value) || 0), 0), [p?.assets]);
  const totalLiabilities = useMemo(() => (p?.liabilities || []).reduce((s: number, l: { outstandingBalance?: number }) => s + (Number(l.outstandingBalance) || 0), 0), [p?.liabilities]);
  const totalMonthlyDebt = useMemo(() => (p?.liabilities || []).reduce((s: number, l: { monthlyPayment?: number }) => s + (Number(l.monthlyPayment) || 0), 0), [p?.liabilities]);
  const netWorth = totalAssets - totalLiabilities;

  const premiumToIncomeRatio = grossMonthly > 0 ? (totalAllPremiums / grossMonthly) * 100 : 0;
  const retirementSavingsRate = grossMonthly > 0 ? (totalRetirementPremium / grossMonthly) * 100 : 0;

  const dependants = useMemo(() => (p?.familyMembers || []).filter((m: { isFinanciallyDependent?: boolean }) => m.isFinanciallyDependent), [p?.familyMembers]);

  // ── FNA summary stats ─────────────────────────────────────────────────

  const fnaPublished = fnaStatuses.filter(f => f.status === 'published').length;
  const fnaDraft = fnaStatuses.filter(f => f.status === 'draft').length;
  const fnaOverdue = fnaStatuses.filter(f => f.nextReviewDue && isPast(f.nextReviewDue)).length;

  // ── Synthesise FNA milestone events into activity timeline ────────────

  const enrichedActivityEvents = useMemo<ActivityEvent[]>(() => {
    const fnaEvents: ActivityEvent[] = [];

    fnaStatuses.forEach((fna) => {
      if (fna.publishedAt) {
        fnaEvents.push({
          id: `fna-published-${fna.key}`,
          type: 'fna_published',
          label: `${fna.name} published`,
          timestamp: fna.publishedAt,
          icon: FileCheck,
          iconColor: 'text-gray-500',
          success: true,
        });
      } else if (fna.updatedAt && fna.status === 'draft') {
        fnaEvents.push({
          id: `fna-draft-${fna.key}`,
          type: 'fna_draft',
          label: `${fna.name} draft saved`,
          timestamp: fna.updatedAt,
          icon: FileText,
          iconColor: 'text-gray-500',
          success: true,
        });
      }
    });

    // Combine and filter noise (client mode also hides security events)
    const combined = [...activityEvents, ...fnaEvents]
      .filter(evt => !ACTIVITY_NOISE_TYPES.has(evt.type))
      .filter(evt => !isClient || !CLIENT_HIDDEN_ACTIVITY_TYPES.has(evt.type));
    combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return combined;
  }, [activityEvents, fnaStatuses, isClient]);

  const visibleEvents = activityExpanded
    ? enrichedActivityEvents
    : enrichedActivityEvents.slice(0, INITIAL_ACTIVITY_COUNT);

  // ── Coverage gap analysis (FNA-driven — no arbitrary figures) ─────────
  //
  // Gap items are ONLY generated when a published FNA exists for the domain.
  // Without a published FNA there is no authoritative recommendation to
  // compare against, so showing a gap would be misleading.

  /** Helper: extract finalNeeds from a published Risk Planning FNA */
  const extractRiskFinalNeeds = (raw: Record<string, unknown> | null | undefined): Array<{
    riskType: string; label: string; grossNeed: number; existingCoverTotal: number;
    netShortfall: number; finalRecommendedCover: number;
  }> => {
    if (!raw) return [];
    const needs = raw.finalNeeds as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(needs)) return [];
    return needs.map(n => ({
      riskType: (n.riskType as string) || '',
      label: (n.label as string) || '',
      grossNeed: Number(n.grossNeed) || 0,
      existingCoverTotal: Number(n.existingCoverTotal) || 0,
      netShortfall: Number(n.netShortfall) || 0,
      finalRecommendedCover: Number(n.finalRecommendedCover) || 0,
    }));
  };

  /** Helper: extract RetirementCalculationResults from a published Retirement FNA */
  const extractRetirementResults = (raw: Record<string, unknown> | null | undefined): {
    hasShortfall: boolean; capitalShortfall: number; requiredCapital: number;
    projectedCapital: number; totalRecommendedContribution: number;
    requiredAdditionalContribution: number; percentageOfIncome: number;
  } | null => {
    if (!raw) return null;
    const results = (raw.results || raw.calculations) as Record<string, unknown> | undefined;
    if (!results) return null;
    return {
      hasShortfall: !!results.hasShortfall,
      capitalShortfall: Number(results.capitalShortfall) || 0,
      requiredCapital: Number(results.requiredCapital) || 0,
      projectedCapital: Number(results.projectedCapital) || 0,
      totalRecommendedContribution: Number(results.totalRecommendedContribution) || 0,
      requiredAdditionalContribution: Number(results.requiredAdditionalContribution) || 0,
      percentageOfIncome: Number(results.percentageOfIncome) || 0,
    };
  };

  const riskFnaPublished = fnaStatuses.find(f => f.key === 'risk')?.status === 'published';
  const retirementFnaPublished = fnaStatuses.find(f => f.key === 'retirement')?.status === 'published';
  const medicalFnaPublished = fnaStatuses.find(f => f.key === 'medical')?.status === 'published';
  const investmentFnaPublished = fnaStatuses.find(f => f.key === 'investment')?.status === 'published';
  const estateFnaPublished = fnaStatuses.find(f => f.key === 'estate')?.status === 'published';

  const gapAnalysis = useMemo<GapItem[]>(() => {
    const gaps: GapItem[] = [];

    // ── Risk Planning gaps (from published Risk FNA finalNeeds) ──────
    if (riskFnaPublished) {
      const riskNeeds = extractRiskFinalNeeds(fnaResultsMap.risk);

      // Life Cover
      const lifeNeed = riskNeeds.find(n => n.riskType === 'life');
      if (lifeNeed) {
        const ratio = lifeNeed.grossNeed > 0 ? lifeNeed.existingCoverTotal / lifeNeed.grossNeed : 1;
        gaps.push({
          label: 'Life Cover',
          status: lifeNeed.netShortfall <= 0 ? 'good' : ratio >= 0.8 ? 'caution' : 'gap',
          current: fmt(lifeNeed.existingCoverTotal),
          recommended: `${fmt(lifeNeed.grossNeed)} (FNA recommended)`,
          detail: lifeNeed.netShortfall > 0
            ? `Shortfall: ${fmt(lifeNeed.netShortfall)}`
            : lifeNeed.existingCoverTotal > lifeNeed.grossNeed
              ? 'Adequately covered'
              : undefined,
        });
      }

      // Disability Cover
      const disabilityNeed = riskNeeds.find(n => n.riskType === 'disability');
      if (disabilityNeed) {
        gaps.push({
          label: 'Disability Cover',
          status: disabilityNeed.netShortfall <= 0 ? 'good' : 'gap',
          current: disabilityNeed.existingCoverTotal > 0 ? fmt(disabilityNeed.existingCoverTotal) : 'None',
          recommended: `${fmt(disabilityNeed.grossNeed)} (FNA recommended)`,
          detail: disabilityNeed.netShortfall > 0 ? `Shortfall: ${fmt(disabilityNeed.netShortfall)}` : undefined,
        });
      }

      // Severe Illness
      const severeNeed = riskNeeds.find(n => n.riskType === 'severeIllness');
      if (severeNeed) {
        gaps.push({
          label: 'Severe Illness Cover',
          status: severeNeed.netShortfall <= 0 ? 'good' : 'gap',
          current: severeNeed.existingCoverTotal > 0 ? fmt(severeNeed.existingCoverTotal) : 'None',
          recommended: `${fmt(severeNeed.grossNeed)} (FNA recommended)`,
          detail: severeNeed.netShortfall > 0 ? `Shortfall: ${fmt(severeNeed.netShortfall)}` : undefined,
        });
      }

      // Income Protection (temporary + permanent)
      const ipTempNeed = riskNeeds.find(n => n.riskType === 'incomeProtectionTemporary');
      const ipPermNeed = riskNeeds.find(n => n.riskType === 'incomeProtectionPermanent');
      const ipNeed = ipTempNeed || ipPermNeed; // Use whichever is available
      if (ipNeed) {
        // Combine temporary + permanent if both exist
        const totalIpExisting = (ipTempNeed?.existingCoverTotal || 0) + (ipPermNeed?.existingCoverTotal || 0);
        const totalIpGross = (ipTempNeed?.grossNeed || 0) + (ipPermNeed?.grossNeed || 0);
        const totalIpShortfall = (ipTempNeed?.netShortfall || 0) + (ipPermNeed?.netShortfall || 0);

        gaps.push({
          label: 'Income Protection',
          status: totalIpShortfall <= 0 ? 'good' : 'gap',
          current: totalIpExisting > 0 ? fmt(totalIpExisting) : 'None',
          recommended: `${fmt(totalIpGross)} (FNA recommended)`,
          detail: totalIpShortfall > 0 ? `Shortfall: ${fmt(totalIpShortfall)}` : undefined,
        });
      }
    }

    // ── Medical Aid gaps (from published Medical FNA) ────────────────
    if (medicalFnaPublished) {
      const medRaw = fnaResultsMap.medical;
      const medResults = medRaw?.results as Record<string, unknown> | undefined;
      const medFinal = medRaw?.finalNeeds as Record<string, unknown> | undefined;

      // Medical FNA provides qualitative recommendations (plan type, MSA, LJP)
      // We can check if the client has any active medical cover at all
      const hasActivePlan = medicalPolicies.length > 0;
      gaps.push({
        label: 'Medical Aid',
        status: hasActivePlan ? 'good' : 'gap',
        current: hasActivePlan
          ? `${medicalPolicies.length} active plan${medicalPolicies.length > 1 ? 's' : ''}`
          : 'None',
        recommended: medResults
          ? `${(medResults.recommendedInHospitalCover as string) || 'In-hospital'} cover, ${(medResults.msaRecommended || medFinal?.msa) ? 'MSA recommended' : 'MSA not required'} (FNA)`
          : 'Active medical aid membership (per FNA)',
      });
    }

    // ── Retirement gaps (from published Retirement FNA) ──────────────
    if (retirementFnaPublished) {
      const retResults = extractRetirementResults(fnaResultsMap.retirement);
      if (retResults) {
        gaps.push({
          label: 'Retirement Savings',
          status: !retResults.hasShortfall ? 'good' : retResults.capitalShortfall < retResults.requiredCapital * 0.3 ? 'caution' : 'gap',
          current: fmt(retResults.projectedCapital) + ' projected',
          recommended: `${fmt(retResults.requiredCapital)} required capital (FNA)`,
          detail: retResults.hasShortfall
            ? `Shortfall: ${fmt(retResults.capitalShortfall)}. Additional ${fmt(retResults.requiredAdditionalContribution)}/m recommended.`
            : 'On track to meet retirement target',
        });
      }
    }

    // ── Estate Planning gaps (from published Estate FNA) ─────────────
    if (estateFnaPublished) {
      gaps.push({
        label: 'Estate Planning',
        status: estatePolicies.length > 0 ? 'good' : 'caution',
        current: estatePolicies.length > 0 ? 'In place' : 'No estate plan on record',
        recommended: 'Will, executor nomination, and estate duty planning (per FNA)',
      });
    }

    return gaps;
  }, [fnaResultsMap, riskFnaPublished, retirementFnaPublished, medicalFnaPublished, estateFnaPublished, medicalPolicies, estatePolicies]);

  // ── Action Items intelligence (mode-aware) ─────────────────────────────

  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    // --- FNA-derived items ---
    fnaStatuses.forEach((fna) => {
      if (fna.loading) return;

      if (fna.nextReviewDue && isPast(fna.nextReviewDue)) {
        items.push({
          id: `fna-overdue-${fna.key}`,
          priority: 'urgent',
          category: 'fna',
          title: isClient
            ? `Your ${fna.name} is overdue for a check-up`
            : `${fna.name} — review overdue`,
          detail: isClient
            ? `This was due for review on ${fmtDate(fna.nextReviewDue)}. Get in touch with your adviser to book a fresh one.`
            : `Was due ${fmtDate(fna.nextReviewDue)}. Book a new review to make sure the recommendations still hold.`,
          icon: ClipboardCheck,
        });
      }

      if (fna.status === 'draft') {
        items.push({
          id: `fna-draft-${fna.key}`,
          priority: 'attention',
          category: 'fna',
          title: isClient
            ? `Your ${fna.name} is being worked on`
            : `${fna.name} — draft in progress`,
          detail: isClient
            ? 'Your adviser is putting this together. You\'ll be able to see it once it\'s ready.'
            : 'Finish this up and publish it so the client can see the results.',
          icon: FileText,
        });
      }

      if (fna.status === 'not_started') {
        items.push({
          id: `fna-missing-${fna.key}`,
          priority: 'recommended',
          category: 'fna',
          title: isClient
            ? `${fna.name} hasn't been done yet`
            : `Start a ${fna.name}`,
          detail: isClient
            ? 'This review hasn\'t happened yet — bring it up with your adviser at your next catch-up.'
            : 'No review on file. Worth kicking one off at the next meeting.',
          icon: ClipboardCheck,
        });
      }
    });

    // --- Coverage gap items (friendly, natural language) ---
    gapAnalysis.forEach((gap) => {
      if (gap.status === 'gap') {
        const isCritical = ['Life Cover', 'Disability Cover', 'Income Protection'].includes(gap.label);
        items.push({
          id: `gap-${gap.label.toLowerCase().replace(/\s+/g, '-')}`,
          priority: isCritical ? 'urgent' : 'attention',
          category: 'coverage',
          title: isClient
            ? `Your ${gap.label.toLowerCase()} needs topping up`
            : `${gap.label} — falling short`,
          detail: isClient
            ? `Right now you have ${gap.current} in ${gap.label.toLowerCase()}. A bit more cover would go a long way toward protecting you and your family.`
            : `Sitting at ${gap.current} against a recommendation of ${gap.recommended}. Flag this at the next review.`,
          icon: Shield,
        });
      } else if (gap.status === 'caution') {
        items.push({
          id: `gap-caution-${gap.label.toLowerCase().replace(/\s+/g, '-')}`,
          priority: 'attention',
          category: 'coverage',
          title: isClient
            ? `${gap.label} — almost there`
            : `${gap.label} — nearly on target`,
          detail: isClient
            ? `Your ${gap.label.toLowerCase()} is close to where it should be. A small tweak could get it just right.`
            : `At ${gap.current}. ${gap.detail || 'Just under the recommendation — probably fine, but worth a quick check next time.'}`,
          icon: AlertTriangle,
        });
      }
    });

    // --- Policy renewal items ---
    allPolicies.forEach((pol) => {
      let inceptionDateStr: string | null = null;
      for (const fieldId of INCEPTION_FIELD_IDS) {
        const val = pol.data?.[fieldId];
        if (val && typeof val === 'string') {
          const dt = new Date(val);
          if (!isNaN(dt.getTime())) {
            inceptionDateStr = val;
            break;
          }
        }
      }

      if (!inceptionDateStr) {
        for (const [key, val] of Object.entries(pol.data || {})) {
          if (key.toLowerCase().includes('inception') && typeof val === 'string') {
            const dt = new Date(val);
            if (!isNaN(dt.getTime())) {
              inceptionDateStr = val;
              break;
            }
          }
        }
      }

      if (inceptionDateStr) {
        const anniversary = nextAnniversary(inceptionDateStr);
        if (anniversary) {
          const daysUntil = daysBetween(new Date(), anniversary);
          if (daysUntil >= 0 && daysUntil <= RENEWAL_WINDOW_DAYS) {
            items.push({
              id: `renewal-${pol.id}`,
              priority: daysUntil <= 14 ? 'urgent' : 'attention',
              category: 'renewal',
              title: isClient
                ? `Your ${pol.providerName} policy is up for renewal soon`
                : `${pol.providerName} — renewal coming up`,
              detail: isClient
                ? `Renews on ${fmtDate(anniversary.toISOString())} (${daysUntil === 0 ? 'today' : `${daysUntil} days away`}). Your adviser might get in touch to go over it.`
                : `Due ${fmtDate(anniversary.toISOString())} (${daysUntil === 0 ? 'today' : `${daysUntil} days away`}). Good time to check the terms and premiums.`,
              icon: Calendar,
            });
          }
        }
      }
    });

    // --- Profile completeness items ---
    if (grossMonthly === 0) {
      items.push({
        id: 'profile-income-missing',
        priority: 'attention',
        category: 'profile',
        title: isClient ? 'We need your income details' : 'Income info is missing',
        detail: isClient
          ? 'Knowing your income lets us give you much more accurate recommendations and savings targets.'
          : 'Can\'t calculate savings rates, gap analysis, or run FNAs properly without income on file.',
        icon: DollarSign,
      });
    }

    if (!p?.emergencyContactName) {
      items.push({
        id: 'profile-emergency-contact',
        priority: 'recommended',
        category: 'profile',
        title: isClient ? 'Add an emergency contact' : 'No emergency contact on file',
        detail: isClient
          ? 'Having someone we can reach in an emergency gives you extra peace of mind.'
          : 'Pop an emergency contact into Personal Details — good practice and covers duty of care.',
        icon: Phone,
      });
    }

    if (!p?.taxNumber) {
      items.push({
        id: 'profile-tax-number',
        priority: 'recommended',
        category: 'profile',
        title: isClient ? 'Add your tax reference number' : 'Tax number is missing',
        detail: isClient
          ? 'We need this for tax planning and to keep everything above board with SARS.'
          : 'Needed for tax planning and SARS compliance. Ask the client for it at the next touchpoint.',
        icon: FileText,
      });
    }

    if ((p?.familyMembers || []).length === 0 && dependants.length === 0) {
      items.push({
        id: 'profile-dependants',
        priority: 'recommended',
        category: 'profile',
        title: isClient ? 'Tell us about your family' : 'No family or dependants on record',
        detail: isClient
          ? 'Adding your family helps your adviser work out the right life cover and estate plan for you.'
          : 'Can\'t size life cover, income protection, or estate plans without knowing the family picture.',
        icon: Users,
      });
    }

    // --- Compliance items (adviser-only) ---
    if (!isClient && (p?.assets || []).length === 0 && (p?.liabilities || []).length === 0) {
      items.push({
        id: 'compliance-balance-sheet',
        priority: 'recommended',
        category: 'compliance',
        title: 'No balance sheet on file',
        detail: 'Worth capturing assets and liabilities — makes net worth tracking and financial planning much stronger.',
        icon: Scale,
      });
    }

    // Sort: urgent first, then attention, then recommended
    const priorityOrder: Record<ActionPriority, number> = { urgent: 0, attention: 1, recommended: 2 };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return items;
  }, [fnaStatuses, gapAnalysis, allPolicies, grossMonthly, p, dependants, isClient]);

  // ── Financial Health Score ────────────────────────────────────────────

  const healthScore = useMemo<number>(() => {
    let score = 0;
    let maxScore = 0;

    // Coverage health (30 points) — only scored when FNA-driven gaps exist
    if (gapAnalysis.length > 0) {
      gapAnalysis.forEach(gap => {
        const weight = 30 / gapAnalysis.length;
        maxScore += weight;
        if (gap.status === 'good') score += weight;
        else if (gap.status === 'caution') score += weight * 0.5;
        // 'gap' and 'none' contribute 0
      });
    }

    // FNA completeness (25 points)
    fnaStatuses.forEach(fna => {
      if (fna.loading) return;
      const weight = 25 / fnaStatuses.length;
      maxScore += weight;
      if (fna.status === 'published') score += weight;
      else if (fna.status === 'draft') score += weight * 0.3;
    });

    // Profile completeness (20 points)
    const profileChecks = [
      !!grossMonthly,
      !!p?.taxNumber,
      !!p?.emergencyContactName,
      (p?.familyMembers || []).length > 0,
      (p?.assets || []).length > 0 || (p?.liabilities || []).length > 0,
    ];
    profileChecks.forEach(check => {
      const weight = 20 / profileChecks.length;
      maxScore += weight;
      if (check) score += weight;
    });

    // Savings rate (15 points) — only scored when Retirement FNA is published
    if (retirementFnaPublished) {
      const retResults = extractRetirementResults(fnaResultsMap.retirement);
      maxScore += 15;
      if (retResults) {
        if (!retResults.hasShortfall) score += 15;
        else if (retResults.capitalShortfall < retResults.requiredCapital * 0.3) score += 10;
        else if (retResults.capitalShortfall < retResults.requiredCapital * 0.6) score += 5;
      }
    }

    // Net worth positive (10 points)
    maxScore += 10;
    if (netWorth > 0) score += 10;
    else if (netWorth === 0) score += 5;

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }, [gapAnalysis, fnaStatuses, grossMonthly, p, retirementFnaPublished, fnaResultsMap, netWorth]);

  const healthLabel = healthScore >= 75 ? 'Strong' : healthScore >= 50 ? 'Fair' : healthScore >= 25 ? 'Needs Work' : 'Getting Started';
  const healthColor = healthScore >= 75 ? 'text-green-600' : healthScore >= 50 ? 'text-amber-500' : healthScore >= 25 ? 'text-orange-500' : 'text-gray-400';
  const healthStroke = healthScore >= 75 ? '#16a34a' : healthScore >= 50 ? '#f59e0b' : healthScore >= 25 ? '#f97316' : '#d1d5db';

  // ── Health Sub-Scores ─────────────────────────────────────────────────

  const retResultsForSubScore = useMemo(() => {
    if (!retirementFnaPublished) return null;
    return extractRetirementResults(fnaResultsMap.retirement);
  }, [retirementFnaPublished, fnaResultsMap]);

  const subScores = useMemo<HealthSubScores>(() => {
    const retShortfallSeverity = retResultsForSubScore
      ? !retResultsForSubScore.hasShortfall
        ? 'none' as const
        : retResultsForSubScore.capitalShortfall < retResultsForSubScore.requiredCapital * 0.3
          ? 'minor' as const
          : retResultsForSubScore.capitalShortfall < retResultsForSubScore.requiredCapital * 0.6
            ? 'moderate' as const
            : 'severe' as const
      : null;

    return deriveHealthSubScores({
      gapStatuses: gapAnalysis,
      riskFnaPublished,
      medicalFnaPublished,
      retirementFnaPublished,
      investmentFnaPublished,
      estateFnaPublished,
      hasRiskPolicies: riskPolicies.length > 0,
      hasMedicalPolicies: medicalPolicies.length > 0,
      hasRetirementPolicies: retirementPolicies.length > 0,
      hasInvestmentPolicies: investmentPolicies.length > 0,
      hasEstatePolicies: estatePolicies.length > 0,
      retirementHasShortfall: retResultsForSubScore ? retResultsForSubScore.hasShortfall : null,
      retirementShortfallSeverity: retShortfallSeverity,
    });
  }, [gapAnalysis, riskFnaPublished, medicalFnaPublished, retirementFnaPublished, investmentFnaPublished, estateFnaPublished,
    riskPolicies, medicalPolicies, retirementPolicies, investmentPolicies, estatePolicies, retResultsForSubScore]);

  // ── KPI Values ────────────────────────────────────────────────────────

  const kpiValues = useMemo<KPIValue[]>(() => {
    const hasBalanceSheet = (p?.assets || []).length > 0 || (p?.liabilities || []).length > 0;

    // DTI
    const dti = calcDTI(totalMonthlyDebt, grossMonthly);
    const dtiStatus = deriveDTIStatus(dti);

    // Emergency Fund — estimate monthly expenses as net income minus savings contributions
    const estMonthlyExpenses = netMonthly > 0
      ? netMonthly - totalRetirementPremium - totalInvestmentPremium
      : grossMonthly * 0.7; // Rough fallback: 70% of gross
    const emergencyMonths = calcEmergencyFundMonths(p?.assets || [], estMonthlyExpenses);
    const emergencyStatus = deriveEmergencyFundStatus(emergencyMonths);

    // Insurance coverage (from Risk FNA gap analysis — life cover)
    const riskNeeds = riskFnaPublished ? extractRiskFinalNeeds(fnaResultsMap.risk) : [];
    const lifeNeed = riskNeeds.find(n => n.riskType === 'life');
    const insuranceRatio = lifeNeed
      ? calcInsuranceCoverageRatio(lifeNeed.existingCoverTotal, lifeNeed.grossNeed)
      : null;
    const insuranceStatus = deriveInsuranceCoverageStatus(insuranceRatio);

    // Retirement progress
    const retResults = retResultsForSubScore;
    const retProgress = retResults
      ? calcRetirementProgress(retResults.projectedCapital, retResults.requiredCapital)
      : null;
    const retStatus = deriveRetirementProgressStatus(retProgress);

    // Savings rate
    const savingsStatus = grossMonthly > 0
      ? deriveSavingsRateStatus(retirementSavingsRate)
      : 'no-data' as const;

    // Net worth
    const nwStatus = deriveNetWorthStatus(netWorth, hasBalanceSheet);

    return [
      {
        id: 'net_worth',
        displayValue: fmt(netWorth),
        rawValue: netWorth,
        status: nwStatus,
        detail: netWorth > 0 ? 'In the green' : netWorth === 0 ? 'Breaking even' : 'Owes more than they own',
      },
      {
        id: 'dti',
        displayValue: dti !== null ? `${dti.toFixed(1)}%` : '—',
        rawValue: dti,
        status: dtiStatus,
        detail: dti !== null
          ? dti < 36 ? 'Comfortable range' : dti <= 50 ? 'Getting stretched' : 'Under pressure'
          : undefined,
      },
      {
        id: 'savings_rate',
        displayValue: grossMonthly > 0 ? `${retirementSavingsRate.toFixed(1)}%` : '—',
        rawValue: retirementSavingsRate,
        status: savingsStatus,
        detail: grossMonthly > 0
          ? retirementSavingsRate >= 15 ? 'Hitting the target' : 'Could save more'
          : undefined,
      },
      {
        id: 'emergency_fund',
        displayValue: emergencyMonths !== null
          ? `${emergencyMonths.toFixed(1)} months`
          : '—',
        rawValue: emergencyMonths,
        status: emergencyStatus,
        detail: emergencyMonths !== null
          ? emergencyMonths >= 6 ? 'Well prepared' : emergencyMonths >= 3 ? 'Getting there' : 'Needs building up'
          : undefined,
      },
      {
        id: 'insurance_coverage',
        displayValue: insuranceRatio !== null
          ? `${insuranceRatio.toFixed(0)}%`
          : '—',
        rawValue: insuranceRatio,
        status: insuranceStatus,
        detail: insuranceRatio !== null
          ? insuranceRatio >= 100 ? 'Fully covered' : `${(100 - insuranceRatio).toFixed(0)}% gap to close`
          : riskFnaPublished ? 'No life cover need identified' : 'Needs a Risk FNA first',
      },
      {
        id: 'retirement_progress',
        displayValue: retProgress !== null
          ? `${retProgress.toFixed(0)}%`
          : '—',
        rawValue: retProgress,
        status: retStatus,
        detail: retProgress !== null
          ? retProgress >= 90 ? 'Looking good' : `${fmt(retResults?.capitalShortfall)} still needed`
          : 'Needs a Retirement FNA first',
      },
    ];
  }, [
    p, grossMonthly, netMonthly, totalMonthlyDebt, totalRetirementPremium,
    totalInvestmentPremium, gapAnalysis, riskFnaPublished, fnaResultsMap,
    retResultsForSubScore, retirementSavingsRate, netWorth,
  ]);

  // ── Phase 2: Chart Data ───────────────────────────────────────────────

  const assetAllocationData = useMemo<AssetAllocationData>(() => ({
    assets: (p?.assets || []).map((a: { type?: string; value?: number; description?: string }) => ({
      type: a.type,
      value: Number(a.value) || 0,
      description: a.description,
    })),
    retirementValue: retirementCurrentValue,
    investmentValue: investmentCurrentValue,
  }), [p?.assets, retirementCurrentValue, investmentCurrentValue]);

  const insuranceCoverageItems = useMemo<InsuranceCoverageItem[]>(() => {
    if (!riskFnaPublished) return [];
    const riskNeeds = extractRiskFinalNeeds(fnaResultsMap.risk);
    return riskNeeds
      .filter(n => n.grossNeed > 0 || n.existingCoverTotal > 0)
      .map(n => ({
        riskType: n.riskType,
        label: n.label,
        existing: n.existingCoverTotal,
        recommended: n.grossNeed,
      }));
  }, [riskFnaPublished, fnaResultsMap]);

  const cashflowData = useMemo<CashflowWaterfallData>(() => ({
    grossIncome: grossMonthly,
    netIncome: netMonthly > 0 ? netMonthly : grossMonthly * 0.72,
    riskPremiums: totalRiskPremium,
    medicalPremiums: totalMedicalPremium,
    retirementPremiums: totalRetirementPremium,
    investmentPremiums: totalInvestmentPremium,
    employeePremiums: totalEmployeePremium,
    debtPayments: totalMonthlyDebt,
  }), [grossMonthly, netMonthly, totalRiskPremium, totalMedicalPremium,
    totalRetirementPremium, totalInvestmentPremium, totalEmployeePremium, totalMonthlyDebt]);

  const actionDistribution = useMemo<ActionDistribution>(() => {
    const dist: ActionDistribution = { urgent: 0, attention: 0, recommended: 0, monitoring: 0 };
    actionItems.forEach(item => {
      if (item.priority in dist) {
        dist[item.priority as keyof ActionDistribution]++;
      }
    });
    return dist;
  }, [actionItems]);

  // ── Phase 3: Documents Checklist ──────────────────────────────────────

  const documentChecklist = useMemo<DocumentItem[]>(() => {
    const policyCategoriesWithDocs = CATEGORIES
      .filter(cat => (policiesByCategory[cat.id] || []).length > 0)
      .map(cat => cat.categoryId);

    const publishedFnaModules = fnaStatuses
      .filter(f => f.status === 'published')
      .map(f => f.key);

    return deriveDocumentChecklist({
      hasIdNumber: !!(client.idNumber || p?.idNumber),
      hasAddress: !!(p?.residentialAddressLine1),
      hasBankDetails: (p?.bankAccounts || []).length > 0,
      hasPayslip: grossMonthly > 0,
      hasTaxNumber: !!p?.taxNumber,
      hasIncome: grossMonthly > 0,
      policyCategoriesWithDocs,
      publishedFnaModules,
    });
  }, [client.idNumber, p, grossMonthly, policiesByCategory, fnaStatuses]);

  // ── Phase 3: Per-Category Policy KPIs ─────────────────────────────────

  const categoryKPIs = useMemo<CategoryKPI[]>(() => {
    return deriveCategoryKPIs({
      riskPolicies,
      medicalPolicies,
      retirementPolicies,
      investmentPolicies,
      employeePolicies,
      estatePolicies,
      sumField: (pols, keyId) => pols.reduce((s, pol) => s + numVal(pol, keyId), 0),
      dependantCount: dependants.length,
    });
  }, [riskPolicies, medicalPolicies, retirementPolicies, investmentPolicies,
    employeePolicies, estatePolicies, dependants]);

  // ── Pillar Card Data (5 strategic pillars: Has vs Needs) ────────────────
  //
  // Each pillar compares what the client HAS (from policies) against what
  // they NEED (from published FNA). When no FNA is published, the card
  // still renders useful policy-level data with a "No FNA" fallback.

  const pillars = useMemo<PillarData[]>(() => {
    // ── Extract FNA recommendations for comparison ─────────────────────
    const riskNeeds = riskFnaPublished ? extractRiskFinalNeeds(fnaResultsMap.risk) : [];
    const lifeNeed = riskNeeds.find(n => n.riskType === 'life');
    const disabilityNeed = riskNeeds.find(n => n.riskType === 'disability');
    const severeNeed = riskNeeds.find(n => n.riskType === 'severeIllness');
    const ipTempNeed = riskNeeds.find(n => n.riskType === 'incomeProtectionTemporary');
    const ipPermNeed = riskNeeds.find(n => n.riskType === 'incomeProtectionPermanent');
    const totalIpNeed = (ipTempNeed?.grossNeed || 0) + (ipPermNeed?.grossNeed || 0);
    const totalIpExisting = (ipTempNeed?.existingCoverTotal || 0) + (ipPermNeed?.existingCoverTotal || 0);

    const riskFnaItem = fnaStatuses.find(f => f.key === 'risk');
    const medFnaItem = fnaStatuses.find(f => f.key === 'medical');
    const retFnaItem = fnaStatuses.find(f => f.key === 'retirement');
    const invFnaItem = fnaStatuses.find(f => f.key === 'investment');
    const estateFnaItem = fnaStatuses.find(f => f.key === 'estate');

    // ── Medical FNA data ──────────────────────────────────────────────
    const medRaw = fnaResultsMap.medical;
    const medResults = medRaw?.results as Record<string, unknown> | undefined;
    const medFinalNeeds = medRaw?.finalNeeds as Record<string, unknown> | undefined;
    const msaRecommended = medResults?.msaRecommended || medFinalNeeds?.msa;
    const hospitalRate = (medResults?.recommendedInHospitalCover as string) || undefined;

    // Policy-level medical data (resolved via keyId → schema field ID mapping)
    const medPlanName = medicalPolicies.length > 0
      ? (strVal(medicalPolicies[0], 'medical_aid_plan_type') || medicalPolicies[0].providerName)
      : undefined;
    const medHospitalTariff = medicalPolicies.length > 0
      ? (strVal(medicalPolicies[0], 'medical_aid_hospital_tariff') || undefined)
      : undefined;
    const medHasMSA = medicalPolicies.length > 0
      ? numVal(medicalPolicies[0], 'medical_aid_msa') > 0
      : false;

    // ── Retirement FNA data ───────────────────────────────────────────
    const retResults = retirementFnaPublished ? extractRetirementResults(fnaResultsMap.retirement) : null;

    // ── Risk gap health (from gap analysis or policy fallback) ────────
    const riskGapStatuses = gapAnalysis
      .filter(g => ['Life Cover', 'Disability Cover', 'Severe Illness Cover', 'Income Protection'].includes(g.label))
      .map(g => g.status);
    const riskHealth: PillarHealth = riskGapStatuses.length > 0
      ? worstGapStatus(riskGapStatuses)
      : riskPolicies.length > 0 ? 'healthy' : 'no-data';

    // ── 1. Risk Planning ──────────────────────────────────────────────
    const riskPillar: PillarData = {
      id: 'risk-planning',
      title: 'Risk',
      icon: Shield,
      health: riskHealth,
      fnaStatus: riskFnaItem?.loading ? 'loading' : riskFnaItem?.status,
      primaryValue: riskPolicies.length > 0
        ? `${riskPolicies.length} ${riskPolicies.length === 1 ? 'Policy' : 'Policies'}`
        : 'No Policies',
      primaryLabel: totalRiskPremium > 0 ? `${fmt(totalRiskPremium)}/m total premium` : 'No risk cover in place',
      metrics: [
        {
          label: 'Life Cover',
          value: totalLifeCover > 0 ? fmtCompact(totalLifeCover) : 'None',
          recommended: lifeNeed ? fmtCompact(lifeNeed.grossNeed) : undefined,
          highlight: lifeNeed ? lifeNeed.netShortfall > 0 : totalLifeCover === 0,
        },
        {
          label: 'Disability',
          value: totalDisability > 0 ? fmtCompact(totalDisability) : 'None',
          recommended: disabilityNeed ? fmtCompact(disabilityNeed.grossNeed) : undefined,
          highlight: disabilityNeed ? disabilityNeed.netShortfall > 0 : totalDisability === 0,
        },
        {
          label: 'Severe Illness',
          value: totalSevereIllness > 0 ? fmtCompact(totalSevereIllness) : 'None',
          recommended: severeNeed ? fmtCompact(severeNeed.grossNeed) : undefined,
          highlight: severeNeed ? severeNeed.netShortfall > 0 : false,
        },
        {
          label: 'Income Protection',
          value: totalIncomeProtection > 0 ? fmtCompact(totalIncomeProtection) : (totalIpExisting > 0 ? fmtCompact(totalIpExisting) : 'None'),
          recommended: totalIpNeed > 0 ? fmtCompact(totalIpNeed) : undefined,
          highlight: totalIpNeed > 0 && totalIpExisting < totalIpNeed,
        },
      ],
      policyCount: riskPolicies.length,
      monthlyPremium: totalRiskPremium,
    };

    // ── 2. Medical Aid ────────────────────────────────────────────────
    const medGapStatus = gapAnalysis.find(g => g.label === 'Medical Aid')?.status || 'none';
    const medHealth: PillarHealth = medGapStatus === 'good' ? 'healthy'
      : medGapStatus === 'gap' ? 'critical'
      : medicalPolicies.length > 0 ? 'healthy' : 'no-data';

    const medicalPillar: PillarData = {
      id: 'medical-aid',
      title: 'Medical Aid',
      icon: Heart,
      health: medHealth,
      fnaStatus: medFnaItem?.loading ? 'loading' : medFnaItem?.status,
      primaryValue: medPlanName || (medicalPolicies.length > 0 ? medicalPolicies[0].providerName : 'No Cover'),
      primaryLabel: totalMedicalPremium > 0 ? `${fmt(totalMedicalPremium)}/m premium` : 'No medical aid on record',
      metrics: [
        {
          label: 'Hospital Rate',
          value: medHospitalTariff || (medicalPolicies.length > 0 ? 'On plan' : 'N/A'),
          recommended: hospitalRate ? `${hospitalRate} (FNA)` : undefined,
        },
        {
          label: 'MSA',
          value: medicalPolicies.length > 0 ? (medHasMSA ? 'Yes' : 'No') : 'N/A',
          recommended: medicalFnaPublished ? (msaRecommended ? 'Recommended' : 'Not required') : undefined,
          highlight: medicalFnaPublished && !!msaRecommended && !medHasMSA,
        },
        {
          label: 'Dependants',
          value: `${dependants.length}`,
        },
      ],
      policyCount: medicalPolicies.length,
      monthlyPremium: totalMedicalPremium,
    };

    // ── 3. Retirement Annuity ─────────────────────────────────────────
    const retGapStatus = gapAnalysis.find(g => g.label === 'Retirement Savings')?.status || 'none';
    const retHealth: PillarHealth = retGapStatus === 'good' ? 'healthy'
      : retGapStatus === 'caution' ? 'attention'
      : retGapStatus === 'gap' ? 'critical'
      : retirementPolicies.length > 0 ? 'healthy' : 'no-data';

    const retirementPillar: PillarData = {
      id: 'retirement',
      title: 'Retirement',
      icon: PiggyBank,
      health: retHealth,
      fnaStatus: retFnaItem?.loading ? 'loading' : retFnaItem?.status,
      primaryValue: fmtCompact(retirementCurrentValue),
      primaryLabel: 'Current Fund Value',
      metrics: [
        {
          label: 'Monthly Contrib.',
          value: totalRetirementPremium > 0 ? `${fmtCompact(totalRetirementPremium)}/m` : 'None',
          recommended: retResults ? `${fmtCompact(retResults.totalRecommendedContribution)}/m` : undefined,
          highlight: retResults ? retResults.hasShortfall : false,
        },
        {
          label: 'Savings Rate',
          value: grossMonthly > 0 ? pct(retirementSavingsRate) : '—',
          recommended: retResults && grossMonthly > 0 ? `${retResults.percentageOfIncome.toFixed(1)}%` : undefined,
          highlight: grossMonthly > 0 && retirementSavingsRate < 15,
        },
        {
          label: 'Projected Capital',
          value: retResults ? fmtCompact(retResults.projectedCapital) : '—',
          recommended: retResults ? fmtCompact(retResults.requiredCapital) : undefined,
          highlight: retResults ? retResults.hasShortfall : false,
        },
      ],
      policyCount: retirementPolicies.length,
      monthlyPremium: totalRetirementPremium,
    };

    // ── 4. Investment Planning ─────────────────────────────────────────
    const investmentPillar: PillarData = {
      id: 'investment',
      title: 'Investments',
      icon: TrendingUp,
      health: investmentPolicies.length > 0 ? 'healthy' : 'no-data',
      fnaStatus: invFnaItem?.loading ? 'loading' : invFnaItem?.status,
      primaryValue: fmtCompact(investmentCurrentValue),
      primaryLabel: 'Current Portfolio Value',
      metrics: [
        {
          label: 'Monthly Contrib.',
          value: totalInvestmentPremium > 0 ? `${fmtCompact(totalInvestmentPremium)}/m` : 'None',
        },
        {
          label: 'Policies',
          value: `${investmentPolicies.length}`,
        },
      ],
      policyCount: investmentPolicies.length,
      monthlyPremium: totalInvestmentPremium,
    };

    // ── 5. Estate Planning ────────────────────────────────────────────
    const estateGapStatus = gapAnalysis.find(g => g.label === 'Estate Planning')?.status || 'none';
    const estateHealth: PillarHealth = estateGapStatus === 'good' ? 'healthy'
      : estateGapStatus === 'caution' ? 'attention'
      : estateGapStatus === 'gap' ? 'critical'
      : estatePolicies.length > 0 ? 'healthy' : 'no-data';

    const estatePillar: PillarData = {
      id: 'estate',
      title: 'Estate',
      icon: Landmark,
      health: estateHealth,
      fnaStatus: estateFnaItem?.loading ? 'loading' : estateFnaItem?.status,
      primaryValue: estatePolicies.length > 0 ? 'In Place' : 'Not Set Up',
      primaryLabel: 'Planning Status',
      metrics: [
        {
          label: 'Will / Executor',
          value: estateFnaItem?.status === 'published' ? 'Reviewed' : estateFnaItem?.status === 'draft' ? 'In Progress' : 'Not Started',
          highlight: estateFnaItem?.status !== 'published',
        },
        {
          label: 'Tax Number',
          value: p?.taxNumber ? 'On File' : 'Missing',
          highlight: !p?.taxNumber,
        },
      ],
      policyCount: estatePolicies.length,
      monthlyPremium: 0,
    };

    return [riskPillar, medicalPillar, retirementPillar, investmentPillar, estatePillar];
  }, [
    gapAnalysis, fnaStatuses, fnaResultsMap,
    totalLifeCover, totalDisability, totalSevereIllness, totalIncomeProtection,
    totalRiskPremium, riskPolicies, riskFnaPublished,
    medicalPolicies, totalMedicalPremium, dependants, medicalFnaPublished,
    retirementCurrentValue, totalRetirementPremium, retirementPolicies,
    grossMonthly, retirementSavingsRate, retirementFnaPublished,
    investmentCurrentValue, totalInvestmentPremium, investmentPolicies,
    estatePolicies, p?.taxNumber,
  ]);

  // ── Phase 4: PDF report generation ────────────────────────────────────

  const handleDownloadPDF = useCallback(async () => {
    setGeneratingPDF(true);
    try {
      const policySummary = allPolicies.map((pol) => {
        const cat = CATEGORIES.find(c => c.categoryId === pol.categoryId);
        return {
          category: cat?.label || pol.categoryId,
          provider: pol.providerName,
          premium: numVal(pol, 'risk_monthly_premium') || numVal(pol, 'medical_aid_monthly_premium')
            || numVal(pol, 'retirement_monthly_contribution') || numVal(pol, 'invest_monthly_contribution')
            || numVal(pol, 'eb_risk_monthly_premium') || numVal(pol, 'eb_monthly_premium')
            || numVal(pol, 'estate_annual_fee'),
          coverAmount: numVal(pol, 'risk_life_cover') || numVal(pol, 'risk_severe_illness') || numVal(pol, 'risk_disability'),
          currentValue: numVal(pol, 'retirement_fund_value') || numVal(pol, 'retirement_current_value')
            || numVal(pol, 'post_retirement_capital_value') || numVal(pol, 'invest_current_value')
            || numVal(pol, 'invest_guaranteed_capital'),
        };
      });

      const assets = (p?.assets || []).map((a: { description?: string; assetType?: string; value?: unknown }) => ({
        description: a.description || a.assetType || 'Unnamed asset',
        value: Number(a.value) || 0,
      }));

      const liabilities = (p?.liabilities || []).map((l: { description?: string; liabilityType?: string; outstandingBalance?: unknown; monthlyPayment?: unknown }) => ({
        description: l.description || l.liabilityType || 'Unnamed liability',
        outstandingBalance: Number(l.outstandingBalance) || 0,
        monthlyPayment: Number(l.monthlyPayment) || 0,
      }));

      const depList = (p?.familyMembers || []).map((m: { firstName?: string; lastName?: string; name?: string; relationship?: string; dateOfBirth?: string; isFinanciallyDependent?: boolean }) => ({
        name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.name || 'Unnamed',
        relationship: m.relationship,
        dateOfBirth: m.dateOfBirth,
        isFinanciallyDependent: !!m.isFinanciallyDependent,
      }));

      const reportData = {
        client: {
          firstName: client.firstName,
          lastName: client.lastName,
          preferredName: client.preferredName,
          email: client.email,
          applicationNumber: client.applicationNumber,
          applicationStatus: client.applicationStatus || 'unknown',
          createdAt: client.createdAt,
        },
        profile: p ? {
          title: p.title,
          firstName: p.firstName,
          middleName: p.middleName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth,
          age,
          gender: p.gender,
          maskedIdNumber: client.idNumber ? `${client.idNumber.slice(0, 6)}****${client.idNumber.slice(-2)}` : undefined,
          taxNumber: p.taxNumber,
          nationality: p.nationality,
          maritalStatus: p.maritalStatus,
          maritalRegime: p.maritalRegime,
          smokerStatus: p.smokerStatus,
          email: p.email || client.email,
          phone: p.phoneNumber,
          address: addressLine(p),
          employmentStatus: p.employmentStatus,
          employer: (p.employers || [])[0]?.employerName || (p.selfEmployedCompanyName) || undefined,
          position: (p.employers || [])[0]?.jobTitle || undefined,
          industry: (p.employers || [])[0]?.industry || (p.selfEmployedIndustry) || undefined,
          riskProfile: p.riskAssessment?.riskCategory
            ? `${p.riskAssessment.riskCategory} (Score: ${p.riskAssessment.totalScore}/50)`
            : undefined,
        } : null,
        financials: {
          grossMonthly,
          grossAnnual,
          netMonthly,
          totalAllPremiums,
          totalLifeCover,
          totalSevereIllness,
          totalDisability,
          retirementCurrentValue,
          investmentCurrentValue,
          totalAssets,
          totalLiabilities,
          netWorth,
          premiumToIncomeRatio,
          retirementSavingsRate,
          totalMonthlyDebt,
        },
        policySummary,
        gapAnalysis: gapAnalysis.map(g => ({
          label: g.label,
          status: g.status,
          current: g.current,
          recommended: g.recommended,
          detail: g.detail,
        })),
        fnaStatuses: fnaStatuses.map(f => ({
          name: f.name,
          status: f.status,
          updatedAt: f.updatedAt,
          publishedAt: f.publishedAt,
          nextReviewDue: f.nextReviewDue,
        })),
        actionItems: actionItems.map(a => ({
          priority: a.priority,
          category: a.category,
          title: a.title,
          detail: a.detail,
        })),
        assets,
        liabilities,
        dependants: depList,
        healthScore,
        healthSubScores: subScores,
        kpiSummary: kpiValues.map(k => ({
          id: k.id,
          displayValue: k.displayValue,
          status: k.status,
          detail: k.detail,
        })),
        cashflow: {
          grossIncome: cashflowData.grossIncome,
          netIncome: cashflowData.netIncome,
          totalPremiums: totalAllPremiums,
          debtPayments: cashflowData.debtPayments,
        },
        insuranceCoverage: insuranceCoverageItems.map(item => ({
          label: item.label,
          existing: item.existing,
          recommended: item.recommended,
        })),
        // Phase 3 additions
        assetAllocation: assetAllocationData.assets
          .filter(a => (Number(a.value) || 0) > 0)
          .map(a => ({ type: a.type || 'Other', value: Number(a.value) || 0 })),
        categoryKPIs: categoryKPIs.map(c => ({
          label: c.label,
          policyCount: c.policyCount,
          monthlyPremium: c.monthlyPremium,
          headlineValue: c.headlineValue,
          headlineLabel: c.headlineLabel,
        })),
        documentsChecklist: {
          total: documentChecklist.filter(d => d.status !== 'not-applicable').length,
          available: documentChecklist.filter(d => d.status === 'available').length,
          missing: documentChecklist.filter(d => d.status === 'missing').length,
          items: documentChecklist.map(d => ({
            label: d.label,
            category: d.category,
            status: d.status,
          })),
        },
        generatedAt: new Date().toISOString(),
      };

      const supabase = createSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || publicAnonKey;

      // Phase 4: Fetch net worth snapshots for PDF inclusion
      try {
        const snapRes = await fetch(
          `${API_BASE}/net-worth-snapshots/${client.id}`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );
        if (snapRes.ok) {
          const snapData = await snapRes.json();
          if (snapData.success && Array.isArray(snapData.snapshots) && snapData.snapshots.length > 0) {
            (reportData as Record<string, unknown>).netWorthHistory = snapData.snapshots.map(
              (s: { date: string; totalAssets: number; totalLiabilities: number; netWorth: number }) => ({
                date: s.date,
                totalAssets: s.totalAssets,
                totalLiabilities: s.totalLiabilities,
                netWorth: s.netWorth,
              })
            );
          }
        }
      } catch {
        // Non-critical — PDF generates without history if fetch fails
      }

      const res = await fetch(
        `${API_BASE}/reporting/client-overview-pdf`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reportData),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Server returned ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Navigate_Wealth_Report_${client.lastName}_${client.firstName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating PDF report:', err);
      setError('Unable to generate PDF report. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  }, [
    client, p, age, allPolicies, gapAnalysis, fnaStatuses, actionItems,
    grossMonthly, grossAnnual, netMonthly, totalAllPremiums, totalLifeCover,
    totalSevereIllness, totalDisability, retirementCurrentValue, investmentCurrentValue,
    totalAssets, totalLiabilities, netWorth, premiumToIncomeRatio, retirementSavingsRate,
    totalMonthlyDebt, healthScore, subScores, kpiValues,
    cashflowData, insuranceCoverageItems,
    assetAllocationData, categoryKPIs, documentChecklist,
  ]);

  // ── Loading state ─────────────────────────────────────────────────────

  const isLoading = loadingProfile || loadingPolicies;

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  if (error && allPolicies.length === 0 && !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-10 w-10 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Unable to load overview</h3>
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={refreshAll}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 animate-in fade-in duration-500 print:space-y-6" id="client-overview">

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ABOVE THE FOLD — What matters at a glance                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* ─── 1. Welcome Banner + Financial Snapshot + Health Score ─────── */}
      <WelcomeBanner
        client={client}
        profile={p}
        age={age}
        healthScore={healthScore}
        healthLabel={healthLabel}
        healthColor={healthColor}
        healthStroke={healthStroke}
        subScores={subScores}
        totalPremiums={totalAllPremiums}
        netWorth={netWorth}
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
        portfolioValue={retirementCurrentValue + investmentCurrentValue}
        retirementValue={retirementCurrentValue}
        investmentValue={investmentCurrentValue}
        premiumToIncomeRatio={grossMonthly > 0 ? premiumToIncomeRatio : null}
        policyCount={allPolicies.length}
        onRefresh={refreshAll}
        onDownloadPDF={handleDownloadPDF}
        generatingPDF={generatingPDF}
        mode={mode}
      />

      {/* ─── 2. Health Pillar Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-stretch">
        {pillars.map((pillar) => (
          <PillarCard key={pillar.id} pillar={pillar} />
        ))}
      </div>

      {/* ─── 3. Action Items — what needs attention ───────────────────── */}
      <UnifiedActionItems items={actionItems} mode={mode} actionDistribution={actionDistribution} />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BELOW THE FOLD — Individual collapsible detail panels          */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      <Accordion type="multiple" defaultValue={[]} className="space-y-3">

        {/* ─── KPI Dashboard & Charts ─────────────────────────────────── */}
        <AccordionItem value="kpi-charts" className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <Activity className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {isClient ? 'My Financial Health Details' : 'Financial Health & Charts'}
              </span>
              <span className="text-xs text-gray-400 ml-auto mr-2 hidden sm:inline truncate">
                {isClient ? 'Detailed breakdown of your financial health' : 'Health indicators, asset allocation, cashflow & coverage'}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <div className="px-5 py-4 space-y-5">
              {/* Data source note — adviser only */}
              {!isClient && (
                <div className="flex items-start gap-2 p-3 bg-blue-50/60 rounded-lg border border-blue-100 text-xs text-blue-700">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Data sources: </span>
                    <span className="text-blue-600">
                      Emergency Fund = liquid assets (savings, cash, deposits from balance sheet) ÷ estimated monthly expenses.{' '}
                      Asset Allocation = profile balance sheet assets + retirement/investment policy values.{' '}
                      Insurance Coverage = published Risk Planning FNA finalNeeds (existing vs recommended).{' '}
                      Cashflow = income, premiums &amp; debt from profile + policies.
                    </span>
                  </div>
                </div>
              )}
              <KPISummaryTable kpis={kpiValues} mode={mode} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AssetAllocationChart data={assetAllocationData} mode={mode} />
                <InsuranceCoverageChart items={insuranceCoverageItems} mode={mode} />
              </div>
              <CashflowWaterfallChart data={cashflowData} mode={mode} />
              <CategoryPolicyKPIs categories={categoryKPIs} mode={mode} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Policies ───────────────────────────────────────────────── */}
        <AccordionItem value="policies" className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <FileText className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {isClient ? 'My Policies' : 'Portfolio Summary'}
              </span>
              {allPolicies.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{allPolicies.length}</Badge>
              )}
              <span className="text-xs text-gray-400 ml-auto mr-2 hidden sm:inline truncate">
                {allPolicies.length > 0
                  ? `${allPolicies.length} ${allPolicies.length === 1 ? 'policy' : 'policies'} · ${fmt(totalAllPremiums)}/m`
                  : 'No policies on record'}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <div className="p-4">
              {allPolicies.length === 0 ? (
                <EmptyBox message={isClient
                  ? 'No policies on record yet. Speak to your adviser to get started.'
                  : 'No policies on record. Add policies via the Policy Details tab.'
                } />
              ) : (
                <PolicyOverviewTab
                  clientId={client.id}
                  clientDisplayName={
                    [client.firstName, client.lastName].filter(Boolean).join(' ').trim() || undefined
                  }
                  variant="embedded"
                />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Net Worth & Balance Sheet ───────────────────────────────── */}
        <AccordionItem value="net-worth" className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <Scale className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">{isClient ? 'My Net Worth' : 'Net Worth & Balance Sheet'}</span>
              <span className="text-xs text-gray-400 ml-auto mr-2 hidden sm:inline truncate">
                {fmt(totalAssets)} assets · {fmt(totalLiabilities)} liabilities · {fmt(netWorth)} net
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <div className="px-5 py-4 space-y-5">
              {/* Summary bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Total Assets</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{fmt(totalAssets)}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">Total Liabilities</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{fmt(totalLiabilities)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-600">Net Worth</p>
                  <p className="text-lg font-bold mt-1 text-gray-900">{fmt(netWorth)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Assets */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Assets</h4>
                  {(p?.assets || []).length === 0 ? (
                    <EmptyBox message="No assets recorded." small />
                  ) : (
                    <div className="space-y-2">
                      {(p?.assets || []).map((a: { id: string; name?: string; type?: string; description?: string; value?: number }) => (
                        <div key={a.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{a.name || a.type}</p>
                            {a.description && <p className="text-xs text-gray-500">{a.description}</p>}
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{fmt(a.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Liabilities */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Liabilities</h4>
                  {(p?.liabilities || []).length === 0 ? (
                    <EmptyBox message="No liabilities recorded." small />
                  ) : (
                    <div className="space-y-2">
                      {(p?.liabilities || []).map((l: { id: string; name?: string; type?: string; outstandingBalance?: number; monthlyPayment?: number; interestRate?: number }) => (
                        <div key={l.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{l.name || l.type}</p>
                            {(l.monthlyPayment || 0) > 0 && (
                              <p className="text-xs text-gray-500">
                                {fmt(l.monthlyPayment)}/m{(l.interestRate || 0) > 0 ? ` · ${l.interestRate}% interest` : ''}
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{fmt(l.outstandingBalance)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {totalMonthlyDebt > 0 && (
                <div className="contents">
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between px-3">
                    <p className="text-sm text-gray-500">Total monthly debt obligations</p>
                    <span className="text-sm font-semibold text-gray-700">{fmt(totalMonthlyDebt)}/m</span>
                  </div>
                </div>
              )}

              {/* Net Worth History */}
              <div className="pt-2">
                <NetWorthHistory
                  clientId={client.id}
                  currentTotalAssets={totalAssets}
                  currentTotalLiabilities={totalLiabilities}
                  currentNetWorth={netWorth}
                  currentPolicyCount={allPolicies.length}
                  currentMonthlyPremiums={totalAllPremiums}
                  currentRetirementValue={retirementCurrentValue}
                  currentInvestmentValue={investmentCurrentValue}
                  assetBreakdown={(p?.assets || []).map((a: { type?: string; value?: number }) => ({
                    type: a.type || 'Other',
                    value: Number(a.value) || 0,
                  }))}
                  liabilityBreakdown={(p?.liabilities || []).map((l: { type?: string; outstandingBalance?: number }) => ({
                    type: l.type || 'Other',
                    balance: Number(l.outstandingBalance) || 0,
                  }))}
                  mode={mode}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Financial Reviews ───────────────────────────────────────── */}
        <AccordionItem value="reviews" className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <ClipboardCheck className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {isClient ? 'My Financial Reviews' : 'Financial Reviews'}
              </span>
              {fnaOverdue > 0 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 border-red-200 text-red-600 bg-red-50">
                  {fnaOverdue} {isClient ? 'due' : 'overdue'}
                </Badge>
              )}
              <span className="text-xs text-gray-400 ml-auto mr-2 hidden sm:inline truncate">
                {fnaPublished > 0 && `${fnaPublished} published`}
                {fnaPublished > 0 && fnaDraft > 0 && ' · '}
                {fnaDraft > 0 && `${fnaDraft} ${isClient ? 'in progress' : 'draft'}`}
                {fnaPublished === 0 && fnaDraft === 0 && (isClient ? 'No reviews yet' : 'No reviews conducted')}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <div className="px-5 py-4">
              <div className="flex items-center gap-4 mb-5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600">{fnaPublished} {isClient ? 'Complete' : 'Published'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="text-sm text-gray-600">{fnaDraft} {isClient ? 'In Progress' : 'Draft'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  <span className="text-sm text-gray-600">{FNA_MODULES.length - fnaPublished - fnaDraft} Not Started</span>
                </div>
                {fnaOverdue > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600 font-medium">
                      {fnaOverdue} {isClient ? 'review due' : 'overdue for review'}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {fnaStatuses.map((fna) => (
                  <FNAStatusCard key={fna.key} fna={fna} mode={mode} />
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Documents & Compliance ─────────────────────────────────── */}
        <AccordionItem value="documents" className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <FileCheck className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {isClient ? 'My Documents' : 'Documents & Compliance'}
              </span>
              {(() => {
                const applicable = documentChecklist.filter(d => d.status !== 'not-applicable');
                const available = applicable.filter(d => d.status === 'available').length;
                const total = applicable.length;
                return total > 0 ? (
                  <span className="text-xs text-gray-400 ml-auto mr-2 hidden sm:inline">
                    {available}/{total} on file
                  </span>
                ) : null;
              })()}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <div className="px-5 py-4">
              <DocumentsChecklist documents={documentChecklist} mode={mode} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── 7. Dependants & Family ─────────────────────────────────── */}
        <AccordionItem value="dependants" className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <Users className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">{isClient ? 'My Family' : 'Dependants & Family'}</span>
              {(p?.familyMembers || []).length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{(p?.familyMembers || []).length}</Badge>
              )}
              <span className="text-xs text-gray-400 ml-auto mr-2 hidden sm:inline truncate">
                {(p?.familyMembers || []).length > 0
                  ? `${(p?.familyMembers || []).length} ${(p?.familyMembers || []).length === 1 ? 'member' : 'members'}${dependants.length > 0 ? ` · ${dependants.length} dependent` : ''}`
                  : 'No family members recorded'}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <div className="px-5 py-4">
              {(p?.familyMembers || []).length === 0 ? (
                <EmptyBox message={isClient
                  ? 'No family members on file. Contact your adviser to update your records.'
                  : 'No family members recorded. Add dependants in the Personal Details tab.'
                } />
              ) : (
                <div className="overflow-x-auto -mx-5">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80">
                        <TableHead className="text-xs font-semibold text-gray-600 pl-5">Name</TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600">Relationship</TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600">Age</TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600 text-center hidden sm:table-cell">Financially Dependent</TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600 text-center pr-5 hidden sm:table-cell">Estate Planning</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(p?.familyMembers || []).map((m: { id: string; fullName: string; relationship?: string; dateOfBirth?: string; isFinanciallyDependent?: boolean; isIncludedInEstatePlanning?: boolean }) => {
                        const memberAge = calcAge(m.dateOfBirth);
                        return (
                          <TableRow key={m.id} className="hover:bg-gray-50/50">
                            <TableCell className="text-xs text-gray-900 font-medium pl-5">{m.fullName}</TableCell>
                            <TableCell className="text-xs text-gray-600">{m.relationship || '-'}</TableCell>
                            <TableCell className="text-xs text-gray-600">{memberAge !== null ? `${memberAge} yrs` : '-'}</TableCell>
                            <TableCell className="text-center hidden sm:table-cell">
                              <StatusDot active={!!m.isFinanciallyDependent} />
                            </TableCell>
                            <TableCell className="text-center pr-5 hidden sm:table-cell">
                              <StatusDot active={!!m.isIncludedInEstatePlanning} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {dependants.length > 0 && (
                <p className="text-sm text-gray-500 mt-3 px-1">
                  {dependants.length} financially dependent {dependants.length === 1 ? 'member' : 'members'} —
                  {isClient
                    ? ' this is factored into your life cover and income protection needs.'
                    : ' this impacts life cover and income protection recommendations.'}
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── 8. Recent Activity ─────────────────────────────────────── */}
        <AccordionItem value="activity" className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm last:border-b last:border-b-gray-200">
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <Clock className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">{isClient ? 'My Activity' : 'Recent Activity'}</span>
              {enrichedActivityEvents.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">{enrichedActivityEvents.length}</Badge>
              )}
              <span className="text-xs text-gray-400 ml-auto mr-2 hidden sm:inline truncate">
                {enrichedActivityEvents.length > 0
                  ? `${enrichedActivityEvents.length} events · last: ${fmtRelative(enrichedActivityEvents[0]?.timestamp || '')}`
                  : 'No activity recorded'}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <div className="px-5 py-4">
              {loadingActivity ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-48" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : enrichedActivityEvents.length === 0 ? (
                <EmptyBox message="No activity recorded yet." />
              ) : (
                <div className="contents">
                  <div className="relative">
                    <div className="absolute left-4 top-4 bottom-4 w-px bg-gray-200 print:hidden" />
                    <div className="space-y-0">
                      {visibleEvents.map((evt, idx) => (
                        <TimelineEvent key={evt.id} event={evt} isLast={idx === visibleEvents.length - 1} />
                      ))}
                    </div>
                  </div>
                  {enrichedActivityEvents.length > INITIAL_ACTIVITY_COUNT && (
                    <div className="mt-4 text-center print:hidden">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-gray-500"
                        onClick={() => setActivityExpanded(!activityExpanded)}
                      >
                        {activityExpanded ? (
                          <div className="contents"><ChevronUp className="h-3.5 w-3.5 mr-1" /> Show less</div>
                        ) : (
                          <div className="contents"><ChevronDown className="h-3.5 w-3.5 mr-1" /> Show all {enrichedActivityEvents.length} events</div>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>

      {/* ─── Print Footer ────────────────────────────────────────────── */}
      <div className="hidden print:block print:mt-8 border-t pt-4">
        <p className="text-[10px] text-gray-400 text-center">
          {isClient
            ? 'This report is generated by Navigate Wealth and is intended for informational purposes only. The information contained herein is based on data captured as at the date of generation and should be reviewed with your financial adviser. Navigate Wealth is a licensed Financial Services Provider.'
            : 'This report is generated from Navigate Wealth\'s client management system and is intended for advisory purposes only. The information contained herein is based on data captured as at the date of generation and should be independently verified. Navigate Wealth is a licensed Financial Services Provider.'}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

// ── Welcome Banner ──────────────────────────────────────────────────────

function WelcomeBanner({
  client,
  profile,
  age,
  healthScore,
  healthLabel,
  healthColor,
  healthStroke,
  subScores,
  totalPremiums,
  netWorth,
  totalAssets,
  totalLiabilities,
  portfolioValue,
  retirementValue,
  investmentValue,
  premiumToIncomeRatio,
  policyCount,
  onRefresh,
  onDownloadPDF,
  generatingPDF,
  mode = 'adviser',
}: {
  client: Client;
  profile: ProfileData | null;
  age: number | null;
  healthScore: number;
  healthLabel: string;
  healthColor: string;
  healthStroke: string;
  subScores: HealthSubScores;
  totalPremiums: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  portfolioValue: number;
  retirementValue: number;
  investmentValue: number;
  premiumToIncomeRatio: number | null;
  policyCount: number;
  onRefresh: () => void;
  onDownloadPDF: () => void;
  generatingPDF: boolean;
  mode?: DashboardMode;
}) {
  const p = profile;
  const isClientMode = mode === 'client';
  const firstName = p?.firstName || client.firstName;
  const fullName = isClientMode
    ? firstName
    : `${p?.title ? p.title + ' ' : ''}${firstName} ${p?.lastName || client.lastName}`;
  const knownAs = !isClientMode && client.preferredName && client.preferredName !== client.firstName
    ? `"${client.preferredName}"`
    : null;
  const employer = (p?.employers || [])[0]?.employerName || p?.selfEmployedCompanyName || undefined;

  return (
    <Card className="overflow-hidden print:shadow-none print:border">
      {/* Print-only header */}
      <div className="hidden print:block border-b-2 border-[#6d28d9] px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#6d28d9]">Navigate Wealth</h1>
            <p className="text-sm text-gray-600">{isClientMode ? 'My Financial Summary' : 'Client Portfolio Summary'}</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Generated: {new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <p>Confidential</p>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Left: Identity (compact) */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-[#6d28d9]/10 flex-shrink-0">
                <User className="h-7 w-7 text-[#6d28d9]" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
                    {isClientMode ? `Welcome back, ${fullName}` : fullName}
                  </h2>
                  {knownAs && (
                    <span className="text-sm text-gray-400 italic">{knownAs}</span>
                  )}
                  {/* Status badge — adviser sees application status; client sees simplified */}
                  {!isClientMode && (
                    <Badge
                      variant={client.applicationStatus === 'approved' ? 'default' : 'secondary'}
                      className={`text-[10px] ${client.applicationStatus === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    >
                      {client.applicationStatus === 'approved' ? 'Active' : client.applicationStatus}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-gray-500">
                  {age !== null && <span>{age} years old</span>}
                  {age !== null && <span className="text-gray-300">{'\u00B7'}</span>}
                  <span>{isClientMode ? 'Member' : 'Client'} since {fmtDate(client.createdAt)}</span>
                  {employer && (
                    <div className="contents">
                      <span className="text-gray-300">{'\u00B7'}</span>
                      <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{employer}</span>
                    </div>
                  )}
                </div>

                {/* Application number — adviser only */}
                {!isClientMode && client.applicationNumber && (
                  <p className="text-xs text-gray-400 mt-1">#{client.applicationNumber}</p>
                )}

                {/* Financial snapshot stats — merged from former snapshot cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider leading-none">{isClientMode ? 'My Net Worth' : 'Net Worth'}</p>
                    <p className="text-base md:text-lg font-bold text-gray-900 mt-1">{fmt(netWorth)}</p>
                    <p className="text-xs text-gray-400 leading-tight truncate">{fmt(totalAssets)} assets · {fmt(totalLiabilities)} debt</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider leading-none">Premiums</p>
                    <p className="text-base md:text-lg font-bold text-gray-900 mt-1">{fmt(totalPremiums)}/m</p>
                    <p className="text-xs text-gray-400 leading-tight truncate">{policyCount} {policyCount === 1 ? 'policy' : 'policies'}{premiumToIncomeRatio !== null ? ` · ${premiumToIncomeRatio.toFixed(0)}% of income` : ''}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider leading-none">{isClientMode ? 'My Savings' : 'Portfolio'}</p>
                    <p className="text-base md:text-lg font-bold text-gray-900 mt-1">{fmt(portfolioValue)}</p>
                    <p className="text-xs text-gray-400 leading-tight truncate">Ret: {fmt(retirementValue)} · Inv: {fmt(investmentValue)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider leading-none">Health Score</p>
                    <p className="text-base md:text-lg font-bold text-gray-900 mt-1">{healthScore}/100</p>
                    <p className="text-xs text-gray-400 leading-tight truncate">{healthLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Health Score + Sub-Scores + Actions */}
          <div className="flex items-start gap-5 flex-shrink-0">
            <div className="flex flex-col items-center gap-3">
              {/* Health Score Ring */}
              <HealthScoreRing score={healthScore} label={healthLabel} color={healthColor} stroke={healthStroke} />
              {/* Sub-Score Breakdown */}
              <div className="w-full sm:w-[220px]">
                <HealthScoreBreakdown subScores={subScores} mode={mode} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 print:hidden">
              <Button variant="ghost" size="sm" onClick={onRefresh} title="Refresh" className="h-8 w-8 p-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadPDF}
                disabled={generatingPDF}
                className="h-8 w-8 p-0"
                title={isClientMode ? 'Download My Report' : 'Download PDF'}
              >
                {generatingPDF ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Health Score Ring ────────────────────────────────────────────────────

function HealthScoreRing({
  score,
  label,
  color,
  stroke,
}: {
  score: number;
  label: string;
  color: string;
  stroke: string;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const remaining = circumference - progress;

  return (
    <div className="relative flex items-center justify-center" title={`Financial Health: ${score}%`}>
      <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
        {/* Background track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${remaining}`}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${color}`}>{score}</span>
        <span className="text-[7px] text-gray-400 uppercase tracking-wide font-medium max-w-[56px] text-center leading-tight">{label}</span>
      </div>
    </div>
  );
}

// ── Pillar Card ─────────────────────────────────────────────────────────

const PILLAR_HEALTH_CONFIG: Record<PillarHealth, { bg: string; border: string; dot: string; dotBg: string; label: string }> = {
  healthy: { bg: 'bg-white', border: 'border-gray-200', dot: 'bg-green-500', dotBg: 'bg-green-100', label: 'Healthy' },
  attention: { bg: 'bg-white', border: 'border-gray-200', dot: 'bg-amber-400', dotBg: 'bg-amber-100', label: 'Review' },
  critical: { bg: 'bg-white', border: 'border-gray-200', dot: 'bg-red-500', dotBg: 'bg-red-100', label: 'Shortfall' },
  'no-data': { bg: 'bg-white', border: 'border-gray-200', dot: 'bg-gray-300', dotBg: 'bg-gray-100', label: 'No Data' },
};

const PILLAR_ICON_COLORS: Record<string, string> = {
  'risk-planning': 'text-gray-500 bg-gray-100',
  'medical-aid': 'text-gray-500 bg-gray-100',
  retirement: 'text-gray-500 bg-gray-100',
  investment: 'text-gray-500 bg-gray-100',
  estate: 'text-gray-500 bg-gray-100',
};

/** Pillar card top-line strip colours — matched to HEALTH_SUB_SCORE_CONFIG */
const PILLAR_STRIP_COLORS: Record<string, string> = {
  'risk-planning': 'bg-[#6d28d9]',   // brand purple  — Risk
  'medical-aid': 'bg-[#2563eb]',     // blue-600      — Medical Aid
  retirement: 'bg-[#16a34a]',        // green-600     — Retirement
  investment: 'bg-[#f59e0b]',        // amber-500     — Investments
  estate: 'bg-[#64748b]',            // slate-500     — Estate Planning
};

const FNA_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  published: { label: 'FNA', color: 'text-gray-500' },
  draft: { label: 'FNA Draft', color: 'text-gray-400' },
  not_started: { label: 'No FNA', color: 'text-gray-400' },
  error: { label: 'FNA Error', color: 'text-gray-400' },
  loading: { label: '...', color: 'text-gray-300' },
};

function PillarCard({ pillar }: { pillar: PillarData }) {
  const healthCfg = PILLAR_HEALTH_CONFIG[pillar.health];
  const PillarIcon = pillar.icon;
  const iconColor = PILLAR_ICON_COLORS[pillar.id] || 'text-gray-600 bg-gray-100';
  const stripColor = PILLAR_STRIP_COLORS[pillar.id] || 'bg-gray-300';
  const fnaLabel = pillar.fnaStatus ? FNA_STATUS_LABELS[pillar.fnaStatus] : null;

  return (
    <Card className={`relative overflow-hidden transition-shadow hover:shadow-md border ${healthCfg.border} flex flex-col`}>
      {/* Health indicator strip — colour matches sub-score breakdown */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${stripColor}`} />

      <CardContent className="pt-4 pb-3 px-4 flex-1 flex flex-col gap-0">
        {/* Header: icon + title + health badge */}
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${iconColor} flex-shrink-0`}>
              <PillarIcon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800 leading-tight truncate">{pillar.title}</h3>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4.5 flex-shrink-0 ml-1 ${healthCfg.border} ${healthCfg.bg}`}
          >
            <div className={`h-1.5 w-1.5 rounded-full ${healthCfg.dot} mr-1`} />
            {healthCfg.label}
          </Badge>
        </div>

        {/* Meta line: policy count + FNA status */}
        <p className="text-xs text-gray-400 leading-tight mb-2">
          {pillar.policyCount} {pillar.policyCount === 1 ? 'policy' : 'policies'}
          {fnaLabel && <span className={`ml-1 ${fnaLabel.color}`}>· {fnaLabel.label}</span>}
        </p>

        {/* Primary metric */}
        <div className="mb-2">
          <p className="text-base font-bold text-gray-900 leading-tight">{pillar.primaryValue}</p>
          <p className="text-xs text-gray-500 leading-tight">{pillar.primaryLabel}</p>
        </div>

        {/* Current cover — simple label : value rows */}
        <div className="space-y-1.5 flex-1">
          {pillar.metrics.map((metric) => (
            <div key={metric.label} className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-gray-500 truncate min-w-0">{metric.label}</span>
              <span className={`text-xs font-medium whitespace-nowrap text-gray-700`}>
                {metric.value}
              </span>
            </div>
          ))}
        </div>

        {/* Fallback: no FNA notice */}
        {pillar.fnaStatus === 'not_started' && pillar.policyCount > 0 && (
          <p className="text-[11px] text-gray-400 mt-2 italic border-t border-gray-50 pt-1.5">
            Current cover shown — complete an FNA to check if it's enough
          </p>
        )}
        {pillar.fnaStatus === 'not_started' && pillar.policyCount === 0 && (
          <p className="text-[11px] text-gray-400 mt-2 italic border-t border-gray-50 pt-1.5">
            No cover on record yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Unified Action Items ────────────────────────────────────────────────

const PRIORITY_STYLES: Record<ActionPriority, {
  border: string;
  bg: string;
  iconBg: string;
  iconColor: string;
  label: string;
  labelColor: string;
  labelBorder: string;
}> = {
  urgent: {
    border: 'border-red-200',
    bg: 'bg-red-50/40',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    label: 'Act Now',
    labelColor: 'text-red-700',
    labelBorder: 'border-red-200 bg-red-50',
  },
  attention: {
    border: 'border-amber-200',
    bg: 'bg-amber-50/30',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    label: 'Worth a Look',
    labelColor: 'text-amber-700',
    labelBorder: 'border-amber-200 bg-amber-50',
  },
  recommended: {
    border: 'border-blue-200',
    bg: 'bg-blue-50/20',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    label: 'Nice to Have',
    labelColor: 'text-blue-600',
    labelBorder: 'border-blue-200 bg-blue-50',
  },
};

const CATEGORY_LABELS: Record<ActionItem['category'], string> = {
  fna: 'Financial Review',
  coverage: 'Cover Gaps',
  renewal: 'Upcoming Renewal',
  profile: 'Client Info',
  compliance: 'Compliance',
};

/** Client-friendly labels — replaces jargon for the client portal */
const CLIENT_CATEGORY_LABELS: Record<ActionItem['category'], string> = {
  fna: 'Financial Review',
  coverage: 'Your Cover',
  renewal: 'Upcoming Renewal',
  profile: 'Your Details',
  compliance: 'Compliance',
};

function UnifiedActionItems({ items, mode = 'adviser', actionDistribution }: { items: ActionItem[]; mode?: DashboardMode; actionDistribution?: ActionDistribution }) {
  const [collapsed, setCollapsed] = useState(false);
  const isClientMode = mode === 'client';

  const urgentCount = items.filter(i => i.priority === 'urgent').length;
  const attentionCount = items.filter(i => i.priority === 'attention').length;
  const recommendedCount = items.filter(i => i.priority === 'recommended').length;

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">
                {isClientMode ? 'Everything looks good' : 'Nothing outstanding'}
              </p>
              <p className="text-xs text-gray-500">
                {isClientMode ? 'Nothing needs your attention right now.' : 'No items need attention for this client right now.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4 border-b border-gray-100 bg-gray-50/40 print:bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-sm font-semibold text-gray-800">
              {isClientMode ? 'Things to Check' : 'What Needs Doing'}
            </CardTitle>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 ml-1">{items.length}</Badge>
          </div>

          {/* Priority distribution bar + summary */}
          <div className="flex items-center gap-3">
            {actionDistribution && (
              <ActionPriorityBar distribution={actionDistribution} mode={mode} />
            )}

            {items.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500 h-6 px-2 print:hidden"
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? (
                  <div className="contents"><ChevronDown className="h-3 w-3 mr-1" /> Show all</div>
                ) : (
                  <div className="contents"><ChevronUp className="h-3 w-3 mr-1" /> Collapse</div>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-2">
        {(collapsed ? items.slice(0, 5) : items).map((item) => (
          <ActionItemRow key={item.id} item={item} mode={mode} />
        ))}
        {collapsed && items.length > 5 && (
          <button
            className="w-full text-center py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors print:hidden"
            onClick={() => setCollapsed(false)}
          >
            + {items.length - 5} more
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function ActionItemRow({ item, mode = 'adviser' }: { item: ActionItem; mode?: DashboardMode }) {
  const style = PRIORITY_STYLES[item.priority];
  const ItemIcon = item.icon;
  const categoryLabels = mode === 'client' ? CLIENT_CATEGORY_LABELS : CATEGORY_LABELS;

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${style.border} ${style.bg}`}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-md ${style.iconBg} flex-shrink-0 mt-0.5`}>
        <ItemIcon className={`h-4 w-4 ${style.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800">{item.title}</p>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4.5 border ${style.labelBorder} ${style.labelColor}`}>
            {style.label}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4.5 border-gray-200 text-gray-400 hidden sm:inline-flex">
            {categoryLabels[item.category]}
          </Badge>
        </div>
        {item.detail && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
        )}
      </div>
      <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1.5 print:hidden" />
    </div>
  );
}

// ── FNA Status Card ─────────────────────────────────────────────────────

const FNA_STATUS_STYLES: Record<FNAStatusItem['status'], { dot: string; badge: string; badgeLabel: string }> = {
  published: { dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200', badgeLabel: 'Published' },
  draft: { dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200', badgeLabel: 'Draft' },
  not_started: { dot: 'bg-gray-300', badge: 'bg-gray-50 text-gray-500 border-gray-200', badgeLabel: 'Not Started' },
  error: { dot: 'bg-red-400', badge: 'bg-red-50 text-red-600 border-red-200', badgeLabel: 'Error' },
};

function FNAStatusCard({ fna, mode = 'adviser' }: { fna: FNAStatusItem; mode?: DashboardMode }) {
  const style = FNA_STATUS_STYLES[fna.status];
  const FnaIcon = fna.icon;
  const overdue = fna.nextReviewDue && isPast(fna.nextReviewDue);
  const isClientMode = mode === 'client';

  if (fna.loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3.5 flex items-start gap-3 ${overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gray-100 flex-shrink-0">
        <FnaIcon className="h-4.5 w-4.5 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-800 truncate">{fna.name}</p>
          <Badge variant="outline" className={`text-[11px] px-1.5 py-0 h-4.5 border ${style.badge}`}>
            {isClientMode
              ? (fna.status === 'published' ? 'Complete' : fna.status === 'draft' ? 'In Progress' : style.badgeLabel)
              : style.badgeLabel}
          </Badge>
        </div>
        {fna.status === 'not_started' ? (
          <p className="text-xs text-gray-400">
            {isClientMode ? 'Not yet started — your adviser will initiate this' : 'No analysis conducted yet'}
          </p>
        ) : (
          <div className="space-y-0.5">
            {fna.publishedAt && (
              <p className="text-xs text-gray-500">
                {isClientMode ? 'Completed: ' : 'Published: '}{fmtDate(fna.publishedAt)}
              </p>
            )}
            {fna.updatedAt && !fna.publishedAt && (
              <p className="text-xs text-gray-500">
                {isClientMode ? 'Last updated: ' : 'Last saved: '}{fmtDate(fna.updatedAt)}
              </p>
            )}
            {fna.nextReviewDue && (
              <p className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {overdue
                  ? (isClientMode ? 'Review due — ' : 'Review overdue — ')
                  : 'Next review: '}
                {fmtDate(fna.nextReviewDue)}
              </p>
            )}
          </div>
        )}
      </div>
      <div className={`h-2.5 w-2.5 rounded-full ${style.dot} flex-shrink-0 mt-1`} />
    </div>
  );
}

// ── Timeline Event ──────────────────────────────────────────────────────

function TimelineEvent({ event, isLast }: { event: ActivityEvent; isLast: boolean }) {
  const EvtIcon = event.icon;

  return (
    <div className={`flex items-start gap-3 relative pl-1 ${isLast ? '' : 'pb-4'}`}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-full bg-white border-2 z-10 flex-shrink-0 ${
        event.success === false ? 'border-red-300' : 'border-gray-200'
      }`}>
        <EvtIcon className={`h-4 w-4 ${event.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${event.success === false ? 'text-red-700' : 'text-gray-800'}`}>
            {event.label}
          </p>
          {event.success === false && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-red-200 text-red-500">
              Failed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-400" title={fmtDateTime(event.timestamp)}>
            {fmtDate(event.timestamp)} {'\u00B7'} {fmtRelative(event.timestamp)}
          </p>
        </div>
        {event.detail && (
          <p className="text-xs text-red-500 mt-0.5">{event.detail}</p>
        )}
      </div>
    </div>
  );
}

// ── Empty Box ───────────────────────────────────────────────────────────

function EmptyBox({ message, small }: { message: string; small?: boolean }) {
  return (
    <div className={`text-center ${small ? 'py-4' : 'py-8'} bg-gray-50 rounded-lg border border-dashed border-gray-200`}>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

// ── Status Dot ──────────────────────────────────────────────────────────

function StatusDot({ active }: { active: boolean }) {
  return active ? (
    <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
  ) : (
    <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Welcome Banner skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-start gap-4 flex-1">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
                <div className="flex gap-4 mt-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
            <Skeleton className="h-[100px] w-[100px] rounded-full" />
          </div>
        </CardContent>
      </Card>

      {/* Pillar cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200" />
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-6 w-28 mb-1" />
              <Skeleton className="h-3 w-36 mb-4" />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action items skeleton */}
      <Card>
        <CardHeader className="pb-4 border-b border-gray-100 bg-gray-50/40">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-100">
              <Skeleton className="h-7 w-7 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <div className="flex gap-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
