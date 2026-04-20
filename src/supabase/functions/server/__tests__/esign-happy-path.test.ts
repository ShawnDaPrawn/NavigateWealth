/**
 * E-Sign Happy-Path Integration Test (Phase 0.5)
 * ================================================
 *
 * Goal: lock down the create → add signers → submit field value → complete
 * envelope flow as the regression gate for every later phase.
 *
 * Scope:
 *   • Pure service-layer integration (no HTTP, no auth middleware).
 *   • In-memory KV mock (same pattern as client-lifecycle.test.ts).
 *   • Postgres dual-write is mocked OFF — we are testing the canonical KV
 *     path, which is the production path until Phase 0.1 cuts over.
 *
 * Run:
 *   npx vitest run src/supabase/functions/server/__tests__/esign-happy-path.test.ts
 *
 * @module server/__tests__/esign-happy-path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── KV mock ────────────────────────────────────────────────────────────────

const kvStore = new Map<string, unknown>();

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => {
    const v = kvStore.get(key);
    return v ? JSON.parse(JSON.stringify(v)) : null;
  }),
  set: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, JSON.parse(JSON.stringify(value)));
  }),
  del: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
  getByPrefix: vi.fn(async (prefix: string) => {
    const out: unknown[] = [];
    kvStore.forEach((v, k) => {
      if (k.startsWith(prefix)) out.push(JSON.parse(JSON.stringify(v)));
    });
    return out;
  }),
}));

// ── Quiet logger ───────────────────────────────────────────────────────────

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Postgres repo: confirm shadow-write contract is honoured ───────────────
// We assert that every canonical KV write is paired with a shadow Postgres
// call. The repo itself is no-op when ESIGN_DUAL_WRITE != 'true'; we mock
// it so we can spy on the calls without touching a real DB.
//
// vi.hoisted is required because vi.mock factories run BEFORE module-scope
// variables are initialised, so we lift the spy holder up there too.

const { pgMock } = vi.hoisted(() => ({
  pgMock: {
    upsertEnvelope: vi.fn().mockResolvedValue(null),
    upsertSigner: vi.fn().mockResolvedValue(null),
    upsertField: vi.fn().mockResolvedValue(null),
    replaceFields: vi.fn().mockResolvedValue(null),
    insertAudit: vi.fn().mockResolvedValue(null),
    deleteEnvelope: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../esign-postgres-repo.ts', () => ({
  esignPgRepo: pgMock,
  dualWriteEnabled: false,
  readSource: 'kv' as const,
}));

// ── Supabase client mock (admin lookups) ───────────────────────────────────

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-1', email: 'admin@test.com' } },
          error: null,
        }),
      },
    },
  }),
}));

// ── Imports MUST come after mocks ──────────────────────────────────────────

import {
  createEnvelope,
  addSignersToEnvelope,
  getEnvelopeDetails,
  getEnvelopeSigners,
  updateEnvelopeStatus,
  updateSignerStatus,
  logAuditEvent,
  getSignerByToken,
  addFieldsToEnvelope,
  updateFieldValue,
  getAuditTrail,
} from '../esign-services.tsx';

// ── Helpers ────────────────────────────────────────────────────────────────

const FIRM_ID = 'firm-1';
const CLIENT_ID = 'client-1';
const ADMIN_ID = 'admin-1';
const DOC_ID = 'doc-1';

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('E-Sign happy path: create → add signers → place fields → fill → complete', () => {
  it('walks through the full lifecycle without losing data', async () => {
    // 1) CREATE ENVELOPE
    const create = await createEnvelope({
      firmId: FIRM_ID,
      clientId: CLIENT_ID,
      title: 'Investment Mandate — Jane Smith',
      documentId: DOC_ID,
      createdByUserId: ADMIN_ID,
      message: 'Please sign at your earliest convenience.',
      signers: [],
      expiryDays: 14,
    });

    expect(create.error).toBeUndefined();
    expect(create.envelopeId).toBeTruthy();
    const envId = create.envelopeId!;

    // Shadow write for envelope creation
    expect(pgMock.upsertEnvelope).toHaveBeenCalledOnce();
    expect(pgMock.upsertEnvelope.mock.calls[0][0]).toMatchObject({
      id: envId,
      firm_id: FIRM_ID,
      title: 'Investment Mandate — Jane Smith',
      status: 'draft',
      signing_mode: 'sequential',
    });

    // 2) ADD SIGNERS
    const add = await addSignersToEnvelope(envId, [
      { name: 'Jane Smith', email: 'jane@example.com', requiresOtp: false },
      { name: 'Internal Witness', email: 'witness@nw.co' },
    ]);
    expect(add.error).toBeUndefined();
    expect(add.signerIds).toHaveLength(2);
    expect(pgMock.upsertSigner).toHaveBeenCalledTimes(2);

    const signers = await getEnvelopeSigners(envId);
    expect(signers.map((s) => s.email)).toEqual([
      'jane@example.com',
      'witness@nw.co',
    ]);
    expect(signers.every((s) => !!s.access_token)).toBe(true);
    expect(signers[0].order).toBe(1);
    expect(signers[1].order).toBe(2);

    // 3) ADD FIELDS
    const fieldsRes = await addFieldsToEnvelope(envId, [
      {
        signerId: signers[0].id,
        type: 'signature',
        page: 1,
        x: 50,
        y: 75,
        width: 150,
        height: 50,
        required: true,
      },
      {
        signerId: signers[0].id,
        type: 'text',
        page: 1,
        x: 50,
        y: 60,
        width: 150,
        height: 30,
        required: true,
      },
    ]);
    expect(fieldsRes.error).toBeUndefined();
    expect(fieldsRes.fieldIds.length).toBe(2);

    const detailsAfterFields = await getEnvelopeDetails(envId);
    expect(detailsAfterFields).toBeTruthy();
    const fields = (detailsAfterFields as Record<string, unknown>).fields as Array<Record<string, unknown>>;
    expect(fields.length).toBe(2);

    // 4) MOVE TO 'sent'
    await updateEnvelopeStatus(envId, 'sent');
    const sentDetails = await getEnvelopeDetails(envId) as Record<string, unknown>;
    expect(sentDetails.status).toBe('sent');

    // 5) SIGNER LOOKUP BY TOKEN — must round-trip identity
    const tok = signers[0].access_token!;
    const found = await getSignerByToken(tok);
    expect(found).toBeTruthy();
    expect(found?.email).toBe('jane@example.com');

    // 6) FILL THE TEXT FIELD AS THE SIGNER
    const textField = fields.find((f) => f.type === 'text') as Record<string, unknown>;
    await updateFieldValue(textField.id as string, 'Jane Smith');
    const refreshed = await getEnvelopeDetails(envId) as Record<string, unknown>;
    const refreshedFields = refreshed.fields as Array<Record<string, unknown>>;
    expect(refreshedFields.find((f) => f.id === textField.id)?.value).toBe('Jane Smith');

    // 7) MARK SIGNER AS SIGNED
    await updateSignerStatus(signers[0].id, 'signed');
    const signersAfter = await getEnvelopeSigners(envId);
    expect(signersAfter[0].status).toBe('signed');

    // 8) AUDIT TRAIL — confirm at least envelope_created and status_changed are present
    const audit = await getAuditTrail(envId);
    const actions = new Set(audit.map((e) => e.action));
    expect(actions.has('envelope_created')).toBe(true);
    expect(actions.has('status_changed')).toBe(true);

    // Shadow audit writes shadow every KV audit
    expect(pgMock.insertAudit.mock.calls.length).toBeGreaterThanOrEqual(audit.length);
  });

  it('logAuditEvent never throws even when downstream writes fail', async () => {
    // Force the pgMock to reject; the logger must still resolve.
    pgMock.insertAudit.mockRejectedValueOnce(new Error('simulated postgres outage'));
    await expect(
      logAuditEvent({
        envelopeId: 'env-x',
        actorType: 'sender_user',
        actorId: ADMIN_ID,
        action: 'test_event',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('E-Sign mutation idempotency: replaying createEnvelope', () => {
  it('two distinct calls produce two distinct envelopes (no accidental collapsing)', async () => {
    const a = await createEnvelope({
      firmId: FIRM_ID,
      clientId: CLIENT_ID,
      title: 'Mandate A',
      documentId: DOC_ID,
      createdByUserId: ADMIN_ID,
      signers: [],
    });
    const b = await createEnvelope({
      firmId: FIRM_ID,
      clientId: CLIENT_ID,
      title: 'Mandate B',
      documentId: DOC_ID,
      createdByUserId: ADMIN_ID,
      signers: [],
    });
    expect(a.envelopeId).not.toBe(b.envelopeId);
  });
});
