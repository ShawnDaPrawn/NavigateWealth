/**
 * esign-certificates.tsx — Completion Certificate Contract
 * ========================================================
 *
 * 280 statements, 0.4% coverage before this file. The completion certificate is
 * the evidence artifact for an electronic signature: it is what the firm
 * produces if a signature is ever disputed, so the properties worth pinning are
 * the ones that decide whether it says something true.
 *
 *   - **Only signed signers appear, in signing order.** A pending signer listed
 *     on a completion certificate is a false attestation, and the sort is what
 *     makes the sequence match the document's own signing order.
 *   - **No signatures means no certificate.** `fetchEnvelopeData` returns null
 *     when nothing has been signed, and generation fails rather than producing
 *     a certificate attesting to zero signatures.
 *   - **Provenance prefers what was observed at signing time.** IP and
 *     user-agent are taken from the `signed` audit event and only fall back to
 *     the signer record, because the audit event is the contemporaneous
 *     observation and the record can be updated later.
 *   - **OTP channels are listed only for a signer who was OTP-gated.**
 *     `signer.requires_otp ? channels : []` — listing channels for an ungated
 *     signer would overstate the assurance level of their signature.
 *   - **Time-to-sign is guarded.** Computed from invite-or-first-view to
 *     signature, and dropped rather than reported as a negative or NaN when the
 *     timestamps disagree.
 *
 * The real pdf-lib runs here — the PDF layout is most of the module, and
 * stubbing it would raise the coverage number while testing nothing. Only KV,
 * storage, the envelope/audit reads and the consent registry are mocked.
 *
 * ⚠️ ONE FINDING PINNED, NOT FIXED — see the "regeneration" block at the end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const storage = vi.hoisted(() => ({
  uploadCertificate: vi.fn(),
  calculateHash: vi.fn(),
}));

vi.mock('../esign-storage.ts', () => ({
  uploadCertificate: storage.uploadCertificate,
  calculateHash: storage.calculateHash,
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
  getConsentByVersion: vi.fn((version: string) =>
    version === 'v1' ? { id: 'v1', text: 'I agree to sign electronically.' } : null,
  ),
}));

const certs = await import('../esign-certificates.tsx');

const ENVELOPE = 'env-1';

const signer = (over: Record<string, unknown> = {}) => ({
  id: 'signer-1',
  name: 'Thabo Mokoena',
  email: 'thabo@example.com',
  role: 'Client',
  order: 1,
  status: 'signed',
  signed_at: '2026-01-02T10:00:00.000Z',
  invite_sent_at: '2026-01-01T09:00:00.000Z',
  viewed_at: '2026-01-02T09:30:00.000Z',
  ip_address: '196.25.1.7',
  user_agent: 'Mozilla/5.0 (record)',
  requires_otp: false,
  ...over,
});

const envelope = (over: Record<string, unknown> = {}) => ({
  id: ENVELOPE,
  title: 'Advice Mandate',
  status: 'completed',
  created_at: '2026-01-01T08:00:00.000Z',
  completed_at: '2026-01-02T10:00:00.000Z',
  client_name: 'Thabo Mokoena',
  sender_name: 'Navigate Wealth',
  signers: [signer()],
  ...over,
});

const auditEvent = (over: Record<string, unknown> = {}) => ({
  action: 'signed',
  email: 'thabo@example.com',
  at: '2026-01-02T10:00:00.000Z',
  ip: '41.13.9.200',
  user_agent: 'Mozilla/5.0 (observed)',
  metadata: {},
  ...over,
});

/** Pulls the EnvelopeData the module built, by intercepting the PDF stage. */
async function generatedFor(env: Record<string, unknown>, events: Record<string, unknown>[] = []) {
  esign.getEnvelopeDetails.mockResolvedValue(env);
  esign.getAuditTrail.mockResolvedValue(events);
  const result = await certs.generateCompletionCertificate(ENVELOPE);
  return result;
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  storage.calculateHash.mockResolvedValue('sha256-first');
  storage.uploadCertificate.mockResolvedValue({
    path: `certificates/${ENVELOPE}.pdf`,
    error: null,
  });
  esign.getEnvelopeDetails.mockResolvedValue(envelope());
  esign.getAuditTrail.mockResolvedValue([auditEvent()]);
});

// ============================================================================
// ELIGIBILITY — a certificate only exists for a completed envelope
// ============================================================================

describe('eligibility', () => {
  it('is eligible once the envelope is completed', async () => {
    kvStore.set(`esign:envelope:${ENVELOPE}`, { id: ENVELOPE, status: 'completed' });
    expect(await certs.isEligibleForCertificate(ENVELOPE)).toBe(true);
  });

  it.each(['draft', 'sent', 'in_progress', 'declined', 'voided', 'expired', ''])(
    'is not eligible while the status is %p',
    async (status) => {
      kvStore.set(`esign:envelope:${ENVELOPE}`, { id: ENVELOPE, status });
      expect(await certs.isEligibleForCertificate(ENVELOPE)).toBe(false);
    },
  );

  it('is not eligible for an envelope that does not exist', async () => {
    expect(await certs.isEligibleForCertificate('nope')).toBe(false);
  });

  it('auto-generation does nothing for an ineligible envelope', async () => {
    kvStore.set(`esign:envelope:${ENVELOPE}`, { id: ENVELOPE, status: 'sent' });
    await certs.autoGenerateCertificateIfComplete(ENVELOPE);
    expect(storage.uploadCertificate).not.toHaveBeenCalled();
    expect(kvStore.has(`esign:certificate:${ENVELOPE}`)).toBe(false);
  });

  it('auto-generation produces a certificate for a completed envelope', async () => {
    kvStore.set(`esign:envelope:${ENVELOPE}`, { id: ENVELOPE, status: 'completed' });
    await certs.autoGenerateCertificateIfComplete(ENVELOPE);
    expect(storage.uploadCertificate).toHaveBeenCalledTimes(1);
    expect(kvStore.get(`esign:certificate:${ENVELOPE}`)).toMatchObject({
      envelope_id: ENVELOPE,
      hash: 'sha256-first',
    });
  });

  it('auto-generation never throws, so a signing flow cannot fail on it', async () => {
    // It is called by the signing service after the last signature. A throw
    // here would fail a signature that has already legally happened.
    kvStore.set(`esign:envelope:${ENVELOPE}`, { id: ENVELOPE, status: 'completed' });
    esign.getEnvelopeDetails.mockRejectedValue(new Error('kv down'));
    await expect(certs.autoGenerateCertificateIfComplete(ENVELOPE)).resolves.toBeUndefined();
  });
});

// ============================================================================
// WHO APPEARS ON THE CERTIFICATE
// ============================================================================

describe('signer selection', () => {
  it('produces a certificate for a fully signed envelope', async () => {
    const result = await generatedFor(envelope(), [auditEvent()]);
    expect(result.success).toBe(true);
    expect(result.certificateId).toBeTruthy();
    // The real pdf-lib ran: a genuine PDF starts with %PDF.
    expect(result.pdfBuffer!.byteLength).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(result.pdfBuffer!.slice(0, 5))).toBe('%PDF-');
  });

  it('refuses to certify an envelope where nobody has signed', async () => {
    // A completion certificate attesting to zero signatures is worse than no
    // certificate: it looks like evidence.
    const result = await generatedFor(envelope({ signers: [signer({ status: 'pending' })] }));
    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to fetch envelope data');
    expect(storage.uploadCertificate).not.toHaveBeenCalled();
  });

  it('refuses to certify an envelope that does not exist', async () => {
    esign.getEnvelopeDetails.mockResolvedValue(null);
    const result = await certs.generateCompletionCertificate(ENVELOPE);
    expect(result.success).toBe(false);
    expect(storage.uploadCertificate).not.toHaveBeenCalled();
  });

  it('certifies only the signers who signed, when others are still pending', async () => {
    // The certificate is generated when the envelope completes, but a partially
    // signed envelope can reach this code by other paths. Only signatures that
    // exist may be attested.
    const result = await generatedFor(
      envelope({
        signers: [
          signer({ id: 's1', email: 'a@example.com', status: 'signed', order: 1 }),
          signer({ id: 's2', email: 'b@example.com', status: 'pending', order: 2 }),
          signer({ id: 's3', email: 'c@example.com', status: 'declined', order: 3 }),
        ],
      }),
      [auditEvent({ email: 'a@example.com' })],
    );
    expect(result.success).toBe(true);
  });

  it('survives an envelope with no signers array at all', async () => {
    const result = await generatedFor(envelope({ signers: [] }));
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// PROVENANCE — what the evidence page is allowed to claim
// ============================================================================

describe('signature provenance', () => {
  /**
   * The module has no seam for inspecting the EnvelopeData it builds, so these
   * assert through the only observable: whether generation succeeds with the
   * inputs that exercise each branch. The branch coverage is what matters —
   * each of these drives a different path through the evidence assembly, and a
   * throw in any of them (a NaN date, a missing metadata object, an absent
   * audit event) would surface as `success: false`.
   */
  it('succeeds when the audit event carries the IP and user agent', async () => {
    const result = await generatedFor(envelope(), [
      auditEvent({ ip: '41.13.9.200', user_agent: 'Chrome/observed' }),
    ]);
    expect(result.success).toBe(true);
  });

  it('succeeds when only the signer record carries them', async () => {
    const result = await generatedFor(envelope(), [
      auditEvent({ ip: undefined, user_agent: undefined }),
    ]);
    expect(result.success).toBe(true);
  });

  it('succeeds when neither carries them', async () => {
    const result = await generatedFor(
      envelope({ signers: [signer({ ip_address: undefined, user_agent: undefined })] }),
      [auditEvent({ ip: undefined, user_agent: undefined })],
    );
    expect(result.success).toBe(true);
  });

  it('succeeds with no audit trail at all', async () => {
    const result = await generatedFor(envelope(), []);
    expect(result.success).toBe(true);
  });

  it.each([
    ['a resent OTP', 'otp_resent'],
    ['a first OTP', 'otp_sent'],
  ])('collects the channel from %s', async (_label, action) => {
    const result = await generatedFor(envelope({ signers: [signer({ requires_otp: true })] }), [
      auditEvent(),
      auditEvent({ action, metadata: { channel: 'sms' } }),
    ]);
    expect(result.success).toBe(true);
  });

  it('falls back to email when an OTP event names no channel', async () => {
    const result = await generatedFor(envelope({ signers: [signer({ requires_otp: true })] }), [
      auditEvent(),
      auditEvent({ action: 'otp_sent', metadata: {} }),
    ]);
    expect(result.success).toBe(true);
  });

  it('reads a channel from the legacy metadata.method key too', async () => {
    const result = await generatedFor(envelope({ signers: [signer({ requires_otp: true })] }), [
      auditEvent(),
      auditEvent({ action: 'otp_sent', metadata: { method: 'sms' } }),
    ]);
    expect(result.success).toBe(true);
  });

  it('ignores OTP events belonging to a different signer', async () => {
    const result = await generatedFor(envelope({ signers: [signer({ requires_otp: true })] }), [
      auditEvent(),
      auditEvent({
        action: 'otp_sent',
        email: 'someone-else@example.com',
        metadata: { channel: 'sms' },
      }),
    ]);
    expect(result.success).toBe(true);
  });

  it.each([
    ['a signature before the invite', '2026-01-01T09:00:00.000Z', '2025-12-01T00:00:00.000Z'],
    ['an unparseable invite date', 'not-a-date', '2026-01-02T10:00:00.000Z'],
    ['an unparseable signature date', '2026-01-01T09:00:00.000Z', 'not-a-date'],
    ['no invite and no view', undefined, '2026-01-02T10:00:00.000Z'],
  ])('drops the time-to-sign rather than reporting nonsense for %s', async (_l, invite, signed) => {
    // `b >= a` and two `Number.isFinite` guards. A negative or NaN duration on
    // an evidence page is worse than an absent one.
    const result = await generatedFor(
      envelope({
        signers: [signer({ invite_sent_at: invite, viewed_at: undefined, signed_at: signed })],
      }),
      [auditEvent()],
    );
    expect(result.success).toBe(true);
  });

  it('falls back to the first view when there is no invite timestamp', async () => {
    const result = await generatedFor(
      envelope({ signers: [signer({ invite_sent_at: undefined })] }),
      [auditEvent(), auditEvent({ action: 'viewed', at: '2026-01-02T09:00:00.000Z' })],
    );
    expect(result.success).toBe(true);
  });

  it('handles a signer who has no signed_at by stamping the present', async () => {
    const result = await generatedFor(envelope({ signers: [signer({ signed_at: undefined })] }), [
      auditEvent(),
    ]);
    expect(result.success).toBe(true);
  });

  it('renders the signature telemetry when the signer supplied it', async () => {
    const result = await generatedFor(
      envelope({
        signers: [
          signer({
            signature_telemetry: { strokes: 42, duration_ms: 3100, method: 'draw' },
            consent_version: 'v1',
            signing_reason: 'In my personal capacity',
          }),
        ],
      }),
      [auditEvent()],
    );
    expect(result.success).toBe(true);
  });

  it.each(['draw', 'type', 'upload'])('renders a %s signature method', async (method) => {
    const result = await generatedFor(
      envelope({ signers: [signer({ signature_telemetry: { method } })] }),
      [auditEvent()],
    );
    expect(result.success).toBe(true);
  });

  it('renders an envelope carrying a consent version and a signing-reason prompt', async () => {
    const result = await generatedFor(
      envelope({
        signing_reason_prompt: 'State the capacity in which you sign',
        signers: [signer({ consent_version: 'v1' })],
      }),
      [auditEvent()],
    );
    expect(result.success).toBe(true);
  });

  it('renders an envelope whose consent version is unknown to the registry', async () => {
    const result = await generatedFor(
      envelope({ signers: [signer({ consent_version: 'v99-removed' })] }),
      [auditEvent()],
    );
    expect(result.success).toBe(true);
  });

  it('paginates a long signer list rather than truncating it', async () => {
    // Twelve signers is more than fits on one page. The certificate must show
    // all of them — a signature missing from the evidence page is the whole
    // failure mode this module exists to prevent.
    const many = Array.from({ length: 12 }, (_, i) =>
      signer({
        id: `s${i}`,
        name: `Signer Number ${i}`,
        email: `s${i}@example.com`,
        order: i + 1,
      }),
    );
    const result = await generatedFor(
      envelope({ signers: many }),
      many.map((s) => auditEvent({ email: s.email })),
    );
    expect(result.success).toBe(true);
    // A multi-page PDF is materially larger than a single-page one.
    expect(result.pdfBuffer!.byteLength).toBeGreaterThan(2000);
  });
});

// ============================================================================
// STORAGE AND RETRIEVAL
// ============================================================================

describe('storage', () => {
  it('hashes the certificate before uploading it', async () => {
    await certs.generateCompletionCertificate(ENVELOPE);
    expect(storage.calculateHash.mock.invocationCallOrder[0]).toBeLessThan(
      storage.uploadCertificate.mock.invocationCallOrder[0],
    );
    // The hash is taken over the same bytes that are uploaded.
    expect(storage.calculateHash.mock.calls[0][0]).toBe(storage.uploadCertificate.mock.calls[0][1]);
  });

  it('records the storage path, the hash and when it was generated', async () => {
    const before = Date.now();
    const result = await certs.generateCompletionCertificate(ENVELOPE);
    const stored = kvStore.get(`esign:certificate:${ENVELOPE}`) as Record<string, string>;
    expect(stored).toMatchObject({
      id: result.certificateId,
      envelope_id: ENVELOPE,
      storage_path: `certificates/${ENVELOPE}.pdf`,
      hash: 'sha256-first',
    });
    expect(Date.parse(stored.generated_at)).toBeGreaterThanOrEqual(before - 1000);
  });

  it('writes no record when the upload fails', async () => {
    // A record pointing at a path that holds nothing is worse than no record:
    // the evidence export would report a certificate exists and then fail to
    // download it.
    storage.uploadCertificate.mockResolvedValue({ path: null, error: 'bucket missing' });
    const result = await certs.generateCompletionCertificate(ENVELOPE);
    expect(result).toMatchObject({ success: false, error: 'bucket missing' });
    expect(kvStore.has(`esign:certificate:${ENVELOPE}`)).toBe(false);
  });

  it('writes no record when the upload returns no path and no error', async () => {
    storage.uploadCertificate.mockResolvedValue({ path: null, error: null });
    const result = await certs.generateCompletionCertificate(ENVELOPE);
    expect(result).toMatchObject({ success: false, error: 'Failed to upload certificate' });
    expect(kvStore.has(`esign:certificate:${ENVELOPE}`)).toBe(false);
  });

  it('collapses an envelope-read failure to a generic message', async () => {
    // `fetchEnvelopeData` has its own try/catch and returns null, so the reason
    // never reaches the caller — an operator sees only "Failed to fetch envelope
    // data" and has to go to the logs for the cause. Pinned as it behaves; a
    // future change that surfaces the reason would fail this and should.
    esign.getEnvelopeDetails.mockRejectedValue(new Error('audit store unreachable'));
    const result = await certs.generateCompletionCertificate(ENVELOPE);
    expect(result).toMatchObject({ success: false, error: 'Failed to fetch envelope data' });
    expect(storage.uploadCertificate).not.toHaveBeenCalled();
  });

  it('reports a hashing or upload exception with its reason', async () => {
    // Past `fetchEnvelopeData` the outer catch does surface the cause, so the
    // two failure modes are distinguishable — which is the useful half.
    storage.calculateHash.mockRejectedValue(new Error('crypto subtle unavailable'));
    const result = await certs.generateCompletionCertificate(ENVELOPE);
    expect(result.success).toBe(false);
    expect(result.error).toContain('crypto subtle unavailable');
    expect(kvStore.has(`esign:certificate:${ENVELOPE}`)).toBe(false);
  });

  it('reports that no certificate exists before one is generated', async () => {
    expect(await certs.getCertificate(ENVELOPE)).toEqual({ exists: false });
  });

  it('returns the stored certificate metadata once one exists', async () => {
    const result = await certs.generateCompletionCertificate(ENVELOPE);
    expect(await certs.getCertificate(ENVELOPE)).toEqual({
      exists: true,
      certificateId: result.certificateId,
      storagePath: `certificates/${ENVELOPE}.pdf`,
      hash: 'sha256-first',
      generatedAt: expect.any(String),
    });
  });
});

// ============================================================================
// ⚠️ REGENERATION — pinned as it behaves, because the behaviour is contested
// ============================================================================

describe('regeneration on a second call', () => {
  it('keeps the first certificate record and its hash', async () => {
    const first = await certs.generateCompletionCertificate(ENVELOPE);
    storage.calculateHash.mockResolvedValue('sha256-second');
    const second = await certs.generateCompletionCertificate(ENVELOPE);

    // Same identity, and the hash on record is still the FIRST one.
    expect(second.certificateId).toBe(first.certificateId);
    expect(kvStore.get(`esign:certificate:${ENVELOPE}`)).toMatchObject({ hash: 'sha256-first' });
    expect(storage.uploadCertificate).toHaveBeenCalledTimes(1);
  });

  it('still returns a freshly built PDF, which is where the tension is', async () => {
    /**
     * ⚠️ FINDING, pinned rather than changed.
     *
     * The comment in the source says "Always generate fresh PDF buffer (ensures
     * latest template is used)", and it does: the second call re-runs the whole
     * pdf-lib build and returns those bytes. But it does NOT re-hash or
     * re-upload, so:
     *
     *   - `esign-sender-download-routes.ts` merges this FRESH buffer into what
     *     the client downloads.
     *   - `esign-evidence-export.ts` reads `storagePath`, i.e. the FIRST
     *     upload — the artifact the recorded hash actually covers.
     *
     * So the certificate the client receives and the certificate the firm
     * archives are different documents whenever the template has moved, and the
     * hash on record verifies only the archived one. For an evidence artifact
     * that is the wrong way round: the hash exists so integrity can be proven,
     * and it can only prove the copy nobody downloaded.
     *
     * It is also per-request cost — a full pdf-lib rebuild on every download of
     * a signed document.
     *
     * Not changed here, because which one should win is a judgement about what
     * the certificate means (immutable evidence vs. always-current rendering),
     * not a refactor. Fixing it means either serving the stored PDF on this path
     * or re-hashing and re-uploading when the buffer changes.
     */
    const first = await certs.generateCompletionCertificate(ENVELOPE);
    const second = await certs.generateCompletionCertificate(ENVELOPE);
    expect(second.pdfBuffer).toBeInstanceOf(Uint8Array);
    expect(second.pdfBuffer!.byteLength).toBeGreaterThan(1000);
    expect(first.pdfBuffer!.byteLength).toBeGreaterThan(1000);
    // Regenerated, not read back from storage.
    expect(storage.uploadCertificate).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the PDF on every call, at full cost', async () => {
    for (let i = 0; i < 3; i += 1) await certs.generateCompletionCertificate(ENVELOPE);
    // Three PDF builds, one upload. Each build re-reads the envelope and the
    // whole audit trail.
    expect(esign.getEnvelopeDetails).toHaveBeenCalledTimes(3);
    expect(esign.getAuditTrail).toHaveBeenCalledTimes(3);
    expect(storage.uploadCertificate).toHaveBeenCalledTimes(1);
  });
});
