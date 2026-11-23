/**
 * sendEmail() records every attempt in the delivery log
 * =====================================================
 *
 * A client's birthday greeting went missing and nothing anywhere said whether
 * it had been sent: the scheduled job answered 200 and the outcome was lost.
 * Pinned here: every way sendEmail can end writes exactly ONE delivery row
 * with the caller's kind and batch, before the caller sees the result, and
 * the return / throw semantics callers depend on are unchanged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
const deliveryLog = vi.hoisted(() => ({ recordEmailDelivery: vi.fn(async () => undefined) }));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../email-transport-ses.ts', () => ses);
vi.mock('../email-delivery-log.ts', () => deliveryLog);

import { sendEmail } from '../email-core.ts';

const PARAMS = {
  to: 'client@example.co.za',
  subject: 'Happy Birthday, Michael!',
  html: '<p>Have a great day</p>',
  kind: 'client_birthday' as const,
};

function stubFetch(response: { ok: boolean; status?: number; body?: string; messageId?: string }) {
  const fetchSpy = vi.fn(async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 202 : 400),
    text: async () => response.body ?? '',
    headers: { get: (h: string) => (h === 'x-message-id' ? (response.messageId ?? null) : null) },
  }));
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

beforeEach(() => {
  vi.clearAllMocks();
  envMap.clear();
  envMap.set('SENDGRID_API_KEY', 'sg-test-key');
});
afterEach(() => vi.unstubAllGlobals());

const recorded = () =>
  deliveryLog.recordEmailDelivery.mock.calls.map((c) => c[0] as Record<string, unknown>);

describe('SendGrid', () => {
  it('records an accepted email with its kind, batch and message id', async () => {
    stubFetch({ ok: true, messageId: 'sg-msg-1' });
    await expect(sendEmail({ ...PARAMS, batchId: 'b-1' })).resolves.toBe(true);
    expect(recorded()).toEqual([
      expect.objectContaining({
        kind: 'client_birthday',
        batchId: 'b-1',
        to: 'client@example.co.za',
        subject: 'Happy Birthday, Michael!',
        status: 'sent',
        provider: 'sendgrid',
        providerMessageId: 'sg-msg-1',
      }),
    ]);
  });

  it('records a rejection once, with the status, and still returns false', async () => {
    stubFetch({ ok: false, status: 403, body: 'forbidden' });
    await expect(sendEmail(PARAMS)).resolves.toBe(false);
    expect(recorded()).toEqual([
      expect.objectContaining({ status: 'failed', error: 'SendGrid 403: forbidden' }),
    ]);
  });

  it('records a rejection once and still throws with throwOnError', async () => {
    stubFetch({ ok: false, status: 400, body: 'bad address' });
    await expect(sendEmail({ ...PARAMS, throwOnError: true })).rejects.toThrow(
      'SendGrid error: bad address',
    );
    expect(recorded()).toHaveLength(1);
  });

  it('records a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection reset');
      }),
    );
    await expect(sendEmail(PARAMS)).resolves.toBe(false);
    expect(recorded()).toEqual([
      expect.objectContaining({ status: 'failed', error: 'connection reset' }),
    ]);
  });

  it('records a send that could not start for lack of an API key', async () => {
    envMap.delete('SENDGRID_API_KEY');
    // The key is cached per isolate; a fresh module sees the missing key.
    vi.resetModules();
    const fresh = await import('../email-core.ts');
    const freshLog = await import('../email-delivery-log.ts');
    await expect(fresh.sendEmail(PARAMS)).resolves.toBe(false);
    expect(freshLog.recordEmailDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: 'SENDGRID_API_KEY not configured' }),
    );
  });
});

describe('legacy positional signature', () => {
  it('records under the kind passed as the sixth argument and still throws', async () => {
    stubFetch({ ok: false, status: 400, body: 'nope' });
    await expect(
      sendEmail('a@example.com', 'New article: X', '<p>x</p>', 'x', undefined, {
        kind: 'publication_notification',
        batchId: 'publication:a1',
      }),
    ).rejects.toThrow('SendGrid error: nope');
    expect(recorded()).toEqual([
      expect.objectContaining({
        kind: 'publication_notification',
        batchId: 'publication:a1',
        status: 'failed',
      }),
    ]);
  });
});

describe('SES', () => {
  beforeEach(() => {
    envMap.set('NW_EMAIL_PROVIDER', 'ses');
    ses.getSesConfig.mockReturnValue({
      region: 'eu-west-1',
      accessKeyId: 'a',
      secretAccessKey: 's',
    });
  });

  it('records an accepted email under the ses provider', async () => {
    await expect(sendEmail(PARAMS)).resolves.toBe(true);
    expect(recorded()).toEqual([expect.objectContaining({ status: 'sent', provider: 'ses' })]);
  });

  it('records an SES failure', async () => {
    ses.sendViaSes.mockRejectedValueOnce(new Error('SES 400 MessageRejected'));
    await expect(sendEmail(PARAMS)).resolves.toBe(false);
    expect(recorded()).toEqual([
      expect.objectContaining({
        status: 'failed',
        provider: 'ses',
        error: 'SES 400 MessageRejected',
      }),
    ]);
  });
});
