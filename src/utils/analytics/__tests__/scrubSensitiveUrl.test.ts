/**
 * Analytics URL scrubbing — SECURITY-AUDIT S8 regression guard
 * ============================================================
 *
 * The e-sign signer token arrives as `/sign?token=<uuid>` and IS the signer's
 * credential. Both analytics pipelines record the full page URL, so every
 * signer visit copied a live credential to Google and Vercel, where anyone with
 * dashboard access could replay it.
 *
 * Run: npx vitest run src/utils/analytics/__tests__/scrubSensitiveUrl.test.ts
 */
import { describe, it, expect } from 'vitest';

import { scrubSensitiveUrl, hasSensitiveQueryParam } from '../scrubSensitiveUrl';

const TOKEN = '3f0c8b6e-1a2d-4c5b-9e7f-0a1b2c3d4e5f';

describe('scrubSensitiveUrl', () => {
  it('removes the signer token from an absolute URL', () => {
    const result = scrubSensitiveUrl(`https://www.navigatewealth.co/sign?token=${TOKEN}`);
    expect(result).not.toContain(TOKEN);
  });

  it('removes the signer token from a path-relative URL', () => {
    // Vercel Analytics hands over the relative form; GA the absolute one.
    const result = scrubSensitiveUrl(`/sign?token=${TOKEN}`);
    expect(result).not.toContain(TOKEN);
    expect(result.startsWith('/sign')).toBe(true);
  });

  it('matches the parameter name case-insensitively', () => {
    expect(scrubSensitiveUrl(`/sign?TOKEN=${TOKEN}`)).not.toContain(TOKEN);
    expect(scrubSensitiveUrl(`/x?Access_Token=${TOKEN}`)).not.toContain(TOKEN);
  });

  it('scrubs client identifiers as well as credentials', () => {
    const result = scrubSensitiveUrl('/admin?clientId=abc-123&userId=u-9');
    expect(result).not.toContain('abc-123');
    expect(result).not.toContain('u-9');
  });

  it('preserves marketing attribution, which must keep working', () => {
    // Over-scrubbing silently degrades attribution, and a safety measure that
    // breaks the marketing site is a safety measure that gets reverted.
    const url = '/pricing?utm_source=google&utm_campaign=brand&ref=partner';
    expect(scrubSensitiveUrl(url)).toBe(url);
  });

  it('leaves a URL without sensitive parameters exactly as it was', () => {
    expect(scrubSensitiveUrl('/about')).toBe('/about');
    expect(scrubSensitiveUrl('https://www.navigatewealth.co/about#team')).toBe(
      'https://www.navigatewealth.co/about#team',
    );
  });

  it('keeps other parameters and the fragment intact while scrubbing', () => {
    const result = scrubSensitiveUrl(`/sign?token=${TOKEN}&lang=en#sig`);
    expect(result).not.toContain(TOKEN);
    expect(result).toContain('lang=en');
    expect(result).toContain('#sig');
  });

  it('never throws on malformed input', () => {
    // This runs inside a render path and an inline analytics script; throwing
    // would take down the page it is meant to protect.
    expect(() => scrubSensitiveUrl('::::not a url::::')).not.toThrow();
    expect(scrubSensitiveUrl('')).toBe('');
  });
});

describe('hasSensitiveQueryParam', () => {
  it('reports whether a URL would leak', () => {
    expect(hasSensitiveQueryParam(`/sign?token=${TOKEN}`)).toBe(true);
    expect(hasSensitiveQueryParam('/about')).toBe(false);
  });
});
