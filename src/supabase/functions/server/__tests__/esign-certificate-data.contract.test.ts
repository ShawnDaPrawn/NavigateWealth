/**
 * esign-certificates.ts — what the certificate is told to say
 * ===========================================================
 *
 * The renderer is replaced with a spy so these tests read the exact data the
 * certificate prints. Pinned:
 *
 *   - **Real names.** Before the Nov 2026 redesign every certificate printed
 *     "Client" and "Admin" (hard-coded TODOs). The client comes from their
 *     profile, falling back to the signer linked to the client; the sender
 *     from their personnel profile, falling back to the firm — never to an
 *     invented person.
 *   - **The certificate ID printed is the record's ID**, so a regenerated
 *     certificate shows the same ID and issue time as the stored one.
 *   - **The document fingerprint** is the hash of the document as sent.
 *   - **PIN verification time** is shown only for an OTP-gated signer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore } from './helpers/contract-harness.ts';
import type { CertificateData } from '../esign-certificate-pdf.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('../esign-storage.ts', () => ({
  uploadCertificate: vi.fn(async (id: string) => ({ path: `certificates/${id}.pdf`, error: null })),
  calculateHash: vi.fn(async () => 'sha256-cert'),
}));

const esign = vi.hoisted(() => ({
  getEnvelopeDetails: vi.fn(),
  getAuditTrail: vi.fn(),
}));

vi.mock('../esign-services.ts', () => ({
  getEnvelopeDetails: esign.getEnvelopeDetails,
  getAuditTrail: esign.getAuditTrail,
}));

vi.mock('../esign-consent-registry.ts', () => ({
  getConsentByVersion: vi.fn(async (v: string) => ({ id: v, text: 'I agree.' })),
}));

const render = vi.hoisted(() => vi.fn(async () => new Uint8Array([37, 80, 68, 70, 45])));
vi.mock('../esign-certificate-pdf.ts', () => ({ renderCertificatePdf: render }));

const certs = await import('../esign-certificates.ts');

const ENV = 'env-1';
const envelope = (over: Record<string, unknown> = {}) => ({
  id: ENV,
  title: 'Record of Advice',
  status: 'completed',
  client_id: 'client-1',
  created_by_user_id: 'user-1',
  created_at: '2026-11-12T07:14:06.000Z',
  completed_at: '2026-11-12T09:36:58.000Z',
  expires_at: '2026-12-12T07:18:10.000Z',
  consent_version: 'v1.0.0',
  signing_mode: 'sequential',
  document: {
    original_filename: 'RoA.pdf',
    page_count: 14,
    hash: 'abc123',
  },
  signers: [
    {
      id: 's1',
      client_id: 'client-1',
      name: 'Thandiwe Mokoena',
      email: 'T.Mokoena@example.com',
      role: 'Client',
      order: 1,
      status: 'signed',
      requires_otp: true,
      signed_at: '2026-11-12T08:11:42.000Z',
    },
    {
      id: 's2',
      name: 'Pending Person',
      email: 'p@example.com',
      role: 'Witness',
      order: 2,
      status: 'pending',
      requires_otp: false,
    },
  ],
  ...over,
});

const lastData = () => (render.mock.calls.at(-1) as unknown as [CertificateData])[0];

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  esign.getEnvelopeDetails.mockResolvedValue(envelope());
  esign.getAuditTrail.mockResolvedValue([
    { action: 'esign_invites_sent', at: '2026-11-12T07:18:10.000Z', actor_type: 'sender_user' },
    {
      action: 'otp_verified',
      at: '2026-11-12T08:04:51.000Z',
      email: 't.mokoena@example.com',
      metadata: {},
    },
    {
      action: 'signed',
      at: '2026-11-12T08:11:42.000Z',
      email: 't.mokoena@example.com',
      ip: '1.2.3.4',
    },
  ]);
});

describe('names on the certificate', () => {
  it('prints the client and sender from their profiles', async () => {
    kvStore.set('user_profile:client-1:personal_info', {
      personalInformation: { firstName: 'Thandiwe', lastName: 'Mokoena' },
    });
    kvStore.set('personnel:profile:user-1', {
      firstName: 'Shawn',
      lastName: 'Francisco',
      email: 'shawn@example.com',
    });
    await certs.generateCompletionCertificate(ENV);
    expect(lastData()).toMatchObject({
      client_name: 'Thandiwe Mokoena',
      sender_name: 'Shawn Francisco',
      sender_email: 'shawn@example.com',
    });
  });

  it('falls back to the signer linked to the client, and to the firm as sender', async () => {
    await certs.generateCompletionCertificate(ENV);
    expect(lastData().client_name).toBe('Thandiwe Mokoena');
    expect(lastData().sender_name).toBe('Navigate Wealth');
    expect(lastData().sender_name).not.toBe('Admin');
  });

  it('leaves the client empty for a standalone envelope with no linked signer', async () => {
    esign.getEnvelopeDetails.mockResolvedValue(
      envelope({
        client_id: 'standalone',
        signers: [{ ...envelope().signers[0], client_id: undefined }],
      }),
    );
    await certs.generateCompletionCertificate(ENV);
    expect(lastData().client_name).toBeUndefined();
  });
});

describe('staff other than the sender', () => {
  it('looks up the name of a colleague who acted on the envelope', async () => {
    kvStore.set('personnel:profile:user-2', { firstName: 'Roberto', lastName: 'Francisco' });
    esign.getAuditTrail.mockResolvedValue([
      {
        action: 'evidence_pack_exported',
        at: '2026-11-12T10:00:00.000Z',
        actor_type: 'sender_user',
        actor_id: 'user-2',
      },
      { action: 'signed', at: '2026-11-12T08:11:42.000Z', email: 't.mokoena@example.com' },
    ]);
    await certs.generateCompletionCertificate(ENV);
    expect(lastData().sender_user_id).toBe('user-1');
    expect(lastData().audit_events[0]).toMatchObject({
      actor_id: 'user-2',
      actor_name: 'Roberto Francisco',
    });
  });
});

describe('what the certificate states', () => {
  it('prints the record ID, and the same ID and issue time when regenerated', async () => {
    const first = await certs.generateCompletionCertificate(ENV);
    const firstData = lastData();
    expect(firstData.certificate_id).toBe(first.certificateId);
    await certs.generateCompletionCertificate(ENV);
    expect(lastData().certificate_id).toBe(first.certificateId);
    expect(lastData().issued_at).toBe(firstData.issued_at);
  });

  it('carries the fingerprint, file and page count of the document as sent', async () => {
    await certs.generateCompletionCertificate(ENV);
    expect(lastData().document).toEqual({ filename: 'RoA.pdf', page_count: 14, hash: 'abc123' });
  });

  it('lists only signers who signed, and takes the sent time from the audit trail', async () => {
    await certs.generateCompletionCertificate(ENV);
    expect(lastData().signers.map((s) => s.name)).toEqual(['Thandiwe Mokoena']);
    expect(lastData().sent_at).toBe('2026-11-12T07:18:10.000Z');
  });

  it('matches audit events to signers regardless of email case', async () => {
    await certs.generateCompletionCertificate(ENV);
    const s = lastData().signers[0];
    expect(s.ip_address).toBe('1.2.3.4');
    expect(s.otp_verified_at).toBe('2026-11-12T08:04:51.000Z');
  });

  it('shows no PIN verification for a signer who was not OTP-gated', async () => {
    esign.getEnvelopeDetails.mockResolvedValue(
      envelope({ signers: [{ ...envelope().signers[0], requires_otp: false }] }),
    );
    await certs.generateCompletionCertificate(ENV);
    expect(lastData().signers[0].otp_verified_at).toBeUndefined();
    expect(lastData().signers[0].otp_methods).toEqual([]);
  });

  it('includes the pinned consent text', async () => {
    await certs.generateCompletionCertificate(ENV);
    expect(lastData().consent).toEqual({ id: 'v1.0.0', text: 'I agree.' });
  });
});
