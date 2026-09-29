/**
 * Tests for DEFAULT_SCHEMAS — client-side product schema fallbacks.
 * Importing the module exercises all object literal assignments.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEMAS } from '../default-schemas';
import { ALL_PRODUCT_KEYS } from '@/shared/product-keys/registry';

describe('DEFAULT_SCHEMAS', () => {
  it('is a non-null object', () => {
    expect(DEFAULT_SCHEMAS).toBeDefined();
    expect(typeof DEFAULT_SCHEMAS).toBe('object');
  });

  it('has risk_planning schema', () => {
    expect(DEFAULT_SCHEMAS.risk_planning).toBeDefined();
    expect(Array.isArray(DEFAULT_SCHEMAS.risk_planning.fields)).toBe(true);
  });

  it('has medical_aid schema', () => {
    expect(DEFAULT_SCHEMAS.medical_aid).toBeDefined();
  });

  it('has Pre- and Post-Retirement schemas but no parent Retirement Planning product', () => {
    expect(DEFAULT_SCHEMAS.retirement_pre).toBeDefined();
    expect(DEFAULT_SCHEMAS.retirement_post).toBeDefined();
    // Retirement Planning is only the heading over the two; it has no schema.
    expect(DEFAULT_SCHEMAS.retirement_planning).toBeUndefined();
  });

  it('has a Post-Retirement (Fixed Annuity) schema whose keys are all registered', () => {
    const fixed = DEFAULT_SCHEMAS.retirement_post_fixed;
    expect(fixed).toBeDefined();

    const registered = new Map(ALL_PRODUCT_KEYS.map((k) => [k.id, k.category]));
    const keyIds = fixed.fields.map((f) => f.keyId).filter((id): id is string => Boolean(id));
    expect(keyIds).toContain('post_retirement_fixed_annuity_income');
    for (const keyId of keyIds) {
      expect(registered.get(keyId), keyId).toBe('retirement_post_fixed');
    }
  });

  it('has Voluntary and Guaranteed Investments schemas but no parent Investments product', () => {
    expect(DEFAULT_SCHEMAS.investments_voluntary).toBeDefined();
    expect(DEFAULT_SCHEMAS.investments_guaranteed).toBeDefined();
    // Investments is only the heading over the two; it has no schema.
    expect(DEFAULT_SCHEMAS.investments).toBeUndefined();
  });

  it('each schema has a fields array with entries', () => {
    Object.values(DEFAULT_SCHEMAS).forEach((schema) => {
      expect(Array.isArray(schema.fields)).toBe(true);
      expect(schema.fields.length).toBeGreaterThan(0);
    });
  });

  it('each field has id, name, type, and required', () => {
    Object.values(DEFAULT_SCHEMAS).forEach((schema) => {
      schema.fields.forEach((field) => {
        expect(typeof field.id).toBe('string');
        expect(typeof field.name).toBe('string');
        expect(typeof field.type).toBe('string');
        expect(typeof field.required).toBe('boolean');
      });
    });
  });
});
