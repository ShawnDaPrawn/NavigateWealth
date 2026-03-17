/**
 * Key Manager Utilities
 * Pure utility functions for key operations
 */

import { ProductKey, ProductKeyCategory, KeyMetadata, CategoryMetadata } from './types';
import { KEY_USAGE_MAP, PROFILE_CATEGORIES, PRODUCT_CATEGORIES } from './constants';
import { ALL_PRODUCT_KEYS, KEY_CATEGORIES } from '../../product-management';

// ----------------------------------------------------------------------------
// Key Classification Utilities
// ----------------------------------------------------------------------------

/**
 * Check if a key is a client profile key
 */
export function isClientProfileKey(key: ProductKey): boolean {
  return key.category.startsWith('profile_');
}

/**
 * Check if a key is a product key (not a profile key)
 */
export function isProductKey(key: ProductKey): boolean {
  return !key.category.startsWith('profile_');
}

/**
 * Check if a key is a calculated total key
 */
export function isCalculatedKey(key: ProductKey): boolean {
  return key.isCalculated === true;
}

/**
 * Check if a key is an individual (non-calculated) key
 */
export function isIndividualKey(key: ProductKey): boolean {
  return key.isCalculated !== true;
}

// ----------------------------------------------------------------------------
// Key Filtering Utilities
// ----------------------------------------------------------------------------

/**
 * Filter keys by category
 */
export function filterKeysByCategory(
  keys: ProductKey[], 
  category: ProductKeyCategory | 'all'
): ProductKey[] {
  if (category === 'all') return keys;
  return keys.filter(key => key.category === category);
}

/**
 * Filter keys by data type
 */
export function filterKeysByDataType(
  keys: ProductKey[], 
  dataType: string | 'all'
): ProductKey[] {
  if (dataType === 'all') return keys;
  return keys.filter(key => key.dataType === dataType);
}

/**
 * Filter keys by search term (searches name, description, and ID)
 */
export function filterKeysBySearch(
  keys: ProductKey[], 
  searchTerm: string
): ProductKey[] {
  if (!searchTerm) return keys;
  const term = searchTerm.toLowerCase();
  return keys.filter(key => 
    key.name.toLowerCase().includes(term) ||
    key.description.toLowerCase().includes(term) ||
    key.id.toLowerCase().includes(term)
  );
}

/**
 * Get all client profile keys
 */
export function getClientProfileKeys(keys: ProductKey[] = ALL_PRODUCT_KEYS): ProductKey[] {
  return keys.filter(isClientProfileKey);
}

/**
 * Get all product keys (exclude profile keys)
 */
export function getProductKeys(keys: ProductKey[] = ALL_PRODUCT_KEYS): ProductKey[] {
  return keys.filter(isProductKey);
}

/**
 * Get all calculated keys
 */
export function getCalculatedKeys(keys: ProductKey[] = ALL_PRODUCT_KEYS): ProductKey[] {
  return keys.filter(isCalculatedKey);
}

/**
 * Get all individual (non-calculated) keys
 */
export function getIndividualKeys(keys: ProductKey[] = ALL_PRODUCT_KEYS): ProductKey[] {
  return keys.filter(isIndividualKey);
}

// ----------------------------------------------------------------------------
// Key Lookup Utilities
// ----------------------------------------------------------------------------

/**
 * Find a key by its ID
 */
export function getKeyById(keyId: string): ProductKey | undefined {
  return ALL_PRODUCT_KEYS.find(key => key.id === keyId);
}

/**
 * Find multiple keys by their IDs
 */
export function getKeysByIds(keyIds: string[]): ProductKey[] {
  return keyIds
    .map(id => getKeyById(id))
    .filter((key): key is ProductKey => key !== undefined);
}

/**
 * Get key name by ID (returns ID if not found)
 */
export function getKeyName(keyId: string): string {
  const key = getKeyById(keyId);
  return key?.name || keyId;
}

// ----------------------------------------------------------------------------
// Key Usage Utilities
// ----------------------------------------------------------------------------

/**
 * Get all modules that use a specific key
 */
export function getKeyUsage(keyId: string): string[] {
  return KEY_USAGE_MAP[keyId] || [];
}

/**
 * Check if a key is used by any module
 */
export function isKeyUsed(keyId: string): boolean {
  return getKeyUsage(keyId).length > 0;
}

/**
 * Get all keys used by a specific module
 */
export function getKeysByModule(moduleName: string): ProductKey[] {
  const keyIds = Object.entries(KEY_USAGE_MAP)
    .filter(([, modules]) => modules.includes(moduleName))
    .map(([keyId]) => keyId);
  
  return getKeysByIds(keyIds);
}

/**
 * Get dependencies for a calculated key
 */
export function getKeyDependencies(keyId: string): string[] {
  const key = getKeyById(keyId);
  return key?.calculatedFrom || [];
}

/**
 * Get dependency names for a calculated key
 */
export function getKeyDependencyNames(keyId: string): string[] {
  const dependencies = getKeyDependencies(keyId);
  return dependencies.map(depId => getKeyName(depId));
}

// ----------------------------------------------------------------------------
// Metadata & Statistics Utilities
// ----------------------------------------------------------------------------

/**
 * Get all unique data types from keys
 */
export function getDataTypes(keys: ProductKey[] = ALL_PRODUCT_KEYS): string[] {
  const types = new Set<string>();
  keys.forEach(key => types.add(key.dataType));
  return Array.from(types).sort();
}

/**
 * Count keys by category
 */
export function countKeysByCategory(
  keys: ProductKey[] = ALL_PRODUCT_KEYS
): Record<ProductKeyCategory, number> {
  const counts = {} as Record<ProductKeyCategory, number>;
  
  keys.forEach(key => {
    counts[key.category] = (counts[key.category] || 0) + 1;
  });
  
  return counts;
}

/**
 * Count keys by data type
 */
export function countKeysByDataType(
  keys: ProductKey[] = ALL_PRODUCT_KEYS
): Record<string, number> {
  const counts: Record<string, number> = {};
  
  keys.forEach(key => {
    counts[key.dataType] = (counts[key.dataType] || 0) + 1;
  });
  
  return counts;
}

/**
 * Get comprehensive metadata about all keys
 */
export function getKeyMetadata(): KeyMetadata {
  const clientKeys = getClientProfileKeys();
  const productKeys = getProductKeys();
  const calculatedKeys = getCalculatedKeys();
  
  return {
    totalKeys: ALL_PRODUCT_KEYS.length,
    clientKeys: clientKeys.length,
    productKeys: productKeys.length,
    calculatedKeys: calculatedKeys.length,
    categoryCounts: countKeysByCategory(),
    dataTypeCounts: countKeysByDataType(),
  };
}

/**
 * Get metadata for a specific category
 */
export function getCategoryMetadata(category: ProductKeyCategory): CategoryMetadata | undefined {
  const categoryInfo = KEY_CATEGORIES.find(cat => cat.id === category);
  if (!categoryInfo) return undefined;
  
  const keys = ALL_PRODUCT_KEYS.filter(key => key.category === category);
  
  return {
    id: category,
    name: categoryInfo.name,
    description: categoryInfo.description,
    keyCount: keys.length,
  };
}

// ----------------------------------------------------------------------------
// Validation Utilities
// ----------------------------------------------------------------------------

/**
 * Validate that a key ID exists
 */
export function validateKeyId(keyId: string): boolean {
  return getKeyById(keyId) !== undefined;
}

/**
 * Validate that all key IDs in an array exist
 */
export function validateKeyIds(keyIds: string[]): boolean {
  return keyIds.every(validateKeyId);
}

/**
 * Check if a key can be assigned to a specific product category
 */
export function isValidKeyAssignment(
  keyId: string, 
  productCategory: ProductKeyCategory
): boolean {
  const key = getKeyById(keyId);
  if (!key) return false;
  
  // Profile keys cannot be assigned to product fields
  if (isClientProfileKey(key)) return false;
  
  // Calculated keys cannot be directly assigned
  if (isCalculatedKey(key)) return false;
  
  // Key must match the product category
  return key.category === productCategory;
}

// ----------------------------------------------------------------------------
// Format & Display Utilities
// ----------------------------------------------------------------------------

/**
 * Format a key value for display based on its data type
 */
export function formatKeyValue(key: ProductKey, value: unknown): string {
  if (value === null || value === undefined) return '-';
  
  switch (key.dataType) {
    case 'currency':
      if (typeof value === 'number') {
        const isNeg = value < 0;
        const fixed = Math.abs(value).toFixed(2);
        const [intPart, decPart] = fixed.split('.');
        const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return `${isNeg ? '-' : ''}R${withCommas}.${decPart}`;
      }
      return String(value);
      
    case 'number':
      if (typeof value === 'number') {
        const isNegN = value < 0;
        const parts = Math.abs(value).toString().split('.');
        const intPartN = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return `${isNegN ? '-' : ''}${intPartN}${parts.length > 1 ? '.' + parts[1] : ''}`;
      }
      return String(value);
      
    case 'date':
      if (value instanceof Date) {
        return value.toLocaleDateString('en-ZA');
      }
      if (typeof value === 'string') {
        return new Date(value).toLocaleDateString('en-ZA');
      }
      return String(value);
      
    case 'boolean':
      return value ? 'Yes' : 'No';
      
    default:
      return String(value);
  }
}

/**
 * Get a friendly description of a key's purpose
 */
export function getKeyPurpose(keyId: string): string {
  const usage = getKeyUsage(keyId);
  if (usage.length === 0) return 'Not currently used';
  
  if (usage.length === 1) return `Used in ${usage[0]}`;
  if (usage.length === 2) return `Used in ${usage[0]} and ${usage[1]}`;
  
  return `Used in ${usage.length} modules`;
}

// ----------------------------------------------------------------------------
// Category Helpers
// ----------------------------------------------------------------------------

/**
 * Check if a category is a profile category
 */
export function isProfileCategory(category: ProductKeyCategory): boolean {
  return PROFILE_CATEGORIES.includes(category);
}

/**
 * Check if a category is a product category
 */
export function isProductCategory(category: ProductKeyCategory): boolean {
  return PRODUCT_CATEGORIES.includes(category);
}

/**
 * Get all profile category IDs
 */
export function getProfileCategories(): ProductKeyCategory[] {
  return [...PROFILE_CATEGORIES];
}

/**
 * Get all product category IDs
 */
export function getProductCategories(): ProductKeyCategory[] {
  return [...PRODUCT_CATEGORIES];
}