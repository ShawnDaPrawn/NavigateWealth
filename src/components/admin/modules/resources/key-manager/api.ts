/**
 * Key Manager API
 * Single source of truth for all key operations
 * This is the public interface that other modules should use
 */

import { 
  ALL_PRODUCT_KEYS, 
  KEY_CATEGORIES, 
  getKeysByCategory as getKeysByCategoryInternal 
} from '../../product-management';
import {
  ProductKey,
  ProductKeyCategory,
  KeyFilterOptions,
  KeyMetadata,
  CategoryMetadata,
  KeyLookupResult,
  KeySelectorOption,
  KeyUsageInfo,
} from './types';
import {
  getKeyById,
  getKeysByIds,
  getKeyName,
  getKeyUsage,
  isKeyUsed,
  getKeysByModule,
  getKeyDependencies,
  getKeyDependencyNames,
  filterKeysByCategory,
  filterKeysByDataType,
  filterKeysBySearch,
  getClientProfileKeys,
  getProductKeys,
  getCalculatedKeys,
  getIndividualKeys,
  getKeyMetadata,
  getCategoryMetadata,
  validateKeyId,
  validateKeyIds,
  isValidKeyAssignment,
  formatKeyValue,
  getKeyPurpose,
  getDataTypes,
  countKeysByCategory,
  countKeysByDataType,
  isClientProfileKey,
  isProductKey,
  isCalculatedKey,
  isIndividualKey,
  isProfileCategory,
  isProductCategory,
  getProfileCategories,
  getProductCategories,
} from './utils';
import { KEY_USAGE_MAP, KEY_MODULES } from './constants';

/**
 * Key Manager API
 * Central API for all key-related operations
 */
export const KeyAPI = {
  // ----------------------------------------------------------------------------
  // Constants (re-exported for convenience)
  // ----------------------------------------------------------------------------
  
  /**
   * All product keys
   */
  ALL_PRODUCT_KEYS,

  /**
   * All key categories
   */
  KEY_CATEGORIES,

  /**
   * Key usage mapping
   */
  KEY_USAGE_MAP,

  /**
   * Module names
   */
  KEY_MODULES,

  // ----------------------------------------------------------------------------
  // Core Lookup Methods
  // ----------------------------------------------------------------------------

  /**
   * Get a single key by its ID
   */
  getKeyById,

  /**
   * Get multiple keys by their IDs
   */
  getKeysByIds,

  /**
   * Get a key's display name by ID
   */
  getKeyName,

  /**
   * Get all keys
   */
  getAllKeys(): ProductKey[] {
    return ALL_PRODUCT_KEYS;
  },

  /**
   * Get keys by category
   */
  getKeysByCategory(category: ProductKeyCategory): ProductKey[] {
    return getKeysByCategoryInternal(category);
  },

  /**
   * Get keys by data type
   */
  getKeysByDataType(dataType: string): ProductKey[] {
    return ALL_PRODUCT_KEYS.filter(key => key.dataType === dataType);
  },

  /**
   * Search keys by term (searches name, description, ID)
   */
  searchKeys(searchTerm: string): ProductKey[] {
    return filterKeysBySearch(ALL_PRODUCT_KEYS, searchTerm);
  },

  // ----------------------------------------------------------------------------
  // Filtering Methods
  // ----------------------------------------------------------------------------

  /**
   * Get client profile keys only
   */
  getClientProfileKeys,

  /**
   * Get product keys only (excludes profile keys)
   */
  getProductKeys,

  /**
   * Get calculated total keys only
   */
  getCalculatedKeys,

  /**
   * Get individual (non-calculated) keys only
   */
  getIndividualKeys,

  /**
   * Advanced filtering with multiple criteria
   */
  filterKeys(options: KeyFilterOptions): ProductKey[] {
    let keys = ALL_PRODUCT_KEYS;

    // Filter by type (client/product/calculated)
    if (options.filterType === 'client') {
      keys = getClientProfileKeys(keys);
    } else if (options.filterType === 'product') {
      keys = getProductKeys(keys);
    } else if (options.filterType === 'calculated') {
      keys = getCalculatedKeys(keys);
    }

    // Filter by category
    if (options.category && options.category !== 'all') {
      keys = filterKeysByCategory(keys, options.category);
    }

    // Filter by data type
    if (options.dataType && options.dataType !== 'all') {
      keys = filterKeysByDataType(keys, options.dataType);
    }

    // Filter by search term
    if (options.searchTerm) {
      keys = filterKeysBySearch(keys, options.searchTerm);
    }

    return keys;
  },

  // ----------------------------------------------------------------------------
  // Usage & Dependencies
  // ----------------------------------------------------------------------------

  /**
   * Get all modules that use a specific key
   */
  getKeyUsage,

  /**
   * Check if a key is used by any module
   */
  isKeyUsed,

  /**
   * Get all keys used by a specific module
   */
  getKeysByModule,

  /**
   * Get dependency key IDs for a calculated key
   */
  getKeyDependencies,

  /**
   * Get dependency key names for a calculated key
   */
  getKeyDependencyNames,

  /**
   * Get complete lookup result with usage and dependencies
   */
  getKeyLookup(keyId: string): KeyLookupResult | undefined {
    const key = getKeyById(keyId);
    if (!key) return undefined;

    return {
      key,
      usedBy: getKeyUsage(keyId),
      dependencies: getKeyDependencies(keyId),
    };
  },

  /**
   * Get usage information for all keys
   */
  getAllKeyUsage(): KeyUsageInfo[] {
    return Object.entries(KEY_USAGE_MAP).map(([keyId, modules]) => ({
      keyId,
      keyName: getKeyName(keyId),
      modules,
      dependencies: getKeyDependencies(keyId),
    }));
  },

  // ----------------------------------------------------------------------------
  // Validation
  // ----------------------------------------------------------------------------

  /**
   * Validate that a key ID exists
   */
  validateKeyId,

  /**
   * Validate that all key IDs exist
   */
  validateKeyIds,

  /**
   * Check if a key can be assigned to a product category
   */
  isValidKeyAssignment,

  // ----------------------------------------------------------------------------
  // Metadata & Statistics
  // ----------------------------------------------------------------------------

  /**
   * Get all unique data types
   */
  getDataTypes,

  /**
   * Get comprehensive metadata about all keys
   */
  getKeyMetadata,

  /**
   * Get metadata for a specific category
   */
  getCategoryMetadata,

  /**
   * Get all category definitions
   */
  getAllCategories() {
    return KEY_CATEGORIES;
  },

  /**
   * Count keys by category
   */
  countKeysByCategory,

  /**
   * Count keys by data type
   */
  countKeysByDataType,

  /**
   * Get key count
   */
  getKeyCount(): number {
    return ALL_PRODUCT_KEYS.length;
  },

  // ----------------------------------------------------------------------------
  // Formatting & Display
  // ----------------------------------------------------------------------------

  /**
   * Format a key value for display
   */
  formatKeyValue,

  /**
   * Get a friendly description of a key's purpose
   */
  getKeyPurpose,

  // ----------------------------------------------------------------------------
  // Classification Helpers
  // ----------------------------------------------------------------------------

  /**
   * Check if a key is a client profile key
   */
  isClientProfileKey,

  /**
   * Check if a key is a product key
   */
  isProductKey,

  /**
   * Check if a key is a calculated key
   */
  isCalculatedKey,

  /**
   * Check if a key is an individual key
   */
  isIndividualKey,

  /**
   * Check if a category is a profile category
   */
  isProfileCategory,

  /**
   * Check if a category is a product category
   */
  isProductCategory,

  /**
   * Get all profile category IDs
   */
  getProfileCategories,

  /**
   * Get all product category IDs
   */
  getProductCategories,

  // ----------------------------------------------------------------------------
  // Integration Methods (for Form Builder, Advice Engine, etc.)
  // ----------------------------------------------------------------------------

  /**
   * Get keys formatted as selector options for dropdowns
   */
  getKeySelectorOptions(
    category?: ProductKeyCategory,
    includeCalculated: boolean = false
  ): KeySelectorOption[] {
    let keys = ALL_PRODUCT_KEYS;

    // Filter by category if specified
    if (category) {
      keys = keys.filter(key => key.category === category);
    }

    // Exclude calculated keys unless explicitly requested
    if (!includeCalculated) {
      keys = keys.filter(key => !key.isCalculated);
    }

    // Exclude profile keys (they can't be assigned to product fields)
    keys = keys.filter(key => !isClientProfileKey(key));

    return keys.map(key => ({
      value: key.id,
      label: key.name,
      description: key.description,
      category: key.category,
      dataType: key.dataType,
      isCalculated: key.isCalculated || false,
    }));
  },

  /**
   * Get assignable keys for a product category (for Form Builder)
   * Returns only individual (non-calculated) keys that match the category
   */
  getAssignableKeys(category: ProductKeyCategory): ProductKey[] {
    return ALL_PRODUCT_KEYS.filter(key => 
      key.category === category && 
      !key.isCalculated &&
      !isClientProfileKey(key)
    );
  },

  /**
   * Get calculated keys for a category (for reference/display only)
   */
  getCalculatedKeysForCategory(category: ProductKeyCategory): ProductKey[] {
    return ALL_PRODUCT_KEYS.filter(key => 
      key.category === category && 
      key.isCalculated
    );
  },
};

// Default export for convenience
export default KeyAPI;