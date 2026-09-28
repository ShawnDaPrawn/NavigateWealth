/**
 * Estate Planning wizard — building, merging and checking the inputs.
 */

import type { EstatePlanningInputs } from '../types';
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
