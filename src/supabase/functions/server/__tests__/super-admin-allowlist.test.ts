/**
 * Super-admin allowlist tests.
 *
 * Guards the durable, recovery-safe authorisation path: `isSuperAdminEmail()`
 * must match every hardcoded allowlist entry case-insensitively, honour the
 * `SUPER_ADMIN_EMAILS` env override (the deploy-free recovery path), and reject
 * everything else — including empty/undefined input.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSuperAdminEmail, SUPER_ADMIN_EMAILS } from '../constants.ts';

describe('SUPER_ADMIN_EMAILS allowlist', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('contains at least two recovery admins (no single point of failure)', () => {
    expect(SUPER_ADMIN_EMAILS.size).toBeGreaterThanOrEqual(2);
  });

  it('matches every hardcoded entry case-insensitively', () => {
    for (const email of SUPER_ADMIN_EMAILS) {
      expect(isSuperAdminEmail(email)).toBe(true);
      expect(isSuperAdminEmail(email.toUpperCase())).toBe(true);
      expect(isSuperAdminEmail(`  ${email}  `)).toBe(true);
    }
  });

  it('rejects non-allowlisted, empty, and nullish emails', () => {
    expect(isSuperAdminEmail('attacker@example.com')).toBe(false);
    expect(isSuperAdminEmail('')).toBe(false);
    expect(isSuperAdminEmail('   ')).toBe(false);
    expect(isSuperAdminEmail(null)).toBe(false);
    expect(isSuperAdminEmail(undefined)).toBe(false);
  });

  it('honours the SUPER_ADMIN_EMAILS env override (deploy-free recovery)', () => {
    vi.stubGlobal('Deno', {
      env: {
        get: (k: string) => (k === 'SUPER_ADMIN_EMAILS' ? 'recovery@example.com' : undefined),
      },
    });
    expect(isSuperAdminEmail('recovery@example.com')).toBe(true);
    expect(isSuperAdminEmail('RECOVERY@example.com')).toBe(true);
    expect(isSuperAdminEmail('still-not-admin@example.com')).toBe(false);
  });

  it('parses a comma/whitespace-separated env override list', () => {
    vi.stubGlobal('Deno', {
      env: { get: () => 'one@example.com, two@example.com;three@example.com' },
    });
    expect(isSuperAdminEmail('two@example.com')).toBe(true);
    expect(isSuperAdminEmail('three@example.com')).toBe(true);
  });

  it('is safe when Deno is undefined (Node/Vitest runtime)', () => {
    expect(typeof (globalThis as { Deno?: unknown }).Deno).toBe('undefined');
    expect(isSuperAdminEmail('attacker@example.com')).toBe(false);
  });
});
