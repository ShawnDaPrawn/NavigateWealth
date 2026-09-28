/**
 * Estate Planning wizard — building, merging and checking the inputs.
 */

import type { EstatePlanningAsset, EstatePlanningInputs, LiabilityItem } from '../types';
import { ESTATE_PLANNING_CONSTANTS } from '../constants';

export type EstateStep1Tab = 'family' | 'will' | 'records';

const NESTED_FIELDS = ['familyInfo', 'willInfo', 'assumptions'] as const;

export function buildDefaultEstateInputs(): EstatePlanningInputs {
  return {
    familyInfo: {
      fullName: '',
      dateOfBirth: '',
      age: 0,
      maritalStatus: 'single',
      citizenship: 'South Africa',
      taxResidency: 'South Africa',
    },
    dependants: [],
    willInfo: {
      hasValidWill: 'unknown',
      executorNominated: 'unknown',
      guardianNominated: 'unknown',
      specialBequests: [],
      willNeedsUpdate: false,
    },
    assets: [],
    liabilities: [],
    lifePolicies: [],
    assumptions: {
      executorFeePercentage: ESTATE_PLANNING_CONSTANTS.DEFAULT_EXECUTOR_FEE_PERCENTAGE,
      conveyancingFeesPerProperty: ESTATE_PLANNING_CONSTANTS.DEFAULT_CONVEYANCING_FEE_PER_PROPERTY,
      masterFeesEstimate: ESTATE_PLANNING_CONSTANTS.DEFAULT_MASTER_FEES,
      funeralCostsEstimate: ESTATE_PLANNING_CONSTANTS.DEFAULT_FUNERAL_COSTS,
      estateDutyRate: ESTATE_PLANNING_CONSTANTS.ESTATE_DUTY_RATE,
      estateDutyAbatement: ESTATE_PLANNING_CONSTANTS.ESTATE_DUTY_ABATEMENT,
      spousalBequest: false,
      cgtInclusionRate: ESTATE_PLANNING_CONSTANTS.CGT_INCLUSION_RATE_INDIVIDUAL,
    },
    hasOffshorAssets: false,
    hasTrusts: false,
    planningNotes: '',
  };
}

/** Merges a partial (records, an intake) one level deep, so a partial willInfo keeps its defaults. */
export function mergeEstateInputs(
  base: EstatePlanningInputs,
  patch: Record<string, unknown> | undefined,
): EstatePlanningInputs {
  if (!patch) return base;
  const next = { ...base, ...patch } as EstatePlanningInputs & Record<string, unknown>;
  for (const key of NESTED_FIELDS) {
    const value = patch[key];
    if (value && typeof value === 'object') {
      next[key] = { ...base[key], ...(value as object) } as never;
    } else {
      next[key] = base[key] as never;
    }
  }
  return next;
}

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

/** Applies reviewed prefill values, which may be nested (`familyInfo.age`). */
export function mergePrefillIntoEstateInputs(
  base: EstatePlanningInputs,
  values: Record<string, unknown>,
): EstatePlanningInputs {
  const next = { ...base, familyInfo: { ...base.familyInfo } } as EstatePlanningInputs &
    Record<string, unknown>;
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key.includes('.')) {
      setNestedValue(next as Record<string, unknown>, key, value);
    } else if (key in next) {
      (next as Record<string, unknown>)[key] = value;
    }
  });
  return next as EstatePlanningInputs;
}

export function findEstateStep1Problem(
  inputs: EstatePlanningInputs,
): { tab: EstateStep1Tab; message: string } | null {
  if (!inputs.familyInfo.fullName.trim()) {
    return { tab: 'family', message: 'Please provide the client’s full name' };
  }
  if (!inputs.familyInfo.age || inputs.familyInfo.age <= 0) {
    return { tab: 'family', message: 'Please provide the client’s age' };
  }
  return null;
}

// ── Client intake ────────────────────────────────────────────────────────────

const INTAKE_MARITAL_STATUS: Record<string, EstatePlanningInputs['familyInfo']['maritalStatus']> = {
  married_in_community: 'married_cop',
  married_out_community: 'married_anc',
};

const ESTATE_MARITAL_STATUSES = new Set<string>([
  'single',
  'married_cop',
  'married_anc',
  'married_customary',
  'divorced',
  'widowed',
]);

function toAmount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRow(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The client estate intake lists assets as `{ description, value }`. The
 * calculation needs the full asset shape; an asset the client only named and
 * valued is counted as a personal, illiquid asset held solely in the estate —
 * the adviser refines it in the client's Assets section.
 */
function toEstateAsset(row: Record<string, unknown>, index: number): EstatePlanningAsset | null {
  if ('currentValue' in row && 'type' in row) return row as unknown as EstatePlanningAsset;
  const description = String(row.description ?? '').trim();
  const currentValue = toAmount(row.value);
  if (!description && currentValue === 0) return null;
  return {
    id: String(row.id ?? `intake-asset-${index + 1}`),
    type: 'personal',
    subType: 'other',
    description: description || `Asset ${index + 1}`,
    currentValue,
    ownership: 'sole',
    ownershipPercentage: 100,
    location: 'south_africa',
    liquidity: 'illiquid',
    includeInEstate: true,
  };
}

/** The client estate intake lists liabilities as `{ description, value }`. */
function toEstateLiability(row: Record<string, unknown>, index: number): LiabilityItem | null {
  if ('outstandingBalance' in row && 'type' in row) {
    return {
      ...(row as unknown as LiabilityItem),
      outstandingBalance: toAmount(row.outstandingBalance),
    };
  }
  const description = String(row.description ?? '').trim();
  const outstandingBalance = toAmount(row.value);
  if (!description && outstandingBalance === 0) return null;
  return {
    id: String(row.id ?? `intake-liability-${index + 1}`),
    type: 'other',
    description: description || `Liability ${index + 1}`,
    outstandingBalance,
    lifeCoverCeded: false,
  };
}

/**
 * Turns an accepted client intake into Estate Planning inputs.
 *
 * - Dotted keys (`familyInfo.fullName`, added when the adviser applies review
 *   matches at accept) become nested values.
 * - Intake asset and liability rows become the shapes the calculation reads.
 * - The intake's marital status options map onto Estate Planning's.
 */
export function normalizeEstateIntake(
  intake: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!intake) return {};
  const result: Record<string, unknown> = {};
  const nested: [string, unknown][] = [];

  for (const [key, value] of Object.entries(intake)) {
    if (key.includes('.')) nested.push([key, value]);
    else result[key] = isRow(value) ? { ...value } : value;
  }
  for (const [path, value] of nested) {
    if (value === undefined || value === null || value === '') continue;
    const [head, ...rest] = path.split('.');
    const target = (isRow(result[head]) ? result[head] : (result[head] = {})) as Record<
      string,
      unknown
    >;
    setNestedValue(target, rest.join('.'), value);
  }

  if (Array.isArray(result.assets)) {
    result.assets = result.assets
      .filter(isRow)
      .map(toEstateAsset)
      .filter((a): a is EstatePlanningAsset => a !== null);
  }
  if (Array.isArray(result.liabilities)) {
    result.liabilities = result.liabilities
      .filter(isRow)
      .map(toEstateLiability)
      .filter((l): l is LiabilityItem => l !== null);
  }

  if (isRow(result.familyInfo)) {
    const status = String(result.familyInfo.maritalStatus ?? '');
    const mapped =
      INTAKE_MARITAL_STATUS[status] ?? (ESTATE_MARITAL_STATUSES.has(status) ? status : undefined);
    if (mapped) result.familyInfo.maritalStatus = mapped;
    else delete result.familyInfo.maritalStatus;
  }

  return result;
}
