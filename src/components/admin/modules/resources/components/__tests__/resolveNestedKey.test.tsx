/**
 * resolveNestedKey — Lightweight Integration Tests
 *
 * These tests verify the {{ key }} stripping and nested-path resolution
 * logic used by DynamicFormRenderer and renderBlock for data binding.
 *
 * Run at module load time and log results to console. In a real test
 * runner, each assertion would be an `it()` block. Here we use a simple
 * assert-and-log approach so the results are visible in the browser
 * console during development.
 */

import { resolveNestedKey } from '../DynamicFormRenderer';

// ============================================================================
// Test Data
// ============================================================================
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
  'client.name': 'Flat Dot Key',   // Flat key that contains a dot
  status: '',                       // Empty string
  amount: 0,                        // Falsy number
  isActive: true,
  items: [{ name: 'A' }, { name: 'B' }],
};

// ============================================================================
// Test Cases
// ============================================================================
interface TestCase {
  label: string;
  path: string;
  expected: unknown;
}

const cases: TestCase[] = [
  // -- FLAT KEYS --
  { label: 'Flat key (no dots)',             path: 'firstName',                        expected: 'Alice' },
  { label: 'Flat key — falsy empty string',  path: 'status',                           expected: '' },
  { label: 'Flat key — falsy zero',          path: 'amount',                           expected: 0 },
  { label: 'Flat key — boolean true',        path: 'isActive',                         expected: true },
  { label: 'Flat key with dot in name',      path: 'client.name',                      expected: 'Flat Dot Key' },

  // -- NESTED PATHS --
  { label: 'Nested 1-level deep',           path: 'personalInformation.idNumber',      expected: '9001015009087' },
  { label: 'Nested 2-levels deep',          path: 'personalInformation.address.city',  expected: 'Johannesburg' },
  { label: 'Nested — missing leaf key',     path: 'personalInformation.address.province', expected: undefined },
  { label: 'Nested — missing parent',       path: 'nonexistent.deep.path',             expected: undefined },

  // -- TEMPLATE SYNTAX {{ key }} --
  { label: '{{ key }} wrapping',             path: '{{firstName}}',                     expected: 'Alice' },
  { label: '{{ key }} with spaces',          path: '{{  firstName  }}',                 expected: 'Alice' },
  { label: '{{ key }} with leading space',   path: '{{ firstName}}',                    expected: 'Alice' },
  { label: '{{ key }} nested path',          path: '{{personalInformation.idNumber}}',  expected: '9001015009087' },
  { label: '{{ key }} nested with spaces',   path: '{{  personalInformation.address.street  }}', expected: '123 Main Road' },

  // -- EDGE CASES --
  { label: 'Empty path',                    path: '',                                   expected: undefined },
  { label: 'Array at key',                  path: 'items',                              expected: TEST_DATA.items },
  { label: 'Whitespace-only path',          path: '   ',                                expected: undefined },
];

// ============================================================================
// Runner
// ============================================================================
let passed = 0;
let failed = 0;
const failures: string[] = [];

cases.forEach(({ label, path, expected }) => {
  const actual = resolveNestedKey(TEST_DATA, path);
  const ok = actual === expected || (actual === undefined && expected === undefined) || JSON.stringify(actual) === JSON.stringify(expected);

  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(`  FAIL: "${label}" — path="${path}" expected=${JSON.stringify(expected)} got=${JSON.stringify(actual)}`);
  }
});

// ============================================================================
// Output (visible in browser console)
// ============================================================================
const summary = `[resolveNestedKey tests] ${passed}/${cases.length} passed, ${failed} failed`;

if (failed > 0) {
  console.warn(summary);
  failures.forEach((f) => console.warn(f));
} else {
  console.log(`%c${summary}`, 'color: green; font-weight: bold;');
}

// Export runner for programmatic use
export const resolveNestedKeyTestResults = {
  total: cases.length,
  passed,
  failed,
  failures,
};