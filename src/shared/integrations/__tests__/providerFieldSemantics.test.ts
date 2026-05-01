import { describe, expect, it } from 'vitest';
import {
  getFallbackValueForField,
  getFieldSemanticKind,
  isLikelyCurrencyValue,
  isLikelyDateValue,
  isLikelyProductTypeValue,
  isPlausibleValueForField,
  normaliseProviderPolicyNumber,
} from '../../../../scripts/provider-adapters/field-semantics.mjs';

describe('provider portal field semantics', () => {
  it('classifies common provider field meanings from schema and mapping metadata', () => {
    expect(getFieldSemanticKind({ targetFieldName: 'Policy Number' })).toBe('policy_number');
    expect(getFieldSemanticKind({ columnName: 'Investment start date' })).toBe('date_of_inception');
    expect(getFieldSemanticKind({ targetFieldId: 'ret_pre_3' })).toBe('current_value');
    expect(getFieldSemanticKind({ sourceHeader: 'Closing Balance' })).toBe('current_value');
    expect(getFieldSemanticKind({ sourceHeader: 'Estimated Maturity Value' })).toBe('generic');
    expect(getFieldSemanticKind({ sourceHeader: 'Product Type' })).toBe('product_type');
  });

  it('normalises policy numbers consistently across provider formats', () => {
    expect(normaliseProviderPolicyNumber(' ag-123 / 45 ')).toBe('AG12345');
    expect(normaliseProviderPolicyNumber('AG_123-45')).toBe('AG12345');
  });

  it('validates current value fields as money-like values only', () => {
    expect(isLikelyCurrencyValue('R 1 234 567.89')).toBe(true);
    expect(isLikelyCurrencyValue('123,456.00')).toBe(true);
    expect(isLikelyCurrencyValue('Selected period since inception')).toBe(false);
    expect(isLikelyCurrencyValue('Retirement Annuity Fund')).toBe(false);
  });

  it('validates date fields without accepting portal summary phrases', () => {
    expect(isLikelyDateValue('1 March 2020')).toBe(true);
    expect(isLikelyDateValue('2020-03-01')).toBe(true);
    expect(isLikelyDateValue('Since inception')).toBe(false);
    expect(isLikelyDateValue('Download statement')).toBe(false);
  });

  it('validates product type fields without accepting dates, money, or portal actions', () => {
    expect(isLikelyProductTypeValue('Retirement Annuity Fund')).toBe(true);
    expect(isLikelyProductTypeValue('Living Annuity')).toBe(true);
    expect(isLikelyProductTypeValue('1 March 2020')).toBe(false);
    expect(isLikelyProductTypeValue('R 500 000')).toBe(false);
    expect(isLikelyProductTypeValue('Download statement')).toBe(false);
  });

  it('selects provider fallback values by semantic field kind', () => {
    const fallback = {
      policyNumber: 'AG123',
      productType: 'Retirement Annuity Fund',
      dateOfInception: '1 March 2020',
      currentValue: 'R 500 000',
    };

    expect(getFallbackValueForField({ targetFieldName: 'Policy Number' }, fallback)).toBe('AG123');
    expect(getFallbackValueForField({ targetFieldName: 'Product Type' }, fallback)).toBe('Retirement Annuity Fund');
    expect(getFallbackValueForField({ targetFieldName: 'Date of Inception' }, fallback)).toBe('1 March 2020');
    expect(getFallbackValueForField({ targetFieldName: 'Current Value' }, fallback)).toBe('R 500 000');
    expect(getFallbackValueForField({ targetFieldName: 'Adviser Name' }, fallback)).toBe('');
  });

  it('checks field values against their semantic kind for any provider adapter', () => {
    const item = { policyNumber: 'AG-123/45' };

    expect(isPlausibleValueForField({ targetFieldName: 'Policy Number' }, 'AG12345', item)).toBe(true);
    expect(isPlausibleValueForField({ targetFieldName: 'Policy Number' }, 'OTHER999', item)).toBe(false);
    expect(isPlausibleValueForField({ targetFieldName: 'Current Value' }, 'R 500 000', item)).toBe(true);
    expect(isPlausibleValueForField({ targetFieldName: 'Current Value' }, 'Since inception', item)).toBe(false);
    expect(isPlausibleValueForField({ targetFieldName: 'Product Type' }, 'Retirement Annuity Fund', item)).toBe(true);
    expect(isPlausibleValueForField({ targetFieldName: 'Product Type' }, 'R 500 000', item)).toBe(false);
    expect(isPlausibleValueForField({ targetFieldName: 'Adviser Name' }, 'Navigate Wealth', item)).toBe(true);
  });
});
