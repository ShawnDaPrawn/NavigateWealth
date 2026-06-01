/**
 * key-manager/utils — unit tests (Phase 4 coverage push).
 *
 * Product-key classification / filtering / lookup / usage / metadata /
 * validation / formatting helpers. The product-key catalog (ALL_PRODUCT_KEYS,
 * KEY_CATEGORIES) and the usage/category constants are mocked with a small
 * fixture so every helper is exercised against known data.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ProductKey, ProductKeyCategory } from '../types';

const fx = vi.hoisted(() => ({
  ALL_PRODUCT_KEYS: [
    {
      id: 'prof1',
      name: 'Profile Name',
      description: 'personal name',
      category: 'profile_personal',
      dataType: 'text',
    },
    {
      id: 'prod1',
      name: 'Premium',
      description: 'monthly premium',
      category: 'life',
      dataType: 'currency',
    },
    {
      id: 'calc1',
      name: 'Total Cover',
      description: 'total',
      category: 'life',
      dataType: 'currency',
      isCalculated: true,
      calculatedFrom: ['prod1'],
    },
    {
      id: 'prod2',
      name: 'Start Date',
      description: 'inception',
      category: 'life',
      dataType: 'date',
    },
  ],
  KEY_CATEGORIES: [{ id: 'life', name: 'Life', description: 'Life insurance' }],
  KEY_USAGE_MAP: { prod1: ['A', 'B', 'C'], prod2: ['A', 'B'], prof1: ['A'], calc1: [] } as Record<
    string,
    string[]
  >,
  PROFILE_CATEGORIES: ['profile_personal'],
  PRODUCT_CATEGORIES: ['life'],
}));

vi.mock('../../../product-management', () => ({
  ALL_PRODUCT_KEYS: fx.ALL_PRODUCT_KEYS,
  KEY_CATEGORIES: fx.KEY_CATEGORIES,
}));
vi.mock('../constants', () => ({
  KEY_USAGE_MAP: fx.KEY_USAGE_MAP,
  PROFILE_CATEGORIES: fx.PROFILE_CATEGORIES,
  PRODUCT_CATEGORIES: fx.PRODUCT_CATEGORIES,
}));

import {
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
} from '../utils';

const KEYS = fx.ALL_PRODUCT_KEYS as unknown as ProductKey[];
const k = (id: string) => KEYS.find((key) => key.id === id)!;

describe('classification', () => {
  it('distinguishes profile / product / calculated / individual', () => {
    expect(isClientProfileKey(k('prof1'))).toBe(true);
    expect(isClientProfileKey(k('prod1'))).toBe(false);
    expect(isProductKey(k('prod1'))).toBe(true);
    expect(isProductKey(k('prof1'))).toBe(false);
    expect(isCalculatedKey(k('calc1'))).toBe(true);
    expect(isCalculatedKey(k('prod1'))).toBe(false);
    expect(isIndividualKey(k('prod1'))).toBe(true);
    expect(isIndividualKey(k('calc1'))).toBe(false);
  });
});

describe('filtering', () => {
  it('filterKeysByCategory', () => {
    expect(filterKeysByCategory(KEYS, 'all')).toHaveLength(4);
    expect(filterKeysByCategory(KEYS, 'life' as ProductKeyCategory).map((x) => x.id)).toEqual([
      'prod1',
      'calc1',
      'prod2',
    ]);
  });
  it('filterKeysByDataType', () => {
    expect(filterKeysByDataType(KEYS, 'all')).toHaveLength(4);
    expect(filterKeysByDataType(KEYS, 'currency').map((x) => x.id)).toEqual(['prod1', 'calc1']);
  });
  it('filterKeysBySearch matches name/description/id', () => {
    expect(filterKeysBySearch(KEYS, 'premium').map((x) => x.id)).toEqual(['prod1']);
    expect(filterKeysBySearch(KEYS, '')).toHaveLength(4);
  });
  it('catalog getters default to the full key set', () => {
    expect(getClientProfileKeys().map((x) => x.id)).toEqual(['prof1']);
    expect(getProductKeys().map((x) => x.id)).toEqual(['prod1', 'calc1', 'prod2']);
    expect(getCalculatedKeys().map((x) => x.id)).toEqual(['calc1']);
    expect(getIndividualKeys().map((x) => x.id)).toEqual(['prof1', 'prod1', 'prod2']);
  });
});

describe('lookup + usage', () => {
  it('getKeyById / getKeysByIds / getKeyName', () => {
    expect(getKeyById('prod1')?.name).toBe('Premium');
    expect(getKeyById('nope')).toBeUndefined();
    expect(getKeysByIds(['prod1', 'nope', 'calc1']).map((x) => x.id)).toEqual(['prod1', 'calc1']);
    expect(getKeyName('prod1')).toBe('Premium');
    expect(getKeyName('nope')).toBe('nope');
  });
  it('usage helpers', () => {
    expect(getKeyUsage('prod1')).toEqual(['A', 'B', 'C']);
    expect(getKeyUsage('nope')).toEqual([]);
    expect(isKeyUsed('prod1')).toBe(true);
    expect(isKeyUsed('calc1')).toBe(false);
    expect(getKeysByModule('A').map((x) => x.id)).toEqual(['prod1', 'prod2', 'prof1']);
  });
  it('dependencies', () => {
    expect(getKeyDependencies('calc1')).toEqual(['prod1']);
    expect(getKeyDependencies('prod1')).toEqual([]);
    expect(getKeyDependencyNames('calc1')).toEqual(['Premium']);
  });
});

describe('metadata', () => {
  it('getDataTypes (unique, sorted)', () => {
    expect(getDataTypes()).toEqual(['currency', 'date', 'text']);
  });
  it('countKeysByCategory / countKeysByDataType', () => {
    expect(countKeysByCategory()).toEqual({ profile_personal: 1, life: 3 });
    expect(countKeysByDataType()).toEqual({ text: 1, currency: 2, date: 1 });
  });
  it('getKeyMetadata aggregates the catalog', () => {
    expect(getKeyMetadata()).toMatchObject({
      totalKeys: 4,
      clientKeys: 1,
      productKeys: 3,
      calculatedKeys: 1,
    });
  });
  it('getCategoryMetadata', () => {
    expect(getCategoryMetadata('life' as ProductKeyCategory)).toEqual({
      id: 'life',
      name: 'Life',
      description: 'Life insurance',
      keyCount: 3,
    });
    expect(getCategoryMetadata('nope' as ProductKeyCategory)).toBeUndefined();
  });
});

describe('validation + assignment', () => {
  it('validateKeyId / validateKeyIds', () => {
    expect(validateKeyId('prod1')).toBe(true);
    expect(validateKeyId('nope')).toBe(false);
    expect(validateKeyIds(['prod1', 'prod2'])).toBe(true);
    expect(validateKeyIds(['prod1', 'nope'])).toBe(false);
  });
  it('isValidKeyAssignment enforces product/category rules', () => {
    expect(isValidKeyAssignment('prod1', 'life' as ProductKeyCategory)).toBe(true);
    expect(isValidKeyAssignment('calc1', 'life' as ProductKeyCategory)).toBe(false); // calculated
    expect(isValidKeyAssignment('prof1', 'life' as ProductKeyCategory)).toBe(false); // profile
    expect(isValidKeyAssignment('prod1', 'other' as ProductKeyCategory)).toBe(false); // category mismatch
    expect(isValidKeyAssignment('nope', 'life' as ProductKeyCategory)).toBe(false); // not found
  });
});

describe('formatting + purpose', () => {
  const key = (dataType: string) => ({ dataType }) as unknown as ProductKey;
  it('formatKeyValue formats by data type', () => {
    expect(formatKeyValue(key('currency'), 1234.5)).toBe('R1,234.50');
    expect(formatKeyValue(key('currency'), -1000)).toBe('-R1,000.00');
    expect(formatKeyValue(key('number'), 1234)).toBe('1,234');
    expect(formatKeyValue(key('boolean'), true)).toBe('Yes');
    expect(formatKeyValue(key('boolean'), false)).toBe('No');
    expect(formatKeyValue(key('text'), 'hello')).toBe('hello');
    expect(formatKeyValue(key('currency'), null)).toBe('-');
    expect(typeof formatKeyValue(key('date'), new Date('2026-05-07'))).toBe('string');
  });
  it('getKeyPurpose summarizes module usage (0/1/2/3+)', () => {
    expect(getKeyPurpose('calc1')).toBe('Not currently used');
    expect(getKeyPurpose('prof1')).toBe('Used in A');
    expect(getKeyPurpose('prod2')).toBe('Used in A and B');
    expect(getKeyPurpose('prod1')).toBe('Used in 3 modules');
  });
});

describe('category helpers', () => {
  it('profile vs product categories', () => {
    expect(isProfileCategory('profile_personal' as ProductKeyCategory)).toBe(true);
    expect(isProfileCategory('life' as ProductKeyCategory)).toBe(false);
    expect(isProductCategory('life' as ProductKeyCategory)).toBe(true);
    expect(getProfileCategories()).toEqual(['profile_personal']);
    expect(getProductCategories()).toEqual(['life']);
  });
});
