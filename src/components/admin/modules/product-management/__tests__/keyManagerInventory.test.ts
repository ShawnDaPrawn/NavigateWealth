/**
 * Exact inventory of the product-key catalogue.
 * =============================================
 *
 * `keyManagerConstants.ts` is 1,637 lines of pure data: 21 arrays of
 * `ProductKey` definitions, composed into `ALL_PRODUCT_KEYS` and dispatched by
 * `getKeysByCategory`. Splitting it across files is mechanically safe — the
 * arrays do not reference each other — but "safe" is not the same as "checked".
 * A whole array can go missing from the composition and nothing type-errors:
 * `ALL_PRODUCT_KEYS` is still a `ProductKey[]`, just shorter.
 *
 * The existing `keyManagerConstants.test.ts` asserts `length > 0` per array,
 * which passes with a single key in each and passes with an array dropped from
 * the aggregate entirely. This file states the counts instead, so a loss is a
 * named failure rather than a silent one.
 *
 * These numbers are the catalogue as it stands, captured before the split.
 * Adding a key is a deliberate act — update the count here in the same commit.
 */
import { describe, expect, it } from 'vitest';
import * as keys from '../keyManagerConstants';
import type { ProductKey } from '../types';

/** Captured from the pre-split file. Total: 164 keys, all ids distinct. */
const EXPECTED_COUNTS: Record<string, number> = {
  RISK_KEYS: 19,
  MEDICAL_AID_KEYS: 12,
  RETIREMENT_PRE_KEYS: 17,
  RETIREMENT_POST_KEYS: 7,
  INVEST_VOLUNTARY_KEYS: 11,
  INVEST_GUARANTEED_KEYS: 6,
  EMPLOYEE_BENEFITS_RISK_KEYS: 5,
  EMPLOYEE_BENEFITS_RETIREMENT_KEYS: 6,
  EMPLOYEE_BENEFITS_KEYS: 13,
  ESTATE_PLANNING_KEYS: 6,
  TAX_KEYS: 6,
  PROFILE_PERSONAL_KEYS: 10,
  PROFILE_CONTACT_KEYS: 9,
  PROFILE_IDENTITY_KEYS: 5,
  PROFILE_ADDRESS_KEYS: 14,
  PROFILE_EMPLOYMENT_KEYS: 5,
  PROFILE_HEALTH_KEYS: 5,
  PROFILE_FAMILY_KEYS: 3,
  PROFILE_BANKING_KEYS: 4,
  PROFILE_RISK_KEYS: 4,
  PROFILE_FINANCIAL_KEYS: 8,
  ALL_PRODUCT_KEYS: 164,
  KEY_CATEGORIES: 21,
};

const exported = keys as unknown as Record<string, unknown>;

describe('the catalogue has not lost anything', () => {
  it.each(Object.entries(EXPECTED_COUNTS))('%s holds %i entries', (name, count) => {
    const value = exported[name];
    expect(Array.isArray(value), `${name} is not an array`).toBe(true);
    expect((value as unknown[]).length).toBe(count);
  });

  it('exports exactly the arrays this file knows about, and no others', () => {
    // Catches the reverse case: a new array added to the module without being
    // added to the aggregate or to this inventory.
    const arrays = Object.entries(exported)
      .filter(([, v]) => Array.isArray(v))
      .map(([n]) => n)
      .sort();

    expect(arrays).toEqual(Object.keys(EXPECTED_COUNTS).sort());
  });

  it('gives every key a distinct id', () => {
    const ids = (keys.ALL_PRODUCT_KEYS as ProductKey[]).map((k) => k.id);
    const seen = new Set<string>();
    const duplicates = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));

    expect(duplicates).toEqual([]);
    expect(seen.size).toBe(164);
  });

  it('composes ALL_PRODUCT_KEYS from the per-category arrays, losing none', () => {
    // The aggregate is a hand-written spread of nineteen arrays. Dropping one
    // line from it is invisible to the type system.
    const parts = [
      'RISK_KEYS',
      'MEDICAL_AID_KEYS',
      'RETIREMENT_PRE_KEYS',
      'RETIREMENT_POST_KEYS',
      'INVEST_VOLUNTARY_KEYS',
      'INVEST_GUARANTEED_KEYS',
      'EMPLOYEE_BENEFITS_KEYS',
      'ESTATE_PLANNING_KEYS',
      'TAX_KEYS',
      'PROFILE_PERSONAL_KEYS',
      'PROFILE_CONTACT_KEYS',
      'PROFILE_IDENTITY_KEYS',
      'PROFILE_ADDRESS_KEYS',
      'PROFILE_EMPLOYMENT_KEYS',
      'PROFILE_HEALTH_KEYS',
      'PROFILE_FAMILY_KEYS',
      'PROFILE_BANKING_KEYS',
      'PROFILE_RISK_KEYS',
      'PROFILE_FINANCIAL_KEYS',
    ];
    const composed = parts.flatMap((n) => exported[n] as ProductKey[]);

    expect(composed.map((k) => k.id)).toEqual(
      (keys.ALL_PRODUCT_KEYS as ProductKey[]).map((k) => k.id),
    );
  });

  it('shapes every key the way consumers read it', () => {
    for (const key of keys.ALL_PRODUCT_KEYS as ProductKey[]) {
      expect(typeof key.id, `${key.id}: id`).toBe('string');
      expect(key.id.length, 'empty id').toBeGreaterThan(0);
      expect(typeof key.category, `${key.id}: category`).toBe('string');
      expect(typeof key.name, `${key.id}: name`).toBe('string');
      expect(typeof key.dataType, `${key.id}: dataType`).toBe('string');
      expect(typeof key.isCalculated, `${key.id}: isCalculated`).toBe('boolean');
    }
  });
});

describe('getKeysByCategory reaches every category it claims to', () => {
  it('returns a non-empty array for each id in KEY_CATEGORIES', () => {
    const empty = (keys.KEY_CATEGORIES as { id: string; name: string }[])
      .map((cat) => ({ id: cat.id, count: keys.getKeysByCategory(cat.id as never).length }))
      .filter((row) => row.count === 0);

    expect(empty, 'a listed category resolves to no keys').toEqual([]);
  });

  it('returns the same array identity the module exports', () => {
    // Not a copy: consumers rely on getKeysByCategory('risk') being RISK_KEYS.
    expect(keys.getKeysByCategory('risk' as never)).toBe(keys.RISK_KEYS);
    expect(keys.getKeysByCategory('medical_aid' as never)).toBe(keys.MEDICAL_AID_KEYS);
  });
});
