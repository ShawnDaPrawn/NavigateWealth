/**
 * Honeycomb integration — The compliance dashboard, computed from stored check history.
 *
 * One slice of what used to be all 1,613 lines of `honeycomb-service.ts`.
 * That file still re-exports the whole public surface, because all five
 * honeycomb route files reach it as `import * as service`.
 *
 * The logger keeps the channel name `honeycomb-service` on purpose: splitting
 * the file should not rename anything in the logs.
 */
import type {
  HoneycombCheckResult,
  HoneycombCheckType,
  ComplianceDashboardData,
  ComplianceCategory,
  CategoryStatus,
  CheckStatus,
  RiskFlag,
} from './honeycomb-types.ts';
import { getAllCheckHistory } from './honeycomb-reports.ts';

// COMPLIANCE DASHBOARD — Computed from KV check history
// ────────────────────────────────────────────────────────────────────────────

/** Category definitions for the compliance matrix */
const COMPLIANCE_CATEGORIES: ComplianceCategory[] = [
  {
    id: 'identity',
    label: 'Identity Verification',
    checkTypes: [
      'idv_no_photo',
      'idv_with_photo',
      'idv_no_photo_secondary',
      'idv_with_photo_secondary',
      'idv_bulk',
    ],
    colour: 'blue',
  },
  {
    id: 'cdd',
    label: 'Customer Due Diligence',
    checkTypes: ['cdd_report'],
    colour: 'teal',
  },
  {
    id: 'financial',
    label: 'Financial Intelligence',
    checkTypes: [
      'bank_verification',
      'consumer_credit',
      'consumer_trace',
      'debt_enquiry',
      'lifestyle_audit',
      'income_predictor',
    ],
    colour: 'green',
  },
  {
    id: 'sanctions',
    label: 'Screening & Sanctions',
    checkTypes: ['sanctions_search', 'enforcement_actions', 'legal_a_listing', 'custom_screening'],
    colour: 'purple',
  },
  {
    id: 'corporate',
    label: 'Corporate & Governance',
    checkTypes: ['cipc', 'director_enquiry', 'tenders_blue'],
    colour: 'indigo',
  },
  {
    id: 'address',
    label: 'Address',
    checkTypes: ['best_known_address'],
    colour: 'emerald',
  },
  {
    id: 'assessment',
    label: 'Risk Assessment',
    checkTypes: ['assessment'],
    colour: 'amber',
  },
];

/** Human-readable labels for each check type */
const CHECK_TYPE_LABELS: Record<HoneycombCheckType, string> = {
  idv_no_photo: 'IDV (No Photo)',
  idv_with_photo: 'IDV (With Photo)',
  idv_no_photo_secondary: 'IDV Secondary (No Photo)',
  idv_with_photo_secondary: 'IDV Secondary (With Photo)',
  idv_bulk: 'Bulk IDV',
  bank_verification: 'Bank Verification',
  consumer_credit: 'Consumer Credit',
  consumer_trace: 'Consumer Trace',
  debt_enquiry: 'Debt Review Enquiry',
  lifestyle_audit: 'Lifestyle Audit',
  income_predictor: 'Income Predictor',
  cipc: 'CIPC Company Search',
  director_enquiry: 'Director Enquiry',
  tenders_blue: 'Tenders Blue List',
  custom_screening: 'Custom Screening',
  sanctions_search: 'Sanctions Search',
  enforcement_actions: 'Enforcement Actions',
  legal_a_listing: 'Legal A Listing',
  best_known_address: 'Best Known Address',
  cdd_report: 'CDD Report',
  assessment: 'Risk Assessment',
  registration: 'Registration',
};

/** Extract risk flags from raw check results */
function extractRiskFlags(allResults: HoneycombCheckResult[]): RiskFlag[] {
  const flags: RiskFlag[] = [];

  for (const result of allResults) {
    const raw = result.rawResponse as Record<string, unknown> | null;
    if (!raw) continue;

    switch (result.checkType) {
      case 'sanctions_search': {
        const resultsArr = Array.isArray(raw.results) ? raw.results : [];
        const matches =
          (typeof raw.totalMatches === 'number' ? raw.totalMatches : null) ??
          resultsArr.length ??
          0;
        if (matches > 0) {
          flags.push({
            severity: 'high',
            source: 'Sanctions Search',
            message: `${matches} sanctions match(es) found`,
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        break;
      }
      case 'enforcement_actions': {
        const resultsArr = Array.isArray(raw.results) ? raw.results : [];
        const matches =
          (typeof raw.totalMatches === 'number' ? raw.totalMatches : null) ??
          resultsArr.length ??
          0;
        if (matches > 0) {
          flags.push({
            severity: 'high',
            source: 'Enforcement Actions',
            message: `${matches} enforcement action(s) found`,
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        break;
      }
      case 'legal_a_listing': {
        const resultsArr = Array.isArray(raw.results) ? raw.results : [];
        const matches =
          (typeof raw.totalMatches === 'number' ? raw.totalMatches : null) ??
          resultsArr.length ??
          0;
        if (matches > 0) {
          flags.push({
            severity: 'medium',
            source: 'Legal A Listing',
            message: `${matches} legal listing(s) found`,
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        break;
      }
      case 'debt_enquiry': {
        if (raw.isUnderDebtReview === true) {
          flags.push({
            severity: 'medium',
            source: 'Debt Review',
            message: 'Client is under debt review',
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        break;
      }
      case 'idv_no_photo':
      case 'idv_with_photo': {
        if (raw.idVerified === false) {
          flags.push({
            severity: 'high',
            source: 'Identity Verification',
            message: 'Identity could not be verified',
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        if (raw.photoMatch === false) {
          flags.push({
            severity: 'medium',
            source: 'IDV Photo Match',
            message: 'Photo does not match bureau records',
            checkType: result.checkType,
            detectedAt: result.submittedAt,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  // Sort by severity (high first)
  const severityOrder = { high: 0, medium: 1, low: 2, info: 3 };
  return flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * COMPLIANCE DASHBOARD
 * Aggregates all check history for a client into a readiness score,
 * per-category completion, and risk flags.
 */
export async function getComplianceDashboard(clientId: string): Promise<ComplianceDashboardData> {
  const allResults = await getAllCheckHistory(clientId);

  // Build a map of checkType -> results
  const resultsByType = new Map<HoneycombCheckType, HoneycombCheckResult[]>();
  for (const r of allResults) {
    const existing = resultsByType.get(r.checkType) || [];
    existing.push(r);
    resultsByType.set(r.checkType, existing);
  }

  // Exclude 'registration' from scoring — it's not a compliance check
  const scorableCategories = COMPLIANCE_CATEGORIES;

  // Build per-check status
  const checks: CheckStatus[] = [];
  for (const cat of scorableCategories) {
    for (const ct of cat.checkTypes) {
      const results = resultsByType.get(ct) || [];
      const lastResult = results[0]; // already sorted desc
      checks.push({
        checkType: ct,
        label: CHECK_TYPE_LABELS[ct] || ct,
        category: cat.id,
        completed: results.length > 0,
        lastRun: lastResult?.submittedAt || null,
        runCount: results.length,
        lastMatterId: lastResult?.matterId || null,
      });
    }
  }

  // Build per-category status
  const categories: CategoryStatus[] = scorableCategories.map((cat) => {
    const catChecks = checks.filter((c) => c.category === cat.id);
    const completedCount = catChecks.filter((c) => c.completed).length;
    return {
      id: cat.id,
      label: cat.label,
      colour: cat.colour,
      completedCount,
      totalCount: catChecks.length,
      percentage: catChecks.length > 0 ? Math.round((completedCount / catChecks.length) * 100) : 0,
    };
  });

  // Compute overall readiness score
  // Weighted: identity=25%, cdd=15%, financial=20%, sanctions=20%, corporate=10%, address=5%, assessment=5%
  const weights: Record<string, number> = {
    identity: 0.25,
    cdd: 0.15,
    financial: 0.2,
    sanctions: 0.2,
    corporate: 0.1,
    address: 0.05,
    assessment: 0.05,
  };
  let readinessScore = 0;
  for (const cat of categories) {
    const w = weights[cat.id] ?? 0;
    readinessScore += (cat.percentage / 100) * w * 100;
  }
  readinessScore = Math.round(readinessScore);

  // Extract risk flags
  const riskFlags = extractRiskFlags(allResults);

  // Totals
  const completedCheckTypes = checks.filter((c) => c.completed).length;
  const totalCheckTypes = checks.length;
  const lastCheckDate = allResults.length > 0 ? allResults[0].submittedAt : null;

  return {
    readinessScore,
    completedCheckTypes,
    totalCheckTypes,
    categories,
    checks,
    riskFlags,
    lastCheckDate,
    totalCheckRuns: allResults.length,
  };
}
