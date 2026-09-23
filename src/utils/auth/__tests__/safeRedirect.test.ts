import { describe, it, expect } from 'vitest';
import { safeInternalPath } from '../safeRedirect';

const ORIGIN = 'https://www.navigatewealth.co';

describe('safeInternalPath', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/admin/clients?tab=open#top', '/admin/clients?tab=open#top'],
    ['/portal/../dashboard', '/dashboard'],
  ])('keeps the same-origin path %p', (input, expected) => {
    expect(safeInternalPath(input, ORIGIN)).toBe(expected);
  });

  it.each([
    // The bypass that got through the old `startsWith('/') && !startsWith('//')`
    // check: browsers read the backslash as a slash.
    '/\\evil.example',
    '/\\/evil.example',
    '//evil.example',
    '///evil.example',
    'https://evil.example/login',
    'javascript:alert(1)',
    'evil.example',
    '',
  ])('refuses %p', (input) => {
    expect(safeInternalPath(input, ORIGIN)).toBeNull();
  });

  it('refuses null and undefined', () => {
    expect(safeInternalPath(null, ORIGIN)).toBeNull();
    expect(safeInternalPath(undefined, ORIGIN)).toBeNull();
  });
});
