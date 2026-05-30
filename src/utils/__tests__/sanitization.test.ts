/**
 * Sanitization Tests
 *
 * `deepSanitize` strips large/base64 strings and blocks `data:` URIs (including
 * in URL-ish allowlisted fields) before payloads are persisted or logged. This
 * is a security boundary, so the allowlist, the data:-URI block, the length
 * cutoff, and the null/undefined passthrough are all pinned here.
 *
 * @module utils/__tests__/sanitization
 */

import { describe, it, expect } from 'vitest';
import { deepSanitize } from '../sanitization';

describe('deepSanitize', () => {
  it('returns null and undefined unchanged', () => {
    expect(deepSanitize(null)).toBeNull();
    expect(deepSanitize(undefined)).toBeUndefined();
  });

  it('passes through normal short strings, numbers, and booleans', () => {
    const input = { name: 'Alice', age: 42, active: true };
    expect(deepSanitize(input)).toEqual(input);
  });

  it('removes base64 data: URI strings in normal fields', () => {
    const input = { avatar: 'data:image/png;base64,AAAA', name: 'Bob' };
    expect(deepSanitize(input)).toEqual({ name: 'Bob' });
  });

  it('removes strings longer than 5000 characters', () => {
    const input = { blob: 'x'.repeat(5001), keep: 'short' };
    const result = deepSanitize(input);
    expect(result).toEqual({ keep: 'short' });
  });

  it('keeps strings of exactly 5000 characters', () => {
    const input = { blob: 'x'.repeat(5000) };
    const result = deepSanitize(input);
    expect(result.blob).toHaveLength(5000);
  });

  it('allows long URLs in allowlisted fields (fileUrl, path, url, href)', () => {
    const longUrl = `https://example.com/${'a'.repeat(6000)}`;
    const input = {
      fileUrl: longUrl,
      path: longUrl,
      url: longUrl,
      href: longUrl,
    };
    const result = deepSanitize(input);
    expect(result.fileUrl).toBe(longUrl);
    expect(result.path).toBe(longUrl);
    expect(result.url).toBe(longUrl);
    expect(result.href).toBe(longUrl);
  });

  it('still blocks data: URIs even in allowlisted fields (security fix)', () => {
    const input = {
      fileUrl: 'data:image/png;base64,AAAA',
      url: 'data:text/html,<script>alert(1)</script>',
      keep: 'value',
    };
    const result = deepSanitize(input);
    expect(result).toEqual({ keep: 'value' });
  });

  it('sanitizes nested objects and arrays', () => {
    const input = {
      user: {
        name: 'Carol',
        photo: 'data:image/jpeg;base64,BBBB',
      },
      items: [{ note: 'ok' }, { note: 'y'.repeat(5001) }],
    };
    const result = deepSanitize(input);
    expect(result).toEqual({
      user: { name: 'Carol' },
      items: [{ note: 'ok' }, {}],
    });
  });
});
