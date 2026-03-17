/**
 * Key Manager Types
 * Type definitions specific to the Universal Key Manager
 */

import { ProductKey, ProductKeyCategory } from '../../product-management';

// Re-export base types for convenience
export type { ProductKey, ProductKeyCategory };

// Filter types
export type KeyFilterType = 'all' | 'client' | 'product' | 'calculated';

export interface KeyFilterOptions {
  category?: ProductKeyCategory | 'all';
  dataType?: string | 'all';
  searchTerm?: string;
  filterType?: KeyFilterType;
}

// Metadata and statistics
export interface KeyMetadata {
  totalKeys: number;
  clientKeys: number;
  productKeys: number;
  calculatedKeys: number;
  categoryCounts: Record<ProductKeyCategory, number>;
  dataTypeCounts: Record<string, number>;
}

export interface CategoryMetadata {
  id: ProductKeyCategory;
  name: string;
  description: string;
  keyCount: number;
}

// Key lookup results
export interface KeyLookupResult {
  key: ProductKey;
  usedBy: string[];
  dependencies: string[];
}

// Key validation
export interface KeyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Integration types for external modules
export interface KeySelectorOption {
  value: string;
  label: string;
  description: string;
  category: ProductKeyCategory;
  dataType: string;
  isCalculated: boolean;
}

export interface KeyUsageInfo {
  keyId: string;
  keyName: string;
  modules: string[];
  dependencies: string[];
}

// Client key value storage
export interface ClientKeyValue {
  keyId: string;
  value: unknown;
  lastUpdated: string;
  source?: string; // Which module/form updated it
}

export interface ClientKeyData {
  clientId: string;
  keys: Record<string, unknown>;
  lastSync: string;
}
