/**
 * clientOverviewPdfExport.ts
 *
 * PDF report generation logic for the Client Overview Tab.
 * Extracted from ClientOverviewTab.tsx handleDownloadPDF callback.
 */

import { api } from '../../../../../../utils/api/client';
import { createClient as createSupabaseClient } from '../../../../../../utils/supabase/client';
import { publicAnonKey, supabaseUrl } from '../../../../../../utils/supabase/info';
import { addressLine } from '../clientOverview/format';
import { numVal } from '../clientOverview/policyFields';
import type { ActionItem } from '../clientOverview/actionItems';
import type { GapItem } from '../clientOverview/gapAnalysis';
import type { Policy } from '../clientOverview/policyFields';
import type { Client, ProfileData } from '../../types';
import type { HealthSubScores } from '../../utils';
import type { KPIValue } from './KPISummaryTable';
import type {
  InsuranceCoverageItem,
  CashflowWaterfallData,
  AssetAllocationData,
} from './OverviewCharts';
import type { CategoryKPI } from './CategoryPolicyKPIs';
import type { DocumentItem } from './DocumentsChecklist';
import type { FNAStatusItem } from './FNAStatusCard';
import type { CategoryDef } from '../clientOverviewConstants';

// ── PDF export function ──────────────────────────────────────────────────

export async function downloadClientOverviewPDF(params: {
  client: Client;
  profile: ProfileData | null;
  age: number | null;
  allPolicies: Policy[];
  categories: CategoryDef[];
  gapAnalysis: GapItem[];
  fnaStatuses: FNAStatusItem[];
  actionItems: ActionItem[];
  grossMonthly: number;
  grossAnnual: number;
  netMonthly: number;
  totalAllPremiums: number;
  totalLifeCover: number;
  totalSevereIllness: number;
  totalDisability: number;
  retirementCurrentValue: number;
  investmentCurrentValue: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  premiumToIncomeRatio: number;
  retirementSavingsRate: number;
  totalMonthlyDebt: number;
  healthScore: number;
  subScores: HealthSubScores;
  kpiValues: KPIValue[];
  cashflowData: CashflowWaterfallData;
  insuranceCoverageItems: InsuranceCoverageItem[];
  assetAllocationData: AssetAllocationData;
  categoryKPIs: CategoryKPI[];
  documentChecklist: DocumentItem[];
}): Promise<void> {
  const {
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
  } = params;

  const policySummary = allPolicies.map((pol) => {
    const cat = CATEGORIES.find((c) => c.categoryId === pol.categoryId);
    return {
      category: cat?.label || pol.categoryId,
      provider: pol.providerName,
      premium:
        numVal(pol, 'risk_monthly_premium') ||
        numVal(pol, 'medical_aid_monthly_premium') ||
        numVal(pol, 'retirement_monthly_contribution') ||
        numVal(pol, 'invest_monthly_contribution') ||
        numVal(pol, 'eb_risk_monthly_premium') ||
        numVal(pol, 'eb_monthly_premium') ||
        numVal(pol, 'estate_annual_fee'),
      coverAmount:
        numVal(pol, 'risk_life_cover') ||
        numVal(pol, 'risk_severe_illness') ||
        numVal(pol, 'risk_disability'),
      currentValue:
        numVal(pol, 'retirement_fund_value') ||
        numVal(pol, 'retirement_current_value') ||
        numVal(pol, 'post_retirement_capital_value') ||
        numVal(pol, 'invest_current_value') ||
        numVal(pol, 'invest_guaranteed_capital'),
    };
  });

  const assets = (p?.assets || []).map(
    (a: { description?: string; assetType?: string; value?: unknown }) => ({
      description: a.description || a.assetType || 'Unnamed asset',
      value: Number(a.value) || 0,
    }),
  );

  const liabilities = (p?.liabilities || []).map(
    (l: {
      description?: string;
      liabilityType?: string;
      outstandingBalance?: unknown;
      monthlyPayment?: unknown;
    }) => ({
      description: l.description || l.liabilityType || 'Unnamed liability',
      outstandingBalance: Number(l.outstandingBalance) || 0,
      monthlyPayment: Number(l.monthlyPayment) || 0,
    }),
  );

  const depList = (p?.familyMembers || []).map(
    (m: {
      firstName?: string;
      lastName?: string;
      name?: string;
      relationship?: string;
      dateOfBirth?: string;
      isFinanciallyDependent?: boolean;
    }) => ({
      name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.name || 'Unnamed',
      relationship: m.relationship,
      dateOfBirth: m.dateOfBirth,
      isFinanciallyDependent: !!m.isFinanciallyDependent,
    }),
  );

  const reportData: Record<string, unknown> = {
    client: {
      firstName: client.firstName,
      lastName: client.lastName,
      preferredName: client.preferredName,
      email: client.email,
      applicationNumber: client.applicationNumber,
      applicationStatus: client.applicationStatus || 'unknown',
      createdAt: client.createdAt,
    },
    profile: p
      ? {
          title: p.title,
          firstName: p.firstName,
          middleName: p.middleName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth,
          age,
          gender: p.gender,
          maskedIdNumber: client.idNumber
            ? `${client.idNumber.slice(0, 6)}****${client.idNumber.slice(-2)}`
            : undefined,
          taxNumber: p.taxNumber,
          nationality: p.nationality,
          maritalStatus: p.maritalStatus,
          maritalRegime: p.maritalRegime,
          smokerStatus: p.smokerStatus,
          email: p.email || client.email,
          phone: p.phoneNumber,
          address: addressLine(p),
          employmentStatus: p.employmentStatus,
          employer: (p.employers || [])[0]?.employerName || p.selfEmployedCompanyName || undefined,
          position: (p.employers || [])[0]?.jobTitle || undefined,
          industry: (p.employers || [])[0]?.industry || p.selfEmployedIndustry || undefined,
          riskProfile: p.riskAssessment?.riskCategory
            ? `${p.riskAssessment.riskCategory} (Score: ${p.riskAssessment.totalScore}/50)`
            : undefined,
        }
      : null,
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
    gapAnalysis: gapAnalysis.map((g) => ({
      label: g.label,
      status: g.status,
      current: g.current,
      recommended: g.recommended,
      detail: g.detail,
    })),
    fnaStatuses: fnaStatuses.map((f) => ({
      name: f.name,
      status: f.status,
      updatedAt: f.updatedAt,
      publishedAt: f.publishedAt,
      nextReviewDue: f.nextReviewDue,
    })),
    actionItems: actionItems.map((a) => ({
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
    kpiSummary: kpiValues.map((k) => ({
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
    insuranceCoverage: insuranceCoverageItems.map((item) => ({
      label: item.label,
      existing: item.existing,
      recommended: item.recommended,
    })),
    assetAllocation: assetAllocationData.assets
      .filter((a) => (Number(a.value) || 0) > 0)
      .map((a) => ({ type: a.type || 'Other', value: Number(a.value) || 0 })),
    categoryKPIs: categoryKPIs.map((c) => ({
      label: c.label,
      policyCount: c.policyCount,
      monthlyPremium: c.monthlyPremium,
      headlineValue: c.headlineValue,
      headlineLabel: c.headlineLabel,
    })),
    documentsChecklist: {
      total: documentChecklist.filter((d) => d.status !== 'not-applicable').length,
      available: documentChecklist.filter((d) => d.status === 'available').length,
      missing: documentChecklist.filter((d) => d.status === 'missing').length,
      items: documentChecklist.map((d) => ({
        label: d.label,
        category: d.category,
        status: d.status,
      })),
    },
    generatedAt: new Date().toISOString(),
  };

  // Phase 4: Fetch net worth snapshots for PDF inclusion
  try {
    type NetWorthSnapshot = {
      date: string;
      totalAssets: number;
      totalLiabilities: number;
      netWorth: number;
    };
    const snapData = await api.get<{
      success: boolean;
      snapshots?: NetWorthSnapshot[];
    }>(`/net-worth-snapshots/${client.id}`);

    if (snapData.success && Array.isArray(snapData.snapshots) && snapData.snapshots.length > 0) {
      reportData.netWorthHistory = snapData.snapshots.map((s: NetWorthSnapshot) => ({
        date: s.date,
        totalAssets: s.totalAssets,
        totalLiabilities: s.totalLiabilities,
        netWorth: s.netWorth,
      }));
    }
  } catch {
    // Non-critical — PDF generates without history if fetch fails
  }

  // PDF endpoint returns a blob (application/pdf), not JSON.
  // api.post returns the raw Response object for non-JSON content types.
  // We need to get the auth token manually for the raw fetch.
  const supabase = createSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authToken = session?.access_token || publicAnonKey;

  // Use raw fetch for the PDF endpoint because the response is a binary blob.
  // The api client handles non-JSON by returning the raw Response object anyway,
  // but we need the blob directly. We build the URL from supabaseUrl (same source
  // as api client's private baseURL).
  const pdfApiBase = `${supabaseUrl}/functions/v1/make-server-91ed8379`;
  const res = await fetch(`${pdfApiBase}/reporting/client-overview-pdf`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reportData),
  });

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
}
