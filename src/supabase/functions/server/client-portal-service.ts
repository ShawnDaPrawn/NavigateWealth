/**
 * Client Portal Service
 * Aggregates KV data into a portfolio summary for the client-facing dashboard.
 *
 * Reads from:
 *   - user_profile:{userId}:personal_info     (profile)
 *   - user_profile:{userId}:client_keys        (financial key values)
 *   - risk-planning-fna:client:{userId}:*      (risk FNAs)
 *   - medical-fna:client:{userId}:*            (medical FNAs)
 *   - retirement-fna:client:{userId}:*         (retirement FNAs)
 *   - investment-ina:client:{userId}:*         (investment INAs)
 *   - tax-planning-fna:client:{userId}:*       (tax FNAs)
 *   - estate-planning-fna:client:{userId}:*    (estate planning FNAs)
 *   - doc:{userId}:*                           (documents)
 *   - calendar_event:*                         (calendar events — filtered by clientId)
 *   - policies:client:{userId}                 (per-product policy details)
 *   - application:{applicationId}              (to resolve adviserId)
 *   - personnel:profile:{adviserId}            (adviser's name, email, phone, FSP)
 *
 * Guidelines refs: §3.2 (three-tier), §4.2 (service layer), §5.4 (KV conventions)
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('client-portal');

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export interface PortfolioClientData {
  firstName: string;
  lastName: string;
  memberNumber: string;
  totalWealthValue: number;
  lastUpdated: string;
  riskTolerance: string;
  financialScore: number;
}

export interface FinancialPillar {
  status: string;
  statusText: string;
  nextReview: string;
  [key: string]: unknown;
}

export interface PortfolioFinancialOverview {
  retirement: FinancialPillar & {
    currentValue: number;
    projectedValue: number;
    monthlyContribution: number;
    progressToGoal: number;
  };
  risk: FinancialPillar & {
    deathCover: number;
    disabilityCover: number;
    criticalIllnessCover: number;
  };
  investment: FinancialPillar & {
    totalValue: number;
    monthlyContribution: number;
    goalsLinked: number;
    performance: string;
  };
  estate: FinancialPillar & {
    willStatus: string;
    trustStatus: string;
    nominationStatus: string;
    lastUpdated: string;
  };
  medicalAid: FinancialPillar & {
    scheme: string;
    plan: string;
    monthlyPremium: number;
    dependants: number;
  };
  tax: FinancialPillar & {
    returnStatus: string;
    estimatedRefund: number;
    taxYear: number;
    filingDate: string;
  };
}

export interface PortfolioRecommendation {
  id: string;
  type: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  iconSlug: string;
  title: string;
  description: string;
  action: string;
  dueDate: string;
}

export interface PortfolioDocument {
  id: string;
  documentType: string;
  category: string;
  uploaded: boolean;
  uploadDate: string | null;
  downloadUrl: string | null;
}

export interface PortfolioEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
  time: string | null;
  status: string;
}

/** Per-product policy detail for PDF report tables */
export interface ProductHolding {
  id: string;
  category: string;
  provider: string;
  product: string;
  policyNumber: string;
  value: number;
  premium: number;
  status: string;
}

/** Adviser details resolved from personnel profile */
export interface AdviserDetails {
  name: string;
  email: string;
  phone: string;
  fspReference: string;
}

export interface PortfolioSummary {
  clientData: PortfolioClientData;
  financialOverview: PortfolioFinancialOverview;
  recommendations: PortfolioRecommendation[];
  recentDocuments: PortfolioDocument[];
  upcomingEvents: PortfolioEvent[];
  productHoldings: ProductHolding[];
  adviserDetails: AdviserDetails;
}

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════

/** Loose shape for objects coming from the KV store */
interface KvRecord { [key: string]: unknown }
interface FnaRecord extends KvRecord { status?: string; updatedAt?: string; createdAt?: string; value?: unknown }
interface PolicyRecord extends KvRecord { id?: string; name?: string; provider?: string; coverAmount?: number; currentValue?: number; monthlyPremium?: number; category?: string; product_category?: string; productCategory?: string; status?: string }

/** Pick the most recent FNA from a list of KV entries */
function latestFna(entries: unknown[]): FnaRecord | null {
  if (!entries || entries.length === 0) return null;
  // Each KV entry is { key, value } where value is the FNA object
  const sorted = entries
    .map((e: unknown) => (typeof e === 'object' && e !== null ? ((e as KvRecord).value ?? e) as FnaRecord : e as FnaRecord))
    .filter(Boolean)
    .sort((a: FnaRecord, b: FnaRecord) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  return sorted[0] || null;
}

/** Safe number extraction */
function num(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

/** Determine review status based on FNA availability */
function pillarStatus(fna: FnaRecord | null): { status: string; statusText: string } {
  if (!fna) return { status: 'not-assessed', statusText: 'Not Yet Assessed' };
  if (fna.status === 'completed' || fna.status === 'published') {
    return { status: 'on-track', statusText: 'Assessment Complete' };
  }
  if (fna.status === 'in_progress' || fna.status === 'draft') {
    return { status: 'review-needed', statusText: 'Assessment In Progress' };
  }
  return { status: 'on-track', statusText: 'Assessment Complete' };
}

/** Next review date — 12 months from last FNA update or 'Not scheduled' */
function nextReviewDate(fna: FnaRecord | null): string {
  if (!fna) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const lastDate = new Date(fna.updatedAt || fna.createdAt || Date.now());
  const review = new Date(lastDate);
  review.setFullYear(review.getFullYear() + 1);
  return review.toISOString().split('T')[0];
}

// ── Category → portfolio bucket mapping ────────────────
const CATEGORY_BUCKET: Record<string, string> = {
  risk_planning: 'life',
  medical_aid: 'medicalAid',
  retirement_planning: 'retirement',
  retirement_pre: 'retirement',
  retirement_post: 'retirement',
  investments: 'investment',
  investments_voluntary: 'investment',
  investments_guaranteed: 'investment',
  employee_benefits: 'employeeBenefits',
  employee_benefits_risk: 'employeeBenefits',
  employee_benefits_retirement: 'employeeBenefits',
  estate_planning: 'estate',
  tax_planning: 'tax',
  short_term: 'shortTerm',
};

/** Build ProductHolding[] from the policies:client:{id} KV entry */
function extractProductHoldings(policies: PolicyRecord[]): ProductHolding[] {
  if (!policies || !Array.isArray(policies)) return [];

  let skippedCount = 0;

  const holdings = policies
    .filter((p: PolicyRecord) => {
      if (!p || typeof p !== 'object') {
        skippedCount++;
        return false;
      }
      return !p.archived;
    })
    .map((p: PolicyRecord) => {
      const d = p.data;
      // Guard: data must be a non-null plain object
      if (!d || typeof d !== 'object' || Array.isArray(d)) {
        log.info('Policy entry has missing or non-object data — skipping field extraction', {
          policyId: p.id,
          categoryId: p.categoryId,
          dataType: d === null ? 'null' : typeof d,
        });
        // Still produce a holding with metadata-level info
        const bucket = CATEGORY_BUCKET[p.categoryId] || 'other';
        return {
          id: p.id || `ph-${Math.random().toString(36).substring(2, 8)}`,
          category: bucket,
          provider: p.providerName || 'Provider',
          product: p.categoryId?.replace(/_/g, ' ') || 'Product',
          policyNumber: '-',
          value: 0,
          premium: 0,
          status: p.archived ? 'Archived' : 'Active',
        } satisfies ProductHolding;
      }

      const allEntries = Object.entries(d);

      // Policy number: first string that looks like a policy/reference number
      let policyNumber = '';
      let productName = '';
      let value = 0;
      let premium = 0;

      for (const [key, val] of allEntries) {
        const lk = key.toLowerCase();
        // Policy number fields end in _1 in standard schemas
        if (lk.endsWith('_1') || lk.includes('policy') || lk.includes('reference')) {
          if (typeof val === 'string' && val.trim() && !policyNumber) {
            policyNumber = val.trim();
          }
        }
        // Product type / plan fields typically _2 or _3
        if (lk.endsWith('_2') || lk.includes('type') || lk.includes('plan')) {
          if (typeof val === 'string' && val.trim() && !productName) {
            productName = val.trim();
          }
        }
      }

      // Extract value and premium using common field name patterns
      for (const [key, val] of allEntries) {
        // Skip non-primitive values (nested objects/arrays from custom schemas)
        if (val !== null && typeof val === 'object') continue;

        const lk = key.toLowerCase();
        const n = num(val);
        // Value: current value, cover amount, capital, fund value
        if (
          (lk.includes('value') || lk.includes('cover') || lk.includes('capital') ||
           lk.includes('sum_assured') || lk.includes('amount')) &&
          !lk.includes('maturity') && !lk.includes('projected') &&
          n > 0 && value === 0
        ) {
          value = n;
        }
        // Premium: monthly premium, contribution
        if (
          (lk.includes('premium') || lk.includes('contribution') || lk.includes('income')) &&
          n > 0 && premium === 0
        ) {
          premium = n;
        }
      }

      // Also try numbered field ID patterns from default schemas
      // rp_2=Life Cover, rp_6=Premium; ret_3/ret_pre_3=Current Value, ret_6/ret_pre_6=Premium
      // inv_3=Current Value, inv_6=Premium; ma_6=Premium; eb_4=Cover, eb_5=Contribution
      // tax_4=Amount Due/Refundable; est_5=Premium
      for (const [key, val] of allEntries) {
        // Skip non-primitive values
        if (val !== null && typeof val === 'object') continue;

        const n = num(val);
        if (n <= 0) continue;
        // Value fields
        if (['rp_2', 'rp_3', 'rp_4', 'rp_5', 'ret_3', 'ret_pre_3', 'ret_post_3', 'inv_3',
             'inv_vol_3', 'inv_gua_3', 'eb_4', 'eb_risk_4', 'eb_ret_4', 'tax_4'].includes(key)) {
          if (value === 0) value = n;
        }
        // Premium fields
        if (['rp_6', 'ret_6', 'ret_pre_6', 'ret_post_6', 'inv_6', 'inv_vol_6',
             'ma_6', 'eb_5', 'eb_risk_5', 'eb_ret_5', 'est_5'].includes(key)) {
          if (premium === 0) premium = n;
        }
        // Product type from numbered fields
        if (['ret_2', 'ret_pre_2', 'ret_post_2', 'inv_2', 'inv_vol_2', 'inv_gua_2',
             'eb_3', 'eb_risk_3', 'eb_ret_3', 'ma_2', 'tax_2'].includes(key)) {
          if (!productName && typeof val === 'string') productName = val;
        }
        // Policy number from _1 numbered fields
        if (['rp_1', 'ret_1', 'ret_pre_1', 'ret_post_1', 'inv_1', 'inv_vol_1',
             'inv_gua_1', 'ma_1', 'eb_1', 'eb_risk_1', 'eb_ret_1', 'est_1', 'tax_1'].includes(key)) {
          if (!policyNumber && typeof val === 'string') policyNumber = val;
        }
      }

      const bucket = CATEGORY_BUCKET[p.categoryId] || 'other';

      return {
        id: p.id || `ph-${Math.random().toString(36).substring(2, 8)}`,
        category: bucket,
        provider: p.providerName || 'Provider',
        product: productName || p.categoryId?.replace(/_/g, ' ') || 'Product',
        policyNumber: policyNumber || '-',
        value,
        premium,
        status: p.archived ? 'Archived' : 'Active',
      } satisfies ProductHolding;
    });

  if (skippedCount > 0) {
    log.warn('Skipped non-object entries in policies array during product holdings extraction', { skippedCount });
  }

  return holdings;
}

/** Resolve adviser details from the client's application and personnel KV data */
async function resolveAdviserDetails(
  profile: KvRecord | null,
  clientId: string,
): Promise<AdviserDetails> {
  const PLATFORM_DEFAULTS: AdviserDetails = {
    name: 'Your Navigate Wealth Adviser',
    email: 'support@navigatewealth.co.za',
    phone: '+27 10 000 0000',
    fspReference: 'FSP 00000',
  };

  try {
    // 1. Find the client's applicationId from their profile
    const applicationId = profile?.applicationId || profile?.application_id;
    if (!applicationId) {
      log.info('No applicationId on profile — using platform defaults for adviser', { clientId });
      return PLATFORM_DEFAULTS;
    }

    // 2. Fetch the application to find adviserId or approvedBy
    const application = await kv.get(`application:${applicationId}`);
    if (!application) {
      log.info('Application not found — using platform defaults for adviser', { clientId, applicationId });
      return PLATFORM_DEFAULTS;
    }

    const adviserId = application.adviserId || application.reviewed_by || application.approvedBy;
    if (!adviserId) {
      log.info('No adviserId on application — using platform defaults for adviser', { clientId, applicationId });
      return PLATFORM_DEFAULTS;
    }

    // 3. Look up the adviser's personnel profile
    const personnelProfile = await kv.get(`personnel:profile:${adviserId}`);
    if (!personnelProfile) {
      log.info('Personnel profile not found for adviser — using platform defaults', { clientId, adviserId });
      return PLATFORM_DEFAULTS;
    }

    return {
      name: `${personnelProfile.firstName || ''} ${personnelProfile.lastName || ''}`.trim() || PLATFORM_DEFAULTS.name,
      email: personnelProfile.email || PLATFORM_DEFAULTS.email,
      phone: personnelProfile.phone || personnelProfile.cellphone || PLATFORM_DEFAULTS.phone,
      fspReference: personnelProfile.fspReference || PLATFORM_DEFAULTS.fspReference,
    };
  } catch (err: unknown) {
    log.error('Error resolving adviser details — falling back to platform defaults', err instanceof Error ? err.message : err);
    return PLATFORM_DEFAULTS;
  }
}

// ═══════════════════════════════════════════════════════
// Main Service
// ═══════════════════════════════════════════════════════

export async function getPortfolioSummary(clientId: string): Promise<PortfolioSummary> {
  log.info('Fetching portfolio summary for client', { clientId });

  // ── Batch-fetch all data in parallel (Guidelines §13: batch KV reads) ──
  const [
    profile,
    clientKeys,
    riskFnas,
    medicalFnas,
    retirementFnas,
    investmentInas,
    taxFnas,
    estateFnas,
    documents,
    calendarEvents,
    policies,
  ] = await Promise.all([
    kv.get(`user_profile:${clientId}:personal_info`),
    kv.get(`user_profile:${clientId}:client_keys`),
    kv.getByPrefix(`risk-planning-fna:client:${clientId}:`),
    kv.getByPrefix(`medical-fna:client:${clientId}:`),
    kv.getByPrefix(`retirement-fna:client:${clientId}:`),
    kv.getByPrefix(`investment-ina:client:${clientId}:`),
    kv.getByPrefix(`tax-planning-fna:client:${clientId}:`),
    kv.getByPrefix(`estate-planning-fna:client:${clientId}:`),
    kv.getByPrefix(`doc:${clientId}:`),
    kv.getByPrefix(`calendar_event:`),
    kv.get(`policies:client:${clientId}`),
  ]);

  // ── Client Data ──────────────────────────────────────
  const pi = profile?.personalInformation || profile || {};
  const ckRaw = (clientKeys || {}) as Record<string, unknown>;

  const firstName = String(pi.firstName || ckRaw.profile_first_name || 'Client');
  const lastName = String(pi.lastName || ckRaw.profile_last_name || '');
  const memberNumber = String(pi.memberNumber || ckRaw.member_number || `NW-${clientId.substring(0, 6).toUpperCase()}`);

  // ── Extract latest FNA per domain ────────────────────
  const latestRisk = latestFna(riskFnas);
  const latestMedical = latestFna(medicalFnas);
  const latestRetirement = latestFna(retirementFnas);
  const latestInvestment = latestFna(investmentInas);
  const latestTax = latestFna(taxFnas);
  const latestEstate = latestFna(estateFnas);

  // ── Compute total wealth from client_keys or FNA data ──
  const retirementValue = num(ckRaw.retirement_total || latestRetirement?.results?.currentValue || latestRetirement?.inputs?.currentRetirementSavings);
  const investmentValue = num(ckRaw.investment_total || latestInvestment?.results?.totalValue || latestInvestment?.inputs?.currentInvestmentValue);
  const riskDeathCover = num(ckRaw.risk_death_cover || latestRisk?.results?.deathCover || latestRisk?.inputs?.existingDeathCover);
  const riskDisabilityCover = num(ckRaw.risk_disability_cover || latestRisk?.results?.disabilityCover || latestRisk?.inputs?.existingDisabilityCover);
  const riskCriticalIllness = num(ckRaw.risk_critical_illness || latestRisk?.results?.criticalIllnessCover || latestRisk?.inputs?.existingCriticalIllnessCover);
  const totalWealthValue = retirementValue + investmentValue;

  // Financial health score: rough heuristic based on how many pillars have assessments
  const assessedPillars = [latestRisk, latestMedical, latestRetirement, latestInvestment, latestTax, latestEstate].filter(Boolean).length;
  const financialScore = Math.min(100, Math.round((assessedPillars / 6) * 100));

  // Most recent FNA update date
  const allFnas = [latestRisk, latestMedical, latestRetirement, latestInvestment, latestTax, latestEstate].filter(Boolean);
  const lastUpdated = allFnas.length > 0
    ? allFnas.reduce((latest: string, fna: FnaRecord) => {
        const d = fna.updatedAt || fna.createdAt || '';
        return d > latest ? d : latest;
      }, '')
    : new Date().toISOString();

  const clientData: PortfolioClientData = {
    firstName,
    lastName,
    memberNumber,
    totalWealthValue,
    lastUpdated,
    riskTolerance: String(pi.riskTolerance || ckRaw.risk_tolerance || latestRisk?.inputs?.riskTolerance || 'Not assessed'),
    financialScore,
  };

  // ── Financial Overview ───────────────────────────────
  const retirementStatus = pillarStatus(latestRetirement);
  const riskStatus = pillarStatus(latestRisk);
  const investmentStatus = pillarStatus(latestInvestment);
  const estateStatus = pillarStatus(latestEstate);
  const medicalStatus = pillarStatus(latestMedical);
  const taxStatus = pillarStatus(latestTax);

  const financialOverview: PortfolioFinancialOverview = {
    retirement: {
      currentValue: retirementValue,
      projectedValue: num(latestRetirement?.results?.projectedValue || retirementValue * 2),
      monthlyContribution: num(ckRaw.retirement_monthly_contribution || latestRetirement?.inputs?.monthlyContribution),
      progressToGoal: retirementValue > 0 ? Math.min(100, Math.round((retirementValue / Math.max(1, num(latestRetirement?.results?.targetValue || retirementValue * 3))) * 100)) : 0,
      ...retirementStatus,
      nextReview: nextReviewDate(latestRetirement),
    },
    risk: {
      deathCover: riskDeathCover,
      disabilityCover: riskDisabilityCover,
      criticalIllnessCover: riskCriticalIllness,
      ...riskStatus,
      nextReview: nextReviewDate(latestRisk),
    },
    investment: {
      totalValue: investmentValue,
      monthlyContribution: num(ckRaw.investment_monthly_contribution || latestInvestment?.inputs?.monthlyContribution),
      goalsLinked: num(latestInvestment?.inputs?.goalsLinked || 0),
      performance: latestInvestment?.results?.performanceYtd || 'N/A',
      ...investmentStatus,
      nextReview: nextReviewDate(latestInvestment),
    },
    estate: {
      willStatus: latestEstate?.results?.willStatus || latestEstate?.inputs?.willStatus || 'not-drafted',
      trustStatus: latestEstate?.results?.trustStatus || latestEstate?.inputs?.trustStatus || 'not-established',
      nominationStatus: latestEstate?.results?.nominationStatus || latestEstate?.inputs?.nominationStatus || 'incomplete',
      lastUpdated: latestEstate?.updatedAt || latestEstate?.createdAt || '',
      ...estateStatus,
      nextReview: nextReviewDate(latestEstate),
    },
    medicalAid: {
      scheme: String(latestMedical?.inputs?.schemeName || ckRaw.medical_scheme || 'Not specified'),
      plan: String(latestMedical?.inputs?.planName || ckRaw.medical_plan || 'Not specified'),
      monthlyPremium: num(ckRaw.medical_monthly_premium || latestMedical?.inputs?.monthlyPremium),
      dependants: num(ckRaw.medical_dependants || latestMedical?.inputs?.numberOfDependants),
      ...medicalStatus,
      nextReview: nextReviewDate(latestMedical),
    },
    tax: {
      returnStatus: String(latestTax?.results?.returnStatus || latestTax?.inputs?.returnStatus || 'not-filed'),
      estimatedRefund: num(latestTax?.results?.estimatedRefund),
      taxYear: num(latestTax?.inputs?.taxYear || new Date().getFullYear()),
      filingDate: latestTax?.results?.filingDate || latestTax?.inputs?.filingDate || '',
      ...taxStatus,
      nextReview: nextReviewDate(latestTax),
    },
  };

  // ── Recommendations (derived from pillar status) ─────
  const recommendations: PortfolioRecommendation[] = [];

  if (!latestRisk) {
    recommendations.push({
      id: 'rec-risk-assessment',
      type: 'risk',
      priority: 'high',
      iconSlug: 'shield',
      title: 'Complete Risk Assessment',
      description: 'Your risk cover has not been assessed. Book a risk review to ensure you and your family are adequately protected.',
      action: 'Book Risk Review',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  }

  if (!latestRetirement) {
    recommendations.push({
      id: 'rec-retirement-planning',
      type: 'retirement',
      priority: 'high',
      iconSlug: 'target',
      title: 'Start Retirement Planning',
      description: 'No retirement assessment on file. Understanding your retirement readiness is crucial for long-term financial security.',
      action: 'Schedule Consultation',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  }

  if (latestEstate && (latestEstate.results?.willStatus === 'not-drafted' || latestEstate.inputs?.willStatus === 'not-drafted')) {
    recommendations.push({
      id: 'rec-estate-will',
      type: 'estate',
      priority: 'urgent',
      iconSlug: 'users',
      title: 'Estate Planning Update',
      description: 'Your Will has not been drafted. This is essential for protecting your family and ensuring your wishes are honoured.',
      action: 'Schedule Estate Consultation',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  }

  if (!latestTax) {
    recommendations.push({
      id: 'rec-tax-review',
      type: 'tax',
      priority: 'medium',
      iconSlug: 'calculator',
      title: 'Tax Planning Review',
      description: 'No tax assessment on file. A review could identify opportunities to optimise your tax position.',
      action: 'Review Tax Situation',
      dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  }

  // ── Recent Documents ─────────────────────────────────
  const recentDocuments: PortfolioDocument[] = (documents || [])
    .map((entry: unknown) => {
      const doc = (typeof entry === 'object' && entry !== null ? (entry as KvRecord).value ?? entry : entry) as KvRecord | null;
      if (!doc || typeof doc !== 'object') return null;
      return {
        id: String(doc.id || ''),
        documentType: String(doc.title || doc.documentType || 'Document'),
        category: String(doc.productCategory || doc.category || 'General'),
        uploaded: true,
        uploadDate: (doc.uploadDate || doc.createdAt || null) as string | null,
        downloadUrl: null,
      };
    })
    .filter(Boolean)
    .sort((a: PortfolioDocument, b: PortfolioDocument) => new Date(b.uploadDate || 0).getTime() - new Date(a.uploadDate || 0).getTime())
    .slice(0, 5);

  // ── Upcoming Events ──────────────────────────────────
  const now = new Date();
  const upcomingEvents: PortfolioEvent[] = (calendarEvents || [])
    .map((entry: unknown) => {
      const evt = (typeof entry === 'object' && entry !== null ? (entry as KvRecord).value ?? entry : entry) as KvRecord | null;
      if (!evt || typeof evt !== 'object') return null;
      // Filter to this client's events
      if (evt.clientId && evt.clientId !== clientId) return null;
      return {
        id: String(evt.id || ''),
        type: String(evt.type || 'meeting'),
        title: String(evt.title || 'Event'),
        description: String(evt.description || ''),
        date: String(evt.date || evt.startDate || ''),
        time: (evt.time || evt.startTime || null) as string | null,
        status: String(evt.status || 'pending'),
      };
    })
    .filter(Boolean)
    .filter((evt: PortfolioEvent) => new Date(evt.date) >= now)
    .sort((a: PortfolioEvent, b: PortfolioEvent) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  // ── Product Holdings ────────────────────────────────
  // Defensive unwrapping: policies:client:{id} may be a flat array,
  // an object with a .policies array, or an object with .value array.
  let policiesArray: PolicyRecord[] = [];
  if (Array.isArray(policies)) {
    policiesArray = policies;
  } else if (policies && typeof policies === 'object') {
    const policiesObj = policies as Record<string, unknown>;
    if (Array.isArray(policiesObj.policies)) {
      policiesArray = policiesObj.policies;
    } else if (Array.isArray(policiesObj.value)) {
      policiesArray = policiesObj.value;
    } else {
      // Object with category keys — flatten values if they are arrays
      const vals = Object.values(policiesObj);
      if (vals.length > 0 && vals.every(Array.isArray)) {
        policiesArray = vals.flat();
      }
    }
  }

  const productHoldings: ProductHolding[] = extractProductHoldings(policiesArray);

  // ── Adviser Details ────────────────────────────────
  const adviserDetails: AdviserDetails = await resolveAdviserDetails(profile, clientId);

  log.info('Portfolio summary assembled', {
    clientId,
    pillarsAssessed: assessedPillars,
    documentCount: recentDocuments.length,
    eventCount: upcomingEvents.length,
    recommendationCount: recommendations.length,
    productHoldingCount: productHoldings.length,
    adviserResolved: adviserDetails.name !== 'Your Navigate Wealth Adviser',
  });

  return {
    clientData,
    financialOverview,
    recommendations,
    recentDocuments,
    upcomingEvents,
    productHoldings,
    adviserDetails,
  };
}