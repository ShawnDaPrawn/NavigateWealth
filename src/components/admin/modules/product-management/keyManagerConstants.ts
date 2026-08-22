/**
 * Predefined product keys for the Key Manager.
 *
 * These keys represent standard data points that can be mapped from product
 * fields. There are 164 of them across 21 categories; at 1,637 lines they made
 * this the third-largest file in the codebase while containing no logic beyond
 * the composition at the bottom.
 *
 * The definitions now live per domain under `productKeys/`. What stays here is
 * the part that is genuinely about the catalogue as a whole: the aggregate, the
 * category dispatch, and the category list the UI renders. Every array is
 * re-exported, because that aggregate view is the interface consumers use and
 * `product-management/index.ts` re-exports this module wholesale.
 *
 * `__tests__/keyManagerInventory.test.ts` states the exact count per array and
 * checks the aggregate against its parts — a dropped array is still a valid
 * `ProductKey[]`, just a shorter one, so the type system cannot see it.
 */
import type { ProductKey, ProductKeyCategory } from './types';

import { RISK_KEYS } from './productKeys/risk';
import { MEDICAL_AID_KEYS } from './productKeys/medical';
import { RETIREMENT_PRE_KEYS, RETIREMENT_POST_KEYS } from './productKeys/retirement';
import { INVEST_VOLUNTARY_KEYS, INVEST_GUARANTEED_KEYS } from './productKeys/investment';
import {
  EMPLOYEE_BENEFITS_RISK_KEYS,
  EMPLOYEE_BENEFITS_RETIREMENT_KEYS,
  EMPLOYEE_BENEFITS_KEYS,
} from './productKeys/employeeBenefits';
import { ESTATE_PLANNING_KEYS, TAX_KEYS } from './productKeys/estateAndTax';
import {
  PROFILE_PERSONAL_KEYS,
  PROFILE_CONTACT_KEYS,
  PROFILE_IDENTITY_KEYS,
  PROFILE_ADDRESS_KEYS,
} from './productKeys/profileIdentity';
import {
  PROFILE_EMPLOYMENT_KEYS,
  PROFILE_HEALTH_KEYS,
  PROFILE_FAMILY_KEYS,
  PROFILE_BANKING_KEYS,
  PROFILE_RISK_KEYS,
  PROFILE_FINANCIAL_KEYS,
} from './productKeys/profileFinancial';

// Re-exported so consumers can keep importing the catalogue from one place.
export { RISK_KEYS } from './productKeys/risk';
export { MEDICAL_AID_KEYS } from './productKeys/medical';
export { RETIREMENT_PRE_KEYS, RETIREMENT_POST_KEYS } from './productKeys/retirement';
export { INVEST_VOLUNTARY_KEYS, INVEST_GUARANTEED_KEYS } from './productKeys/investment';
export {
  EMPLOYEE_BENEFITS_RISK_KEYS,
  EMPLOYEE_BENEFITS_RETIREMENT_KEYS,
  EMPLOYEE_BENEFITS_KEYS,
} from './productKeys/employeeBenefits';
export { ESTATE_PLANNING_KEYS, TAX_KEYS } from './productKeys/estateAndTax';
export {
  PROFILE_PERSONAL_KEYS,
  PROFILE_CONTACT_KEYS,
  PROFILE_IDENTITY_KEYS,
  PROFILE_ADDRESS_KEYS,
} from './productKeys/profileIdentity';
export {
  PROFILE_EMPLOYMENT_KEYS,
  PROFILE_HEALTH_KEYS,
  PROFILE_FAMILY_KEYS,
  PROFILE_BANKING_KEYS,
  PROFILE_RISK_KEYS,
  PROFILE_FINANCIAL_KEYS,
} from './productKeys/profileFinancial';

// Consolidated key registry
export const ALL_PRODUCT_KEYS: ProductKey[] = [
  ...RISK_KEYS,
  ...MEDICAL_AID_KEYS,
  ...RETIREMENT_PRE_KEYS,
  ...RETIREMENT_POST_KEYS,
  ...INVEST_VOLUNTARY_KEYS,
  ...INVEST_GUARANTEED_KEYS,
  ...EMPLOYEE_BENEFITS_KEYS,
  ...ESTATE_PLANNING_KEYS,
  ...TAX_KEYS,
  ...PROFILE_PERSONAL_KEYS,
  ...PROFILE_CONTACT_KEYS,
  ...PROFILE_IDENTITY_KEYS,
  ...PROFILE_ADDRESS_KEYS,
  ...PROFILE_EMPLOYMENT_KEYS,
  ...PROFILE_HEALTH_KEYS,
  ...PROFILE_FAMILY_KEYS,
  ...PROFILE_BANKING_KEYS,
  ...PROFILE_RISK_KEYS,
  ...PROFILE_FINANCIAL_KEYS,
];

// Helper to get keys by category
export function getKeysByCategory(category: ProductKeyCategory): ProductKey[] {
  switch (category) {
    case 'risk':
      return RISK_KEYS;
    case 'medical_aid':
      return MEDICAL_AID_KEYS;
    case 'retirement_pre':
      return RETIREMENT_PRE_KEYS;
    case 'retirement_post':
      return RETIREMENT_POST_KEYS;
    case 'invest_voluntary':
      return INVEST_VOLUNTARY_KEYS;
    case 'invest_guaranteed':
      return INVEST_GUARANTEED_KEYS;
    case 'employee_benefits':
      return EMPLOYEE_BENEFITS_KEYS;
    case 'employee_benefits_risk':
      return EMPLOYEE_BENEFITS_RISK_KEYS;
    case 'employee_benefits_retirement':
      return EMPLOYEE_BENEFITS_RETIREMENT_KEYS;
    case 'estate_planning':
      return ESTATE_PLANNING_KEYS;
    case 'tax':
      return TAX_KEYS;
    case 'profile_personal':
      return PROFILE_PERSONAL_KEYS;
    case 'profile_contact':
      return PROFILE_CONTACT_KEYS;
    case 'profile_identity':
      return PROFILE_IDENTITY_KEYS;
    case 'profile_address':
      return PROFILE_ADDRESS_KEYS;
    case 'profile_employment':
      return PROFILE_EMPLOYMENT_KEYS;
    case 'profile_health':
      return PROFILE_HEALTH_KEYS;
    case 'profile_family':
      return PROFILE_FAMILY_KEYS;
    case 'profile_banking':
      return PROFILE_BANKING_KEYS;
    case 'profile_risk':
      return PROFILE_RISK_KEYS;
    case 'profile_financial':
      return PROFILE_FINANCIAL_KEYS;
    default:
      return [];
  }
}

// Key categories with display names
export const KEY_CATEGORIES = [
  {
    id: 'risk' as ProductKeyCategory,
    name: 'Risk',
    description: 'Life, disability, and income protection',
  },
  {
    id: 'medical_aid' as ProductKeyCategory,
    name: 'Medical Aid',
    description: 'Medical aid and healthcare',
  },
  {
    id: 'retirement_pre' as ProductKeyCategory,
    name: 'Pre-Retirement',
    description: 'Retirement accumulation (RA, Pension, Provident)',
  },
  {
    id: 'retirement_post' as ProductKeyCategory,
    name: 'Post-Retirement',
    description: 'Retirement income (Living Annuity, etc.)',
  },
  {
    id: 'invest_voluntary' as ProductKeyCategory,
    name: 'Voluntary Investments',
    description: 'Discretionary investments (Unit Trusts, TFSA)',
  },
  {
    id: 'invest_guaranteed' as ProductKeyCategory,
    name: 'Guaranteed Investments',
    description: 'Fixed period/rate investments (Endowments, etc.)',
  },
  {
    id: 'employee_benefits' as ProductKeyCategory,
    name: 'Employee Benefits (General)',
    description: 'General Group benefits and schemes',
  },
  {
    id: 'employee_benefits_risk' as ProductKeyCategory,
    name: 'Employee Benefits (Risk)',
    description: 'Group Risk benefits (Life, Disability, etc.)',
  },
  {
    id: 'employee_benefits_retirement' as ProductKeyCategory,
    name: 'Employee Benefits (Retirement)',
    description: 'Group Retirement benefits (Pension, Provident)',
  },
  {
    id: 'estate_planning' as ProductKeyCategory,
    name: 'Estate Planning',
    description: 'Wills, trusts, and estate',
  },
  { id: 'tax' as ProductKeyCategory, name: 'Tax', description: 'Tax planning and compliance' },
  {
    id: 'profile_personal' as ProductKeyCategory,
    name: 'Personal Information',
    description: 'Client personal details',
  },
  {
    id: 'profile_contact' as ProductKeyCategory,
    name: 'Contact Information',
    description: 'Client contact details',
  },
  {
    id: 'profile_identity' as ProductKeyCategory,
    name: 'Identity Information',
    description: 'Client identity details',
  },
  {
    id: 'profile_address' as ProductKeyCategory,
    name: 'Address Information',
    description: 'Client address details',
  },
  {
    id: 'profile_employment' as ProductKeyCategory,
    name: 'Employment Information',
    description: 'Client employment details',
  },
  {
    id: 'profile_health' as ProductKeyCategory,
    name: 'Health Information',
    description: 'Client health details',
  },
  {
    id: 'profile_family' as ProductKeyCategory,
    name: 'Family Information',
    description: 'Client family details',
  },
  {
    id: 'profile_banking' as ProductKeyCategory,
    name: 'Banking Information',
    description: 'Client banking details',
  },
  {
    id: 'profile_risk' as ProductKeyCategory,
    name: 'Risk Profile',
    description: 'Client risk profile',
  },
  {
    id: 'profile_financial' as ProductKeyCategory,
    name: 'Financial Information',
    description: 'Client financial details',
  },
];
