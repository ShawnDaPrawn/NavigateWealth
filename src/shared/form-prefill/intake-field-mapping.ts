/**
 * Maps simplified client intake field names to full admin wizard field paths.
 */

export type IntakeDomain = 'risk' | 'medical' | 'retirement' | 'investment' | 'tax' | 'estate';

/** Intake key → wizard field path(s) */
const INTAKE_TO_WIZARD: Record<IntakeDomain, Record<string, string | string[]>> = {
  risk: {
    currentAge: 'currentAge',
    grossMonthlyIncome: 'grossMonthlyIncome',
    netMonthlyIncome: 'netMonthlyIncome',
    totalOutstandingDebts: 'totalOutstandingDebts',
    dependantsSummary: 'dependants',
    existingCoverSummary: 'existingCover',
  },
  tax: {
    taxNumber: 'taxNumber',
    annualTaxableIncome: 'employmentIncome',
    tfsaContributions: 'tfsaContributionsLifetime',
    taxConcerns: 'notes',
  },
  estate: {
    hasValidWill: 'willInfo.hasValidWill',
    maritalStatus: 'familyInfo.maritalStatus',
    estimatedEstateValue: 'assumptions.estimatedEstateValue',
    estateNotes: 'notes',
  },
  investment: {
    investmentGoals: 'goals',
    investmentHorizonYears: 'economicAssumptions.investmentHorizonYears',
    monthlyContribution: 'discretionaryInvestments.0.monthlyContribution',
    riskTolerance: 'clientRiskProfile',
  },
  medical: {},
  retirement: {},
};

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

/**
 * Normalize simplified intake inputs into wizard-shaped objects.
 * Text summaries (dependants, cover) stay as strings where the wizard expects structured data later.
 */
export function normalizeIntakeToWizard(
  domain: IntakeDomain,
  inputs: Record<string, unknown>,
): Record<string, unknown> {
  const usesFullStep1Payload =
    (domain === 'risk' &&
      (Array.isArray(inputs.dependants) || inputs.existingCover !== undefined)) ||
    (domain === 'tax' && (inputs.employmentIncome !== undefined || inputs.age !== undefined)) ||
    domain === 'medical' ||
    domain === 'retirement' ||
    (domain === 'investment' && Array.isArray(inputs.goals)) ||
    (domain === 'estate' && (Array.isArray(inputs.assets) || inputs.willInfo !== undefined));

  if (usesFullStep1Payload) {
    return { ...inputs };
  }

  const mapping = INTAKE_TO_WIZARD[domain];
  const result: Record<string, unknown> = {};

  for (const [intakeKey, wizardPath] of Object.entries(mapping)) {
    if (!(intakeKey in inputs)) continue;
    const value = inputs[intakeKey];
    if (value === undefined || value === null || value === '') continue;

    if (intakeKey === 'currentAge' || intakeKey === 'investmentHorizonYears') {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        setNestedValue(result, wizardPath as string, num);
      }
      continue;
    }

    if (
      intakeKey === 'grossMonthlyIncome' ||
      intakeKey === 'netMonthlyIncome' ||
      intakeKey === 'totalOutstandingDebts' ||
      intakeKey === 'annualTaxableIncome' ||
      intakeKey === 'estimatedEstateValue' ||
      intakeKey === 'monthlyContribution' ||
      intakeKey === 'tfsaContributions'
    ) {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        setNestedValue(result, wizardPath as string, num);
      }
      continue;
    }

    if (intakeKey === 'dependantsSummary' && typeof value === 'string') {
      result.dependantsSummary = value;
      continue;
    }

    if (intakeKey === 'existingCoverSummary' && typeof value === 'string') {
      result.existingCoverSummary = value;
      continue;
    }

    setNestedValue(result, wizardPath as string, value);
  }

  return result;
}

export function mergePrefillValues(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined || value === null || value === '') continue;
    if (merged[key] === undefined || merged[key] === null || merged[key] === '') {
      merged[key] = value;
    }
  }
  return merged;
}
