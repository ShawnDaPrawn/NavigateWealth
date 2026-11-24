/**
 * Two signer-facing regressions found on 2026-11-23.
 *
 * 1. Opening a signing link that needs a one-time PIN never emailed the PIN.
 *    The auto-send sat after an early return taken by exactly those signers,
 *    so every signer had to press "resend".
 * 2. "Download Copy" on the completion screen could never work: the signing
 *    token is rotated on submit. The submit response now carries a
 *    download-only grant, which the download route must accept — and which
 *    must open nothing else.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (key: string) => `test-${key}` },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../esign-postgres-repo.ts', () => ({
  esignPgRepo: new Proxy({}, { get: () => vi.fn(async () => undefined) }),
  dualWriteEnabled: false,
}));
vi.mock('../esign-storage.ts', () => ({
  downloadDocument: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
  getDocumentUrl: vi.fn(async (path: string) => `https://signed.test/${path}`),
  calculateHash: vi.fn(async () => 'sha256:test'),
}));
const io = vi.hoisted(() => ({
  emails: [] as Array<{ to: string; subject: string; text?: string }>,
  kicks: 0,
}));
vi.mock('../email-service.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../email-service.ts')>()),
  sendEmail: vi.fn(async (m: { to: string; subject: string; text?: string }) => {
    io.emails.push(m);
    return true;
  }),
}));
vi.mock('../sms-service.ts', () => ({
  sendOtpSms: vi.fn(async () => ({ delivered: false })),
  sendInviteSms: vi.fn(async () => true),
}));
vi.mock('../esign-completion-queue.ts', () => ({
  kickCompletionDrain: vi.fn(() => {
    io.kicks += 1;
  }),
  enqueueCompletion: vi.fn(async () => undefined),
}));
vi.mock('../esign-rate-limit.ts', () => ({
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: { message: 'no' } }) },
    rpc: async () => ({
      data: { allowed: true, remaining: 100, resetAt: 4_000_000_000_000, blocked: false },
      error: null,
    }),
  }),
}));

import { kvStore } from './helpers/contract-harness.ts';
import { EsignKeys } from '../esign-keys.ts';
import { Hono } from 'npm:hono';

const accessRoutes = (await import('../esign-signer-access-routes.ts')).default;
const extrasRoutes = (await import('../esign-signer-extras-routes.ts')).default;
const { issueSignerDownloadGrant } = await import('../esign-services.ts');

const app = new Hono();
app.route('/', accessRoutes);
app.route('/', extrasRoutes);

const ENV = 'env-otp';
const SIGNER = 'signer-otp';

function seed(envelope: Record<string, unknown> = {}, signer: Record<string, unknown> = {}) {
  kvStore.clear();
  kvStore.set(EsignKeys.envelope(ENV), {
    id: ENV,
    title: 'Record of advice',
    status: 'sent',
    signing_mode: 'parallel',
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    created_at: new Date().toISOString(),
    ...envelope,
  });
  kvStore.set(EsignKeys.envelopeSigners(ENV), [SIGNER]);
  kvStore.set(EsignKeys.envelopeFields(ENV), []);
  kvStore.set(EsignKeys.PREFIX_SIGNER + SIGNER, {
    id: SIGNER,
    envelope_id: ENV,
    name: 'Thandi Mokoena',
    email: 'thandi@example.test',
    status: 'sent',
    order: 1,
    requires_otp: true,
    otp_verified: false,
    access_token: 'tok-live',
    ...signer,
  });
  kvStore.set(EsignKeys.signerToken('tok-live'), SIGNER);
}

const validate = (token = 'tok-live') =>
  app.request('/signer/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token }),
  });

beforeEach(() => {
  io.emails.length = 0;
  io.kicks = 0;
});

describe('opening a link that needs a one-time PIN', () => {
  it('emails the PIN without the signer asking for it', async () => {
    seed();
    const res = await validate();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { missing_factors: string[] }).missing_factors).toContain('otp');

    expect(io.emails).toHaveLength(1);
    expect(io.emails[0].to).toBe('thandi@example.test');
    expect(io.emails[0].subject).toBe('Verification Code: Record of advice');
    expect(kvStore.get(`esign:otp:${SIGNER}`)).toBeTruthy();
  });

  it('does not replace a PIN it sent moments ago when the page is reopened', async () => {
    seed();
    await validate();
    const first = kvStore.get(`esign:otp:${SIGNER}`);
    await validate();
    expect(io.emails).toHaveLength(1);
    expect(kvStore.get(`esign:otp:${SIGNER}`)).toEqual(first);
  });

  it('sends nothing to a signer whose turn has not come', async () => {
    seed({ signing_mode: 'sequential' }, { order: 2 });
    kvStore.set(EsignKeys.envelopeSigners(ENV), ['first', SIGNER]);
    kvStore.set(EsignKeys.PREFIX_SIGNER + 'first', {
      id: 'first',
      envelope_id: ENV,
      name: 'First',
      email: 'first@example.test',
      status: 'sent',
      order: 1,
    });
    await validate();
    expect(io.emails).toHaveLength(0);
  });

  it('sends nothing when no PIN is required', async () => {
    seed({}, { requires_otp: false });
    await validate();
    expect(io.emails).toHaveLength(0);
  });
});

describe('downloading the signed copy after submitting', () => {
  it('accepts the download grant once the signing token has been rotated away', async () => {
    seed({ status: 'completed', signed_document_path: 'completed/env-otp/signed_document.pdf' });
    kvStore.delete(EsignKeys.signerToken('tok-live'));
    const grant = await issueSignerDownloadGrant(SIGNER, ENV);

    const res = await app.request(`/signer/download/${grant}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('asks the client to wait, and restarts the drain, while the copy is being sealed', async () => {
    seed({ status: 'completing' });
    const grant = await issueSignerDownloadGrant(SIGNER, ENV);

    const res = await app.request(`/signer/download/${grant}`);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'preparing', retryable: true });
    expect(io.kicks).toBe(1);
  });

  it('refuses an expired grant', async () => {
    seed({ status: 'completed', signed_document_path: 'p.pdf' });
    const grant = await issueSignerDownloadGrant(SIGNER, ENV);
    const key = EsignKeys.signerDownloadGrant(grant);
    kvStore.set(key, {
      ...(kvStore.get(key) as object),
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect((await app.request(`/signer/download/${grant}`)).status).toBe(404);
  });

  it('does not let the grant reopen the signing session', async () => {
    seed();
    const grant = await issueSignerDownloadGrant(SIGNER, ENV);
    expect((await validate(grant)).status).toBe(404);
  });
});
