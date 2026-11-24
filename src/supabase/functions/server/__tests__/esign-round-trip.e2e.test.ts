/**
 * E-sign round trip — the REAL client request bodies through the REAL server
 * routes and validators, then into the signed PDF.
 *
 * Every break found in November 2026 sat at a seam between two of our own
 * components that were each tested against a stand-in for the other (see
 * docs/INCIDENTS.md, 2026-11-17): the signer service test mocked `fetch`, the
 * prefill test called the resolver directly, the draft-recipients test used a
 * role the wizard never sends. This test removes the stand-ins:
 *
 *   wizard payload builders (wizardDerivations.ts)
 *     → POST /envelopes/:id/invites   (esign-documents-routes.ts)
 *   signer client (esignSignerService.submitSignature, via a fetch that
 *   routes into the app)
 *     → POST /signer/submit           (esign-signer-submit-routes.ts)
 *   stored fields + signers
 *     → PDFService.burnIn             (esign-pdf.service.ts)
 *
 * Only true IO is replaced: KV (in memory), storage, email/SMS, the
 * completion queue, Postgres mirror, and the Supabase auth client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';

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
  uploadDocument: vi.fn(async () => ({ path: 'stored/path.pdf' })),
  downloadDocument: vi.fn(async () => new Uint8Array([1, 2, 3])),
  getDocumentUrl: vi.fn(async (path: string) => `https://signed.test/${path}`),
  validateDocument: vi.fn(async () => ({ valid: true })),
  calculateHash: vi.fn(async () => 'sha256:test'),
  extractPageCount: vi.fn(async () => 1),
}));

const io = vi.hoisted(() => ({
  emails: [] as Array<{ to: string; subject: string }>,
  completions: [] as string[],
  drainKicks: 0,
  authUsers: new Map<string, Record<string, unknown>>(),
}));
vi.mock('../email-service.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../email-service.ts')>()),
  sendEmail: vi.fn(async (m: { to: string; subject: string }) => {
    io.emails.push({ to: m.to, subject: m.subject });
    return true;
  }),
  sendSigningReminder: vi.fn(async () => true),
  sendRecallNotification: vi.fn(async () => true),
}));
vi.mock('../sms-service.ts', () => ({ sendInviteSms: vi.fn(async () => true) }));
vi.mock('../esign-completion-queue.ts', () => ({
  enqueueCompletion: vi.fn(async (id: string) => {
    io.completions.push(id);
  }),
  kickCompletionDrain: vi.fn(() => {
    io.drainKicks += 1;
  }),
}));
vi.mock('../webhook-service.ts', () => ({ emitWebhookEvent: vi.fn(async () => undefined) }));
vi.mock('../esign-inapp-notifications.ts', () => ({ enqueue: vi.fn(async () => undefined) }));
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => {
        const user = io.authUsers.get(token);
        return user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } };
      },
      admin: { getUserById: async () => ({ data: { user: null }, error: null }) },
    },
    rpc: async () => ({
      data: { allowed: true, remaining: 100, resetAt: 4_000_000_000_000, blocked: false },
      error: null,
    }),
  }),
}));
vi.mock('../auth-mw.ts', async () => {
  const actual = await vi.importActual<typeof import('../auth-mw.ts')>('../auth-mw.ts');
  return { ...actual, enforceAccountSecurity: vi.fn(async () => undefined) };
});

import { kvStore } from './helpers/contract-harness.ts';
import { EsignKeys } from '../esign-keys.ts';
import { Hono } from 'npm:hono';
import {
  attachSignerIndexes,
  toInviteSignerPayload,
} from '../../../../components/admin/modules/esign/wizardDerivations.ts';
import type {
  EsignField as ClientField,
  SignerFormData,
} from '../../../../components/admin/modules/esign/types.ts';
import type { EsignField, EsignSigner } from '../esign-types.ts';

const documentsRoutes = (await import('../esign-documents-routes.ts')).default;
const signerSubmitRoutes = (await import('../esign-signer-submit-routes.ts')).default;
const signerAccessRoutes = (await import('../esign-signer-access-routes.ts')).default;
const { getEnvelopeDetails } = await import('../esign-services.ts');
const { PDFService } = await import('../esign-pdf.service.ts');

const app = new Hono();
app.route('/', documentsRoutes);
app.route('/', signerSubmitRoutes);
app.route('/', signerAccessRoutes);

const ENV_ID = 'env-rt';
const DOC_ID = 'doc-rt';
const ADMIN_TOKEN = 'admin-token';
const SIGNATURE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAABCAYAAAD5PA/NAAAAEElEQVR4nGNgYGD4z4AEAAkAAf9V1WN6AAAAAElFTkSuQmCC';

beforeEach(() => {
  kvStore.clear();
  io.emails.length = 0;
  io.completions.length = 0;
  io.authUsers.set(ADMIN_TOKEN, {
    id: 'adviser-1',
    email: 'adviser@navigatewealth.co',
    app_metadata: { role: 'admin' },
    user_metadata: {},
  });
  kvStore.set(EsignKeys.envelope(ENV_ID), {
    id: ENV_ID,
    firm_id: 'adviser-1',
    title: 'Investment mandate',
    status: 'draft',
    document_id: DOC_ID,
    created_by_user_id: 'adviser-1',
    created_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
    // A draft from 60 days ago with a 30-day window: it used to go out expired.
    expires_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  });
  kvStore.set(EsignKeys.PREFIX_DOCUMENT + DOC_ID, {
    id: DOC_ID,
    file_name: 'mandate.pdf',
    storage_path: 'esign/mandate.pdf',
    page_count: 1,
  });
  // The two clients' CRM records the prefill reads.
  kvStore.set('user_profile:client-main:personal_info', {
    firstName: 'Thandi',
    lastName: 'Mokoena',
    idNumber: '8001015009087',
  });
  kvStore.set('user_profile:client-spouse:personal_info', {
    firstName: 'Sipho',
    lastName: 'Mokoena',
    idNumber: '8203030123083',
  });
});

/** What the wizard holds after the recipients step. */
const recipients: SignerFormData[] = [
  {
    recipientKey: 'r_main',
    name: 'Thandi Mokoena',
    email: 'family@example.co.za',
    role: 'Client',
    otpRequired: false, // the sender unticked "Require OTP"
    clientId: 'client-main',
  },
  {
    // Same address as the main client — common for couples.
    recipientKey: 'r_spouse',
    name: 'Sipho Mokoena',
    email: 'family@example.co.za',
    role: 'Spouse',
    otpRequired: false,
    clientId: 'client-spouse',
  },
  {
    recipientKey: 'r_cc',
    name: 'Paraplanner',
    email: 'cc@navigatewealth.co',
    role: 'Receives a copy',
    kind: 'cc',
    otpRequired: false,
  },
];

/** What the studio holds after placing fields. */
const placed = (): ClientField[] => {
  const base = { envelope_id: ENV_ID, page: 1, required: true, created_at: '', updated_at: '' };
  return [
    {
      ...base,
      id: 'c-name',
      type: 'text',
      signer_id: 'r_main',
      x: 10,
      y: 10,
      width: 120,
      height: 14,
      metadata: { label: 'Name', prefill: { token: 'client.name', locked: true } },
    },
    {
      ...base,
      id: 'c-spouse-id',
      type: 'text',
      signer_id: 'r_main',
      x: 10,
      y: 15,
      width: 120,
      height: 14,
      // "Fill from": the main client completes the form, the spouse's ID fills it.
      metadata: { prefill: { token: 'client.id_number', locked: true, source: 'r_spouse' } },
    },
    {
      ...base,
      id: 'c-fund',
      type: 'dropdown',
      signer_id: 'r_main',
      x: 10,
      y: 20,
      width: 120,
      height: 14,
      metadata: { options: ['Growth', 'Income'] },
    },
    {
      ...base,
      id: 'c-sig-main',
      type: 'signature',
      signer_id: 'r_main',
      x: 10,
      y: 30,
      width: 160,
      height: 40,
      metadata: {},
    },
    {
      ...base,
      id: 'c-date',
      type: 'auto_date',
      signer_id: 'r_main',
      x: 50,
      y: 30,
      width: 90,
      height: 14,
      metadata: {},
    },
    {
      ...base,
      id: 'c-sig-spouse',
      type: 'signature',
      signer_id: 'r_spouse',
      x: 10,
      y: 50,
      width: 160,
      height: 40,
      metadata: {},
    },
  ] as ClientField[];
};

/** What the studio's draft save leaves in KV before a send. */
function seedDraftFieldRecords() {
  const ids = placed().map((f) => f.id);
  ids.forEach((id) => kvStore.set(`esign:field:${id}`, { id, envelope_id: ENV_ID }));
  kvStore.set(EsignKeys.envelopeFields(ENV_ID), ids);
}

async function send() {
  return app.request(`/envelopes/${ENV_ID}/invites`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signers: toInviteSignerPayload(recipients),
      fields: attachSignerIndexes(placed(), recipients),
      message: 'Please sign',
      expiryDays: 10,
      signingMode: 'parallel',
    }),
  });
}

/** The signer client's real submit, with fetch routed into the app. */
async function submitAsSigner(
  token: string,
  values: Array<{ field_id: string; type: string; value: string }>,
) {
  const { esignSignerService } =
    await import('../../../../components/esign-signer/services/esignSignerService.ts');
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const path = url.pathname.replace(/^.*\/esign/, '');
    return app.request(path, init);
  }) as typeof fetch;
  try {
    return await esignSignerService.submitSignature(token, values as never);
  } finally {
    globalThis.fetch = realFetch;
  }
}

describe('e-sign round trip', () => {
  it('sends, signs and burns in what the studio placed', async () => {
    // ── Send ────────────────────────────────────────────────────────────
    seedDraftFieldRecords();
    const res = await send();
    expect(res.status, await res.clone().text()).toBe(200);

    const sent = (await getEnvelopeDetails(ENV_ID))!;
    expect(sent.status).toBe('sent');
    // Expiry counts from the send, at the sender's 10 days — not "already expired".
    const daysLeft = (new Date(sent.expires_at as string).getTime() - Date.now()) / 86_400_000;
    expect(daysLeft).toBeGreaterThan(9.9);
    expect(daysLeft).toBeLessThan(10.1);

    const signers = sent.signers as unknown as EsignSigner[];
    const main = signers.find((s) => s.name === 'Thandi Mokoena')!;
    const spouse = signers.find((s) => s.name === 'Sipho Mokoena')!;
    const cc = signers.find((s) => s.name === 'Paraplanner')!;
    // Two recipients sharing one email are still two people.
    expect(main.id).not.toBe(spouse.id);
    // "Require OTP" unticked is honoured.
    expect((main as { requires_otp?: boolean }).requires_otp).toBe(false);
    // Parallel: both signers invited; the copy-only recipient gets no signing link.
    expect(io.emails.map((e) => e.to).sort()).toEqual([
      'family@example.co.za',
      'family@example.co.za',
    ]);
    expect(io.emails.some((e) => e.to === 'cc@navigatewealth.co')).toBe(false);

    const fields = sent.fields as EsignField[];
    const byLabel = (pred: (f: EsignField) => boolean) => fields.find(pred)!;
    const nameField = byLabel((f) => (f.metadata as { label?: string })?.label === 'Name');
    const spouseIdField = byLabel(
      (f) =>
        (f.metadata as { prefill?: { token?: string } })?.prefill?.token === 'client.id_number',
    );
    const fundField = byLabel((f) => f.type === 'dropdown');
    // Field settings survived the send.
    expect((fundField.metadata as { options: string[] }).options).toEqual(['Growth', 'Income']);
    // Prefill resolved — from the assignee, and from the chosen "Fill from" recipient.
    expect(nameField.value).toBe('Thandi Mokoena');
    expect(spouseIdField.value).toBe('8203030123083');
    // Fields went to the right people by recipient key.
    expect(nameField.signer_id).toBe(main.id);
    expect(byLabel((f) => f.type === 'signature' && f.signer_id === spouse.id)).toBeTruthy();

    // Only the sent field records remain: the draft ones the studio saved
    // used to be left behind with nothing pointing at them.
    const fieldKeys = [...kvStore.keys()].filter((k) => k.startsWith('esign:field:'));
    expect(fieldKeys.sort()).toEqual(fields.map((f) => `esign:field:${f.id}`).sort());

    // ── Sign ────────────────────────────────────────────────────────────
    const own = (signerId: string) => fields.filter((f) => f.signer_id === signerId);
    const mainFields = own(main.id);
    const sigMain = mainFields.find((f) => f.type === 'signature')!;
    const fund = mainFields.find((f) => f.type === 'dropdown')!;
    const autoDate = mainFields.find((f) => f.type === 'auto_date')!;

    const r1 = await submitAsSigner(main.access_token, [
      { field_id: sigMain.id, type: 'signature', value: SIGNATURE_PNG },
      { field_id: fund.id, type: 'dropdown', value: 'Growth' },
      // A device clock in the wrong zone; the server's date must win.
      { field_id: autoDate.id, type: 'auto_date', value: '1 Jan 1999, 03:00' },
    ]);
    // was a 400 for every signer
    expect(r1).toMatchObject({ success: true, envelope_complete: false });
    // The signing token is rotated on submit, so the completion screen gets a
    // download-only grant in its place.
    expect(r1.download_token).toMatch(/^dl_/);
    expect(io.completions).toEqual([]); // spouse still to sign; CC never blocks

    // The next signer sees what the first one completed (read-only). Their
    // session used to carry only their own fields over the original PDF.
    const session = await app.request('/signer/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: spouse.access_token }),
    });
    expect(session.status, await session.clone().text()).toBe(200);
    const sessionBody = (await session.json()) as {
      fields: Array<{ id: string }>;
      completed_fields: Array<{ id: string; value: string }>;
    };
    expect(sessionBody.fields.every((f) => own(spouse.id).some((o) => o.id === f.id))).toBe(true);
    const prior = new Map(sessionBody.completed_fields.map((f) => [f.id, f.value]));
    expect(prior.get(sigMain.id)).toBe(SIGNATURE_PNG);
    expect(prior.get(fund.id)).toBe('Growth');
    // Nothing of the spouse's own, and nothing unfilled.
    expect(
      sessionBody.completed_fields.some((f) => own(spouse.id).some((o) => o.id === f.id)),
    ).toBe(false);

    const sigSpouse = own(spouse.id).find((f) => f.type === 'signature')!;
    const r2 = await submitAsSigner(spouse.access_token, [
      { field_id: sigSpouse.id, type: 'signature', value: SIGNATURE_PNG },
    ]);
    expect(r2).toMatchObject({ success: true, envelope_complete: true });
    // Both signers done; the CC recipient does not hold up completion.
    expect(io.completions).toEqual([ENV_ID]);
    // …and the drain is started inside the request, not left to a timer tick
    // the runtime may never let fire (incident 2026-11-23).
    expect(io.drainKicks).toBe(1);

    const done = (await getEnvelopeDetails(ENV_ID))!;
    const doneSigners = done.signers as unknown as EsignSigner[];
    const doneMain = doneSigners.find((s) => s.id === main.id)!;
    expect(doneMain.status).toBe('signed');
    expect(doneMain.signature_data).toBe(SIGNATURE_PNG);
    expect(doneSigners.find((s) => s.id === cc.id)!.status).not.toBe('signed');
    const doneFields = done.fields as EsignField[];
    expect(doneFields.find((f) => f.id === autoDate.id)!.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(doneFields.find((f) => f.id === autoDate.id)!.value).not.toContain('1999');

    // ── Burn in ─────────────────────────────────────────────────────────
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    const burned = await PDFService.burnIn(await pdf.save(), doneFields, doneSigners);
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: burned.pdfBuffer.slice(), isEvalSupported: false })
      .promise;
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const items = (
      (await page.getTextContent()).items as Array<{
        str: string;
        transform: number[];
        width: number;
      }>
    ).filter((i) => i.str.trim());
    for (const f of doneFields.filter((x) => x.type === 'text' || x.type === 'dropdown')) {
      const left = (f.x / 100) * vp.width;
      const top = (f.y / 100) * vp.height;
      const item = items.find((i) => i.str === f.value)!;
      expect(item, `value of ${f.id} printed`).toBeTruthy();
      const [vx, vy] = vp.convertToViewportPoint(item.transform[4], item.transform[5]);
      expect(vx).toBeGreaterThanOrEqual(left);
      expect(vx + item.width).toBeLessThanOrEqual(left + f.width + 0.5);
      expect(vy).toBeGreaterThan(top);
      expect(vy).toBeLessThanOrEqual(top + f.height);
    }
  });
});
