/* eslint-disable max-lines */
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

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  Phone,
  Shield,
  Heart,
  PiggyBank,
  TrendingUp,
  Scale,
  FileText,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Users,
  Calendar,
  DollarSign,
  Landmark,
  Activity,
  ClipboardCheck,
  Clock,
  UserPlus,
  FileCheck,
  ChevronDown,
  ChevronUp,
  PlayCircle,
} from 'lucide-react';
import { getClientProfileQueryOptions } from '../api';
import { Client, ProfileData } from '../types';
import {
  fmt,
  calcAge,
  fmtRelative,
  addMonths,
  isPast,
  numVal,
  sumField,
  sumInvestmentPremiums,
  sumFirstNonZero,
  sumMultiField,
  normalizePolicyData,
  extractRetirementResults,
  deriveGapAnalysis,
  derivePillars,
  deriveHealthScore,
  deriveKpiValues,
  deriveActionItems,
  deriveAssetAllocation,
  deriveInsuranceCoverageItems,
  deriveCashflowData,
  deriveActionDistribution,
  deriveEnrichedActivityEvents,
  INITIAL_ACTIVITY_COUNT,
  type Policy,
  type ActionItem,
  type ActivityEvent,
  type GapItem,
  type PillarData,
} from './clientOverviewUtils';
import { PolicyOverviewTab } from '../../../../admin/profile-sections/PolicyOverviewTab';
// Phase 1 KPI / Sub-Score imports
import { KPISummaryTable } from './overview/KPISummaryTable';
import type { KPIValue } from './overview/KPISummaryTable';
// Phase 2 Chart imports
import {
  AssetAllocationChart,
  InsuranceCoverageChart,
  CashflowWaterfallChart,
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
import { deriveHealthSubScores } from '../utils';
import type { HealthSubScores } from '../utils';

// FNA API — uses batch endpoint via React Query hook for cache control
import { useFnaBatchStatus } from '../hooks/useFnaBatchStatus';

// Centralized API client
import { api } from '../../../../../utils/api/client';

// Constants + DashboardMode extracted to clientOverviewConstants
import type { DashboardMode } from './clientOverviewConstants';
export type { DashboardMode };
import {
  CATEGORIES,
  FNA_MODULES,
  ACTIVITY_TYPE_MAP,
  CATEGORY_GROUP_MAP,
  fetchAllSchemas,
} from './clientOverviewConstants';

// Sub-components extracted to overview/
import { WelcomeBanner } from './overview/WelcomeBanner';
import { PillarCard } from './overview/PillarCard';
import { UnifiedActionItems } from './overview/ActionItems';
import { FNAStatusCard, type FNAStatusItem } from './overview/FNAStatusCard';
import { TimelineEvent, EmptyBox, StatusDot } from './overview/TimelineHelpers';
import { OverviewSkeleton } from './overview/OverviewSkeleton';
import { downloadClientOverviewPDF } from './overview/clientOverviewPdfExport';

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
  const { data: batchFnaData, refetch: refetchFna } = useFnaBatchStatus(client.id);

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
      const submittedAt = data?.submittedAt as string | undefined;
      const progressPercent =
        typeof data?.progressPercent === 'number' ? (data.progressPercent as number) : undefined;

      const reviewBase = publishedAt || updatedAt || createdAt;
      const nextReviewDue = reviewBase ? addMonths(reviewBase as string, 12) : undefined;

      const displayStatus =
        match.status === 'error' ? ('error' as const) : (match.status as FNAStatusItem['status']);

      return {
        key: m.key,
        name: m.name,
        icon: m.icon,
        status: displayStatus,
        updatedAt: (updatedAt || createdAt || submittedAt) as string | undefined,
        publishedAt: publishedAt as string | undefined,
        submittedAt,
        nextReviewDue,
        progressPercent,
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
        api
          .get<{ policies?: Policy[] }>(`/integrations/policies?clientId=${client.id}`)
          .then((data) => (data.policies || []) as Policy[])
          .catch(() => [] as Policy[]),
      ]);

      // Normalise each policy's data using its category's schema
      // and group by overview bucket (client-side filtering replaces 7 server calls)
      const byCategory: Record<string, Policy[]> = {};
      const flat: Policy[] = [];

      for (const pol of rawPolicies) {
        // Normalise field-ID keys to keyIds using the schema
        const fields = schemaMap[pol.categoryId];
        const normalised =
          fields && pol.data ? { ...pol, data: normalizePolicyData(pol.data, fields) } : pol;

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
      type ActivityLog = {
        id?: string;
        type: string;
        timestamp?: string;
        success?: boolean;
        errorMessage?: string;
        [key: string]: unknown;
      };
      const actData = await api
        .get<{ success: boolean; logs?: ActivityLog[] }>(`/security/${client.id}/activity?limit=50`)
        .catch(() => null);

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

      if (actData?.success && Array.isArray(actData.logs)) {
        actData.logs.forEach((log: ActivityLog) => {
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

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivityEvents(events);
    } catch (err) {
      console.error('Error loading activity logs for overview:', err);
      setActivityEvents([
        {
          id: 'account-created',
          type: 'signup',
          label: 'Account created',
          timestamp: client.createdAt,
          icon: UserPlus,
          iconColor: 'text-gray-500',
          success: true,
        },
      ]);
    } finally {
      setLoadingActivity(false);
    }
  }, [client.id, client.createdAt]);

  // ── Effects ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetchProfile().catch(() => {
      /* handled internally */
    });
    fetchPolicies().catch(() => {
      /* handled internally */
    });
    // FNA statuses are managed by useFnaBatchStatus (React Query) — no manual fetch needed
    fetchActivityLogs().catch(() => {
      /* handled internally */
    });
  }, [fetchProfile, fetchPolicies, fetchActivityLogs]);

  const refreshAll = useCallback(() => {
    setError(null);
    queryClient.invalidateQueries({ queryKey: getClientProfileQueryOptions(client.id).queryKey });
    fetchProfile().catch(() => {
      /* handled internally */
    });
    fetchPolicies().catch(() => {
      /* handled internally */
    });
    refetchFna(); // React Query handles cache invalidation and re-fetch
    fetchActivityLogs().catch(() => {
      /* handled internally */
    });
  }, [client.id, fetchProfile, fetchPolicies, refetchFna, fetchActivityLogs, queryClient]);

  // ── Derived data ──────────────────────────────────────────────────────

  const p = profile;

  const age = useMemo(() => calcAge(p?.dateOfBirth), [p?.dateOfBirth]);

  const riskPolicies = useMemo(() => policiesByCategory.risk || [], [policiesByCategory.risk]);
  const medicalPolicies = useMemo(
    () => policiesByCategory.medical || [],
    [policiesByCategory.medical],
  );
  const retirementPolicies = useMemo(
    () => policiesByCategory.retirement || [],
    [policiesByCategory.retirement],
  );
  const investmentPolicies = useMemo(
    () => policiesByCategory.investment || [],
    [policiesByCategory.investment],
  );
  const employeePolicies = useMemo(
    () => policiesByCategory.employee || [],
    [policiesByCategory.employee],
  );
  const estatePolicies = useMemo(
    () => policiesByCategory.estate || [],
    [policiesByCategory.estate],
  );

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
  const totalAllPremiums =
    totalRiskPremium +
    totalMedicalPremium +
    totalRetirementPremium +
    totalInvestmentPremium +
    totalEmployeePremium +
    totalEstatePremium;

  // Risk cover field IDs from keyManagerConstants.ts
  const totalLifeCover = sumField(riskPolicies, 'risk_life_cover');
  const totalSevereIllness = sumField(riskPolicies, 'risk_severe_illness');
  const totalDisability = sumField(riskPolicies, 'risk_disability');
  const totalIncomeProtection =
    sumField(riskPolicies, 'risk_temporary_icb') + sumField(riskPolicies, 'risk_permanent_icb');

  // Retirement lump sum capital: pre-retirement fund value OR post-retirement capital value
  // (sumFirstNonZero avoids double-counting when multiple value fields exist on the same policy)
  const retirementCurrentValue = sumFirstNonZero(
    retirementPolicies,
    'retirement_fund_value',
    'retirement_current_value',
    'post_retirement_capital_value',
  );
  // Investment lump sum capital: discretionary current value OR guaranteed capital
  const investmentCurrentValue = sumFirstNonZero(
    investmentPolicies,
    'invest_current_value',
    'invest_guaranteed_capital',
  );

  const totalAssets = useMemo(
    () =>
      (p?.assets || []).reduce((s: number, a: { value?: number }) => s + (Number(a.value) || 0), 0),
    [p?.assets],
  );
  const totalLiabilities = useMemo(
    () =>
      (p?.liabilities || []).reduce(
        (s: number, l: { outstandingBalance?: number }) => s + (Number(l.outstandingBalance) || 0),
        0,
      ),
    [p?.liabilities],
  );
  const totalMonthlyDebt = useMemo(
    () =>
      (p?.liabilities || []).reduce(
        (s: number, l: { monthlyPayment?: number }) => s + (Number(l.monthlyPayment) || 0),
        0,
      ),
    [p?.liabilities],
  );
  const netWorth = totalAssets - totalLiabilities;

  const premiumToIncomeRatio = grossMonthly > 0 ? (totalAllPremiums / grossMonthly) * 100 : 0;
  const retirementSavingsRate =
    grossMonthly > 0 ? (totalRetirementPremium / grossMonthly) * 100 : 0;

  const dependants = useMemo(
    () =>
      (p?.familyMembers || []).filter(
        (m: { isFinanciallyDependent?: boolean }) => m.isFinanciallyDependent,
      ),
    [p?.familyMembers],
  );

  // ── FNA summary stats ─────────────────────────────────────────────────

  const fnaPublished = fnaStatuses.filter((f) => f.status === 'published').length;
  const fnaDraft = fnaStatuses.filter((f) => f.status === 'draft').length;
  const fnaClientDraft = fnaStatuses.filter((f) => f.status === 'client_draft').length;
  const fnaSubmitted = fnaStatuses.filter((f) => f.status === 'submitted').length;
  const fnaInProgress = fnaDraft + fnaClientDraft + fnaSubmitted;
  const fnaOverdue = fnaStatuses.filter((f) => f.nextReviewDue && isPast(f.nextReviewDue)).length;

  // ── Synthesise FNA milestone events into activity timeline ────────────

  const enrichedActivityEvents = useMemo<ActivityEvent[]>(
    () =>
      deriveEnrichedActivityEvents({
        activityEvents,
        fnaStatuses,
        isClient,
        icons: { FileCheck, ClipboardCheck, FileText },
      }),
    [activityEvents, fnaStatuses, isClient],
  );

  const visibleEvents = activityExpanded
    ? enrichedActivityEvents
    : enrichedActivityEvents.slice(0, INITIAL_ACTIVITY_COUNT);

  // ── Coverage gap analysis (FNA-driven — no arbitrary figures) ─────────
  //
  // Gap items are ONLY generated when a published FNA exists for the domain.
  // Without a published FNA there is no authoritative recommendation to
  // compare against, so showing a gap would be misleading.

  const riskFnaPublished = fnaStatuses.find((f) => f.key === 'risk')?.status === 'published';
  const retirementFnaPublished =
    fnaStatuses.find((f) => f.key === 'retirement')?.status === 'published';
  const medicalFnaPublished = fnaStatuses.find((f) => f.key === 'medical')?.status === 'published';
  const investmentFnaPublished =
    fnaStatuses.find((f) => f.key === 'investment')?.status === 'published';
  const estateFnaPublished = fnaStatuses.find((f) => f.key === 'estate')?.status === 'published';

  const gapAnalysis = useMemo<GapItem[]>(
    () =>
      deriveGapAnalysis({
        fnaResultsMap,
        riskFnaPublished,
        retirementFnaPublished,
        medicalFnaPublished,
        estateFnaPublished,
        medicalPolicies,
        estatePolicies,
      }),
    [
      fnaResultsMap,
      riskFnaPublished,
      retirementFnaPublished,
      medicalFnaPublished,
      estateFnaPublished,
      medicalPolicies,
      estatePolicies,
    ],
  );

  // ── Action Items intelligence (mode-aware) ─────────────────────────────

  const actionItems = useMemo<ActionItem[]>(
    () =>
      deriveActionItems({
        fnaStatuses,
        gapAnalysis,
        allPolicies,
        grossMonthly,
        profile: p,
        dependants,
        isClient,
        icons: {
          ClipboardCheck,
          PlayCircle,
          Clock,
          FileText,
          Shield,
          AlertTriangle,
          Calendar,
          DollarSign,
          Phone,
          Users,
          Scale,
        },
      }),
    [fnaStatuses, gapAnalysis, allPolicies, grossMonthly, p, dependants, isClient],
  );

  // ── Financial Health Score ────────────────────────────────────────────

  const healthScore = useMemo<number>(
    () =>
      deriveHealthScore({
        gapAnalysis,
        fnaStatuses,
        grossMonthly,
        profile: p,
        retirementFnaPublished,
        retirementFnaResult: fnaResultsMap.retirement,
        netWorth,
      }),
    [gapAnalysis, fnaStatuses, grossMonthly, p, retirementFnaPublished, fnaResultsMap, netWorth],
  );

  const healthLabel =
    healthScore >= 75
      ? 'Strong'
      : healthScore >= 50
        ? 'Fair'
        : healthScore >= 25
          ? 'Needs Work'
          : 'Getting Started';
  const healthColor =
    healthScore >= 75
      ? 'text-green-600'
      : healthScore >= 50
        ? 'text-amber-500'
        : healthScore >= 25
          ? 'text-orange-500'
          : 'text-gray-400';
  const healthStroke =
    healthScore >= 75
      ? '#16a34a'
      : healthScore >= 50
        ? '#f59e0b'
        : healthScore >= 25
          ? '#f97316'
          : '#d1d5db';

  // ── Health Sub-Scores ─────────────────────────────────────────────────

  const retResultsForSubScore = useMemo(() => {
    if (!retirementFnaPublished) return null;
    return extractRetirementResults(fnaResultsMap.retirement);
  }, [retirementFnaPublished, fnaResultsMap]);

  const subScores = useMemo<HealthSubScores>(() => {
    const retShortfallSeverity = retResultsForSubScore
      ? !retResultsForSubScore.hasShortfall
        ? ('none' as const)
        : retResultsForSubScore.capitalShortfall < retResultsForSubScore.requiredCapital * 0.3
          ? ('minor' as const)
          : retResultsForSubScore.capitalShortfall < retResultsForSubScore.requiredCapital * 0.6
            ? ('moderate' as const)
            : ('severe' as const)
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
  }, [
    gapAnalysis,
    riskFnaPublished,
    medicalFnaPublished,
    retirementFnaPublished,
    investmentFnaPublished,
    estateFnaPublished,
    riskPolicies,
    medicalPolicies,
    retirementPolicies,
    investmentPolicies,
    estatePolicies,
    retResultsForSubScore,
  ]);

  // ── KPI Values ────────────────────────────────────────────────────────

  const kpiValues = useMemo<KPIValue[]>(
    () =>
      deriveKpiValues({
        profile: p,
        grossMonthly,
        netMonthly,
        totalMonthlyDebt,
        totalRetirementPremium,
        totalInvestmentPremium,
        riskFnaPublished,
        riskFnaResult: fnaResultsMap.risk,
        retResults: retResultsForSubScore,
        retirementSavingsRate,
        netWorth,
      }),
    [
      p,
      grossMonthly,
      netMonthly,
      totalMonthlyDebt,
      totalRetirementPremium,
      totalInvestmentPremium,
      gapAnalysis,
      riskFnaPublished,
      fnaResultsMap,
      retResultsForSubScore,
      retirementSavingsRate,
      netWorth,
    ],
  );

  // ── Phase 2: Chart Data ───────────────────────────────────────────────

  const assetAllocationData = useMemo<AssetAllocationData>(
    () => deriveAssetAllocation({ profile: p, retirementCurrentValue, investmentCurrentValue }),
    [p?.assets, retirementCurrentValue, investmentCurrentValue],
  );

  const insuranceCoverageItems = useMemo<InsuranceCoverageItem[]>(
    () => deriveInsuranceCoverageItems({ riskFnaPublished, riskFnaResult: fnaResultsMap.risk }),
    [riskFnaPublished, fnaResultsMap],
  );

  const cashflowData = useMemo<CashflowWaterfallData>(
    () =>
      deriveCashflowData({
        grossMonthly,
        netMonthly,
        totalRiskPremium,
        totalMedicalPremium,
        totalRetirementPremium,
        totalInvestmentPremium,
        totalEmployeePremium,
        totalMonthlyDebt,
      }),
    [
      grossMonthly,
      netMonthly,
      totalRiskPremium,
      totalMedicalPremium,
      totalRetirementPremium,
      totalInvestmentPremium,
      totalEmployeePremium,
      totalMonthlyDebt,
    ],
  );

  const actionDistribution = useMemo<ActionDistribution>(
    () => deriveActionDistribution(actionItems),
    [actionItems],
  );

  // ── Phase 3: Documents Checklist ──────────────────────────────────────

  const documentChecklist = useMemo<DocumentItem[]>(() => {
    const policyCategoriesWithDocs = CATEGORIES.filter(
      (cat) => (policiesByCategory[cat.id] || []).length > 0,
    ).map((cat) => cat.categoryId);

    const publishedFnaModules = fnaStatuses
      .filter((f) => f.status === 'published')
      .map((f) => f.key);

    return deriveDocumentChecklist({
      hasIdNumber: !!(client.idNumber || p?.idNumber),
      hasAddress: !!p?.residentialAddressLine1,
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
      sumField: (pols, keyId) =>
        pols.reduce((s, pol) => s + numVal(pol as unknown as Policy, keyId), 0),
      dependantCount: dependants.length,
    });
  }, [
    riskPolicies,
    medicalPolicies,
    retirementPolicies,
    investmentPolicies,
    employeePolicies,
    estatePolicies,
    dependants,
  ]);

  // ── Pillar Card Data (5 strategic pillars: Has vs Needs) ────────────────
  //
  // Each pillar compares what the client HAS (from policies) against what
  // they NEED (from published FNA). When no FNA is published, the card
  // still renders useful policy-level data with a "No FNA" fallback.

  const pillars = useMemo<PillarData[]>(
    () =>
      derivePillars({
        gapAnalysis,
        fnaStatuses,
        fnaResultsMap,
        riskFnaPublished,
        medicalFnaPublished,
        retirementFnaPublished,
        riskPolicies,
        medicalPolicies,
        retirementPolicies,
        investmentPolicies,
        estatePolicies,
        totalLifeCover,
        totalDisability,
        totalSevereIllness,
        totalIncomeProtection,
        totalRiskPremium,
        totalMedicalPremium,
        retirementCurrentValue,
        totalRetirementPremium,
        investmentCurrentValue,
        totalInvestmentPremium,
        grossMonthly,
        retirementSavingsRate,
        dependants,
        taxNumber: p?.taxNumber,
        icons: {
          risk: Shield,
          medical: Heart,
          retirement: PiggyBank,
          investment: TrendingUp,
          estate: Landmark,
        },
      }),
    [
      gapAnalysis,
      fnaStatuses,
      fnaResultsMap,
      totalLifeCover,
      totalDisability,
      totalSevereIllness,
      totalIncomeProtection,
      totalRiskPremium,
      riskPolicies,
      riskFnaPublished,
      medicalPolicies,
      totalMedicalPremium,
      dependants,
      medicalFnaPublished,
      retirementCurrentValue,
      totalRetirementPremium,
      retirementPolicies,
      grossMonthly,
      retirementSavingsRate,
      retirementFnaPublished,
      investmentCurrentValue,
      totalInvestmentPremium,
      investmentPolicies,
      estatePolicies,
      p?.taxNumber,
    ],
  );

  // ── Phase 4: PDF report generation ────────────────────────────────────

  const handleDownloadPDF = useCallback(async () => {
    setGeneratingPDF(true);
    try {
      await downloadClientOverviewPDF({
        client,
        profile: p,
        age,
        allPolicies,
        categories: CATEGORIES,
        gapAnalysis,
        fnaStatuses,
        actionItems,
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
        healthScore,
        subScores,
        kpiValues,
        cashflowData,
        insuranceCoverageItems,
        assetAllocationData,
        categoryKPIs,
        documentChecklist,
      });
    } catch (err) {
      console.error('Error generating PDF report:', err);
      setError('Unable to generate PDF report. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  }, [
    client,
    p,
    age,
    allPolicies,
    gapAnalysis,
    fnaStatuses,
    actionItems,
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
    healthScore,
    subScores,
    kpiValues,
    cashflowData,
    insuranceCoverageItems,
    assetAllocationData,
    categoryKPIs,
    documentChecklist,
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
        <AccordionItem
          value="kpi-charts"
          className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
        >
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <Activity className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {isClient ? 'My Financial Health Details' : 'Financial Health & Charts'}
              </span>
              <span className="text-xs text-gray-400 ml-auto mr-2 hidden sm:inline truncate">
                {isClient
                  ? 'Detailed breakdown of your financial health'
                  : 'Health indicators, asset allocation, cashflow & coverage'}
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
                      Emergency Fund = liquid assets (savings, cash, deposits from balance sheet) ÷
                      estimated monthly expenses. Asset Allocation = profile balance sheet assets +
                      retirement/investment policy values. Insurance Coverage = published Risk
                      Planning FNA finalNeeds (existing vs recommended). Cashflow = income, premiums
                      &amp; debt from profile + policies.
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
        <AccordionItem
          value="policies"
          className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
        >
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <FileText className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {isClient ? 'My Policies' : 'Portfolio Summary'}
              </span>
              {allPolicies.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                  {allPolicies.length}
                </Badge>
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
                <EmptyBox
                  message={
                    isClient
                      ? 'No policies on record yet. Speak to your adviser to get started.'
                      : 'No policies on record. Add policies via the Policy Details tab.'
                  }
                />
              ) : (
                <PolicyOverviewTab
                  clientId={client.id}
                  clientDisplayName={
                    [client.firstName, client.lastName].filter(Boolean).join(' ').trim() ||
                    undefined
                  }
                  variant="embedded"
                />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Net Worth & Balance Sheet ───────────────────────────────── */}
        <AccordionItem
          value="net-worth"
          className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
        >
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <Scale className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {isClient ? 'My Net Worth' : 'Net Worth & Balance Sheet'}
              </span>
              <span className="text-xs text-gray-400 ml-auto mr-2 hidden sm:inline truncate">
                {fmt(totalAssets)} assets · {fmt(totalLiabilities)} liabilities · {fmt(netWorth)}{' '}
                net
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <div className="px-5 py-4 space-y-5">
              {/* Summary bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Total Assets
                  </p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{fmt(totalAssets)}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Total Liabilities
                  </p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{fmt(totalLiabilities)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-600">
                    Net Worth
                  </p>
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
                      {(p?.assets || []).map(
                        (a: {
                          id: string;
                          name?: string;
                          type?: string;
                          description?: string;
                          value?: number;
                        }) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {a.name || a.type}
                              </p>
                              {a.description && (
                                <p className="text-xs text-gray-500">{a.description}</p>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {fmt(a.value)}
                            </span>
                          </div>
                        ),
                      )}
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
                      {(p?.liabilities || []).map(
                        (l: {
                          id: string;
                          name?: string;
                          type?: string;
                          outstandingBalance?: number;
                          monthlyPayment?: number;
                          interestRate?: number;
                        }) => (
                          <div
                            key={l.id}
                            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {l.name || l.type}
                              </p>
                              {(l.monthlyPayment || 0) > 0 && (
                                <p className="text-xs text-gray-500">
                                  {fmt(l.monthlyPayment)}/m
                                  {(l.interestRate || 0) > 0
                                    ? ` · ${l.interestRate}% interest`
                                    : ''}
                                </p>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {fmt(l.outstandingBalance)}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>

              {totalMonthlyDebt > 0 && (
                <div className="contents">
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between px-3">
                    <p className="text-sm text-gray-500">Total monthly debt obligations</p>
                    <span className="text-sm font-semibold text-gray-700">
                      {fmt(totalMonthlyDebt)}/m
                    </span>
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
                  liabilityBreakdown={(p?.liabilities || []).map(
                    (l: { type?: string; outstandingBalance?: number }) => ({
                      type: l.type || 'Other',
                      balance: Number(l.outstandingBalance) || 0,
                    }),
                  )}
                  mode={mode}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Financial Reviews ───────────────────────────────────────── */}
        {!isClient && (
          <AccordionItem
            value="reviews"
            className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
          >
            <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                  <ClipboardCheck className="h-4 w-4 text-gray-500" />
                </div>
                <span className="text-sm font-semibold text-gray-800">
                  {isClient ? 'My Financial Reviews' : 'Financial Reviews'}
                </span>
                {fnaOverdue > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs px-1.5 py-0 h-5 border-red-200 text-red-600 bg-red-50"
                  >
                    {fnaOverdue} {isClient ? 'due' : 'overdue'}
                  </Badge>
                )}
                <span className="text-xs text-gray-400 ml-auto mr-2 hidden sm:inline truncate">
                  {fnaPublished > 0 && `${fnaPublished} published`}
                  {fnaPublished > 0 && fnaInProgress > 0 && ' · '}
                  {fnaInProgress > 0 &&
                    `${fnaInProgress} ${isClient ? 'in progress' : 'in progress'}`}
                  {fnaPublished === 0 &&
                    fnaInProgress === 0 &&
                    (isClient ? 'Start a financial discovery' : 'No reviews conducted')}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-0">
              <div className="px-5 py-4">
                <div className="flex items-center gap-4 mb-5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-600">
                      {fnaPublished} {isClient ? 'Complete' : 'Published'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="text-sm text-gray-600">
                      {fnaInProgress} {isClient ? 'In Progress' : 'In Progress'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                    <span className="text-sm text-gray-600">
                      {FNA_MODULES.length - fnaPublished - fnaInProgress} Not Started
                    </span>
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
        )}

        {/* ─── Documents & Compliance ─────────────────────────────────── */}
        <AccordionItem
          value="documents"
          className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
        >
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <FileCheck className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {isClient ? 'My Documents' : 'Documents & Compliance'}
              </span>
              {(() => {
                const applicable = documentChecklist.filter((d) => d.status !== 'not-applicable');
                const available = applicable.filter((d) => d.status === 'available').length;
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
        <AccordionItem
          value="dependants"
          className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
        >
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <Users className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {isClient ? 'My Family' : 'Dependants & Family'}
              </span>
              {(p?.familyMembers || []).length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                  {(p?.familyMembers || []).length}
                </Badge>
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
                <EmptyBox
                  message={
                    isClient
                      ? 'No family members on file. Contact your adviser to update your records.'
                      : 'No family members recorded. Add dependants in the Personal Details tab.'
                  }
                />
              ) : (
                <div className="overflow-x-auto -mx-5">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80">
                        <TableHead className="text-xs font-semibold text-gray-600 pl-5">
                          Name
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600">
                          Relationship
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600">Age</TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600 text-center hidden sm:table-cell">
                          Financially Dependent
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-gray-600 text-center pr-5 hidden sm:table-cell">
                          Estate Planning
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(p?.familyMembers || []).map(
                        (m: {
                          id: string;
                          fullName: string;
                          relationship?: string;
                          dateOfBirth?: string;
                          isFinanciallyDependent?: boolean;
                          isIncludedInEstatePlanning?: boolean;
                        }) => {
                          const memberAge = calcAge(m.dateOfBirth);
                          return (
                            <TableRow key={m.id} className="hover:bg-gray-50/50">
                              <TableCell className="text-xs text-gray-900 font-medium pl-5">
                                {m.fullName}
                              </TableCell>
                              <TableCell className="text-xs text-gray-600">
                                {m.relationship || '-'}
                              </TableCell>
                              <TableCell className="text-xs text-gray-600">
                                {memberAge !== null ? `${memberAge} yrs` : '-'}
                              </TableCell>
                              <TableCell className="text-center hidden sm:table-cell">
                                <StatusDot active={!!m.isFinanciallyDependent} />
                              </TableCell>
                              <TableCell className="text-center pr-5 hidden sm:table-cell">
                                <StatusDot active={!!m.isIncludedInEstatePlanning} />
                              </TableCell>
                            </TableRow>
                          );
                        },
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
              {dependants.length > 0 && (
                <p className="text-sm text-gray-500 mt-3 px-1">
                  {dependants.length} financially dependent{' '}
                  {dependants.length === 1 ? 'member' : 'members'} —
                  {isClient
                    ? ' this is factored into your life cover and income protection needs.'
                    : ' this impacts life cover and income protection recommendations.'}
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── 8. Recent Activity ─────────────────────────────────────── */}
        <AccordionItem
          value="activity"
          className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm last:border-b last:border-b-gray-200"
        >
          <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-gray-50/60 bg-gray-50/40 data-[state=open]:border-b data-[state=open]:border-gray-100">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 flex-shrink-0">
                <Clock className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {isClient ? 'My Activity' : 'Recent Activity'}
              </span>
              {enrichedActivityEvents.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                  {enrichedActivityEvents.length}
                </Badge>
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
                        <TimelineEvent
                          key={evt.id}
                          event={evt}
                          isLast={idx === visibleEvents.length - 1}
                        />
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
                          <div className="contents">
                            <ChevronUp className="h-3.5 w-3.5 mr-1" /> Show less
                          </div>
                        ) : (
                          <div className="contents">
                            <ChevronDown className="h-3.5 w-3.5 mr-1" /> Show all{' '}
                            {enrichedActivityEvents.length} events
                          </div>
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
            : "This report is generated from Navigate Wealth's client management system and is intended for advisory purposes only. The information contained herein is based on data captured as at the date of generation and should be independently verified. Navigate Wealth is a licensed Financial Services Provider."}
        </p>
      </div>
    </div>
  );
}
