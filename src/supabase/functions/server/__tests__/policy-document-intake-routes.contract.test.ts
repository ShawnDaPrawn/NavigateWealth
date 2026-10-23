/**
 * policy-document-intake-routes.ts — the agent's HTTPS upload and the worker
 * that stores a PDF an agent handed over, with the REAL service, repository
 * and `replacePolicyDocumentForPolicy` (the app upload's own write path)
 * against in-memory stand-ins for the intake table's functions, Storage and KV.
 *
 * What is pinned:
 *  - only the cron credential or an admin session reaches the worker, and an
 *    agent's token opens the upload but not the worker;
 *  - an upload is submitted whole, in one call to the same SQL function an
 *    agent calls, and stored in the same request, with the document recording
 *    who handed it over (an agent by its token, never by the form);
 *  - two uploads racing with one key settle on one hand-over, stored once and
 *    never mixed; pieces an earlier attempt left under a key are cleared,
 *    never joined into the upload; a PDF that stops short is refused at the
 *    door and never stored by the worker either;
 *  - a due hand-over lands at `{clientId}/{policyId}/{documentType}.pdf` and
 *    `policy.document` is set exactly as the app's upload sets it, leaving the
 *    rest of the policy alone;
 *  - a failed attempt goes back to SQL with its error, which retries it and
 *    then gives up — the worker never marks a row itself;
 *  - a run is bounded, and a run with nothing due touches nothing;
 *  - before the migration is applied, the worker reports nothing to do.
 *
 * The stand-in for the three SQL functions follows the migration's rules
 * (due-ness, attempts, claim tokens, the third failure being final); the SQL
 * itself is pinned by the migration's rolled-back smoke test.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import {
  alignFileGlobal,
  DEFAULT_TEST_USER,
  kvStore,
  multipartBinary,
  request,
  routeRegistrations,
} from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

interface IntakeRow {
  id: string;
  idempotency_key: string;
  client_id: string;
  policy_id: string;
  document_type: string;
  file_name: string;
  pdf_base64: string | null;
  file_size: number | null;
  submitted_by: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  attempts: number;
  next_attempt_at: string | null;
  claimed_at: string | null;
  claim_token: string | null;
  error: string | null;
  storage_key: string | null;
  created_at: string;
  processed_at: string | null;
}

const db = vi.hoisted(() => {
  const MINUTE = 60_000;
  const state = {
    rows: [] as IntakeRow[],
    /** Staged parts by key, then seq: `policy_document_intake_parts`. */
    parts: new Map<string, Map<number, string>>(),
    /** The KV table, which submit reads to check the policy: the suite's `kvStore`. */
    kv: new Map<string, unknown>(),
    ids: 0,
    objects: new Map<string, { bytes: Uint8Array; contentType: string }>(),
    clock: Date.parse('2026-10-01T10:00:00Z'),
    missingFunctions: false,
    /** RPCs that answer with a database error instead of running. */
    brokenRpcs: new Set<string>(),
    uploadError: null as string | null,
    beforeUpload: null as null | ((key: string) => void),
    onUpload: null as null | ((key: string) => void),
    calls: [] as string[],
    tokens: 0,
  };
  const iso = (ms: number) => new Date(ms).toISOString();
  const due = (row: IntakeRow) =>
    (row.status === 'pending' &&
      (row.next_attempt_at === null || Date.parse(row.next_attempt_at) <= state.clock)) ||
    (row.status === 'processing' && Date.parse(row.claimed_at!) < state.clock - 10 * MINUTE);

  /** How the functions refuse: `raise exception '<function>: <reason>'`. */
  const raise = (fn: string, reason: string) => ({
    data: null,
    error: { code: 'P0001', message: `${fn}: ${reason}` },
  });

  const rpc = async (name: string, args: Record<string, unknown> = {}) => {
    state.calls.push(name);
    if (state.missingFunctions) {
      return { data: null, error: { code: 'PGRST202', message: `Could not find ${name}` } };
    }
    if (state.brokenRpcs.has(name)) {
      return {
        data: null,
        error: { code: '57014', message: 'canceling statement due to timeout' },
      };
    }
    const find = () =>
      state.rows.find(
        (row) =>
          row.id === args.p_id &&
          row.claim_token === args.p_claim_token &&
          row.status === 'processing',
      );
    switch (name) {
      case 'policy_document_intake_claim': {
        // One client at a time: a client with a live claim is skipped.
        const busy = (row: IntakeRow) =>
          state.rows.some(
            (other) =>
              other.id !== row.id &&
              other.client_id === row.client_id &&
              other.status === 'processing' &&
              Date.parse(other.claimed_at!) >= state.clock - 10 * MINUTE,
          );
        const [row] = state.rows
          .filter((candidate) => due(candidate) && !busy(candidate))
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        if (!row) return { data: [], error: null };
        Object.assign(row, {
          status: 'processing',
          attempts: row.attempts + 1,
          claimed_at: iso(state.clock),
          claim_token: `token-${++state.tokens}`,
          next_attempt_at: null,
        });
        const { id, client_id, policy_id, document_type, file_name, pdf_base64 } = row;
        const { submitted_by, attempts, claim_token } = row;
        const claimed = { id, client_id, policy_id, document_type, file_name, pdf_base64 };
        return { data: [{ ...claimed, submitted_by, attempts, claim_token }], error: null };
      }
      case 'policy_document_intake_complete': {
        const row = find();
        if (!row) return { data: false, error: null };
        Object.assign(row, {
          status: 'processed',
          processed_at: iso(state.clock),
          storage_key: args.p_storage_key,
          file_size: args.p_file_size,
          pdf_base64: null,
          error: null,
          claim_token: null,
        });
        return { data: true, error: null };
      }
      case 'policy_document_intake_status': {
        const row = state.rows.find(
          (candidate) => candidate.idempotency_key === String(args.p_idempotency_key).trim(),
        );
        if (!row) return { data: [], error: null };
        const { id, client_id, policy_id, document_type, file_name, file_size, status } = row;
        const { attempts, error, storage_key, created_at, processed_at } = row;
        const shown = { id, client_id, policy_id, document_type, file_name, file_size, status };
        return {
          data: [{ ...shown, attempts, error, storage_key, created_at, processed_at }],
          error: null,
        };
      }
      case 'policy_document_intake_submit': {
        const key = String(args.p_idempotency_key);
        const earlier = state.rows.find((row) => row.idempotency_key === key);
        if (earlier) {
          state.parts.delete(key);
          return { data: [{ id: earlier.id, existed: true, status: earlier.status }], error: null };
        }
        const clientId = String(args.p_client_id);
        const policyId = String(args.p_policy_id);
        const book = state.kv.get(`policies:client:${clientId}`) as
          Array<{ id: string }> | undefined;
        if (!Array.isArray(book) || !book.some((p) => p.id === policyId)) {
          return raise(
            'policy_document_intake_submit',
            `client ${clientId} has no policy ${policyId} (policies:client:${clientId})`,
          );
        }
        let base64 = args.p_pdf_base64 as string | null;
        if (!base64) {
          const parts = state.parts.get(key);
          if (!parts || parts.size === 0) {
            return raise('policy_document_intake_submit', 'pass pdf_base64, or stage the PDF');
          }
          const seqs = [...parts.keys()].sort((a, b) => a - b);
          if (seqs[0] !== 0 || seqs[seqs.length - 1] !== seqs.length - 1) {
            return raise('policy_document_intake_submit', 'staged parts must run 0..n');
          }
          base64 = seqs.map((seq) => parts.get(seq)).join('');
        }
        const bytes = Buffer.from(base64, 'base64');
        if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
          return raise('policy_document_intake_submit', 'the file is not a PDF');
        }
        const row: IntakeRow = {
          id: `uploaded-${++state.ids}`,
          idempotency_key: key,
          client_id: clientId,
          policy_id: policyId,
          document_type: String(args.p_document_type),
          file_name: String(args.p_file_name),
          pdf_base64: base64,
          file_size: bytes.length,
          submitted_by: String(args.p_submitted_by),
          status: 'pending',
          attempts: 0,
          next_attempt_at: null,
          claimed_at: null,
          claim_token: null,
          error: null,
          storage_key: null,
          created_at: iso(state.clock + state.ids),
          processed_at: null,
        };
        state.rows.push(row);
        state.parts.delete(key);
        return { data: [{ id: row.id, existed: false, status: row.status }], error: null };
      }
      case 'policy_document_intake_fail': {
        const row = find();
        if (!row) return { data: null, error: null };
        const final = row.attempts >= 3;
        Object.assign(row, {
          status: final ? 'failed' : 'pending',
          next_attempt_at: final ? null : iso(state.clock + MINUTE * 5 ** (row.attempts - 1)),
          error: String(args.p_error).slice(0, 1000),
          claim_token: null,
        });
        return { data: row.status, error: null };
      }
      default:
        throw new Error(`unexpected rpc ${name}`);
    }
  };

  const storage = {
    listBuckets: async () => ({ data: [{ name: 'make-91ed8379-policy-documents' }], error: null }),
    createBucket: async () => ({ data: null, error: null }),
    from: (bucket: string) => {
      if (bucket !== 'make-91ed8379-policy-documents')
        throw new Error(`unexpected bucket ${bucket}`);
      return {
        upload: async (
          key: string,
          body: ArrayBuffer,
          options: { contentType: string; upsert: boolean },
        ) => {
          state.calls.push(`upload ${key}`);
          state.beforeUpload?.(key);
          if (state.uploadError) return { data: null, error: { message: state.uploadError } };
          if (!options.upsert && state.objects.has(key)) {
            return { data: null, error: { message: 'The resource already exists' } };
          }
          state.objects.set(key, { bytes: new Uint8Array(body), contentType: options.contentType });
          state.onUpload?.(key);
          return { data: { path: key }, error: null };
        },
        remove: async (keys: string[]) => {
          state.calls.push(`remove ${keys.join(',')}`);
          keys.forEach((key) => state.objects.delete(key));
          return { data: [], error: null };
        },
      };
    },
  };

  return { state, client: { rpc, storage } };
});

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({ createClient: () => db.client }));
vi.mock('../kv_store.tsx', async () => {
  const { makeKvMock } = await import('./helpers/contract-harness.ts');
  return makeKvMock();
});
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
const cron = vi.hoisted(() => ({
  isAuthorizedCronRequest: vi.fn(
    async (c: { req: { header: (name: string) => string | undefined } }) =>
      c.req.header('x-nw-cron-auth') === 'the-cron-token',
  ),
}));
vi.mock('../cron-auth.ts', () => cron);
vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return { requireAdmin: makeRoleGate(['admin', 'super_admin'], 'ADMIN_REQUIRED') };
});
const agents = vi.hoisted(() => ({
  identifyPortfolioAgent: vi.fn(async (token: string) =>
    token === 'agent-token-grok' ? 'grok' : null,
  ),
}));
vi.mock('../integrations-portfolio-table-auth.ts', () => agents);

import app from '../policy-document-intake-routes.ts';
import {
  INCOMPLETE_PDF_MESSAGE,
  INTAKE_ROWS_PER_RUN,
  processPolicyDocumentIntake,
  uploadPolicyDocument,
} from '../policy-document-intake-service.ts';
import { resetPolicyDocumentIntakeClient } from '../repositories/policy-document-intake-repository.ts';

const CLIENT = '8c4158a6-d7ea-43bf-8386-af0cabda8eee';
const POLICY = 'policy_1769783741137_mfqeoq';
const PDF_TEXT = '%PDF-1.7\n% an investment statement\n%%EOF\n';
const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

const runWorker = (headers: Record<string, string> = { 'x-nw-cron-auth': 'the-cron-token' }) =>
  app.request('/process', { method: 'POST', headers });

let rowCount = 0;
function handOver(overrides: Partial<IntakeRow> = {}): IntakeRow {
  rowCount++;
  const row: IntakeRow = {
    id: `intake-${rowCount}`,
    idempotency_key: `key-${rowCount}`,
    client_id: CLIENT,
    policy_id: POLICY,
    document_type: 'policy_schedule',
    file_name: 'AG_InvestmentStatement_AGRA678002_FRANCISCO,Shawn_323076_2026-10-01.pdf',
    pdf_base64: b64(PDF_TEXT),
    file_size: PDF_TEXT.length,
    submitted_by: 'update-bot',
    status: 'pending',
    attempts: 0,
    next_attempt_at: null,
    claimed_at: null,
    claim_token: null,
    error: null,
    storage_key: null,
    created_at: new Date(Date.UTC(2026, 9, 1, 9, 0, rowCount)).toISOString(),
    processed_at: null,
    ...overrides,
  };
  db.state.rows.push(row);
  return row;
}

const policies = () =>
  kvStore.get(`policies:client:${CLIENT}`) as Array<Record<string, unknown>> | undefined;
const policy = () => policies()?.find((p) => p.id === POLICY);

beforeAll(async () => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
  await alignFileGlobal();
});

beforeEach(() => {
  kvStore.clear();
  kvStore.set(`policies:client:${CLIENT}`, [
    {
      id: POLICY,
      clientId: CLIENT,
      providerName: 'Allan Gray',
      categoryId: 'retirement_pre',
      data: { ret_pre_1: 'AGRA678002', ret_pre_3: '569366.18' },
    },
    { id: 'policy_other', clientId: CLIENT, providerName: 'Sygnia', categoryId: 'investments' },
  ]);
  db.state.rows = [];
  db.state.parts.clear();
  db.state.kv = kvStore;
  db.state.ids = 0;
  db.state.objects.clear();
  db.state.calls = [];
  db.state.missingFunctions = false;
  db.state.brokenRpcs.clear();
  db.state.uploadError = null;
  db.state.beforeUpload = null;
  db.state.onUpload = null;
  db.state.tokens = 0;
  rowCount = 0;
  cron.isAuthorizedCronRequest.mockClear();
  agents.identifyPortfolioAgent.mockClear();
  resetPolicyDocumentIntakeClient();
});

describe('route inventory', () => {
  it('registers the upload and the worker, nothing else', () => {
    const registered = [
      ...new Set(
        routeRegistrations(app)
          .filter((r) => r.method !== 'ALL')
          .map((r) => `${r.method} ${r.path}`),
      ),
    ];
    expect(registered).toEqual(['POST /upload', 'POST /process']);
  });
});

describe('the gate: the cron credential, or an admin', () => {
  it('turns away a caller with neither, and stores nothing', async () => {
    handOver();
    expect((await runWorker({})).status).toBe(401);
    expect((await runWorker({ 'x-nw-cron-auth': 'wrong' })).status).toBe(401);
    expect(db.state.calls).toEqual([]);
    expect(db.state.rows[0].status).toBe('pending');
  });

  it('turns away a signed-in client', async () => {
    const res = await request(app, '/process', { method: 'POST', as: 'client' });
    expect(res.status).toBe(403);
    expect(db.state.calls).toEqual([]);
  });

  it('lets the cron credential and an admin run the queue', async () => {
    expect((await runWorker()).status).toBe(200);
    expect((await request(app, '/process', { method: 'POST', as: 'admin' })).status).toBe(200);
  });

  it('does not open to an agent token, which is for the upload', async () => {
    handOver();
    expect((await runWorker({ 'x-nw-portfolio-token': 'agent-token-grok' })).status).toBe(401);
    expect(db.state.rows[0].status).toBe('pending');
  });
});

describe('storing a hand-over', () => {
  it('stores the PDF at the policy_schedule key and records it on the policy', async () => {
    const row = handOver();
    const res = await runWorker();
    expect(res.status).toBe(200);
    const body = await res.json();
    const storageKey = `${CLIENT}/${POLICY}/policy_schedule.pdf`;

    expect(body).toMatchObject({ success: true, claimed: 1, processed: 1, retrying: 0, failed: 0 });
    expect(body.outcomes).toEqual([
      { id: row.id, clientId: CLIENT, policyId: POLICY, status: 'processed', storageKey },
    ]);

    const stored = db.state.objects.get(storageKey);
    expect(stored?.contentType).toBe('application/pdf');
    expect(Buffer.from(stored!.bytes).toString('utf8')).toBe(PDF_TEXT);

    expect(policy()?.document).toEqual({
      storageKey,
      fileName: row.file_name,
      fileSize: PDF_TEXT.length,
      mimeType: 'application/pdf',
      provider: 'Allan Gray',
      productType: 'Pre-Retirement',
      documentType: 'policy_schedule',
      uploadDate: expect.any(String),
      uploadedBy: 'intake:update-bot',
    });

    expect(db.state.rows[0]).toMatchObject({
      status: 'processed',
      storage_key: storageKey,
      file_size: PDF_TEXT.length,
      pdf_base64: null,
      error: null,
      attempts: 1,
    });
  });

  it('leaves the rest of the policy, and the other policies of the client, as they were', async () => {
    handOver();
    await runWorker();
    expect(policy()?.data).toEqual({ ret_pre_1: 'AGRA678002', ret_pre_3: '569366.18' });
    expect(policies()?.find((p) => p.id === 'policy_other')).toEqual({
      id: 'policy_other',
      clientId: CLIENT,
      providerName: 'Sygnia',
      categoryId: 'investments',
    });
  });

  it('replaces the document already at that key in place', async () => {
    const storageKey = `${CLIENT}/${POLICY}/policy_schedule.pdf`;
    db.state.objects.set(storageKey, {
      bytes: new TextEncoder().encode('%PDF-1.4 old'),
      contentType: 'application/pdf',
    });
    const list = policies()!;
    list[0].document = { storageKey, fileName: 'old.pdf' };
    kvStore.set(`policies:client:${CLIENT}`, list);

    handOver();
    await runWorker();

    expect(Buffer.from(db.state.objects.get(storageKey)!.bytes).toString('utf8')).toBe(PDF_TEXT);
    expect(db.state.calls.some((call) => call.startsWith('remove'))).toBe(false);
    expect(policy()?.document).toMatchObject({
      storageKey,
      fileName: expect.stringContaining('AG_'),
    });
  });

  it('removes an earlier upload kept under a different key', async () => {
    const oldKey = `${CLIENT}/${POLICY}/1767000000000_schedule.pdf`;
    db.state.objects.set(oldKey, { bytes: new Uint8Array([1]), contentType: 'application/pdf' });
    const list = policies()!;
    list[0].document = { storageKey: oldKey, fileName: 'schedule.pdf' };
    kvStore.set(`policies:client:${CLIENT}`, list);

    handOver();
    await runWorker();

    expect(db.state.objects.has(oldKey)).toBe(false);
    expect(db.state.objects.has(`${CLIENT}/${POLICY}/policy_schedule.pdf`)).toBe(true);
  });

  it('files a statement under statement.pdf', async () => {
    handOver({ document_type: 'statement' });
    await runWorker();
    expect(db.state.objects.has(`${CLIENT}/${POLICY}/statement.pdf`)).toBe(true);
    expect(policy()?.document).toMatchObject({ documentType: 'statement' });
  });
});

describe('a failed attempt', () => {
  it('goes back to SQL with its error, and nothing is stored', async () => {
    kvStore.set(`policies:client:${CLIENT}`, [{ id: 'policy_other' }]);
    handOver();

    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ claimed: 1, processed: 0, retrying: 1, failed: 0 });
    expect(body.outcomes[0]).toMatchObject({ status: 'pending', error: 'Policy not found' });
    expect(db.state.rows[0]).toMatchObject({
      status: 'pending',
      error: 'Policy not found',
      next_attempt_at: '2026-10-01T10:01:00.000Z',
    });
    expect(db.state.objects.size).toBe(0);
  });

  it('is retried when it falls due, and the third failure is final', async () => {
    db.state.uploadError = 'Gateway Timeout';
    handOver();

    await runWorker();
    expect(db.state.rows[0]).toMatchObject({ status: 'pending', attempts: 1 });

    // not due yet: the run claims nothing
    expect(await (await runWorker()).json()).toMatchObject({ claimed: 0 });

    db.state.clock += 60_000;
    await runWorker();
    expect(db.state.rows[0]).toMatchObject({ status: 'pending', attempts: 2 });

    db.state.clock += 5 * 60_000;
    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ claimed: 1, failed: 1 });
    expect(db.state.rows[0]).toMatchObject({
      status: 'failed',
      attempts: 3,
      error: 'Upload failed: Gateway Timeout',
      pdf_base64: expect.any(String),
    });
  });

  it('fails a row whose bytes are not a PDF, or not base64, or missing', async () => {
    handOver({ pdf_base64: b64('hello, not a pdf') });
    handOver({ pdf_base64: '%%% not base64 %%%' });
    handOver({ pdf_base64: null });

    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ claimed: 3, processed: 0, retrying: 3 });
    expect(db.state.rows.map((row) => row.error)).toEqual([
      'Downloaded file is not a valid PDF',
      expect.any(String),
      'The hand-over holds no PDF',
    ]);
    expect(db.state.objects.size).toBe(0);
  });

  it('records a stored document whose claim was taken over as lost, not processed', async () => {
    handOver();
    db.state.onUpload = () => {
      db.state.rows[0].claim_token = 'a-later-worker';
    };

    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ claimed: 1, processed: 0 });
    expect(body.outcomes[0]).toMatchObject({ status: 'lost' });
    expect(db.state.rows[0].status).toBe('processing');
  });

  it('counts a failure whose claim was taken over as lost, neither retrying nor failed', async () => {
    db.state.uploadError = 'Gateway Timeout';
    db.state.beforeUpload = () => {
      db.state.rows[0].claim_token = 'a-later-worker';
    };
    handOver();

    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ claimed: 1, processed: 0, retrying: 0, failed: 0 });
    expect(body.outcomes[0]).toMatchObject({
      status: 'lost',
      error: 'Upload failed: Gateway Timeout',
    });
    expect(db.state.rows[0]).toMatchObject({ status: 'processing', error: null });
  });
});

describe('a database error', () => {
  it('on the claim answers 500 and leaves the row as it was', async () => {
    db.state.brokenRpcs.add('policy_document_intake_claim');
    handOver();
    const res = await runWorker();
    expect(res.status).toBe(500);
    expect(db.state.rows[0]).toMatchObject({ status: 'pending', attempts: 0 });
    expect(db.state.objects.size).toBe(0);
  });

  it('recording success turns the attempt into a failed one, retried later', async () => {
    db.state.brokenRpcs.add('policy_document_intake_complete');
    handOver();
    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ claimed: 1, processed: 0, retrying: 1 });
    // Stored already; the retry stores it again under the same key.
    expect(db.state.objects.has(`${CLIENT}/${POLICY}/policy_schedule.pdf`)).toBe(true);
    expect(db.state.rows[0]).toMatchObject({
      status: 'pending',
      error: expect.stringContaining('policy_document_intake_complete failed'),
    });
  });

  it('recording either outcome answers 500, and the row waits for the stale-claim takeover', async () => {
    db.state.brokenRpcs.add('policy_document_intake_complete');
    db.state.brokenRpcs.add('policy_document_intake_fail');
    handOver();
    const res = await runWorker();
    expect(res.status).toBe(500);
    expect(db.state.rows[0]).toMatchObject({ status: 'processing', attempts: 1 });
  });
});

describe('one client at a time', () => {
  it('leaves a client alone while another worker is storing one of its rows', async () => {
    // Another wake-up holds a live claim on this client.
    handOver({
      status: 'processing',
      attempts: 1,
      claimed_at: new Date(db.state.clock - 60_000).toISOString(),
      claim_token: 'other-worker',
    });
    const waiting = handOver({ document_type: 'statement' });
    kvStore.set('policies:client:client-b', [{ id: 'policy_b', providerName: 'Sygnia' }]);
    const otherClient = handOver({ client_id: 'client-b', policy_id: 'policy_b' });

    const body = await (await runWorker()).json();
    expect(body.outcomes.map((o: { id: string }) => o.id)).toEqual([otherClient.id]);
    expect(db.state.rows.find((row) => row.id === waiting.id)?.status).toBe('pending');
    expect(db.state.objects.has(`${CLIENT}/${POLICY}/statement.pdf`)).toBe(false);
  });

  it('stores two hand-overs for one client one after the other, both documents intact', async () => {
    kvStore.set(`policies:client:${CLIENT}`, [
      ...(policies() ?? []),
      {
        id: 'policy_second',
        clientId: CLIENT,
        providerName: 'Allan Gray',
        categoryId: 'investments',
      },
    ]);
    handOver();
    handOver({ policy_id: 'policy_second' });

    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ claimed: 2, processed: 2 });
    expect(policy()?.document).toMatchObject({
      storageKey: `${CLIENT}/${POLICY}/policy_schedule.pdf`,
    });
    expect(policies()?.find((p) => p.id === 'policy_second')?.document).toMatchObject({
      storageKey: `${CLIENT}/policy_second/policy_schedule.pdf`,
    });
  });
});

describe('the bounds of a run', () => {
  it('stores at most INTAKE_ROWS_PER_RUN rows, oldest first, and leaves the rest due', async () => {
    const rows = Array.from({ length: INTAKE_ROWS_PER_RUN + 1 }, (_, i) =>
      handOver({ policy_id: i === 0 ? POLICY : 'policy_other' }),
    );
    const body = await (await runWorker()).json();
    expect(body.claimed).toBe(INTAKE_ROWS_PER_RUN);
    expect(body.outcomes.map((o: { id: string }) => o.id)).toEqual(
      rows.slice(0, INTAKE_ROWS_PER_RUN).map((row) => row.id),
    );
    expect(db.state.rows.at(-1)?.status).toBe('pending');
  });

  it('claims nothing new once the time budget is spent', async () => {
    handOver();
    handOver();
    let elapsed = 0;
    const result = await processPolicyDocumentIntake({
      budgetMs: 1000,
      now: () => {
        elapsed += 600;
        return elapsed;
      },
    });
    expect(result.claimed).toBe(1);
    expect(db.state.rows[1].status).toBe('pending');
  });

  it('does nothing when nothing is due', async () => {
    handOver({ status: 'processed', pdf_base64: null });
    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ claimed: 0, processed: 0, outcomes: [] });
    expect(db.state.calls).toEqual(['policy_document_intake_claim']);
  });

  it('reports nothing to do before the migration is applied', async () => {
    db.state.missingFunctions = true;
    handOver();
    const res = await runWorker();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ claimed: 0, processed: 0 });
  });
});

describe('a PDF that stops short', () => {
  it('is never stored by the worker, whichever door it came through', async () => {
    handOver({ pdf_base64: b64('%PDF-1.7\n% the first of three pieces, and no ending') });
    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ claimed: 1, processed: 0, retrying: 1 });
    expect(db.state.rows[0].error).toBe(INCOMPLETE_PDF_MESSAGE);
    expect(db.state.objects.size).toBe(0);
    expect(policy()?.document).toBeUndefined();
  });
});

describe('the upload', () => {
  const STATEMENT = `%PDF-1.7\n% an investment statement, whole\n${'x'.repeat(200)}\n%%EOF\n`;
  const bytesOf = (text: string) => new TextEncoder().encode(text);

  function upload(
    fields: Record<string, string>,
    {
      file = bytesOf(STATEMENT),
      fileName = 'AG_InvestmentStatement_AGRA678002.pdf',
      headers = { 'x-nw-portfolio-token': 'agent-token-grok' } as Record<string, string>,
      withFile = true,
    } = {},
  ) {
    const parts = Object.entries(fields).map(([name, value]) => ({ name, value }));
    if (withFile) {
      parts.push({ name: 'file', value: file, filename: fileName, type: 'application/pdf' });
    }
    const form = multipartBinary(parts);
    return app.request('/upload', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': form.contentType },
      body: form.body,
    });
  }

  const statementFields = {
    clientId: CLIENT,
    policyId: POLICY,
    documentType: 'statement',
    idempotencyKey: 'agra678002-statement-2026-10-02',
  };

  describe('who may upload', () => {
    it('turns away a caller with no credential, a wrong one, and a signed-in client', async () => {
      expect((await upload(statementFields, { headers: {} })).status).toBe(401);
      const wrong = { 'x-nw-portfolio-token': 'not-a-token' };
      expect((await upload(statementFields, { headers: wrong })).status).toBe(401);
      const client = { Authorization: 'Bearer t', 'x-test-role': 'client' };
      expect((await upload(statementFields, { headers: client })).status).toBe(403);
      expect(db.state.calls).toEqual([]);
      expect(db.state.objects.size).toBe(0);
    });

    it('lets an agent in by its own token, recorded by name whatever the form says', async () => {
      const res = await upload({ ...statementFields, submittedBy: 'someone-else' });
      expect(res.status).toBe(200);
      expect(db.state.rows[0].submitted_by).toBe('agent:grok');
      expect(policy()?.document).toMatchObject({ uploadedBy: 'intake:agent:grok' });
    });

    it('lets a caller on the cron token in, under the label it gives', async () => {
      const res = await upload(
        { ...statementFields, submittedBy: 'update-bot' },
        { headers: { 'x-nw-cron-auth': 'the-cron-token' } },
      );
      expect(res.status).toBe(200);
      expect(db.state.rows[0].submitted_by).toBe('scheduled:update-bot');
    });

    it('lets an admin in, recorded as the signed-in user', async () => {
      const res = await upload(statementFields, {
        headers: { Authorization: 'Bearer t', 'x-test-role': 'admin' },
      });
      expect(res.status).toBe(200);
      expect(db.state.rows[0].submitted_by).toBe(`admin:${DEFAULT_TEST_USER}`);
    });
  });

  describe('storing the PDF in the same request', () => {
    it('answers 200 once the PDF is on the policy, filed as the app files it', async () => {
      const res = await upload(statementFields);
      expect(res.status).toBe(200);
      const storageKey = `${CLIENT}/${POLICY}/statement.pdf`;
      expect(await res.json()).toEqual({
        success: true,
        idempotencyKey: 'agra678002-statement-2026-10-02',
        intakeId: 'uploaded-1',
        existed: false,
        status: 'processed',
        storageKey,
        error: null,
      });
      expect(Buffer.from(db.state.objects.get(storageKey)!.bytes).toString('utf8')).toBe(STATEMENT);
      expect(policy()?.document).toMatchObject({
        storageKey,
        fileName: 'AG_InvestmentStatement_AGRA678002.pdf',
        documentType: 'statement',
      });
    });

    it('hands a large PDF over in one submit, and stores it byte for byte', async () => {
      // Far more than the ~2,000 characters per statement the SQL connector carried.
      const large = `%PDF-1.7\n${'y'.repeat(3 * 1024 * 1024)}\n%%EOF\n`;
      const res = await upload(statementFields, { file: bytesOf(large) });
      expect(res.status).toBe(200);
      expect(
        db.state.calls.filter((call) => call === 'policy_document_intake_submit'),
      ).toHaveLength(1);
      expect(db.state.calls).not.toContain('policy_document_intake_put_part');
      const stored = db.state.objects.get(`${CLIENT}/${POLICY}/statement.pdf`)!;
      expect(stored.bytes.length).toBe(large.length);
      // Compared as bytes: a failed diff of 3 MB of text would take minutes.
      expect(Buffer.from(stored.bytes).equals(Buffer.from(large))).toBe(true);
    });

    it('stores it without ArrayBuffer.prototype.transfer, which the Node 20 in CI lacks', async () => {
      const proto = ArrayBuffer.prototype as { transfer?: unknown };
      const saved = Object.getOwnPropertyDescriptor(proto, 'transfer');
      delete proto.transfer;
      try {
        expect((await upload(statementFields)).status).toBe(200);
      } finally {
        if (saved) Object.defineProperty(proto, 'transfer', saved);
      }
    });

    it('clears pieces an earlier attempt left under the key, and never joins them in', async () => {
      const key = 'agra678002-statement-2026-10-01';
      db.state.parts.set(
        key,
        new Map([
          [0, b64('%PDF-1.7\n% piece one')],
          [1, b64('% piece two')],
          [2, b64('% piece three')],
        ]),
      );
      const res = await upload({ ...statementFields, idempotencyKey: key });
      expect(res.status).toBe(200);
      const stored = db.state.objects.get(`${CLIENT}/${POLICY}/statement.pdf`)!;
      expect(Buffer.from(stored.bytes).toString('utf8')).toBe(STATEMENT);
      expect(db.state.parts.size).toBe(0);
    });

    it('returns the earlier hand-over for a key already used, and stores nothing again', async () => {
      expect((await upload(statementFields)).status).toBe(200);
      db.state.calls = [];
      const again = await upload(statementFields);
      expect(again.status).toBe(200);
      expect(await again.json()).toMatchObject({ existed: true, status: 'processed' });
      expect(db.state.calls).toEqual(['policy_document_intake_status']);
    });

    it('answers 422 for a key whose hand-over failed for good', async () => {
      handOver({
        idempotency_key: 'given-up',
        status: 'failed',
        attempts: 3,
        error: 'Upload failed: bucket unavailable',
        pdf_base64: null,
      });
      const res = await upload({ ...statementFields, idempotencyKey: 'given-up' });
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({
        success: false,
        status: 'failed',
        error: 'Upload failed: bucket unavailable',
      });
    });

    it('makes up a key when none is sent', async () => {
      const { idempotencyKey: _unused, ...withoutKey } = statementFields;
      const res = await upload(withoutKey);
      expect(res.status).toBe(200);
      expect((await res.json()).idempotencyKey).toMatch(/^upload:[0-9a-f-]{36}$/);
    });
  });

  describe('refusing at the door', () => {
    it('refuses a PDF that stops short, before anything is submitted', async () => {
      const res = await upload(statementFields, {
        file: bytesOf('%PDF-1.7\n% only the first piece'),
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: INCOMPLETE_PDF_MESSAGE });
      expect(db.state.calls).toEqual([]);
    });

    it('refuses a file that is not a PDF, and an empty one', async () => {
      const notPdf = await upload(statementFields, { file: bytesOf('hello\n%%EOF') });
      expect(notPdf.status).toBe(400);
      expect((await notPdf.json()).error).toMatch(/not a PDF/);
      const empty = await upload(statementFields, { file: new Uint8Array(0) });
      expect(empty.status).toBe(400);
      expect(db.state.calls).toEqual([]);
    });

    it('refuses a PDF over 20 MB with 413', async () => {
      const res = await upload(statementFields, { file: new Uint8Array(20 * 1024 * 1024 + 1) });
      expect(res.status).toBe(413);
      expect(db.state.calls).toEqual([]);
    });

    it('refuses missing or malformed fields, field by field', async () => {
      const noFile = await upload(statementFields, { withFile: false });
      expect(noFile.status).toBe(400);
      const bad = await upload({ ...statementFields, policyId: 'has spaces', documentType: 'x' });
      expect(bad.status).toBe(400);
      expect(await bad.json()).toMatchObject({ error: 'Validation failed' });
      expect(db.state.calls).toEqual([]);
    });

    it("passes on the SQL side's own refusal, and stores nothing", async () => {
      const res = await upload({ ...statementFields, policyId: 'policy_not_this_clients' });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: `client ${CLIENT} has no policy policy_not_this_clients (policies:client:${CLIENT})`,
      });
      expect(db.state.rows).toEqual([]);
      expect(db.state.objects.size).toBe(0);
    });
  });

  describe('when the client is busy', () => {
    const upload202 = (sleep: (ms: number) => Promise<void>) => {
      let clock = 0;
      return uploadPolicyDocument(
        {
          clientId: CLIENT,
          policyId: POLICY,
          documentType: 'statement',
          fileName: 'statement.pdf',
          bytes: bytesOf(STATEMENT),
          idempotencyKey: 'waiting',
          submittedBy: 'agent:grok',
        },
        {
          waitMs: 3_000,
          now: () => clock,
          sleep: async (ms) => {
            clock += ms;
            await sleep(ms);
          },
        },
      );
    };

    it('waits for another hand-over of the client, then reports its own as pending', async () => {
      handOver({ status: 'processing', claimed_at: new Date(db.state.clock).toISOString() });
      const result = await upload202(async () => undefined);
      expect(result).toMatchObject({ status: 'pending', existed: false, storageKey: null });
      expect(
        db.state.calls.filter((call) => call === 'policy_document_intake_status'),
      ).toHaveLength(1 + 1 + 3);
    });

    it('answers processed as soon as the worker stores it while it waits', async () => {
      handOver({ status: 'processing', claimed_at: new Date(db.state.clock).toISOString() });
      const result = await upload202(async () => {
        const mine = db.state.rows.find((row) => row.idempotency_key === 'waiting')!;
        Object.assign(mine, { status: 'processed', storage_key: 'stored/by/the/worker.pdf' });
      });
      expect(result).toMatchObject({ status: 'processed', storageKey: 'stored/by/the/worker.pdf' });
    });
  });

  describe('two uploads with one key at once', () => {
    const KEY = 'agra678002-statement-2026-10-01';

    // A retry overlapping the first try. Each request yields to the event loop
    // while it waits, so the other one's worker gets to finish.
    const race = (...files: string[]) =>
      Promise.all(
        files.map((text) =>
          uploadPolicyDocument(
            {
              clientId: CLIENT,
              policyId: POLICY,
              documentType: 'statement',
              fileName: 'statement.pdf',
              bytes: bytesOf(text),
              idempotencyKey: KEY,
              submittedBy: 'agent:grok',
            },
            { sleep: () => new Promise((done) => setTimeout(done, 0)) },
          ),
        ),
      );

    it('settle on one hand-over, stored once', async () => {
      const results = await race(STATEMENT, STATEMENT);
      // Both looked the key up before either submitted: a real race.
      expect(db.state.calls.slice(0, 4)).toEqual([
        'policy_document_intake_status',
        'policy_document_intake_status',
        'policy_document_intake_submit',
        'policy_document_intake_submit',
      ]);
      expect(results.map((result) => result.existed).sort()).toEqual([false, true]);
      expect(results.map((result) => result.intakeId)).toEqual(['uploaded-1', 'uploaded-1']);
      expect(results.map((result) => result.status)).toEqual(['processed', 'processed']);
      expect(db.state.rows).toHaveLength(1);
      expect(db.state.calls.filter((call) => call.startsWith('upload '))).toHaveLength(1);
    });

    it('never mix two different files: the first submit is stored whole', async () => {
      db.state.parts.set(KEY, new Map([[0, b64('%PDF-1.7\n% a leftover piece')]]));
      const other = `%PDF-1.7\n% a different statement\n${'z'.repeat(300)}\n%%EOF\n`;
      const results = await race(STATEMENT, other);
      const first = results.findIndex((result) => !result.existed);
      expect(first).not.toBe(-1);
      expect(results.filter((result) => result.existed)).toHaveLength(1);
      expect(db.state.rows).toHaveLength(1);
      const stored = db.state.objects.get(`${CLIENT}/${POLICY}/statement.pdf`)!;
      expect(Buffer.from(stored.bytes).toString('utf8')).toBe([STATEMENT, other][first]);
      expect(db.state.parts.size).toBe(0);
    });
  });
});
