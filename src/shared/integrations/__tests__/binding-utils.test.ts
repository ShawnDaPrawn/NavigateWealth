import { describe, expect, it } from 'vitest';

import {
  buildIntegrationBindingsForFields,
  buildLegacyFieldMappingFromBindings,
  buildPortalFieldsFromBindings,
  normaliseIntegrationBlankBehavior,
} from '../binding-utils';

describe('buildIntegrationBindingsForFields', () => {
  it('hydrates schema fields with configured binding metadata and legacy fallback columns', () => {
    const bindings = buildIntegrationBindingsForFields(
      [
        { id: 'policyNumber', name: 'Policy Number', required: true, type: 'text' },
        { id: 'maturityDate', name: 'Maturity Date', required: false, type: 'date' },
      ],
      [
        {
          targetFieldId: 'maturityDate',
          columnName: 'Maturity Date',
          portalLabels: ['Maturity', 'End date'],
          portalSelector: '[data-field="maturity"]',
          blankBehavior: 'clear',
          transform: 'date',
        },
      ],
      {
        'Policy Number': 'policyNumber',
      },
    );

    expect(bindings).toEqual([
      {
        targetFieldId: 'policyNumber',
        targetFieldName: 'Policy Number',
        columnName: 'Policy Number',
        required: true,
        fieldType: 'text',
        portalLabels: [],
        portalSelector: undefined,
        blankBehavior: 'ignore',
        transform: 'trim',
      },
      {
        targetFieldId: 'maturityDate',
        targetFieldName: 'Maturity Date',
        columnName: 'Maturity Date',
        required: false,
        fieldType: 'date',
        portalLabels: ['Maturity', 'End date'],
        portalSelector: '[data-field="maturity"]',
        blankBehavior: 'clear',
        transform: 'date',
      },
    ]);
  });
});

describe('buildLegacyFieldMappingFromBindings', () => {
  it('serialises canonical column mappings from bindings', () => {
    expect(buildLegacyFieldMappingFromBindings([
      { targetFieldId: 'policyNumber', columnName: 'Policy Number' },
      { targetFieldId: 'fundValue', columnName: 'Fund Value' },
      { targetFieldId: '', columnName: 'Ignored' },
    ])).toEqual({
      'Policy Number': 'policyNumber',
      'Fund Value': 'fundValue',
    });
  });
});

describe('buildPortalFieldsFromBindings', () => {
  it('merges category bindings over provider-level fallback fields', () => {
    const fields = buildPortalFieldsFromBindings(
      [
        {
          targetFieldId: 'fundValue',
          targetFieldName: 'Fund Value',
          columnName: 'Fund Value',
          portalLabels: ['Fund value', 'Current value'],
          portalSelector: '[data-field="fundValue"]',
          required: false,
          transform: 'number',
        },
      ],
      [
        {
          sourceHeader: 'Fund Value',
          columnName: 'Fund Value',
          targetFieldId: 'fundValue',
          targetFieldName: 'Fund Value',
          selector: 'td:nth-child(4)',
          labels: ['Value'],
          attribute: 'text',
          transform: 'trim',
        },
      ],
    );

    expect(fields).toEqual([
      {
        sourceHeader: 'Fund Value',
        columnName: 'Fund Value',
        targetFieldId: 'fundValue',
        targetFieldName: 'Fund Value',
        selector: '[data-field="fundValue"]',
        labels: ['Fund value', 'Current value'],
        attribute: 'text',
        required: false,
        transform: 'number',
      },
    ]);
  });
});

describe('normaliseIntegrationBlankBehavior', () => {
  it('defaults unknown values to ignore', () => {
    expect(normaliseIntegrationBlankBehavior('clear')).toBe('clear');
    expect(normaliseIntegrationBlankBehavior('error')).toBe('error');
    expect(normaliseIntegrationBlankBehavior('anything-else')).toBe('ignore');
  });
});
