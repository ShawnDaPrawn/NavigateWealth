/**
 * Profile fields added in November 2026, in one place.
 *
 * Both profile editors — the client portal (`useProfileManager`) and the admin
 * viewer (`useClientProfile`) — keep their own `ProfileData` type and their own
 * load-and-merge step. Rather than repeat these fields and their defaults in
 * each, both extend `ProfileExtensionFields` and run
 * `normalizeProfileExtensionFields` on the stored record when it loads, so an
 * older record (which has none of these keys) opens with complete, typed values.
 */
import {
  type ComplianceDeclarations,
  emptyComplianceDeclarations,
  normalizeComplianceDeclarations,
} from '../compliance/clientCompliance';
import {
  type PlanningProfile,
  type ProfileGoal,
  emptyPlanningProfile,
  normalizePlanningProfile,
  normalizeProfileGoals,
} from './planning';

export const ALCOHOL_CONSUMPTION_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'occasionally', label: 'Occasionally (a few drinks a month)' },
  { value: 'moderately', label: 'Moderately (a few drinks a week)' },
  { value: 'frequently', label: 'Frequently (most days)' },
] as const;

export interface PostalAddressFields {
  /** When true the postal fields are ignored and the residential address applies. */
  postalSameAsResidential: boolean;
  postalAddressLine1: string;
  postalAddressLine2: string;
  postalSuburb: string;
  postalCity: string;
  postalProvince: string;
  postalPostalCode: string;
  postalCountry: string;
}

export interface ProfileExtensionFields extends PostalAddressFields {
  /** Only meaningful when `smokerStatus` is false. */
  formerSmoker: boolean;
  /** Four-digit year the client stopped smoking. */
  quitSmokingYear: string;
  alcoholConsumption: string;

  complianceDeclarations: ComplianceDeclarations;
  profileGoals: ProfileGoal[];
  planningProfile: PlanningProfile;
}

export function defaultProfileExtensionFields(): ProfileExtensionFields {
  return {
    postalSameAsResidential: true,
    postalAddressLine1: '',
    postalAddressLine2: '',
    postalSuburb: '',
    postalCity: '',
    postalProvince: '',
    postalPostalCode: '',
    postalCountry: 'South Africa',
    formerSmoker: false,
    quitSmokingYear: '',
    alcoholConsumption: '',
    complianceDeclarations: emptyComplianceDeclarations(),
    profileGoals: [],
    planningProfile: emptyPlanningProfile(),
  };
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Complete values for every extension field from a stored profile record. */
export function normalizeProfileExtensionFields(
  raw: Record<string, unknown> | null | undefined,
): ProfileExtensionFields {
  const r = raw ?? {};
  const d = defaultProfileExtensionFields();
  return {
    postalSameAsResidential:
      typeof r.postalSameAsResidential === 'boolean'
        ? r.postalSameAsResidential
        : !str(r.postalAddressLine1),
    postalAddressLine1: str(r.postalAddressLine1),
    postalAddressLine2: str(r.postalAddressLine2),
    postalSuburb: str(r.postalSuburb),
    postalCity: str(r.postalCity),
    postalProvince: str(r.postalProvince),
    postalPostalCode: str(r.postalPostalCode),
    postalCountry: str(r.postalCountry) || d.postalCountry,
    formerSmoker: r.formerSmoker === true,
    quitSmokingYear: str(r.quitSmokingYear),
    alcoholConsumption: str(r.alcoholConsumption),
    complianceDeclarations: normalizeComplianceDeclarations(r.complianceDeclarations),
    profileGoals: normalizeProfileGoals(r.profileGoals),
    planningProfile: normalizePlanningProfile(r.planningProfile),
  };
}

/** One-line postal address for display, or '' when it is the residential one. */
export function formatPostalAddress(p: PostalAddressFields): string {
  if (p.postalSameAsResidential) return '';
  return [
    p.postalAddressLine1,
    p.postalAddressLine2,
    p.postalSuburb,
    p.postalCity,
    p.postalProvince,
    p.postalPostalCode,
    p.postalCountry,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * What the onboarding application recorded that the new sections can use.
 * Approval copies it into the profile's `_applicationMeta`
 * (`buildClientProfileFromApplication`), where nothing showed it until now.
 */
export function applicationHints(profile: Record<string, unknown> | null | undefined): {
  goals: string;
  saTaxResident: boolean;
} {
  const meta = profile?._applicationMeta;
  const m =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : {};
  return {
    goals: str(m.financialGoals),
    saTaxResident: m.isSATaxResident === true,
  };
}
