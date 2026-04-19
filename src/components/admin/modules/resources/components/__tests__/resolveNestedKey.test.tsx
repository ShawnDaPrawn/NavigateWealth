import { describe, expect, it } from 'vitest';

import { resolveNestedKey } from '../DynamicFormRenderer';

const TEST_DATA = {
  firstName: 'Alice',
  lastName: 'Smith',
  personalInformation: {
    idNumber: '9001015009087',
    dateOfBirth: '1990-01-01',
    address: {
      street: '123 Main Road',
      city: 'Johannesburg',
      code: '2000',
    },
  },
  'client.name': 'Flat Dot Key',
  status: '',
  amount: 0,
  isActive: true,
  items: [{ name: 'A' }, { name: 'B' }],
};

interface TestCase {
  label: string;
  path: string;
  expected: unknown;
}

const cases: TestCase[] = [
  { label: 'flat key with no dots', path: 'firstName', expected: 'Alice' },
  { label: 'flat key with falsy empty string', path: 'status', expected: '' },
  { label: 'flat key with falsy zero', path: 'amount', expected: 0 },
  { label: 'flat key with boolean true', path: 'isActive', expected: true },
  { label: 'flat key containing a dot', path: 'client.name', expected: 'Flat Dot Key' },
  { label: 'nested one-level path', path: 'personalInformation.idNumber', expected: '9001015009087' },
  { label: 'nested two-level path', path: 'personalInformation.address.city', expected: 'Johannesburg' },
  { label: 'nested missing leaf key', path: 'personalInformation.address.province', expected: undefined },
  { label: 'nested missing parent', path: 'nonexistent.deep.path', expected: undefined },
  { label: 'template wrapping', path: '{{firstName}}', expected: 'Alice' },
  { label: 'template wrapping with spaces', path: '{{  firstName  }}', expected: 'Alice' },
  { label: 'template wrapping with leading space', path: '{{ firstName}}', expected: 'Alice' },
  { label: 'template wrapping around nested path', path: '{{personalInformation.idNumber}}', expected: '9001015009087' },
  {
    label: 'template wrapping around nested path with spaces',
    path: '{{  personalInformation.address.street  }}',
    expected: '123 Main Road',
  },
  { label: 'empty path', path: '', expected: undefined },
  { label: 'array value at key', path: 'items', expected: TEST_DATA.items },
  { label: 'whitespace-only path', path: '   ', expected: undefined },
];

describe('resolveNestedKey', () => {
  it.each(cases)('resolves $label', ({ path, expected }) => {
    expect(resolveNestedKey(TEST_DATA, path)).toEqual(expected);
  });
});
