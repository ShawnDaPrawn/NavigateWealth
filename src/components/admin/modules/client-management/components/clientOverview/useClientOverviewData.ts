/**
 * Everything the client overview knows, separated from how it looks.
 *
 * `ClientOverviewTab.tsx` was 1,615 lines and carried a file-level `max-lines`
 * suppression at the top to keep the linter quiet about it. Roughly eight
 * hundred of those lines were fetching and derivation: profile and policies,
 * the activity log, five pillars, a health score and its sub-scores, gap
 * analysis, action items, KPI rows, three chart datasets, a document checklist
 * and the PDF export.
 *
 * Eighty-nine values were computed in that block and only forty-three ever
 * reached the markup. The rest were intermediates — per-category policy lists,
 * running premium totals, FNA publication flags — that had no business being
 * visible to a render function. Moving the block here makes that split real:
 * what this hook returns is the overview's view model, and the other forty-six
 * values are now private to it.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DashboardMode } from '../clientOverviewConstants';
import { useQueryClient } from '@tanstack/react-query';
import {
  Phone,
  Shield,
  Heart,
  PiggyBank,
  TrendingUp,
  Scale,
  FileText,
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
  PlayCircle,
} from 'lucide-react';
import { getClientProfileQueryOptions } from '../../api';
import type { Client } from '../../types';
import { ProfileData } from '../../types';
import {
  type ActionItem,
  deriveActionDistribution,
  deriveActionItems,
} from '../clientOverview/actionItems';
import {
  type ActivityEvent,
  INITIAL_ACTIVITY_COUNT,
  deriveEnrichedActivityEvents,
} from '../clientOverview/activity';
import {
  deriveAssetAllocation,
  deriveCashflowData,
  deriveInsuranceCoverageItems,
} from '../clientOverview/charts';
import { extractRetirementResults } from '../clientOverview/fnaExtract';
import { addMonths, calcAge, isPast } from '../clientOverview/format';
import { type GapItem, deriveGapAnalysis } from '../clientOverview/gapAnalysis';
import { deriveHealthScore } from '../clientOverview/healthScore';
import { deriveKpiValues } from '../clientOverview/kpiValues';
import { type PillarData, derivePillars } from '../clientOverview/pillars';
import {
  type Policy,
  normalizePolicyData,
  numVal,
  sumField,
  sumFirstNonZero,
  sumInvestmentPremiums,
  sumMultiField,
} from '../clientOverview/policyFields';
import type { KPIValue } from '../overview/KPISummaryTable';
import type {
  AssetAllocationData,
  InsuranceCoverageItem,
  CashflowWaterfallData,
  ActionDistribution,
} from '../overview/OverviewCharts';
import { deriveDocumentChecklist } from '../overview/DocumentsChecklist';
import type { DocumentItem } from '../overview/DocumentsChecklist';
import { deriveCategoryKPIs } from '../overview/CategoryPolicyKPIs';
import type { CategoryKPI } from '../overview/CategoryPolicyKPIs';
import { deriveHealthSubScores } from '../../utils';
import type { HealthSubScores } from '../../utils';
import { useFnaBatchStatus } from '../../hooks/useFnaBatchStatus';
import { api } from '../../../../../../utils/api/client';
import {
  CATEGORIES,
  FNA_MODULES,
  ACTIVITY_TYPE_MAP,
  CATEGORY_GROUP_MAP,
  fetchAllSchemas,
} from '../clientOverviewConstants';
import { type FNAStatusItem } from '../overview/FNAStatusCard';
import { downloadClientOverviewPDF } from '../overview/clientOverviewPdfExport';

export function useClientOverviewData(client: Client, mode: DashboardMode = 'adviser') {
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

  return {
    actionDistribution,
    actionItems,
    activityExpanded,
    age,
    allPolicies,
    assetAllocationData,
    cashflowData,
    categoryKPIs,
    dependants,
    documentChecklist,
    enrichedActivityEvents,
    error,
    fnaInProgress,
    fnaOverdue,
    fnaPublished,
    fnaStatuses,
    generatingPDF,
    grossMonthly,
    handleDownloadPDF,
    healthColor,
    healthLabel,
    healthScore,
    healthStroke,
    insuranceCoverageItems,
    investmentCurrentValue,
    kpiValues,
    loadingActivity,
    loadingPolicies,
    loadingProfile,
    netWorth,
    p,
    pillars,
    premiumToIncomeRatio,
    profile,
    refreshAll,
    retirementCurrentValue,
    setActivityExpanded,
    subScores,
    totalAllPremiums,
    totalAssets,
    totalLiabilities,
    totalMonthlyDebt,
    visibleEvents,
  };
}
