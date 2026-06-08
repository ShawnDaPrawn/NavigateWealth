import { describe, expect, it } from 'vitest';
import {
  FORM_FIELD_REGISTRY,
  PREFILL_PROFILE_HINTS,
  getFormFieldMappings,
  listFormPrefillIds,
  getCanonicalKeysForForm,
} from '../form-field-registry';

describe('form-field-registry', () => {
  it('FORM_FIELD_REGISTRY is a non-empty object', () => {
    expect(typeof FORM_FIELD_REGISTRY).toBe('object');
    expect(Object.keys(FORM_FIELD_REGISTRY).length).toBeGreaterThan(0);
  });

  it('each registry entry is an array of field mappings', () => {
    Object.values(FORM_FIELD_REGISTRY).forEach((mappings) => {
      expect(Array.isArray(mappings)).toBe(true);
      mappings.forEach((m) => {
        expect(typeof m.formField).toBe('string');
        expect(typeof m.canonicalKey).toBe('string');
        expect(typeof m.label).toBe('string');
      });
    });
  });

  it('PREFILL_PROFILE_HINTS is a non-empty object with string values', () => {
    expect(typeof PREFILL_PROFILE_HINTS).toBe('object');
    expect(Object.keys(PREFILL_PROFILE_HINTS).length).toBeGreaterThan(0);
    Object.values(PREFILL_PROFILE_HINTS).forEach((hint) => {
      expect(typeof hint).toBe('string');
    });
  });

  it('getFormFieldMappings returns mappings for a known form id', () => {
    const ids = listFormPrefillIds();
    expect(ids.length).toBeGreaterThan(0);
    const mappings = getFormFieldMappings(ids[0]);
    expect(Array.isArray(mappings)).toBe(true);
  });

  it('getFormFieldMappings returns empty array for unknown id', () => {
    const result = getFormFieldMappings('nonexistent-form' as never);
    expect(result).toEqual([]);
  });

  it('listFormPrefillIds returns all registered form ids', () => {
    const ids = listFormPrefillIds();
    expect(ids.length).toBe(Object.keys(FORM_FIELD_REGISTRY).length);
  });

  it('getCanonicalKeysForForm returns canonical key strings', () => {
    const ids = listFormPrefillIds();
    const keys = getCanonicalKeysForForm(ids[0]);
    expect(Array.isArray(keys)).toBe(true);
    keys.forEach((k) => expect(typeof k).toBe('string'));
  });
});
