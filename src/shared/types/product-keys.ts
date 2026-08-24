/**
 * Product key definitions — the vocabulary of the key manager.
 *
 * A product key names one value that can be derived from a client's policies.
 * Three separate places model them: product-management defines the canonical
 * registry, resources/key-manager provides the UI for browsing and assigning
 * them, and client-keys resolves a client's stored values against them. None
 * of the three owns the shape, so it lives here.
 */

export type ProductKeyCategory =
  | 'risk'
  | 'medical_aid'
  | 'retirement_pre'
  | 'retirement_post'
  | 'invest_voluntary'
  | 'invest_guaranteed'
  | 'employee_benefits'
  | 'employee_benefits_risk'
  | 'employee_benefits_retirement'
  | 'estate_planning'
  | 'tax'
  | 'profile_personal'
  | 'profile_contact'
  | 'profile_identity'
  | 'profile_address'
  | 'profile_employment'
  | 'profile_health'
  | 'profile_family'
  | 'profile_banking'
  | 'profile_risk'
  | 'profile_financial';

export interface ProductKey {
  id: string;
  category: ProductKeyCategory;
  name: string;
  description: string;
  dataType: 'number' | 'currency' | 'percentage' | 'date' | 'text' | 'boolean';
  isCalculated?: boolean; // True for totals/calculated fields, false/undefined for assignable fields
  calculatedFrom?: string[]; // Array of key IDs that this total is calculated from
  isRecommendation?: boolean; // True for keys that store FNA recommended values
}
