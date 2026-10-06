/**
 * Field coercion and portal column matching.
 *
 * Both the portfolio apply path and the portal sync write a client's policy
 * through these two functions. A route test only checks that the word "lots"
 * is refused. The cases below are the ones that put the wrong rand amount,
 * the wrong day, or another column's figure onto the policy.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

import {
  coerceFieldValue,
  resolveRawPortalValue,
  valuesDiffer,
} from '../integrations-field-utils.ts';
import type { SchemaField } from '../integrations-types.ts';

function field(partial: Partial<SchemaField> & Pick<SchemaField, 'name'>): SchemaField {
  return { id: 'f', type: 'text', ...partial };
}

const productTypes = field({
  name: 'Product Type',
  type: 'dropdown',
  options: [
    'Retirement Annuity',
    'Pension Fund',
    'Provident Fund',
    'Preservation Fund',
    'Living Annuity',
  ],
});

describe('coerceFieldValue', () => {
  it('treats a blank as empty, and keeps a zero', () => {
    // A blank is the caller's decision (ignore, clear, or error). Coercion
    // must not turn it into a validation error, and must not treat 0 as blank:
    // a zero premium is a value.
    for (const blank of [undefined, null, '', '   ']) {
      expect(coerceFieldValue(field({ name: 'Premium', type: 'currency' }), blank)).toEqual({
        value: '',
      });
    }
    expect(coerceFieldValue(field({ name: 'Premium', type: 'currency' }), 0)).toEqual({
      value: 0,
    });
    expect(coerceFieldValue(field({ name: 'Premium', type: 'currency' }), '0')).toEqual({
      value: 0,
    });
  });

  it('reads a rand amount with a symbol, spaces, and thousands separators', () => {
    const premium = field({ name: 'Current Value', type: 'currency' });
    expect(coerceFieldValue(premium, 'R 1,250.50').value).toBe(1250.5);
    expect(coerceFieldValue(premium, 'R\u00A010,000.00').value).toBe(10000);
    expect(coerceFieldValue(premium, '12.5%').value).toBe(12.5);
    expect(
      coerceFieldValue(field({ name: 'Escalation', type: 'percentage' }), ' 12.5 % ').value,
    ).toBe(12.5);
  });

  it('refuses a figure it cannot read, including a credit written in parentheses', () => {
    // "(1,250.50)" is a credit on some statements. Stripping the brackets and
    // storing a positive balance would overstate the policy. It is refused.
    const premium = field({ name: 'Current Value', type: 'currency' });
    expect(coerceFieldValue(premium, 'lots')).toEqual({
      value: 'lots',
      error: 'Current Value must be a valid currency',
    });
    expect(coerceFieldValue(premium, '(1,250.50)').error).toBe(
      'Current Value must be a valid currency',
    );
  });

  it('accepts a negative amount', () => {
    expect(coerceFieldValue(field({ name: 'Adjustment', type: 'number' }), '-250.5').value).toBe(
      -250.5,
    );
  });

  it('reads yes and no, and refuses anything else', () => {
    const active = field({ name: 'Active', type: 'boolean' });
    for (const yes of ['yes', 'YES', ' y ', '1', 'true', true]) {
      expect(coerceFieldValue(active, yes).value).toBe(true);
    }
    for (const no of ['no', 'N', '0', 'false', false]) {
      expect(coerceFieldValue(active, no).value).toBe(false);
    }
    expect(coerceFieldValue(active, 'maybe')).toEqual({
      value: 'maybe',
      error: 'Active must be yes or no',
    });
  });

  it('keeps an ISO date as written, and turns an Excel serial into that day', () => {
    const inception = field({ name: 'Date of Inception', type: 'date' });
    // Returned unchanged, so a local-time conversion cannot move it to the
    // previous day.
    expect(coerceFieldValue(inception, '2023-01-13')).toEqual({ value: '2023-01-13' });
    // 44927 is 2023-01-01. A time fraction on the same serial is still that day.
    expect(coerceFieldValue(inception, 44927).value).toBe('2023-01-01');
    expect(coerceFieldValue(inception, 44927.75).value).toBe('2023-01-01');
  });

  it('refuses a day-first date and text that is not a date', () => {
    // "13/01/2023" is how a South African statement writes 13 January. The
    // date parser does not accept it, so the row fails instead of being read
    // as an American month.
    const inception = field({ name: 'Date of Inception', type: 'date' });
    expect(coerceFieldValue(inception, '13/01/2023').error).toBe(
      'Date of Inception must be a valid date',
    );
    expect(coerceFieldValue(inception, 'not-a-date').error).toBe(
      'Date of Inception must be a valid date',
    );
  });

  it('stores the option as the product lists it, not as the sheet typed it', () => {
    expect(coerceFieldValue(productTypes, 'pension fund').value).toBe('Pension Fund');
    expect(coerceFieldValue(productTypes, 'LIVING ANNUITY').value).toBe('Living Annuity');
    // "fund" is noise: "Preservation" is the Preservation Fund option, and
    // only that one.
    expect(coerceFieldValue(productTypes, 'Preservation').value).toBe('Preservation Fund');
  });

  it('refuses a dropdown value that is not one of the options', () => {
    expect(coerceFieldValue(productTypes, 'Yacht')).toEqual({
      value: 'Yacht',
      error:
        'Product Type must be one of: Retirement Annuity, Pension Fund, Provident Fund, Preservation Fund, Living Annuity',
    });
  });

  it('trims text, and leaves a dropdown with no options as text', () => {
    expect(coerceFieldValue(field({ name: 'Employer' }), '  Acme  ').value).toBe('Acme');
    expect(
      coerceFieldValue(field({ name: 'Product Type', type: 'dropdown', options: [] }), 'Custom')
        .value,
    ).toBe('Custom');
  });
});

describe('valuesDiffer', () => {
  it('ignores surrounding space, and still sees a real change', () => {
    expect(valuesDiffer('  100 ', '100')).toBe(false);
    expect(valuesDiffer(null, '')).toBe(false);
    expect(valuesDiffer(undefined, '   ')).toBe(false);
    // A zero is not the same as an empty cell.
    expect(valuesDiffer(0, '')).toBe(true);
    expect(valuesDiffer('100', '100.00')).toBe(true);
  });
});

describe('resolveRawPortalValue', () => {
  const currentValue = field({
    name: 'Current Value',
    type: 'currency',
    keyId: 'retirement_fund_value',
  });

  it('uses the mapped column when it is present, even when it is blank', () => {
    // An explicit empty "Current Value" must not be filled from "Fund Value".
    // That other column may be a different figure.
    expect(
      resolveRawPortalValue({
        rawData: { 'Current Value': '', 'Fund Value': 9000 },
        sourceHeader: 'Current Value',
        field: currentValue,
        source: 'portal',
      }),
    ).toEqual({ key: 'Current Value', value: '' });
  });

  it('does not borrow another column on a spreadsheet', () => {
    expect(
      resolveRawPortalValue({
        rawData: { 'Fund Value': 9000, 'Estimated Maturity Value': 500000 },
        sourceHeader: 'Current Value',
        field: currentValue,
        source: 'spreadsheet',
      }),
    ).toEqual({ key: 'Current Value', value: undefined });
  });

  it('on a portal, reads a current-value label and skips a blank one', () => {
    expect(
      resolveRawPortalValue({
        rawData: { 'Fund Value': '', 'Market Value': 4200 },
        sourceHeader: 'Current Value',
        field: currentValue,
        source: 'portal',
      }),
    ).toEqual({ key: 'Market Value', value: 4200 });
    expect(
      resolveRawPortalValue({
        rawData: { 'Closing Balance': 8800 },
        sourceHeader: 'Current Value',
        field: currentValue,
        source: 'portal',
      }),
    ).toEqual({ key: 'Closing Balance', value: 8800 });
  });

  it('does not read a maturity, guaranteed, or premium figure as the current value', () => {
    // These labels share the word "value". Taking one of them would put a
    // projection, a guarantee, or a premium onto the fund value the profile totals.
    for (const label of ['Estimated Maturity Value', 'Guaranteed Value', 'Monthly Premium']) {
      expect(
        resolveRawPortalValue({
          rawData: { [label]: 500000 },
          sourceHeader: 'Current Value',
          field: currentValue,
          source: 'portal',
        }),
      ).toEqual({ key: 'Current Value', value: undefined });
    }
  });

  it('matches a policy number from account number, not from a date', () => {
    const policyNumber = field({ name: 'Policy Number', type: 'text' });
    expect(
      resolveRawPortalValue({
        rawData: { 'Account Number': 'RA-9', 'Investment Start Date': '2020-01-01' },
        sourceHeader: 'Policy Number',
        field: policyNumber,
        source: 'portal',
      }),
    ).toEqual({ key: 'Account Number', value: 'RA-9' });
  });
});
