/**
 * Client compliance record — schema version 1.
 *
 * The KYC / FICA / FATCA-CRS / POPIA facts about one client, kept on the
 * client's profile record (`user_profile:{userId}:personal_info`) under two
 * top-level keys that are deliberately separate:
 *
 * - `complianceDeclarations` — what the CLIENT declares: PEP status, source of
 *   funds and wealth, tax residency, US-person status and consents. The client
 *   edits it in the portal; staff can edit it too.
 * - `complianceReview` — what the FIRM records about the client: risk rating,
 *   sanctions screening and KYC review dates. Staff only. The edge function
 *   strips it from a client's own save and never returns it to the client
 *   (`client-management-profile-crud-routes.ts`).
 *
 * Built to be lifted out. The compliance engine that is being written will own
 * this data; until then it lives here. To make the hand-over a straight move:
 * - every object carries `schemaVersion`, so the engine can migrate by version;
 * - no other part of the profile reads the inner shape — readers go through
 *   `normalizeComplianceDeclarations` / `normalizeComplianceReview`;
 * - the rules (review intervals, indicators) are plain data and pure functions
 *   with no React, network or storage dependency, so the engine can import
 *   them as they are or replace them.
 *
 * This file is imported by the SPA and by the Deno edge function, so it must
 * stay free of path aliases and runtime imports.
 */

export const CLIENT_COMPLIANCE_SCHEMA_VERSION = 1 as const;

/** Profile-record key for what the client declares. Client and staff edit it. */
export const COMPLIANCE_DECLARATIONS_PROFILE_KEY = 'complianceDeclarations' as const;
/** Profile-record key for the firm's own assessment. Staff only. */
export const COMPLIANCE_REVIEW_PROFILE_KEY = 'complianceReview' as const;

/** An unanswered question is '' — distinct from an explicit "no". */
export type YesNo = '' | 'yes' | 'no';

// ============================================================================
// Option lists
// ============================================================================

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

/** FICA Schedules 3A and 3B. */
export type PepCategory = '' | 'domestic' | 'foreign';
export const PEP_CATEGORY_OPTIONS: Option<Exclude<PepCategory, ''>>[] = [
  { value: 'domestic', label: 'Domestic prominent influential person (South Africa)' },
  { value: 'foreign', label: 'Foreign prominent public official' },
];

export type PepRelationship = '' | 'family-member' | 'close-associate';
export const PEP_RELATIONSHIP_OPTIONS: Option<Exclude<PepRelationship, ''>>[] = [
  { value: 'family-member', label: 'Immediate family member' },
  { value: 'close-associate', label: 'Known close associate' },
];

/** Where the money this client invests or pays with comes from. */
export const SOURCE_OF_FUNDS_OPTIONS: Option[] = [
  { value: 'salary', label: 'Salary or wages' },
  { value: 'business-income', label: 'Business income' },
  { value: 'investment-income', label: 'Investment income (interest, dividends, rent)' },
  { value: 'pension-annuity', label: 'Pension or annuity income' },
  { value: 'retirement-payout', label: 'Retirement fund pay-out' },
  { value: 'savings', label: 'Existing savings' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'sale-of-asset', label: 'Sale of property or other asset' },
  { value: 'gift-donation', label: 'Gift or donation' },
  { value: 'loan', label: 'Loan' },
  { value: 'other', label: 'Other' },
];

/** How the client built up their overall wealth. */
export const SOURCE_OF_WEALTH_OPTIONS: Option[] = [
  { value: 'employment', label: 'Earnings from employment' },
  { value: 'business-ownership', label: 'Business ownership' },
  { value: 'investments', label: 'Investment growth' },
  { value: 'property', label: 'Property' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'sale-of-business', label: 'Sale of a business' },
  { value: 'retirement-savings', label: 'Retirement savings' },
  { value: 'other', label: 'Other' },
];

/** Why a tax residency has no tax number (the CRS reasons). */
export type NoTaxNumberReason = '' | 'not-issued' | 'not-required' | 'pending';
export const NO_TAX_NUMBER_REASON_OPTIONS: Option<Exclude<NoTaxNumberReason, ''>>[] = [
  { value: 'not-issued', label: 'The country does not issue tax numbers' },
  { value: 'not-required', label: 'Not required by that country' },
  { value: 'pending', label: 'Applied for, not yet received' },
];

export type ConsentKey = 'dataProcessing' | 'providerSharing' | 'electronicDelivery' | 'marketing';
export type ConsentStatus = '' | 'granted' | 'declined';

export const CONSENT_DEFINITIONS: Array<{
  key: ConsentKey;
  label: string;
  description: string;
}> = [
  {
    key: 'dataProcessing',
    label: 'Processing of personal information (POPIA)',
    description:
      'Navigate Wealth may collect, store and use personal information to give financial advice and manage the account.',
  },
  {
    key: 'providerSharing',
    label: 'Sharing with product providers',
    description:
      'Navigate Wealth may share the information needed with insurers, investment platforms and other product providers to apply for, quote on and service products.',
  },
  {
    key: 'electronicDelivery',
    label: 'Electronic delivery of documents',
    description:
      'Statements, documents and official correspondence may be sent electronically instead of by post.',
  },
  {
    key: 'marketing',
    label: 'Marketing communication',
    description:
      'Navigate Wealth may send newsletters, market updates and information about products and services.',
  },
];

export type ClientRiskRating = '' | 'low' | 'medium' | 'high';
export const CLIENT_RISK_RATING_OPTIONS: Option<Exclude<ClientRiskRating, ''>>[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export type SanctionsResult = '' | 'clear' | 'potential-match' | 'confirmed-match';
export const SANCTIONS_RESULT_OPTIONS: Option<Exclude<SanctionsResult, ''>>[] = [
  { value: 'clear', label: 'Clear — no match' },
  { value: 'potential-match', label: 'Potential match — under review' },
  { value: 'confirmed-match', label: 'Confirmed match' },
];

/**
 * Months between KYC reviews for each risk rating. A risk-based default, not a
 * rule: the firm's Risk Management and Compliance Programme (RMCP) sets the real
 * periods, and the compliance engine is expected to take this over.
 */
export const KYC_REVIEW_INTERVAL_MONTHS: Record<Exclude<ClientRiskRating, ''>, number> = {
  high: 12,
  medium: 24,
  low: 36,
};

// ============================================================================
// Shapes
// ============================================================================

export interface TaxResidency {
  id: string;
  country: string;
  taxNumber: string;
  /** Required when there is no tax number. */
  noTaxNumberReason: NoTaxNumberReason;
}

export interface ConsentRecord {
  status: ConsentStatus;
  /** ISO timestamp of the last change of `status`. */
  recordedAt: string;
}

export interface ComplianceDeclarations {
  schemaVersion: typeof CLIENT_COMPLIANCE_SCHEMA_VERSION;

  // Politically exposed person (FICA s21F–21H)
  isPep: YesNo;
  pepCategory: PepCategory;
  pepPosition: string;
  isPepRelated: YesNo;
  pepRelationship: PepRelationship;
  pepRelatedName: string;
  pepRelatedPosition: string;

  // Source of funds and source of wealth
  sourceOfFunds: string[];
  sourceOfFundsDetails: string;
  sourceOfWealth: string[];
  sourceOfWealthDetails: string;

  // Tax residency (CRS) and US person (FATCA)
  taxResidencies: TaxResidency[];
  isUsPerson: YesNo;
  usTin: string;

  consents: Record<ConsentKey, ConsentRecord>;

  /** When the client last confirmed these declarations are accurate (ISO). */
  confirmedAt: string;
}

export interface ComplianceReview {
  schemaVersion: typeof CLIENT_COMPLIANCE_SCHEMA_VERSION;

  riskRating: ClientRiskRating;
  riskRatingReason: string;
  /** YYYY-MM-DD */
  riskRatedAt: string;

  sanctionsResult: SanctionsResult;
  /** YYYY-MM-DD */
  sanctionsScreenedAt: string;
  sanctionsReference: string;

  /** YYYY-MM-DD */
  lastKycReviewDate: string;
  /** YYYY-MM-DD */
  nextKycReviewDate: string;

  notes: string;
}

// ============================================================================
// Construction and normalisation
// ============================================================================

function emptyConsents(): Record<ConsentKey, ConsentRecord> {
  return {
    dataProcessing: { status: '', recordedAt: '' },
    providerSharing: { status: '', recordedAt: '' },
    electronicDelivery: { status: '', recordedAt: '' },
    marketing: { status: '', recordedAt: '' },
  };
}

export function emptyComplianceDeclarations(): ComplianceDeclarations {
  return {
    schemaVersion: CLIENT_COMPLIANCE_SCHEMA_VERSION,
    isPep: '',
    pepCategory: '',
    pepPosition: '',
    isPepRelated: '',
    pepRelationship: '',
    pepRelatedName: '',
    pepRelatedPosition: '',
    sourceOfFunds: [],
    sourceOfFundsDetails: '',
    sourceOfWealth: [],
    sourceOfWealthDetails: '',
    taxResidencies: [],
    isUsPerson: '',
    usTin: '',
    consents: emptyConsents(),
    confirmedAt: '',
  };
}

export function emptyComplianceReview(): ComplianceReview {
  return {
    schemaVersion: CLIENT_COMPLIANCE_SCHEMA_VERSION,
    riskRating: '',
    riskRatingReason: '',
    riskRatedAt: '',
    sanctionsResult: '',
    sanctionsScreenedAt: '',
    sanctionsReference: '',
    lastKycReviewDate: '',
    nextKycReviewDate: '',
    notes: '',
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

const YES_NO: readonly YesNo[] = ['', 'yes', 'no'];

/**
 * Read whatever is stored (nothing, a partial object, an older version) as a
 * complete version-1 record. Unknown values fall back to "unanswered" rather
 * than being guessed.
 */
export function normalizeComplianceDeclarations(raw: unknown): ComplianceDeclarations {
  const r = asRecord(raw);
  const base = emptyComplianceDeclarations();
  const consentsRaw = asRecord(r.consents);
  const consents = emptyConsents();
  for (const key of Object.keys(consents) as ConsentKey[]) {
    const c = asRecord(consentsRaw[key]);
    consents[key] = {
      status: oneOf<ConsentStatus>(c.status, ['', 'granted', 'declined'], ''),
      recordedAt: str(c.recordedAt),
    };
  }
  return {
    ...base,
    isPep: oneOf(r.isPep, YES_NO, ''),
    pepCategory: oneOf<PepCategory>(r.pepCategory, ['', 'domestic', 'foreign'], ''),
    pepPosition: str(r.pepPosition),
    isPepRelated: oneOf(r.isPepRelated, YES_NO, ''),
    pepRelationship: oneOf<PepRelationship>(
      r.pepRelationship,
      ['', 'family-member', 'close-associate'],
      '',
    ),
    pepRelatedName: str(r.pepRelatedName),
    pepRelatedPosition: str(r.pepRelatedPosition),
    sourceOfFunds: strings(r.sourceOfFunds),
    sourceOfFundsDetails: str(r.sourceOfFundsDetails),
    sourceOfWealth: strings(r.sourceOfWealth),
    sourceOfWealthDetails: str(r.sourceOfWealthDetails),
    taxResidencies: Array.isArray(r.taxResidencies)
      ? r.taxResidencies.map((t, i) => {
          const tr = asRecord(t);
          return {
            id: str(tr.id) || `tax-residency-${i + 1}`,
            country: str(tr.country),
            taxNumber: str(tr.taxNumber),
            noTaxNumberReason: oneOf<NoTaxNumberReason>(
              tr.noTaxNumberReason,
              ['', 'not-issued', 'not-required', 'pending'],
              '',
            ),
          };
        })
      : [],
    isUsPerson: oneOf(r.isUsPerson, YES_NO, ''),
    usTin: str(r.usTin),
    consents,
    confirmedAt: str(r.confirmedAt),
  };
}

export function normalizeComplianceReview(raw: unknown): ComplianceReview {
  const r = asRecord(raw);
  return {
    ...emptyComplianceReview(),
    riskRating: oneOf<ClientRiskRating>(r.riskRating, ['', 'low', 'medium', 'high'], ''),
    riskRatingReason: str(r.riskRatingReason),
    riskRatedAt: str(r.riskRatedAt),
    sanctionsResult: oneOf<SanctionsResult>(
      r.sanctionsResult,
      ['', 'clear', 'potential-match', 'confirmed-match'],
      '',
    ),
    sanctionsScreenedAt: str(r.sanctionsScreenedAt),
    sanctionsReference: str(r.sanctionsReference),
    lastKycReviewDate: str(r.lastKycReviewDate),
    nextKycReviewDate: str(r.nextKycReviewDate),
    notes: str(r.notes),
  };
}

// ============================================================================
// Rules
// ============================================================================

/** YYYY-MM-DD of `date` plus `months`, or '' when `date` is not a date. */
export function addMonthsIso(date: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return '';
  const year = Number(m[1]);
  const month = Number(m[2]) - 1 + months;
  const day = Number(m[3]);
  const target = new Date(Date.UTC(year, month, 1));
  // Clamp the day so 31 Jan + 1 month is 28/29 Feb, not 2/3 March.
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** The next KYC review a rating implies, counted from the last review. */
export function suggestNextKycReviewDate(lastReviewDate: string, rating: ClientRiskRating): string {
  if (!rating) return '';
  return addMonthsIso(lastReviewDate, KYC_REVIEW_INTERVAL_MONTHS[rating]);
}

export function isPepExposed(d: ComplianceDeclarations): boolean {
  return d.isPep === 'yes' || d.isPepRelated === 'yes';
}

/** Questions the client has not answered yet, as short labels. */
export function outstandingDeclarations(d: ComplianceDeclarations): string[] {
  const missing: string[] = [];
  if (!d.isPep) missing.push('PEP status');
  if (d.isPep === 'yes' && (!d.pepCategory || !d.pepPosition.trim())) missing.push('PEP details');
  if (!d.isPepRelated) missing.push('PEP family or associate');
  if (d.isPepRelated === 'yes' && (!d.pepRelatedName.trim() || !d.pepRelationship)) {
    missing.push('PEP relation details');
  }
  if (d.sourceOfFunds.length === 0) missing.push('Source of funds');
  if (d.sourceOfWealth.length === 0) missing.push('Source of wealth');
  if (d.taxResidencies.length === 0) missing.push('Tax residency');
  if (
    d.taxResidencies.some((t) => !t.country.trim() || (!t.taxNumber.trim() && !t.noTaxNumberReason))
  ) {
    missing.push('Tax residency details');
  }
  if (!d.isUsPerson) missing.push('US person (FATCA)');
  if (d.isUsPerson === 'yes' && !d.usTin.trim()) missing.push('US tax number');
  if (!d.consents.dataProcessing.status) missing.push('POPIA consent');
  if (!d.consents.providerSharing.status) missing.push('Provider sharing consent');
  return missing;
}

export type ComplianceIndicatorLevel = 'alert' | 'warning' | 'info';
export interface ComplianceIndicator {
  level: ComplianceIndicatorLevel;
  message: string;
}

const FOREIGN_TAX_RESIDENCY = (country: string) => {
  const c = country.trim().toLowerCase();
  return c !== '' && c !== 'south africa' && c !== 'za' && c !== 'rsa';
};

/**
 * What an adviser should notice about this client's compliance position.
 * `today` is YYYY-MM-DD; passed in so the result is deterministic.
 */
export function complianceIndicators(
  d: ComplianceDeclarations,
  r: ComplianceReview,
  today: string,
): ComplianceIndicator[] {
  const out: ComplianceIndicator[] = [];
  if (r.sanctionsResult === 'confirmed-match') {
    out.push({ level: 'alert', message: 'Confirmed sanctions match — do not transact.' });
  } else if (r.sanctionsResult === 'potential-match') {
    out.push({ level: 'alert', message: 'Potential sanctions match awaiting resolution.' });
  }
  if (isPepExposed(d)) {
    out.push({
      level: 'warning',
      message:
        'PEP exposure declared — enhanced due diligence and senior management approval required.',
    });
  }
  if (r.nextKycReviewDate && today && r.nextKycReviewDate < today) {
    out.push({ level: 'warning', message: `KYC review overdue since ${r.nextKycReviewDate}.` });
  }
  if (!r.riskRating) out.push({ level: 'warning', message: 'Client risk rating not set.' });
  if (!r.sanctionsResult)
    out.push({ level: 'warning', message: 'Sanctions screening not recorded.' });
  if (d.consents.dataProcessing.status === 'declined') {
    out.push({ level: 'alert', message: 'POPIA processing consent declined.' });
  }
  if (d.isUsPerson === 'yes') {
    out.push({ level: 'info', message: 'US person — FATCA reporting applies.' });
  }
  if (d.taxResidencies.some((t) => FOREIGN_TAX_RESIDENCY(t.country))) {
    out.push({
      level: 'info',
      message: 'Tax resident outside South Africa — CRS reporting applies.',
    });
  }
  if (isPepExposed(d) && r.riskRating && r.riskRating !== 'high') {
    out.push({
      level: 'warning',
      message: 'PEP exposure declared but the client is not rated high risk.',
    });
  }
  const missing = outstandingDeclarations(d);
  if (missing.length > 0) {
    out.push({ level: 'info', message: `Client still to declare: ${missing.join(', ')}.` });
  }
  return out;
}

// ============================================================================
// Consent evidence recorded before this record existed
// ============================================================================

export interface LegacyConsentEvidence {
  key: ConsentKey;
  status: Exclude<ConsentStatus, ''>;
  recordedAt: string;
  source: string;
}

/**
 * Consent the platform already holds from the first-login terms gate
 * (`_termsConsent`) or the onboarding application (`_applicationMeta`). Shown
 * next to an unanswered consent so nobody has to ask twice; never written
 * into `complianceDeclarations` on its own.
 */
export function legacyConsentEvidence(profile: Record<string, unknown>): LegacyConsentEvidence[] {
  const terms = asRecord(profile._termsConsent);
  const app = asRecord(profile._applicationMeta);
  const out: LegacyConsentEvidence[] = [];
  if (terms.popiaConsent === true) {
    out.push({
      key: 'dataProcessing',
      status: 'granted',
      recordedAt: str(terms.acceptedAt),
      source: 'first sign-in terms',
    });
  } else if (app.popiaConsent === true) {
    out.push({ key: 'dataProcessing', status: 'granted', recordedAt: '', source: 'application' });
  }
  if (app.electronicCommunicationConsent === true) {
    out.push({
      key: 'electronicDelivery',
      status: 'granted',
      recordedAt: '',
      source: 'application',
    });
  }
  if (app.communicationConsent === true) {
    out.push({ key: 'marketing', status: 'granted', recordedAt: '', source: 'application' });
  }
  return out;
}
