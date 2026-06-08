/**
 * Tests for DEFAULT_SCHEMAS — client-side product schema fallbacks.
 * Importing the module exercises all object literal assignments.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEMAS } from '../default-schemas';

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

  it('has retirement_planning schema', () => {
    expect(DEFAULT_SCHEMAS.retirement_planning).toBeDefined();
  });

  it('has investment schema', () => {
    expect(DEFAULT_SCHEMAS.investments ?? DEFAULT_SCHEMAS.investment).toBeDefined();
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
