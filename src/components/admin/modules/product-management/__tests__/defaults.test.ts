import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEMAS, INTERNAL_FIELDS } from '../defaults';

describe('product-management/defaults', () => {
  it('DEFAULT_SCHEMAS is a non-empty array', () => {
    expect(Array.isArray(DEFAULT_SCHEMAS)).toBe(true);
    expect(DEFAULT_SCHEMAS.length).toBeGreaterThan(0);
  });

  it('each schema has a categoryId and fields array', () => {
    DEFAULT_SCHEMAS.forEach((schema) => {
      expect(typeof schema.categoryId).toBe('string');
      expect(Array.isArray(schema.fields)).toBe(true);
      expect(schema.fields.length).toBeGreaterThan(0);
    });
  });

  it('each field has id, name, type, and required', () => {
    DEFAULT_SCHEMAS.forEach((schema) => {
      schema.fields.forEach((field) => {
        expect(typeof field.id).toBe('string');
        expect(typeof field.name).toBe('string');
        expect(typeof field.type).toBe('string');
        expect(typeof field.required).toBe('boolean');
      });
    });
  });

  it('has risk_planning and medical_aid categories', () => {
    const ids = DEFAULT_SCHEMAS.map((s) => s.categoryId);
    expect(ids).toContain('risk_planning');
    expect(ids).toContain('medical_aid');
  });

  it('INTERNAL_FIELDS is a non-empty array', () => {
    expect(Array.isArray(INTERNAL_FIELDS)).toBe(true);
    expect(INTERNAL_FIELDS.length).toBeGreaterThan(0);
  });
});
