/**
 * email-core.ts — provider switch contracts
 * =========================================
 *
 * Every email the platform sends goes through sendEmail(), so the
 * NW_EMAIL_PROVIDER flip is the whole SendGrid→SES cutover. Pinned here:
 *
 *   1. Default (unset/sendgrid) keeps hitting the SendGrid API — the
 *      instant-rollback path.
 *   2. `ses` routes through the SES transport with the from/replyTo/headers
 *      envelope intact and never requires SENDGRID_API_KEY.
 *   3. Failure semantics survive the switch: object form returns false,
 *      throwOnError and the legacy positional form throw.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const envMap = vi.hoisted(() => new Map<string, string>());
vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (key: string) => envMap.get(key) },
  };
});

const ses = vi.hoisted(() => ({
  getSesConfig: vi.fn(),
  sendViaSes: vi.fn(async () => undefined),
}));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../email-transport-ses.ts', () => ses);

import { sendEmail } from '../email-core.ts';

const SES_CONFIG = { region: 'eu-west-1', accessKeyId: 'AKID', secretAccessKey: 'secret' };

beforeEach(() => {
  vi.clearAllMocks();
  envMap.clear();
  envMap.set('SENDGRID_API_KEY', 'sg-test-key');
});

describe('provider = ses', () => {
  beforeEach(() => {
    envMap.set('NW_EMAIL_PROVIDER', 'ses');
    ses.getSesConfig.mockReturnValue(SES_CONFIG);
  });

  it('routes through the SES transport with the full envelope, no SendGrid call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const ok = await sendEmail({
        to: 'client@example.co.za',
        subject: 's',
        html: '<p>b</p>',
        from: { email: 'newsletters@navigatewealth.co', name: 'Navigate Wealth' },
        replyTo: { email: 'info@navigatewealth.co' },
        headers: { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      expect(ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(ses.sendViaSes).toHaveBeenCalledWith(
        SES_CONFIG,
        expect.objectContaining({
          to: 'client@example.co.za',
          from: { email: 'newsletters@navigatewealth.co', name: 'Navigate Wealth' },
          replyTo: { email: 'info@navigatewealth.co' },
          headers: { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        }),
        undefined,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('passes a caller deadline through to the transport', async () => {
    await sendEmail({ to: 'a@b.co', subject: 's', html: '<p>b</p>', timeoutMs: 15_000 });
    expect(ses.sendViaSes).toHaveBeenCalledWith(SES_CONFIG, expect.any(Object), 15_000);
  });

  it('works without a SendGrid key at all', async () => {
    envMap.delete('SENDGRID_API_KEY');
    expect(await sendEmail({ to: 'a@b.co', subject: 's', html: '<p>b</p>' })).toBe(true);
  });

  it('keeps failure semantics: false by default, throws with throwOnError', async () => {
    ses.sendViaSes.mockRejectedValue(new Error('SES error (400): bounce'));
    expect(await sendEmail({ to: 'a@b.co', subject: 's', html: '<p>b</p>' })).toBe(false);
    await expect(
      sendEmail({ to: 'a@b.co', subject: 's', html: '<p>b</p>', throwOnError: true }),
    ).rejects.toThrow(/bounce/);
  });

  it('reports missing SES secrets as a send failure, not a crash', async () => {
    ses.getSesConfig.mockReturnValue(null);
    expect(await sendEmail({ to: 'a@b.co', subject: 's', html: '<p>b</p>' })).toBe(false);
    await expect(
      sendEmail({ to: 'a@b.co', subject: 's', html: '<p>b</p>', throwOnError: true }),
    ).rejects.toThrow(/NW_SES_REGION/);
  });
});

describe('provider = sendgrid (default)', () => {
  it('keeps hitting the SendGrid API and never touches SES', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 202 }));
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const ok = await sendEmail({
        to: 'a@b.co',
        subject: 's',
        html: '<p>b</p>',
        timeoutMs: 15_000,
      });
      expect(ok).toBe(true);
      expect(ses.sendViaSes).not.toHaveBeenCalled();
      expect(fetchSpy.mock.calls[0][0]).toBe('https://api.sendgrid.com/v3/mail/send');
      // The deadline reaches the provider call, so a hung request cannot run
      // past a campaign's delivery lease.
      const init = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(init.signal).toBeInstanceOf(AbortSignal);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
