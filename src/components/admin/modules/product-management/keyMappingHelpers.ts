import { ProductCategoryId, ProductKeyCategory } from './types';
import { getKeysByCategory } from './keyManagerConstants';

/**
 * Maps product category IDs to key categories
 */
export function getKeyCategoryForProductCategory(productCategoryId: ProductCategoryId): ProductKeyCategory | null {
  const mapping: Record<ProductCategoryId, ProductKeyCategory | null> = {
    risk_planning: 'risk',
    medical_aid: 'medical_aid',
    retirement_planning: 'retirement_pre',
    retirement_pre: 'retirement_pre',
    retirement_post: 'retirement_post',
    investments: 'invest_voluntary',
    investments_voluntary: 'invest_voluntary',
    investments_guaranteed: 'invest_guaranteed',
    employee_benefits: 'employee_benefits', // Default/Legacy
    employee_benefits_risk: 'employee_benefits_risk',
    employee_benefits_retirement: 'employee_benefits_retirement',
    tax_planning: 'tax',
    estate_planning: 'estate_planning',
  };
  
  return mapping[productCategoryId] ?? null;
}

/**
 * Gets available keys for a product category
 * Only returns assignable (non-calculated) keys for field mapping
 */
export function getAvailableKeysForCategory(productCategoryId: ProductCategoryId) {
  const keyCategory = getKeyCategoryForProductCategory(productCategoryId);
  if (!keyCategory) return [];
  
  const allKeys = getKeysByCategory(keyCategory);
  
  // Filter out calculated keys - only return assignable field keys
  return allKeys.filter(key => !key.isCalculated);
}