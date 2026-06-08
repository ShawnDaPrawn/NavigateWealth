/**
 * key-manager/api.ts — unit tests
 *
 * KeyAPI is a pure in-memory module (no HTTP client). It delegates to
 * utils.ts and product-management constants, so we mock those and then
 * verify that every method on KeyAPI returns the expected shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProductKey, ProductKeyCategory } from '../types';

// ---------------------------------------------------------------------------
// Fixtures (hoisted so they can be referenced in vi.mock factories below)
// ---------------------------------------------------------------------------
const fx = vi.hoisted(() => {
  const prof1: ProductKey = {
    id: 'prof1',
    name: 'Full Name',
    description: 'client full name',
    category: 'profile_personal' as ProductKeyCategory,
    dataType: 'text',
  };
  const prod1: ProductKey = {
    id: 'prod1',
    name: 'Premium',
    description: 'monthly premium',
    category: 'risk' as ProductKeyCategory,
    dataType: 'currency',
    isCalculated: false,
  };
  const calc1: ProductKey = {
    id: 'calc1',
    name: 'Total Premium',
    description: 'calculated total',
    category: 'risk' as ProductKeyCategory,
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['prod1'],
  };
  const prod2: ProductKey = {
    id: 'prod2',
    name: 'Start Date',
    description: 'inception date',
    category: 'risk' as ProductKeyCategory,
    dataType: 'date',
    isCalculated: false,
  };

  const ALL_PRODUCT_KEYS = [prof1, prod1, calc1, prod2];
  const KEY_CATEGORIES = [
    { id: 'risk' as ProductKeyCategory, name: 'Risk', description: 'Risk products' },
    {
      id: 'profile_personal' as ProductKeyCategory,
      name: 'Personal',
      description: 'Personal profile',
    },
  ];
  const KEY_USAGE_MAP: Record<string, string[]> = {
    prod1: ['Risk FNA', 'Dashboard'],
    calc1: [],
    prof1: ['Client Profile'],
    prod2: ['Risk FNA'],
  };
  const KEY_MODULES = { RISK_FNA: 'Risk FNA', CLIENT_DASHBOARD: 'Dashboard' };
  const PROFILE_CATEGORIES: ProductKeyCategory[] = ['profile_personal'];
  const PRODUCT_CATEGORIES: ProductKeyCategory[] = ['risk'];

  return {
    prof1,
    prod1,
    calc1,
    prod2,
    ALL_PRODUCT_KEYS,
    KEY_CATEGORIES,
    KEY_USAGE_MAP,
    KEY_MODULES,
    PROFILE_CATEGORIES,
    PRODUCT_CATEGORIES,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('../../../product-management', () => ({
  ALL_PRODUCT_KEYS: fx.ALL_PRODUCT_KEYS,
  KEY_CATEGORIES: fx.KEY_CATEGORIES,
  getKeysByCategory: (cat: ProductKeyCategory) =>
    fx.ALL_PRODUCT_KEYS.filter((k) => k.category === cat),
}));

vi.mock('../constants', () => ({
  KEY_USAGE_MAP: fx.KEY_USAGE_MAP,
  KEY_MODULES: fx.KEY_MODULES,
  PROFILE_CATEGORIES: fx.PROFILE_CATEGORIES,
  PRODUCT_CATEGORIES: fx.PRODUCT_CATEGORIES,
}));

// Import AFTER mocks are registered
import { KeyAPI } from '../api';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KeyAPI — constants re-exports', () => {
  it('exposes ALL_PRODUCT_KEYS, KEY_CATEGORIES, KEY_USAGE_MAP, KEY_MODULES', () => {
    expect(Array.isArray(KeyAPI.ALL_PRODUCT_KEYS)).toBe(true);
    expect(Array.isArray(KeyAPI.KEY_CATEGORIES)).toBe(true);
    expect(typeof KeyAPI.KEY_USAGE_MAP).toBe('object');
    expect(typeof KeyAPI.KEY_MODULES).toBe('object');
  });
});

describe('KeyAPI — core lookup methods', () => {
  it('getKeyById returns the correct key', () => {
    expect(KeyAPI.getKeyById('prod1')?.name).toBe('Premium');
    expect(KeyAPI.getKeyById('nope')).toBeUndefined();
  });

  it('getKeysByIds filters out unknown IDs', () => {
    const result = KeyAPI.getKeysByIds(['prod1', 'nope', 'calc1']);
    expect(result.map((k) => k.id)).toEqual(['prod1', 'calc1']);
  });

  it('getKeyName returns display name or falls back to ID', () => {
    expect(KeyAPI.getKeyName('prod1')).toBe('Premium');
    expect(KeyAPI.getKeyName('unknown_id')).toBe('unknown_id');
  });

  it('getAllKeys returns every key', () => {
    expect(KeyAPI.getAllKeys()).toHaveLength(4);
  });

  it('getKeysByCategory returns keys for a given category', () => {
    const riskKeys = KeyAPI.getKeysByCategory('risk' as ProductKeyCategory);
    expect(riskKeys.every((k) => k.category === 'risk')).toBe(true);
    expect(riskKeys.length).toBeGreaterThan(0);
  });

  it('getKeysByDataType filters by dataType', () => {
    const currencyKeys = KeyAPI.getKeysByDataType('currency');
    expect(currencyKeys.every((k) => k.dataType === 'currency')).toBe(true);
    expect(currencyKeys.map((k) => k.id)).toContain('prod1');
  });

  it('searchKeys finds by name, description, or id', () => {
    expect(KeyAPI.searchKeys('premium').map((k) => k.id)).toContain('prod1');
    expect(KeyAPI.searchKeys('monthly premium').map((k) => k.id)).toContain('prod1');
    expect(KeyAPI.searchKeys('prof1').map((k) => k.id)).toContain('prof1');
    expect(KeyAPI.searchKeys('')).toHaveLength(4);
  });
});

describe('KeyAPI — filtering methods', () => {
  it('getClientProfileKeys returns only profile_ keys', () => {
    const keys = KeyAPI.getClientProfileKeys();
    expect(keys.every((k) => k.category.startsWith('profile_'))).toBe(true);
    expect(keys.map((k) => k.id)).toContain('prof1');
  });

  it('getProductKeys excludes profile_ keys', () => {
    const keys = KeyAPI.getProductKeys();
    expect(keys.every((k) => !k.category.startsWith('profile_'))).toBe(true);
  });

  it('getCalculatedKeys returns only isCalculated=true keys', () => {
    const keys = KeyAPI.getCalculatedKeys();
    expect(keys.every((k) => k.isCalculated === true)).toBe(true);
    expect(keys.map((k) => k.id)).toContain('calc1');
  });

  it('getIndividualKeys excludes calculated keys', () => {
    const keys = KeyAPI.getIndividualKeys();
    expect(keys.every((k) => k.isCalculated !== true)).toBe(true);
    expect(keys.map((k) => k.id)).not.toContain('calc1');
  });

  it('filterKeys with filterType=client returns profile keys', () => {
    const result = KeyAPI.filterKeys({ filterType: 'client' });
    expect(result.every((k) => k.category.startsWith('profile_'))).toBe(true);
  });

  it('filterKeys with filterType=product excludes profile keys', () => {
    const result = KeyAPI.filterKeys({ filterType: 'product' });
    expect(result.every((k) => !k.category.startsWith('profile_'))).toBe(true);
  });

  it('filterKeys with filterType=calculated returns only calculated keys', () => {
    const result = KeyAPI.filterKeys({ filterType: 'calculated' });
    expect(result.every((k) => k.isCalculated === true)).toBe(true);
  });

  it('filterKeys by category narrows results', () => {
    const result = KeyAPI.filterKeys({ category: 'risk' as ProductKeyCategory });
    expect(result.every((k) => k.category === 'risk')).toBe(true);
  });

  it('filterKeys by dataType narrows results', () => {
    const result = KeyAPI.filterKeys({ dataType: 'currency' });
    expect(result.every((k) => k.dataType === 'currency')).toBe(true);
  });

  it('filterKeys by searchTerm narrows results', () => {
    const result = KeyAPI.filterKeys({ searchTerm: 'premium' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('filterKeys with category=all returns all keys', () => {
    const result = KeyAPI.filterKeys({ category: 'all' });
    expect(result).toHaveLength(4);
  });
});

describe('KeyAPI — usage & dependencies', () => {
  it('getKeyUsage returns module list for a key', () => {
    expect(KeyAPI.getKeyUsage('prod1')).toEqual(['Risk FNA', 'Dashboard']);
    expect(KeyAPI.getKeyUsage('unknown')).toEqual([]);
  });

  it('isKeyUsed detects usage', () => {
    expect(KeyAPI.isKeyUsed('prod1')).toBe(true);
    expect(KeyAPI.isKeyUsed('calc1')).toBe(false);
  });

  it('getKeysByModule returns keys used in a given module', () => {
    const riskKeys = KeyAPI.getKeysByModule('Risk FNA');
    const ids = riskKeys.map((k) => k.id);
    expect(ids).toContain('prod1');
    expect(ids).toContain('prod2');
  });

  it('getKeyDependencies returns calculatedFrom array', () => {
    expect(KeyAPI.getKeyDependencies('calc1')).toEqual(['prod1']);
    expect(KeyAPI.getKeyDependencies('prod1')).toEqual([]);
  });

  it('getKeyDependencyNames resolves dependency names', () => {
    expect(KeyAPI.getKeyDependencyNames('calc1')).toEqual(['Premium']);
  });

  it('getKeyLookup returns full lookup result', () => {
    const result = KeyAPI.getKeyLookup('prod1');
    expect(result).toBeDefined();
    expect(result?.key.id).toBe('prod1');
    expect(result?.usedBy).toEqual(['Risk FNA', 'Dashboard']);
    expect(result?.dependencies).toEqual([]);
  });

  it('getKeyLookup returns undefined for unknown key', () => {
    expect(KeyAPI.getKeyLookup('unknown')).toBeUndefined();
  });

  it('getAllKeyUsage returns an entry per mapped key', () => {
    const usage = KeyAPI.getAllKeyUsage();
    expect(Array.isArray(usage)).toBe(true);
    const prod1Entry = usage.find((u) => u.keyId === 'prod1');
    expect(prod1Entry).toBeDefined();
    expect(prod1Entry?.modules).toEqual(['Risk FNA', 'Dashboard']);
  });
});

describe('KeyAPI — validation', () => {
  it('validateKeyId returns true for known IDs', () => {
    expect(KeyAPI.validateKeyId('prod1')).toBe(true);
    expect(KeyAPI.validateKeyId('nope')).toBe(false);
  });

  it('validateKeyIds validates all IDs in an array', () => {
    expect(KeyAPI.validateKeyIds(['prod1', 'prod2'])).toBe(true);
    expect(KeyAPI.validateKeyIds(['prod1', 'nope'])).toBe(false);
  });

  it('isValidKeyAssignment checks category + profile + calculated rules', () => {
    // valid: product key, correct category, not profile, not calculated
    expect(KeyAPI.isValidKeyAssignment('prod1', 'risk' as ProductKeyCategory)).toBe(true);
    // invalid: calculated key
    expect(KeyAPI.isValidKeyAssignment('calc1', 'risk' as ProductKeyCategory)).toBe(false);
    // invalid: profile key
    expect(KeyAPI.isValidKeyAssignment('prof1', 'risk' as ProductKeyCategory)).toBe(false);
    // invalid: category mismatch
    expect(KeyAPI.isValidKeyAssignment('prod1', 'medical_aid' as ProductKeyCategory)).toBe(false);
    // invalid: key not found
    expect(KeyAPI.isValidKeyAssignment('nope', 'risk' as ProductKeyCategory)).toBe(false);
  });
});

describe('KeyAPI — metadata & statistics', () => {
  it('getDataTypes returns unique sorted data types', () => {
    const types = KeyAPI.getDataTypes();
    expect(types).toEqual([...new Set(types)].sort());
    expect(types).toContain('currency');
    expect(types).toContain('text');
  });

  it('getKeyMetadata returns correct aggregate counts', () => {
    const meta = KeyAPI.getKeyMetadata();
    expect(meta.totalKeys).toBe(4);
    expect(meta.clientKeys).toBeGreaterThanOrEqual(1);
    expect(meta.productKeys).toBeGreaterThanOrEqual(1);
    expect(meta.calculatedKeys).toBe(1);
  });

  it('getCategoryMetadata returns info for a known category', () => {
    const meta = KeyAPI.getCategoryMetadata('risk' as ProductKeyCategory);
    expect(meta).toBeDefined();
    expect(meta?.id).toBe('risk');
    expect(typeof meta?.keyCount).toBe('number');
  });

  it('getCategoryMetadata returns undefined for unknown category', () => {
    expect(KeyAPI.getCategoryMetadata('nonexistent' as ProductKeyCategory)).toBeUndefined();
  });

  it('getAllCategories returns KEY_CATEGORIES', () => {
    expect(KeyAPI.getAllCategories()).toBe(KeyAPI.KEY_CATEGORIES);
  });

  it('countKeysByCategory returns a record', () => {
    const counts = KeyAPI.countKeysByCategory();
    expect(typeof counts).toBe('object');
    expect((counts as Record<string, number>)['risk']).toBeGreaterThan(0);
  });

  it('countKeysByDataType returns a record', () => {
    const counts = KeyAPI.countKeysByDataType();
    expect(typeof counts).toBe('object');
    expect(counts['currency']).toBeGreaterThan(0);
  });

  it('getKeyCount returns total number of keys', () => {
    expect(KeyAPI.getKeyCount()).toBe(4);
  });
});

describe('KeyAPI — formatting & display', () => {
  it('formatKeyValue formats currency with R prefix', () => {
    expect(KeyAPI.formatKeyValue(fx.prod1, 1500)).toBe('R1,500.00');
    expect(KeyAPI.formatKeyValue(fx.prod1, null)).toBe('-');
  });

  it('getKeyPurpose summarises module usage', () => {
    expect(KeyAPI.getKeyPurpose('calc1')).toBe('Not currently used');
    expect(KeyAPI.getKeyPurpose('prof1')).toBe('Used in Client Profile');
    expect(KeyAPI.getKeyPurpose('prod2')).toBe('Used in Risk FNA');
    expect(KeyAPI.getKeyPurpose('prod1')).toBe('Used in Risk FNA and Dashboard');
  });
});

describe('KeyAPI — classification helpers', () => {
  it('isClientProfileKey / isProductKey', () => {
    expect(KeyAPI.isClientProfileKey(fx.prof1)).toBe(true);
    expect(KeyAPI.isClientProfileKey(fx.prod1)).toBe(false);
    expect(KeyAPI.isProductKey(fx.prod1)).toBe(true);
    expect(KeyAPI.isProductKey(fx.prof1)).toBe(false);
  });

  it('isCalculatedKey / isIndividualKey', () => {
    expect(KeyAPI.isCalculatedKey(fx.calc1)).toBe(true);
    expect(KeyAPI.isCalculatedKey(fx.prod1)).toBe(false);
    expect(KeyAPI.isIndividualKey(fx.prod1)).toBe(true);
    expect(KeyAPI.isIndividualKey(fx.calc1)).toBe(false);
  });

  it('isProfileCategory / isProductCategory', () => {
    expect(KeyAPI.isProfileCategory('profile_personal' as ProductKeyCategory)).toBe(true);
    expect(KeyAPI.isProfileCategory('risk' as ProductKeyCategory)).toBe(false);
    expect(KeyAPI.isProductCategory('risk' as ProductKeyCategory)).toBe(true);
    expect(KeyAPI.isProductCategory('profile_personal' as ProductKeyCategory)).toBe(false);
  });

  it('getProfileCategories / getProductCategories return arrays', () => {
    expect(KeyAPI.getProfileCategories()).toContain('profile_personal');
    expect(KeyAPI.getProductCategories()).toContain('risk');
  });
});

describe('KeyAPI — integration / selector methods', () => {
  it('getKeySelectorOptions excludes profile and optionally calculated keys', () => {
    const opts = KeyAPI.getKeySelectorOptions();
    // No profile keys
    expect(opts.every((o) => !o.value.startsWith('prof'))).toBe(true);
    // By default, no calculated keys
    expect(opts.every((o) => !o.isCalculated)).toBe(true);
    // Shape check
    if (opts.length > 0) {
      expect(opts[0]).toMatchObject({
        value: expect.any(String),
        label: expect.any(String),
        description: expect.any(String),
        category: expect.any(String),
        dataType: expect.any(String),
        isCalculated: expect.any(Boolean),
      });
    }
  });

  it('getKeySelectorOptions includes calculated when flag is set', () => {
    const opts = KeyAPI.getKeySelectorOptions(undefined, true);
    const calcOpt = opts.find((o) => o.value === 'calc1');
    expect(calcOpt).toBeDefined();
  });

  it('getKeySelectorOptions filters by category when provided', () => {
    const opts = KeyAPI.getKeySelectorOptions('risk' as ProductKeyCategory);
    expect(opts.every((o) => o.category === 'risk')).toBe(true);
  });

  it('getAssignableKeys returns only non-calculated, non-profile keys in category', () => {
    const keys = KeyAPI.getAssignableKeys('risk' as ProductKeyCategory);
    expect(keys.every((k) => k.category === 'risk')).toBe(true);
    expect(keys.every((k) => !k.isCalculated)).toBe(true);
    expect(keys.every((k) => !k.category.startsWith('profile_'))).toBe(true);
  });

  it('getCalculatedKeysForCategory returns only calculated keys in category', () => {
    const keys = KeyAPI.getCalculatedKeysForCategory('risk' as ProductKeyCategory);
    expect(keys.every((k) => k.category === 'risk' && k.isCalculated === true)).toBe(true);
    expect(keys.map((k) => k.id)).toContain('calc1');
  });
});
