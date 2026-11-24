/**
 * Benefits an employer provides, recorded on each employer in the client's
 * profile (`employers[].benefits`). An adviser needs them to work out the
 * client's real cover gap: group life and disability reduce what the client
 * must buy privately, and the retirement fund type changes the retirement and
 * estate picture.
 */

export type RetirementFundType = '' | 'pension' | 'provident' | 'none';
export type BenefitYesNo = '' | 'yes' | 'no';

export const RETIREMENT_FUND_TYPE_OPTIONS: Array<{
  value: Exclude<RetirementFundType, ''>;
  label: string;
}> = [
  { value: 'pension', label: 'Pension fund' },
  { value: 'provident', label: 'Provident fund' },
  { value: 'none', label: 'No employer retirement fund' },
];

export interface EmployerBenefits {
  retirementFund: RetirementFundType;
  /** Group life cover, rand lump sum. 0 = none or unknown. */
  groupLifeCover: number;
  /** Group lump-sum disability cover, rand. */
  groupDisabilityLumpSum: number;
  /** Group income protection, rand per month. */
  groupIncomeProtection: number;
  /** Group severe illness (dread disease) cover, rand. */
  groupSevereIllness: number;
  medicalAidSubsidy: BenefitYesNo;
}

export function emptyEmployerBenefits(): EmployerBenefits {
  return {
    retirementFund: '',
    groupLifeCover: 0,
    groupDisabilityLumpSum: 0,
    groupIncomeProtection: 0,
    groupSevereIllness: 0,
    medicalAidSubsidy: '',
  };
}

export function normalizeEmployerBenefits(raw: unknown): EmployerBenefits {
  const r =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
  const fund = ['', 'pension', 'provident', 'none'].includes(r.retirementFund as string)
    ? (r.retirementFund as RetirementFundType)
    : '';
  const subsidy = ['', 'yes', 'no'].includes(r.medicalAidSubsidy as string)
    ? (r.medicalAidSubsidy as BenefitYesNo)
    : '';
  return {
    retirementFund: fund,
    groupLifeCover: num(r.groupLifeCover),
    groupDisabilityLumpSum: num(r.groupDisabilityLumpSum),
    groupIncomeProtection: num(r.groupIncomeProtection),
    groupSevereIllness: num(r.groupSevereIllness),
    medicalAidSubsidy: subsidy,
  };
}

/** True when anything at all has been recorded. */
export function hasEmployerBenefits(b: EmployerBenefits): boolean {
  return (
    b.retirementFund !== '' ||
    b.groupLifeCover > 0 ||
    b.groupDisabilityLumpSum > 0 ||
    b.groupIncomeProtection > 0 ||
    b.groupSevereIllness > 0 ||
    b.medicalAidSubsidy !== ''
  );
}

const AMOUNT_LABELS: Array<{
  field:
    'groupLifeCover' | 'groupDisabilityLumpSum' | 'groupIncomeProtection' | 'groupSevereIllness';
  label: string;
}> = [
  { field: 'groupLifeCover', label: 'Group life cover' },
  { field: 'groupDisabilityLumpSum', label: 'Group disability (lump sum)' },
  { field: 'groupIncomeProtection', label: 'Group income protection (per month)' },
  { field: 'groupSevereIllness', label: 'Group severe illness cover' },
];

/** Labels for the four rand amounts, in display order. */
export const EMPLOYER_BENEFIT_AMOUNT_FIELDS = AMOUNT_LABELS;

/**
 * One readable line per recorded benefit, e.g. "Group life cover: R 1,500,000".
 * Empty when nothing is recorded. `formatAmount` is the caller's rand formatter.
 */
export function employerBenefitLines(
  value: unknown,
  formatAmount: (amount: number) => string,
): string[] {
  const b = normalizeEmployerBenefits(value);
  if (!hasEmployerBenefits(b)) return [];
  const lines: string[] = [];
  const fund = RETIREMENT_FUND_TYPE_OPTIONS.find((o) => o.value === b.retirementFund);
  if (fund) lines.push(fund.label);
  for (const { field, label } of AMOUNT_LABELS) {
    if (b[field] > 0) lines.push(`${label}: ${formatAmount(b[field])}`);
  }
  if (b.medicalAidSubsidy === 'yes') lines.push('Medical aid subsidy');
  if (b.medicalAidSubsidy === 'no') lines.push('No medical aid subsidy');
  return lines;
}
