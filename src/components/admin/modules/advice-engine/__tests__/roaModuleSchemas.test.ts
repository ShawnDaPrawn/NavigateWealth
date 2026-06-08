import { describe, it, expect } from 'vitest';
import { ROA_MODULE_SCHEMAS, getModuleSchema, getAllModules } from '../roaModuleSchemas';

describe('ROA_MODULE_SCHEMAS', () => {
  it('is a non-empty record of module schemas', () => {
    expect(typeof ROA_MODULE_SCHEMAS).toBe('object');
    expect(Object.keys(ROA_MODULE_SCHEMAS).length).toBeGreaterThan(0);
  });

  it('contains expected module IDs', () => {
    const keys = Object.keys(ROA_MODULE_SCHEMAS);
    // Should include at least common module types
    expect(keys).toContain('medical_aid');
  });

  it('every schema has required fields: id, title, description, fields, disclosures', () => {
    for (const [id, schema] of Object.entries(ROA_MODULE_SCHEMAS)) {
      expect(schema.id, `${id} should have id`).toBeTruthy();
      expect(schema.title, `${id} should have title`).toBeTruthy();
      expect(schema.description, `${id} should have description`).toBeTruthy();
      expect(Array.isArray(schema.fields), `${id} fields should be array`).toBe(true);
      expect(Array.isArray(schema.disclosures), `${id} disclosures should be array`).toBe(true);
    }
  });

  it('every field has key, label, and type', () => {
    for (const [moduleId, schema] of Object.entries(ROA_MODULE_SCHEMAS)) {
      for (const field of schema.fields) {
        expect(field.key, `field in ${moduleId} should have key`).toBeTruthy();
        expect(field.label, `field in ${moduleId} should have label`).toBeTruthy();
        expect(field.type, `field in ${moduleId} should have type`).toBeTruthy();
      }
    }
  });
});

describe('getModuleSchema', () => {
  it('returns the schema for a known module ID', () => {
    const schema = getModuleSchema('medical_aid');
    expect(schema).toBeDefined();
    expect(schema?.id).toBe('medical_aid');
  });

  it('returns undefined for an unknown module ID', () => {
    expect(getModuleSchema('non_existent_module')).toBeUndefined();
  });

  it('returns the same object as ROA_MODULE_SCHEMAS for any known key', () => {
    const firstKey = Object.keys(ROA_MODULE_SCHEMAS)[0];
    expect(getModuleSchema(firstKey)).toBe(ROA_MODULE_SCHEMAS[firstKey]);
  });
});

describe('getAllModules', () => {
  it('returns all module schemas as an array', () => {
    const modules = getAllModules();
    expect(Array.isArray(modules)).toBe(true);
    expect(modules.length).toBe(Object.keys(ROA_MODULE_SCHEMAS).length);
  });

  it('every module in the array has an id', () => {
    const modules = getAllModules();
    modules.forEach((m) => {
      expect(m.id).toBeTruthy();
    });
  });
});
