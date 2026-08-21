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
  validateLoginAttempt,
  logLoginSuccess,
  logLoginFailure,
  logLogout,
  logPasswordResetRequest,
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

describe('validateLoginAttempt', () => {
  it('allows the attempt on a 200', async () => {
    fetchResolving({});
    expect(await validateLoginAttempt('a@b.co')).toEqual({ allowed: true });
  });

  it('blocks with reset time on a 429', async () => {
    fetchResolving(
      { blocked: true, error: 'too many', resetAt: '2026-01-01T00:00:00.000Z' },
      { ok: false, status: 429 },
    );
    const res = await validateLoginAttempt('a@b.co');
    expect(res.allowed).toBe(false);
    expect(res.blocked).toBe(true);
    expect(res.resetAt).toBeInstanceOf(Date);
  });

  it('fails closed on a non-429 error response', async () => {
    fetchResolving({}, { ok: false, status: 500 });
    expect(await validateLoginAttempt('a@b.co')).toMatchObject({ allowed: false });
  });

  it('fails closed on a network error', async () => {
    fetchRejecting(new Error('Failed to fetch'));
    expect(await validateLoginAttempt('a@b.co')).toMatchObject({ allowed: false });
  });
});

describe('audit loggers (fire-and-forget)', () => {
  it('logLoginSuccess posts email + userId and never throws on failure', async () => {
    fetchResolving({});
    await logLoginSuccess('a@b.co', 'uid');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/login-success'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.co', userId: 'uid' }),
      }),
    );
    fetchRejecting(new Error('down'));
    await expect(logLoginSuccess('a@b.co', 'uid')).resolves.toBeUndefined();
  });

  it('logLoginFailure posts the reason and swallows errors', async () => {
    fetchResolving({});
    await logLoginFailure('a@b.co', 'bad password');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/login-failure'),
      expect.objectContaining({
        body: JSON.stringify({ email: 'a@b.co', reason: 'bad password' }),
      }),
    );
    fetchRejecting(new Error('down'));
    await expect(logLoginFailure('a@b.co', 'x')).resolves.toBeUndefined();
  });

  it('logLogout posts to /logout', async () => {
    fetchResolving({});
    await logLogout('a@b.co', 'uid');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/logout'),
      expect.objectContaining({ body: JSON.stringify({ email: 'a@b.co', userId: 'uid' }) }),
    );
  });

  it('logPasswordChange posts to /password-change and swallows errors', async () => {
    fetchResolving({});
    await logPasswordChange('a@b.co', 'uid');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/password-change'),
      expect.anything(),
    );
    fetchRejecting(new Error('down'));
    await expect(logPasswordChange('a@b.co', 'uid')).resolves.toBeUndefined();
  });

  it('logPasswordResetRequest always returns a generic success message (anti-enumeration)', async () => {
    fetchResolving({ message: 'custom' });
    expect(await logPasswordResetRequest('a@b.co')).toEqual({ success: true, message: 'custom' });

    fetchRejecting(new Error('down'));
    const res = await logPasswordResetRequest('a@b.co');
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/if an account exists/i);
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
