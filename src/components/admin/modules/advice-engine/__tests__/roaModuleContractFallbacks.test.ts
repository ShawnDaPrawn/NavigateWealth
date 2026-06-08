/**
 * Tests for FALLBACK_ROA_MODULE_CONTRACTS — static fallback data.
 * Importing the module exercises all contract() builder calls at load time.
 */

import { describe, expect, it } from 'vitest';
import { FALLBACK_ROA_MODULE_CONTRACTS } from '../roaModuleContractFallbacks';

describe('FALLBACK_ROA_MODULE_CONTRACTS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(FALLBACK_ROA_MODULE_CONTRACTS)).toBe(true);
    expect(FALLBACK_ROA_MODULE_CONTRACTS.length).toBeGreaterThan(0);
  });

  it('each contract has a non-empty id', () => {
    FALLBACK_ROA_MODULE_CONTRACTS.forEach((c) => {
      expect(typeof c.id).toBe('string');
      expect(c.id.length).toBeGreaterThan(0);
    });
  });

  it('each contract has a title and description', () => {
    FALLBACK_ROA_MODULE_CONTRACTS.forEach((c) => {
      expect(typeof c.title).toBe('string');
      expect(typeof c.description).toBe('string');
    });
  });

  it('each contract has a formSchema with sections', () => {
    FALLBACK_ROA_MODULE_CONTRACTS.forEach((c) => {
      expect(c.formSchema).toBeDefined();
      expect(Array.isArray(c.formSchema.sections)).toBe(true);
    });
  });

  it('each contract has evidence requirements', () => {
    FALLBACK_ROA_MODULE_CONTRACTS.forEach((c) => {
      expect(c.evidence).toBeDefined();
      expect(Array.isArray(c.evidence.requirements)).toBe(true);
    });
  });

  it('each contract has documentSections', () => {
    FALLBACK_ROA_MODULE_CONTRACTS.forEach((c) => {
      expect(Array.isArray(c.documentSections)).toBe(true);
    });
  });

  it('each contract has disclosures', () => {
    FALLBACK_ROA_MODULE_CONTRACTS.forEach((c) => {
      expect(Array.isArray(c.disclosures)).toBe(true);
    });
  });

  it('each contract output has a normalizedKey', () => {
    FALLBACK_ROA_MODULE_CONTRACTS.forEach((c) => {
      expect(c.output).toBeDefined();
      expect(typeof c.output.normalizedKey).toBe('string');
      expect(c.output.normalizedKey.length).toBeGreaterThan(0);
    });
  });

  it('each contract output has a fields array', () => {
    FALLBACK_ROA_MODULE_CONTRACTS.forEach((c) => {
      expect(Array.isArray(c.output.fields)).toBe(true);
    });
  });

  it('all contract ids are unique', () => {
    const ids = FALLBACK_ROA_MODULE_CONTRACTS.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
