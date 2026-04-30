import { Client, ClientFilters } from './types';
import { CONFIG, PERSONNEL_ROLES } from './constants';
import type { HealthSubCategory, KPIStatus } from './constants';

function normalizeClientStatus(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function isRejectedClient(client: Client): boolean {
  const statuses = [
    client.applicationStatus,
    client.accountStatus,
    client.profile?.applicationStatus as string | undefined,
  ];

  return statuses.some((status) => {
    const normalized = normalizeClientStatus(status);
    return normalized === 'declined' || normalized === 'rejected';
  });
}

// ── Financial KPI Calculations (§7.1 — pure utility functions) ───────────

/**
 * Debt-to-Income ratio.
 * DTI = (total monthly debt payments) ÷ (gross monthly income) × 100
 * Spec §9: healthy target < 36%.
 */
export function calcDTI(totalMonthlyDebt: number, grossMonthlyIncome: number): number | null {
  if (grossMonthlyIncome <= 0) return null;
  return (totalMonthlyDebt / grossMonthlyIncome) * 100;
}

/**
 * Derive KPI status for DTI.
 * < 36% = good, 36–50% = caution, > 50% = gap.
 */
export function deriveDTIStatus(dti: number | null): KPIStatus {
  if (dti === null) return 'no-data';
  if (dti < 36) return 'good';
  if (dti <= 50) return 'caution';
  return 'gap';
}

/**
 * Emergency fund in months.
 * Months = liquid savings ÷ estimated monthly expenses.
 * Liquid assets are identified by type keyword matching.
 */
const LIQUID_ASSET_TYPES = new Set([
  'savings', 'money_market', 'cash', 'bank', 'deposit',
  'emergency', 'money market', 'savings account', 'call deposit',
]);

export function calcEmergencyFundMonths(
  assets: Array<{ type?: string; value?: number }>,
  monthlyExpenses: number,
): number | null {
  if (monthlyExpenses <= 0) return null;
  const liquidTotal = assets.reduce((sum, a) => {
    const typeLower = (a.type || '').toLowerCase();
    const isLiquid = [...LIQUID_ASSET_TYPES].some(kw => typeLower.includes(kw));
    return sum + (isLiquid ? (Number(a.value) || 0) : 0);
  }, 0);
  if (liquidTotal === 0) return 0;
  return liquidTotal / monthlyExpenses;
}

/**
 * Derive KPI status for emergency fund.
 * >= 6 months = good, 3–6 months = caution, < 3 months = gap.
 */
export function deriveEmergencyFundStatus(months: number | null): KPIStatus {
  if (months === null) return 'no-data';
  if (months >= 6) return 'good';
  if (months >= 3) return 'caution';
  return 'gap';
}

/**
 * Insurance coverage ratio (existing ÷ recommended × 100).
 * Returns null if no FNA recommendation exists.
 */
export function calcInsuranceCoverageRatio(
  existingCover: number,
  recommendedCover: number,
): number | null {
  if (recommendedCover <= 0) return null;
  return (existingCover / recommendedCover) * 100;
}

/**
 * Derive KPI status for insurance coverage.
 * >= 100% = good, 80–100% = caution, < 80% = gap.
 */
export function deriveInsuranceCoverageStatus(ratio: number | null): KPIStatus {
  if (ratio === null) return 'no-data';
  if (ratio >= 100) return 'good';
  if (ratio >= 80) return 'caution';
  return 'gap';
}

/**
 * Retirement progress ratio (projected ÷ required × 100).
 */
export function calcRetirementProgress(
  projectedCapital: number,
  requiredCapital: number,
): number | null {
  if (requiredCapital <= 0) return null;
  return (projectedCapital / requiredCapital) * 100;
}

/**
 * Derive KPI status for retirement progress.
 * >= 90% = good, 60–90% = caution, < 60% = gap.
 */
export function deriveRetirementProgressStatus(progress: number | null): KPIStatus {
  if (progress === null) return 'no-data';
  if (progress >= 90) return 'good';
  if (progress >= 60) return 'caution';
  return 'gap';
}

/**
 * Derive KPI status for savings rate.
 * >= 15% = good, 10–15% = caution, < 10% = gap.
 */
export function deriveSavingsRateStatus(rate: number): KPIStatus {
  if (rate <= 0) return 'no-data';
  if (rate >= 15) return 'good';
  if (rate >= 10) return 'caution';
  return 'gap';
}

/**
 * Derive KPI status for net worth.
 * Positive = good, zero = caution, negative = gap.
 */
export function deriveNetWorthStatus(netWorth: number, hasData: boolean): KPIStatus {
  if (!hasData) return 'no-data';
  if (netWorth > 0) return 'good';
  if (netWorth === 0) return 'caution';
  return 'gap';
}

// ── Health Sub-Scores ─────────────────────────────────────────────────────

/** Input data for health sub-score computation */
export interface HealthSubScoreInputs {
  /** Gap analysis results — status per gap item */
  gapStatuses: Array<{ label: string; status: 'good' | 'caution' | 'gap' | 'none' }>;
  /** Per-pillar FNA status */
  riskFnaPublished: boolean;
  medicalFnaPublished: boolean;
  retirementFnaPublished: boolean;
  investmentFnaPublished: boolean;
  estateFnaPublished: boolean;
  /** Whether the client has policies in each pillar (fallback when no FNA) */
  hasRiskPolicies: boolean;
  hasMedicalPolicies: boolean;
  hasRetirementPolicies: boolean;
  hasInvestmentPolicies: boolean;
  hasEstatePolicies: boolean;
  /** Retirement FNA data (only when published) */
  retirementHasShortfall: boolean | null;
  retirementShortfallSeverity: 'none' | 'minor' | 'moderate' | 'severe' | null;
}

/** Computed sub-scores (each 0–100) with data-availability flags */
export interface HealthSubScores {
  risk: number;
  medicalAid: number;
  retirement: number;
  investments: number;
  estatePlanning: number;
  overall: number;
  /** Whether each sub-score has underlying data (vs "no data available") */
  hasData: {
    risk: boolean;
    medicalAid: boolean;
    retirement: boolean;
    investments: boolean;
    estatePlanning: boolean;
  };
}

/**
 * Derive health sub-scores — pure function (§7.1).
 *
 * Maps to the 5 strategic pillars displayed as Pillar Cards:
 *   - Risk: gap analysis (risk cover adequacy)
 *   - Medical Aid: medical FNA status + policy coverage
 *   - Retirement: retirement savings adequacy (shortfall analysis)
 *   - Investments: investment FNA status + policy coverage
 *   - Estate Planning: estate FNA status + policy coverage
 */
export function deriveHealthSubScores(inputs: HealthSubScoreInputs): HealthSubScores {
  // ── Risk (from gap analysis) ────────────────────────────────────────
  let riskScore = 0;
  const riskGaps = inputs.gapStatuses.filter(g => g.status !== 'none');
  const hasRiskData = riskGaps.length > 0 || inputs.hasRiskPolicies;
  if (riskGaps.length > 0) {
    const pointsPer = 100 / riskGaps.length;
    riskGaps.forEach(gap => {
      if (gap.status === 'good') riskScore += pointsPer;
      else if (gap.status === 'caution') riskScore += pointsPer * 0.5;
    });
    riskScore = Math.round(riskScore);
  } else if (inputs.hasRiskPolicies) {
    // Has policies but no FNA — partial credit
    riskScore = 30;
  }

  // ── Medical Aid (FNA status + policy presence) ──────────────────────
  let medicalAidScore = 0;
  const hasMedicalData = inputs.medicalFnaPublished || inputs.hasMedicalPolicies;
  if (inputs.medicalFnaPublished) {
    medicalAidScore = 100; // Published FNA = fully assessed
  } else if (inputs.hasMedicalPolicies) {
    medicalAidScore = 40; // Has cover but no FNA assessment
  }

  // ── Retirement (FNA-driven shortfall analysis) ──────────────────────
  let retirementScore = 0;
  const hasRetirementData = inputs.retirementFnaPublished || inputs.hasRetirementPolicies;
  if (inputs.retirementFnaPublished && inputs.retirementHasShortfall !== null) {
    if (!inputs.retirementHasShortfall) {
      retirementScore = 100;
    } else {
      switch (inputs.retirementShortfallSeverity) {
        case 'minor': retirementScore = 67; break;
        case 'moderate': retirementScore = 33; break;
        case 'severe': retirementScore = 10; break;
        default: retirementScore = 33;
      }
    }
  } else if (inputs.hasRetirementPolicies) {
    retirementScore = 30; // Has policies but no FNA
  }

  // ── Investments (FNA status + policy presence) ──────────────────────
  let investmentsScore = 0;
  const hasInvestmentData = inputs.investmentFnaPublished || inputs.hasInvestmentPolicies;
  if (inputs.investmentFnaPublished) {
    investmentsScore = 100; // Published INA = fully assessed
  } else if (inputs.hasInvestmentPolicies) {
    investmentsScore = 40; // Has investments but no INA assessment
  }

  // ── Estate Planning (FNA status + policy presence) ──────────────────
  let estateScore = 0;
  const hasEstateData = inputs.estateFnaPublished || inputs.hasEstatePolicies;
  if (inputs.estateFnaPublished) {
    estateScore = 100; // Published FNA = fully assessed
  } else if (inputs.hasEstatePolicies) {
    estateScore = 40; // Has policies but no FNA assessment
  }

  // ── Overall (weighted average of active sub-scores) ─────────────────
  // Only include sub-scores that have data. This prevents penalising
  // clients who simply haven't had an FNA yet.
  const activePillars: number[] = [];
  if (hasRiskData) activePillars.push(riskScore);
  if (hasMedicalData) activePillars.push(medicalAidScore);
  if (hasRetirementData) activePillars.push(retirementScore);
  if (hasInvestmentData) activePillars.push(investmentsScore);
  if (hasEstateData) activePillars.push(estateScore);

  const overall = activePillars.length > 0
    ? Math.round(activePillars.reduce((a, b) => a + b, 0) / activePillars.length)
    : 0;

  return {
    risk: riskScore,
    medicalAid: medicalAidScore,
    retirement: retirementScore,
    investments: investmentsScore,
    estatePlanning: estateScore,
    overall,
    hasData: {
      risk: hasRiskData,
      medicalAid: hasMedicalData,
      retirement: hasRetirementData,
      investments: hasInvestmentData,
      estatePlanning: hasEstateData,
    },
  };
}

export const calculateGrowthStats = (clientList: Client[]) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Clients added this month
  const newThisMonth = clientList.filter(c => new Date(c.createdAt) >= startOfMonth).length;
  
  // Total clients at start of this month
  const totalPrior = clientList.length - newThisMonth;
  
  // Percentage growth
  const growthRate = totalPrior > 0 
    ? ((newThisMonth / totalPrior) * 100)
    : 100; // If started with 0, growth is 100% (or technically undefined, but 100 indicates "all new")

  return {
    total: clientList.length,
    growthRate: growthRate.toFixed(1),
    newCount: newThisMonth
  };
};

/**
 * Derive display-level account status from the Client fields.
 * Priority: deleted (hard flag) > suspended (hard flag) > profile accountStatus > fallback.
 */
export function deriveAccountStatus(client: Client): 'active' | 'suspended' | 'closed' {
  if (client.deleted || client.accountStatus === 'closed') return 'closed';
  if (client.suspended || client.accountStatus === 'suspended') return 'suspended';
  return 'active';
}

/**
 * Count clients by derived account status.
 */
export function countByStatus(clients: Client[]) {
  let active = 0;
  let suspended = 0;
  let closed = 0;
  for (const c of clients) {
    const s = deriveAccountStatus(c);
    if (s === 'active') active++;
    else if (s === 'suspended') suspended++;
    else closed++;
  }
  return { active, suspended, closed };
}

export const filterClients = (clients: Client[], filters: ClientFilters): Client[] => {
  // 1. Filter out personnel (staff) accounts — defence-in-depth for server-side filter
  const baseClients = clients.filter(client => {
    const profile = client.profile;
    const role = profile?.role;

    // Exclude all personnel roles
    if (role && (PERSONNEL_ROLES as readonly string[]).includes(role)) {
      return false;
    }

    if (isRejectedClient(client)) {
      return false;
    }

    return true;
  });

  // 2. Apply account status filter
  let statusFiltered = baseClients;
  if (filters.accountStatus && filters.accountStatus !== 'all') {
    statusFiltered = baseClients.filter(client => {
      return deriveAccountStatus(client) === filters.accountStatus;
    });
  }

  // 3. Apply search filters
  return statusFiltered.filter(client => {
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      return (
        client.firstName.toLowerCase().includes(searchTerm) ||
        client.lastName.toLowerCase().includes(searchTerm) ||
        client.email.toLowerCase().includes(searchTerm) ||
        (client.idNumber && client.idNumber.toLowerCase().includes(searchTerm))
      );
    }
    return true;
  });
};

export const generateClientCSV = (clients: Client[]) => {
  const csvHeader = ['Name', 'Email', 'ID/Passport', 'Date Joined', 'Application Status', 'Account Status'].join(',');
  const csvRows = clients.map(client => {
    const name = `${client.firstName} ${client.lastName}`;
    const email = client.email || '';
    const id = client.idNumber || '';
    const date = new Date(client.createdAt).toLocaleDateString('en-ZA');
    const appStatus = client.applicationStatus === 'approved' ? 'Active' : 'Application';
    const acctStatus = deriveAccountStatus(client);
    const acctLabel = acctStatus === 'active' ? 'Active' : acctStatus === 'suspended' ? 'Suspended' : 'Closed';
    
    // Escape quotes and wrap in quotes
    const row = [name, email, id, date, appStatus, acctLabel].map(val => {
      const stringVal = String(val);
      return stringVal.includes(',') ? `"${stringVal}"` : stringVal;
    });
    
    return row.join(',');
  });
  
  const csvContent = [csvHeader, ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clients_export_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
};
