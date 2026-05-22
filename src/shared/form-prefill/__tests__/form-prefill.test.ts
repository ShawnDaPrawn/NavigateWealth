/**
 * Tests for form prefill registry and intake mapping.
 */

import { describe, expect, it } from 'vitest';
import { getFormFieldMappings, listFormPrefillIds } from '../form-field-registry';
import { mergePrefillValues, normalizeIntakeToWizard } from '../intake-field-mapping';

describe('form-field-registry', () => {
  it('lists all supported internal form ids', () => {
    const ids = listFormPrefillIds();
    expect(ids).toContain('retirement-fna-step1');
    expect(ids).toContain('risk-fna-step1');
    expect(ids).not.toContain('risk-intake-simplified');
  });

  it('maps retirement step 1 fields to canonical keys', () => {
    const mappings = getFormFieldMappings('retirement-fna-step1');
    expect(mappings.find((m) => m.formField === 'currentAge')?.canonicalKey).toBe('derived:age_from_dob');
  });
});

describe('intake-field-mapping', () => {
  it('normalizes simplified tax intake to wizard fields', () => {
    const wizard = normalizeIntakeToWizard('tax', {
      taxNumber: '123',
      annualTaxableIncome: '850000',
      tfsaContributions: '36000',
    });

    expect(wizard.employmentIncome).toBe(850000);
    expect(wizard.tfsaContributionsLifetime).toBe(36000);
  });

  it('merges prefill without overwriting existing values', () => {
    const merged = mergePrefillValues(
      { currentAge: 40 },
      { currentAge: 42, grossMonthlyIncome: 50000 },
    );
    expect(merged.currentAge).toBe(40);
    expect(merged.grossMonthlyIncome).toBe(50000);
  });
});
