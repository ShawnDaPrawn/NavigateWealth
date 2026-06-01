/**
 * authService — unit tests (Phase 4 coverage push).
 *
 * The core Supabase auth orchestration: sign-in (rate-limit gate, Supabase
 * error mapping, the legacy unconfirmed-email auto-confirm + retry), sign-up,
 * sign-out, session/user reads, password reset/update, and the pure user
 * mappers. The Supabase client + securityService are mocked; errorHandler is
 * real so the error-normalization paths are exercised end-to-end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@supabase/supabase-js';

vi.mock('../../supabase/info', () => ({ projectId: 'proj', publicAnonKey: 'anon-key' }));

const h = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    getSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    resend: vi.fn(),
    updateUser: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}));
vi.mock('../../supabase/client', () => ({ getSupabaseClient: () => ({ auth: h.auth }) }));

vi.mock('../securityService', () => ({
  validateSignupData: vi.fn(
    async (): Promise<{ valid: boolean; error?: string; sanitized?: Record<string, unknown> }> => ({
      valid: true,
      sanitized: { firstName: 'Ann', surname: 'Bee' },
    }),
  ),
  validateLoginAttempt: vi.fn(
    async (): Promise<{ allowed: boolean; error?: string; blocked?: boolean; resetAt?: Date }> => ({
      allowed: true,
    }),
  ),
  logLoginSuccess: vi.fn(async () => {}),
  logLoginFailure: vi.fn(async () => {}),
  logLogout: vi.fn(async () => {}),
  logPasswordResetRequest: vi.fn(async () => {}),
  logPasswordChange: vi.fn(async () => {}),
}));

import * as security from '../securityService';
import * as authService from '../authService';
import { AuthError } from '../errorHandler';

const supaUser = {
  id: 'u1',
  email: 'a@b.co',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  created_at: '2025-01-01T00:00:00Z',
  user_metadata: {
    first_name: 'Ann',
    surname: 'Bee',
    full_phone_number: '+27821234567',
    display_name: 'Ann Bee',
    role: 'admin',
    invited: true,
    accountStatus: 'approved',
  },
} as unknown as User;

function fetchResolving(body: unknown, { ok = true, status = 200 } = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(h.auth).forEach((fn) => fn.mockReset());
});

describe('signIn', () => {
  it('returns the mapped user + session and logs success', async () => {
    h.auth.signInWithPassword.mockResolvedValue({
      data: { user: supaUser, session: { access_token: 't' } },
      error: null,
    });
    const res = await authService.signIn('a@b.co', 'pw');
    expect(res.user).toEqual({
      id: 'u1',
      email: 'a@b.co',
      emailConfirmed: true,
      createdAt: '2025-01-01T00:00:00Z',
    });
    expect(res.session).toEqual({ access_token: 't' });
    expect(security.logLoginSuccess).toHaveBeenCalledWith('a@b.co', 'u1');
  });

  it('throws rate_limited when the server gate blocks the attempt', async () => {
    vi.mocked(security.validateLoginAttempt).mockResolvedValueOnce({
      allowed: false,
      error: 'Too many',
    });
    await expect(authService.signIn('a@b.co', 'pw')).rejects.toMatchObject({
      code: 'rate_limited',
    });
    expect(security.logLoginFailure).toHaveBeenCalled();
  });

  it('maps a Supabase 429 to rate_limited', async () => {
    h.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { status: 429, message: 'Too many requests' },
    });
    await expect(authService.signIn('a@b.co', 'pw')).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('throws invalid_credentials when Supabase returns no user', async () => {
    h.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: null });
    await expect(authService.signIn('a@b.co', 'pw')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });

  it('auto-confirms a legacy unconfirmed email then retries successfully', async () => {
    h.auth.signInWithPassword
      .mockResolvedValueOnce({
        data: {},
        error: { status: 400, message: 'Invalid login credentials' },
      })
      .mockResolvedValueOnce({
        data: { user: supaUser, session: { access_token: 't' } },
        error: null,
      });
    fetchResolving({ confirmed: true, alreadyConfirmed: false });

    const res = await authService.signIn('a@b.co', 'pw');
    expect(res.user?.id).toBe('u1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/confirm-email'),
      expect.anything(),
    );
  });
});

describe('signUp', () => {
  it('creates the account via the backend endpoint (email unconfirmed, no session)', async () => {
    fetchResolving({ user: { id: 'u1', email: 'a@b.co' } });
    const res = await authService.signUp('a@b.co', 'pw', { firstName: 'Ann', surname: 'Bee' });
    expect(res.user).toMatchObject({ id: 'u1', email: 'a@b.co', emailConfirmed: false });
    expect(res.session).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth-signup/signup'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws validation_failed when server validation rejects', async () => {
    vi.mocked(security.validateSignupData).mockResolvedValueOnce({
      valid: false,
      error: 'weak password',
    });
    await expect(authService.signUp('a@b.co', 'pw')).rejects.toMatchObject({
      code: 'validation_failed',
    });
  });

  it('throws when the backend signup endpoint errors', async () => {
    fetchResolving({ error: 'Email exists' }, { ok: false, status: 400 });
    await expect(authService.signUp('a@b.co', 'pw')).rejects.toBeInstanceOf(AuthError);
  });
});

describe('signOut', () => {
  it('signs out and logs the logout event', async () => {
    h.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.co' } } });
    h.auth.signOut.mockResolvedValue({ error: null });
    await authService.signOut();
    expect(security.logLogout).toHaveBeenCalledWith('a@b.co', 'u1');
  });

  it('throws on a Supabase sign-out error', async () => {
    h.auth.getUser.mockResolvedValue({ data: { user: null } });
    h.auth.signOut.mockResolvedValue({ error: { message: 'fail' } });
    await expect(authService.signOut()).rejects.toBeInstanceOf(AuthError);
  });
});

describe('session + user reads', () => {
  it('getSession returns the session, or null on error', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    expect(await authService.getSession()).toEqual({ access_token: 't' });
    h.auth.getSession.mockResolvedValue({ data: {}, error: { message: 'e' } });
    expect(await authService.getSession()).toBeNull();
  });

  it('getCurrentUser maps the user, or null when absent', async () => {
    h.auth.getUser.mockResolvedValue({ data: { user: supaUser }, error: null });
    expect(await authService.getCurrentUser()).toMatchObject({ id: 'u1', emailConfirmed: true });
    h.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await authService.getCurrentUser()).toBeNull();
  });

  it('getCurrentUserWithMetadata returns the full metadata snapshot', async () => {
    h.auth.getUser.mockResolvedValue({ data: { user: supaUser }, error: null });
    expect(await authService.getCurrentUserWithMetadata()).toMatchObject({
      id: 'u1',
      firstName: 'Ann',
      role: 'admin',
      invited: true,
      emailConfirmed: true,
    });
  });

  it('getUserMetadata returns data on email match, null on mismatch', async () => {
    h.auth.getUser.mockResolvedValue({ data: { user: supaUser }, error: null });
    expect(await authService.getUserMetadata('a@b.co')).toMatchObject({
      userId: 'u1',
      emailConfirmed: true,
    });
    expect(await authService.getUserMetadata('other@b.co')).toBeNull();
  });

  it('isEmailVerified reflects the current user', async () => {
    h.auth.getUser.mockResolvedValue({ data: { user: supaUser }, error: null });
    expect(await authService.isEmailVerified()).toBe(true);
  });
});

describe('password flows', () => {
  it('sendPasswordResetEmail calls Supabase with a redirect and logs the request', async () => {
    h.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await authService.sendPasswordResetEmail('a@b.co');
    expect(h.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'a@b.co',
      expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') }),
    );
    expect(security.logPasswordResetRequest).toHaveBeenCalledWith('a@b.co');
  });

  it('sendPasswordResetEmail throws on a Supabase error', async () => {
    h.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: 'bad' } });
    await expect(authService.sendPasswordResetEmail('a@b.co')).rejects.toBeInstanceOf(AuthError);
  });

  it('resendVerificationEmail resolves on success and throws on error', async () => {
    h.auth.resend.mockResolvedValue({ error: null });
    await expect(authService.resendVerificationEmail('a@b.co')).resolves.toBeUndefined();
    h.auth.resend.mockResolvedValue({ error: { message: 'bad' } });
    await expect(authService.resendVerificationEmail('a@b.co')).rejects.toBeInstanceOf(AuthError);
  });

  it('updatePassword updates and logs the change', async () => {
    h.auth.updateUser.mockResolvedValue({ error: null });
    h.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.co' } } });
    await authService.updatePassword('newpw');
    expect(security.logPasswordChange).toHaveBeenCalledWith('a@b.co', 'u1');
  });

  it('updatePassword surfaces a same-password error', async () => {
    h.auth.updateUser.mockResolvedValue({
      error: { message: 'New password is the same as the old one' },
    });
    await expect(authService.updatePassword('newpw')).rejects.toMatchObject({
      code: 'same_password',
    });
  });
});

describe('pure mappers + subscription', () => {
  it('mapSupabaseUserToMetadataSnapshot maps the metadata fields', () => {
    expect(authService.mapSupabaseUserToMetadataSnapshot(supaUser)).toEqual({
      id: 'u1',
      email: 'a@b.co',
      firstName: 'Ann',
      lastName: 'Bee',
      phoneNumber: '+27821234567',
      displayName: 'Ann Bee',
      accountStatus: 'approved',
      emailConfirmed: true,
      createdAt: '2025-01-01T00:00:00Z',
      role: 'admin',
      invited: true,
    });
  });

  it('authUserFromSupabaseUser maps to an AuthUser', () => {
    expect(authService.authUserFromSupabaseUser(supaUser)).toEqual({
      id: 'u1',
      email: 'a@b.co',
      emailConfirmed: true,
      createdAt: '2025-01-01T00:00:00Z',
    });
  });

  it('onAuthStateChange subscribes and forwards mapped user / null to the callback', async () => {
    let handler: ((event: string, session: unknown) => Promise<void>) | undefined;
    h.auth.onAuthStateChange.mockImplementation((cb: (e: string, s: unknown) => Promise<void>) => {
      handler = cb;
      return { data: { subscription: { id: 'sub' } } };
    });
    const cb = vi.fn();
    const sub = authService.onAuthStateChange(cb);
    expect(sub).toEqual({ id: 'sub' });

    await handler!('SIGNED_IN', { user: supaUser, access_token: 't' });
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
      expect.objectContaining({ event: 'SIGNED_IN', accessToken: 't' }),
    );

    await handler!('SIGNED_OUT', null);
    expect(cb).toHaveBeenLastCalledWith(null, { event: 'SIGNED_OUT' });
  });
});
