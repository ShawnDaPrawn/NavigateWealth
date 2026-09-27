/**
 * securityService — unit tests (Phase 4 coverage push).
 *
 * Covers the client-side security layer: server-validated signup/login gating
 * (fail-open on network errors), the fire-and-forget audit loggers, and the
 * `securityService` object (2FA / password / email-change) that calls the
 * centralized api client. fetch and the api client are mocked; no network runs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../supabase/info', () => ({ projectId: 'proj', publicAnonKey: 'anon-key' }));

/**
 * `logPasswordChange` now sends the USER'S access token rather than the anon
 * key: the endpoint it calls draws the session-revocation watermark, and the
 * server derives whose sessions to end from that token. A test session is
 * therefore part of the fixture rather than incidental.
 */
const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(async () => ({ data: { session: { access_token: 'user-token' } } })),
  },
}));
vi.mock('../../supabase/client', () => ({ getSupabaseClient: () => supabaseMock }));

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../api/client', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));

import {
  validateSignupData,
  logLogout,
  logPasswordChange,
  securityService,
} from '../securityService';

function fetchResolving(body: unknown, { ok = true, status = 200 } = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}
function fetchRejecting(err: unknown) {
  global.fetch = vi.fn().mockRejectedValue(err) as unknown as typeof fetch;
}

const signupData = {
  email: 'a@b.co',
  password: 'pw',
  firstName: 'A',
  surname: 'B',
  phoneNumber: '0821234567',
  countryCode: '+27',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateSignupData', () => {
  it('returns valid + sanitized on a 200 response', async () => {
    fetchResolving({ sanitized: { firstName: 'Clean' } });
    const res = await validateSignupData(signupData);
    expect(res.valid).toBe(true);
    expect(res.sanitized).toEqual({ firstName: 'Clean' });
  });

  it('returns the rate-limit error on a 429', async () => {
    fetchResolving({ error: 'slow down' }, { ok: false, status: 429 });
    const res = await validateSignupData(signupData);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('slow down');
  });

  it('returns the server error on a non-ok response', async () => {
    fetchResolving({ error: 'weak password' }, { ok: false, status: 400 });
    const res = await validateSignupData(signupData);
    expect(res).toEqual({ valid: false, error: 'weak password' });
  });

  it('fails OPEN on a network error (allows signup to proceed)', async () => {
    fetchRejecting(new Error('Failed to fetch'));
    const res = await validateSignupData(signupData);
    expect(res.valid).toBe(true);
    expect(res.sanitized).toEqual(signupData);
  });

  it('fails closed on an unexpected (non-network) error', async () => {
    fetchRejecting(new Error('boom'));
    const res = await validateSignupData(signupData);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/unable to validate/i);
  });
});

describe('audit loggers (fire-and-forget)', () => {
  it('logLogout posts to /logout with the session token, never an identity in the body', async () => {
    fetchResolving({});
    await logLogout('user-token');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/logout'),
      expect.objectContaining({ method: 'POST' }),
    );
    // The server takes the account from the token. Naming an email or user id
    // in the body is what let anyone forge sign-out entries for a stranger.
    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer user-token');
    expect(JSON.parse(String(init.body))).toEqual({});

    fetchRejecting(new Error('down'));
    await expect(logLogout('user-token')).resolves.toBeUndefined();
  });

  it('logPasswordChange posts to /password-change with the session token and swallows errors', async () => {
    fetchResolving({});
    await logPasswordChange('a@b.co', 'uid');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/password-change'),
      expect.anything(),
    );

    // The account is identified by the token, never by the body. Sending the
    // anon key here (as this did before) would leave the endpoint unable to
    // tell whose sessions to revoke — and, when it could, would let anyone
    // revoke a stranger's by naming their id.
    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer user-token');
    expect(JSON.parse(String(init.body))).toEqual({});

    fetchRejecting(new Error('down'));
    await expect(logPasswordChange('a@b.co', 'uid')).resolves.toBeUndefined();
  });

  it('logPasswordChange sends nothing when there is no session to prove the account', async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null } } as never);
    fetchResolving({});
    await expect(logPasswordChange('a@b.co', 'uid')).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('securityService object', () => {
  it('getSecurityStatus normalizes a success payload', async () => {
    apiGet.mockResolvedValue({
      success: true,
      status: {
        twoFactorEnabled: true,
        twoFactorMethod: 'sms',
        loginNotifications: false,
        passwordLastChanged: '2026-01-01',
      },
    });
    const res = await securityService.getSecurityStatus('uid');
    expect(res).toEqual({
      twoFactorEnabled: true,
      twoFactorMethod: 'sms',
      loginNotifications: false,
      passwordLastChanged: '2026-01-01',
    });
  });

  it('getSecurityStatus returns null on failure or error', async () => {
    apiGet.mockResolvedValue({ success: false });
    expect(await securityService.getSecurityStatus('uid')).toBeNull();
    apiGet.mockRejectedValue(new Error('boom'));
    expect(await securityService.getSecurityStatus('uid')).toBeNull();
  });

  it('getActivityLogs returns logs on success and [] on error', async () => {
    apiGet.mockResolvedValue({ success: true, logs: [{ id: '1' }] });
    expect(await securityService.getActivityLogs('uid')).toEqual([{ id: '1' }]);
    apiGet.mockRejectedValue(new Error('boom'));
    expect(await securityService.getActivityLogs('uid')).toEqual([]);
  });

  it('updatePassword returns data on success and throws the server error on failure', async () => {
    apiPost.mockResolvedValue({ success: true });
    await expect(securityService.updatePassword('uid', 'old', 'new')).resolves.toEqual({
      success: true,
    });
    apiPost.mockResolvedValue({ success: false, error: 'wrong current password' });
    await expect(securityService.updatePassword('uid', 'old', 'new')).rejects.toThrow(
      'wrong current password',
    );
  });

  it('toggleTwoFactor throws on a failed response', async () => {
    apiPost.mockResolvedValue({ success: false, error: 'nope' });
    await expect(securityService.toggleTwoFactor('uid', true, 'email')).rejects.toThrow('nope');
  });

  it('verifyTwoFactorCode throws "Invalid verification code" by default', async () => {
    apiPost.mockResolvedValue({ success: false });
    await expect(securityService.verifyTwoFactorCode('uid', '000000')).rejects.toThrow(
      /invalid verification code/i,
    );
  });

  it('requestEmailChange returns data on success', async () => {
    apiPost.mockResolvedValue({ success: true, pendingEmailChange: null });
    await expect(
      securityService.requestEmailChange('uid', { newEmail: 'new@b.co' }),
    ).resolves.toEqual({ success: true, pendingEmailChange: null });
  });

  it('verifyEmailChange throws on failure', async () => {
    apiPost.mockResolvedValue({ success: false, error: 'bad code' });
    await expect(securityService.verifyEmailChange('uid', { newEmailCode: '123' })).rejects.toThrow(
      'bad code',
    );
  });
});
