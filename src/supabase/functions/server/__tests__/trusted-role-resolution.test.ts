/**
 * Trusted role resolution tests (SECURITY: PR #106 review P1).
 *
 * `resolveTrustedRole()` is the single source of truth the auth middleware
 * uses to derive a user's effective role. The invariant under test: privileged
 * roles (admin, super_admin, adviser) are NEVER granted from client-editable
 * `user_metadata` — only from the super-admin email allowlist, server-managed
 * `app_metadata`, or the `NW_ADMIN_EMAILS` env allowlist. Without this, any
 * authenticated user could self-escalate via
 * `supabase.auth.updateUser({ data: { role: 'admin' } })`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTrustedRole, isAdminEmail, SUPER_ADMIN_EMAIL } from '../constants.ts';

describe('resolveTrustedRole', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('NEVER grants privileged roles from client-editable user_metadata', () => {
    for (const role of ['admin', 'super_admin', 'super-admin', 'adviser']) {
      expect(
        resolveTrustedRole({
          email: 'attacker@example.com',
          user_metadata: { role },
        }),
      ).toBe('client');
    }
  });

  it('trusts app_metadata verbatim (only the service role can write it)', () => {
    for (const role of ['admin', 'super_admin', 'adviser', 'paraplanner']) {
      expect(
        resolveTrustedRole({
          email: 'staff@example.com',
          app_metadata: { role },
          // Self-set user_metadata must not override the app_metadata value
          user_metadata: { role: 'super_admin' },
        }),
      ).toBe(role);
    }
  });

  it('grants super_admin from the email allowlist regardless of metadata', () => {
    expect(
      resolveTrustedRole({
        email: SUPER_ADMIN_EMAIL,
        user_metadata: { role: 'client' },
      }),
    ).toBe('super_admin');
  });

  it('grants admin from the NW_ADMIN_EMAILS env allowlist', () => {
    vi.stubGlobal('Deno', {
      env: { get: (k: string) => (k === 'NW_ADMIN_EMAILS' ? 'ops@example.com' : undefined) },
    });
    expect(resolveTrustedRole({ email: 'ops@example.com' })).toBe('admin');
    expect(resolveTrustedRole({ email: 'OPS@example.com' })).toBe('admin');
    expect(resolveTrustedRole({ email: 'other@example.com' })).toBe('client');
  });

  it('passes through non-privileged user_metadata roles', () => {
    expect(resolveTrustedRole({ email: 'c@example.com', user_metadata: { role: 'client' } })).toBe(
      'client',
    );
    expect(resolveTrustedRole({ email: 'v@example.com', user_metadata: { role: 'viewer' } })).toBe(
      'viewer',
    );
  });

  it('defaults to client for missing/empty/non-string roles', () => {
    expect(resolveTrustedRole({ email: 'x@example.com' })).toBe('client');
    expect(resolveTrustedRole({ email: 'x@example.com', user_metadata: {} })).toBe('client');
    expect(resolveTrustedRole({ email: 'x@example.com', user_metadata: { role: '' } })).toBe(
      'client',
    );
    expect(
      resolveTrustedRole({
        email: 'x@example.com',
        user_metadata: { role: { nested: 'admin' } },
        app_metadata: { role: 42 },
      }),
    ).toBe('client');
  });
});

describe('isAdminEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when the env var is unset or input is empty', () => {
    expect(isAdminEmail('anyone@example.com')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it('parses a comma/semicolon/whitespace-separated list case-insensitively', () => {
    vi.stubGlobal('Deno', {
      env: { get: () => 'one@example.com, two@example.com;three@example.com' },
    });
    expect(isAdminEmail('TWO@example.com')).toBe(true);
    expect(isAdminEmail('three@example.com')).toBe(true);
    expect(isAdminEmail('four@example.com')).toBe(false);
  });
});
