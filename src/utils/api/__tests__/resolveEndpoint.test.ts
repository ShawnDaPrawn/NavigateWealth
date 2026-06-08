/**
 * Tests for resolveApiEndpoint — pure URL normalization utility.
 */

import { describe, expect, it } from 'vitest';
import { resolveApiEndpoint } from '../resolveEndpoint';

const MARKER = '/functions/v1/make-server-91ed8379';

describe('resolveApiEndpoint', () => {
  it('returns relative paths unchanged', () => {
    expect(resolveApiEndpoint('/api/users')).toBe('/api/users');
  });

  it('returns root relative path unchanged', () => {
    expect(resolveApiEndpoint('/')).toBe('/');
  });

  it('strips the edge function base URL prefix', () => {
    const full = `https://project.supabase.co${MARKER}/clients`;
    expect(resolveApiEndpoint(full)).toBe('/clients');
  });

  it('preserves query string after stripping base URL', () => {
    const full = `https://project.supabase.co${MARKER}/clients?page=2`;
    expect(resolveApiEndpoint(full)).toBe('/clients?page=2');
  });

  it('returns "/" when suffix is empty after marker', () => {
    const full = `https://project.supabase.co${MARKER}`;
    expect(resolveApiEndpoint(full)).toBe('/');
  });

  it('returns non-URL string as-is when it has no marker', () => {
    expect(resolveApiEndpoint('not-a-url')).toBe('not-a-url');
  });

  it('returns full URL as-is when marker is absent', () => {
    const url = 'https://api.example.com/v1/data';
    expect(resolveApiEndpoint(url)).toBe(url);
  });
});
