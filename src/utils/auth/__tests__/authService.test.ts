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
    setSession: vi.fn(),
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
  /**
   * signIn no longer touches `signInWithPassword`. It POSTs to the Edge
   * Function's `/auth/login`, which applies the rate limit and authenticates in
   * the same handler, then installs the returned session with `setSession`.
   * That is the whole point of the change these tests were rewritten for: the
   * lockout used to be a question the client could decline to ask.
   */
  function loginResponding(body: unknown, { ok = true, status = 200 } = {}) {
    global.fetch = vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    }) as unknown as typeof fetch;
  }

  it('posts credentials to the server endpoint and installs the returned session', async () => {
    loginResponding({
      success: true,
      session: { access_token: 't', refresh_token: 'r' },
      user: { id: 'u1' },
    });
    h.auth.setSession.mockResolvedValue({
      data: { user: supaUser, session: { access_token: 't' } },
      error: null,
    });

    const res = await authService.signIn('a@b.co', 'pw');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(h.auth.setSession).toHaveBeenCalledWith({
      access_token: 't',
      refresh_token: 'r',
    });
    expect(res.user).toEqual({
      id: 'u1',
      email: 'a@b.co',
      emailConfirmed: true,
      createdAt: '2025-01-01T00:00:00Z',
    });
    expect(res.session).toEqual({ access_token: 't' });
  });

  it('never calls signInWithPassword — the bypass this endpoint exists to close', async () => {
    loginResponding({
      success: true,
      session: { access_token: 't', refresh_token: 'r' },
      user: { id: 'u1' },
    });
    h.auth.setSession.mockResolvedValue({
      data: { user: supaUser, session: { access_token: 't' } },
      error: null,
    });

    await authService.signIn('a@b.co', 'pw');

    // Going direct to GoTrue is exactly what let a caller skip the 5-in-15
    // lockout. If this ever passes again, the hole is back.
    expect(h.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('maps the server 429 to rate_limited', async () => {
    loginResponding(
      { error: 'Too many login attempts.', blocked: true },
      { ok: false, status: 429 },
    );
    await expect(authService.signIn('a@b.co', 'pw')).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('maps a server 401 to invalid_credentials', async () => {
    loginResponding({ error: 'Invalid credentials' }, { ok: false, status: 401 });
    await expect(authService.signIn('a@b.co', 'pw')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });

  it('rejects a 200 that carries no session rather than treating it as success', async () => {
    loginResponding({ success: true, user: { id: 'u1' } });
    await expect(authService.signIn('a@b.co', 'pw')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    expect(h.auth.setSession).not.toHaveBeenCalled();
  });

  it('FAILS CLOSED when the login service is unreachable', async () => {
    // The important one. Falling back to signing in around the unreachable
    // limiter would hand the bypass back to anyone who can block one host.
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await expect(authService.signIn('a@b.co', 'pw')).rejects.toMatchObject({
      code: 'network_error',
    });
    expect(h.auth.signInWithPassword).not.toHaveBeenCalled();
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
  it('sendPasswordResetEmail posts to the server endpoint with a redirect', async () => {
    // The mail is now sent BY the server, on the far side of the 3-per-hour
    // limit. Calling resetPasswordForEmail here would put the send back in
    // front of the counter, which is the defect this replaced.
    fetchResolving({ success: true });
    await authService.sendPasswordResetEmail('a@b.co');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/password-reset'),
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      email: 'a@b.co',
      redirectTo: expect.stringContaining('/reset-password'),
    });
    expect(h.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('sendPasswordResetEmail throws when the service itself is unhealthy', async () => {
    // The route answers 200 for every outcome a caller may distinguish
    // (unknown address, throttled, provider error), so a non-200 means the
    // service is broken — not that the account does not exist.
    fetchResolving({}, { ok: false, status: 503 });
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
