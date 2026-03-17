/**
 * Key Manager Module
 * Central export point for all key manager functionality
 * 
 * Usage:
 *   import { KeyAPI } from '@/components/admin/modules/resources/key-manager';
 *   const key = KeyAPI.getKeyById('risk_life_cover');
 */

// Main API - This is what most modules should use
export { KeyAPI, default as KeyManager } from './api';

// Components
export { KeyCard, CategoryFilter, KeyList, SearchFilters } from './components';

// Types
export type {
  ProductKey,
  ProductKeyCategory,
  KeyFilterOptions,
  KeyMetadata,
  CategoryMetadata,
  KeyLookupResult,
  KeySelectorOption,
  KeyUsageInfo,
  ClientKeyValue,
  ClientKeyData,
  KeyFilterType,
} from './types';

// Constants (for UI components that need icons/colors)
export {
  CATEGORY_ICONS,
  DATA_TYPE_COLORS,
  KEY_MODULES,
  KEY_USAGE_MAP,
  PROFILE_CATEGORIES,
  PRODUCT_CATEGORIES,
} from './constants';

// Utility functions (exported for advanced use cases)
export {
  isClientProfileKey,
  isProductKey,
  isCalculatedKey,
  isIndividualKey,
  filterKeysByCategory,
  filterKeysByDataType,
  filterKeysBySearch,
  getClientProfileKeys,
  getProductKeys,
  getCalculatedKeys,
  getIndividualKeys,
  getKeyById,
  getKeysByIds,
  getKeyName,
  getKeyUsage,
  isKeyUsed,
  getKeysByModule,
  getKeyDependencies,
  getKeyDependencyNames,
  getDataTypes,
  countKeysByCategory,
  countKeysByDataType,
  getKeyMetadata,
  getCategoryMetadata,
  validateKeyId,
  validateKeyIds,
  isValidKeyAssignment,
  formatKeyValue,
  getKeyPurpose,
  isProfileCategory,
  isProductCategory,
  getProfileCategories,
  getProductCategories,
} from './utils';