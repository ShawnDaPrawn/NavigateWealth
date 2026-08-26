/**
 * esign-packet-service.ts — Contract Tests
 * ========================================
 *
 * A "packet" chains templates into a sequence sent to one set of recipients:
 * envelope N completes, envelope N+1 is materialised and its first signer
 * invited, with no user interaction in between. That auto-advance is the whole
 * point of the feature, and it was 0.6% covered.
 *
 * REAL COLLABORATORS
 * ------------------
 * `esign-services.tsx` and `esign-template-service.ts` are NOT stubbed. Both
 * are pure KV apart from a fire-and-forget Postgres mirror, so stubbing only
 * that mirror lets the genuine envelope, signer, field and audit writes run.
 * That matters here beyond coverage: the thing under test is a handoff BETWEEN
 * modules, and a suite that fakes `createEnvelope` would assert that
 * `materialisePacketStep` calls a mock, not that a packet run actually spawns
 * a signable envelope.
 *
 * The only stubs are the two real IO boundaries — SendGrid and Postgres — plus
 * the logger.
 *
 * Includes the audit-trail honesty contract: a failed delivery is recorded as
 * `invite_send_failed`, never as `invite_sent`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

/** The Postgres mirror is fire-and-forget (`void esignPgRepo.*`) — a no-op. */
vi.mock('../esign-postgres-repo.ts', () => ({
  esignPgRepo: {
    insertAudit: vi.fn(async () => undefined),
    upsertEnvelope: vi.fn(async () => undefined),
    upsertSigner: vi.fn(async () => undefined),
  },
}));

const mail = vi.hoisted(() => ({
  sent: [] as Array<{ to: string; subject: string }>,
  ok: true,
}));
vi.mock('../email-service.ts', () => ({
  sendEmail: vi.fn(async (params: { to: string; subject: string }) => {
    if (!mail.ok) return false;
    mail.sent.push({ to: params.to, subject: params.subject });
    return true;
  }),
}));

import { kvStore } from './helpers/contract-harness.ts';
import { EsignKeys } from '../esign-keys.ts';

const {
  createPacket,
  getPacket,
  listPackets,
  deletePacket,
  startPacketRun,
  getPacketRun,
  listPacketRuns,
  cancelPacketRun,
  advancePacketRunFromCompletion,
} = await import('../esign-packet-service.ts');
const { getEnvelopeSigners, getEnvelopeDetails, getAuditTrail } =
  await import('../esign-services.tsx');

const FIRM = 'firm-1';
const CLIENT = 'client-1';
const USER = 'user-1';

/** Seed a template the packet steps can resolve. */
function seedTemplate(
  id: string,
  overrides: Partial<{
    name: string;
    version: number;
    fields: unknown[];
    signingMode: string;
    defaultMessage: string;
    defaultExpiryDays: number;
  }> = {},
) {
  kvStore.set(EsignKeys.template(id), {
    id,
    name: overrides.name ?? `Template ${id}`,
    version: overrides.version ?? 1,
    documents: [],
    recipients: [],
    fields: overrides.fields ?? [],
    signingMode: overrides.signingMode ?? 'sequential',
    defaultMessage: overrides.defaultMessage,
    defaultExpiryDays: overrides.defaultExpiryDays,
  });
}

const RECIPIENTS = [
  { name: 'Thandi Mokoena', email: 'thandi@example.com', role: 'Client', order: 1 },
  { name: 'Pieter van Wyk', email: 'pieter@example.com', role: 'Spouse', order: 2 },
];

/** Create a two-step packet and start a run over it. */
async function startTwoStepRun() {
  seedTemplate('tpl-a', { name: 'Mandate' });
  seedTemplate('tpl-b', { name: 'Risk Disclosure' });

  const { packet } = await createPacket({
    firmId: FIRM,
    name: 'Onboarding',
    steps: [{ templateId: 'tpl-a' }, { templateId: 'tpl-b' }],
    createdByUserId: USER,
  });

  const started = await startPacketRun({
    packetId: packet!.id,
    firmId: FIRM,
    clientId: CLIENT,
    recipients: RECIPIENTS,
    documentIdsByStep: ['doc-a', 'doc-b'],
    createdByUserId: USER,
    senderEmail: 'adviser@navigatewealth.co',
  });

  return { packet: packet!, ...started };
}

/**
 * The audit events written for an envelope.
 *
 * Read through `getAuditTrail`, not by reaching into
 * `esign:envelope:{id}:audit` — that key holds audit IDS, with the canonical
 * event records under their own prefix. Asserting on the id list would have
 * asserted the wrong thing while looking right.
 */
async function auditFor(envelopeId: string) {
  return (await getAuditTrail(envelopeId)) as unknown as Array<{
    action: string;
    email?: string;
    metadata?: Record<string, unknown>;
  }>;
}

beforeEach(() => {
  kvStore.clear();
  mail.sent.length = 0;
  mail.ok = true;
});

// ============================================================================
// PACKET CRUD
// ============================================================================

describe('createPacket', () => {
  it('snapshots each step’s template version so later edits cannot rewrite it', async () => {
    seedTemplate('tpl-a', { name: 'Mandate', version: 4 });

    const { packet } = await createPacket({
      firmId: FIRM,
      name: '  Onboarding  ',
      steps: [{ templateId: 'tpl-a' }],
      createdByUserId: USER,
    });

    expect(packet!.name).toBe('Onboarding');
    expect(packet!.steps).toEqual([{ templateId: 'tpl-a', templateVersion: 4, label: 'Mandate' }]);
  });

  it('takes an explicit step version over the template’s current one', async () => {
    seedTemplate('tpl-a', { version: 9 });
    const { packet } = await createPacket({
      firmId: FIRM,
      name: 'Pinned',
      steps: [{ templateId: 'tpl-a', templateVersion: 2, label: '  Step one  ' }],
      createdByUserId: USER,
    });
    expect(packet!.steps[0]).toMatchObject({ templateVersion: 2, label: 'Step one' });
  });

  it('rejects a blank name and an empty step list', async () => {
    seedTemplate('tpl-a');
    expect(
      (
        await createPacket({
          firmId: FIRM,
          name: '   ',
          steps: [{ templateId: 'tpl-a' }],
          createdByUserId: USER,
        })
      ).error,
    ).toBe('Packet name is required');
    expect(
      (await createPacket({ firmId: FIRM, name: 'X', steps: [], createdByUserId: USER })).error,
    ).toBe('Packet must contain at least one step');
  });

  it('refuses a step whose template does not exist, and stores nothing', async () => {
    const { packet, error } = await createPacket({
      firmId: FIRM,
      name: 'Broken',
      steps: [{ templateId: 'tpl-missing' }],
      createdByUserId: USER,
    });
    expect(packet).toBeUndefined();
    expect(error).toBe('Template tpl-missing not found');
    expect(await listPackets()).toEqual([]);
  });
});

describe('listPackets / getPacket / deletePacket', () => {
  it('lists newest first', async () => {
    seedTemplate('tpl-a');
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.parse('2026-03-01T09:00:00.000Z'));
      const older = await createPacket({
        firmId: FIRM,
        name: 'Older',
        steps: [{ templateId: 'tpl-a' }],
        createdByUserId: USER,
      });
      vi.setSystemTime(Date.parse('2026-03-02T09:00:00.000Z'));
      const newer = await createPacket({
        firmId: FIRM,
        name: 'Newer',
        steps: [{ templateId: 'tpl-a' }],
        createdByUserId: USER,
      });

      expect((await listPackets()).map((p) => p.id)).toEqual([newer.packet!.id, older.packet!.id]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('getPacket returns null for an unknown id rather than throwing', async () => {
    expect(await getPacket('nope')).toBeNull();
  });

  it('deletePacket removes the record and drops it from the list', async () => {
    seedTemplate('tpl-a');
    const { packet } = await createPacket({
      firmId: FIRM,
      name: 'Doomed',
      steps: [{ templateId: 'tpl-a' }],
      createdByUserId: USER,
    });

    expect(await deletePacket(packet!.id)).toEqual({ ok: true });
    expect(await getPacket(packet!.id)).toBeNull();
    expect(await listPackets()).toEqual([]);
  });
});

// ============================================================================
// STARTING A RUN
// ============================================================================

describe('startPacketRun', () => {
  it('materialises step 0 into a real, sent envelope and invites the first signer', async () => {
    const { run, firstEnvelopeId, error } = await startTwoStepRun();

    expect(error).toBeUndefined();
    expect(firstEnvelopeId).toBeTruthy();
    expect(run!.status).toBe('running');
    expect(run!.current_step_index).toBe(0);
    expect(run!.steps[0]).toMatchObject({ status: 'sent', envelope_id: firstEnvelopeId });
    // Step 1 is untouched until step 0 completes — that is the contract.
    expect(run!.steps[1].status).toBe('pending');

    // `getEnvelopeDetails` spreads the envelope's own fields at the top level
    // and adds `document`, `signers` and `fields` beside them — it does not
    // nest under `.envelope`.
    const details = await getEnvelopeDetails(firstEnvelopeId!);
    expect(details).toMatchObject({
      title: 'Mandate',
      client_id: CLIENT,
      status: 'sent',
      packet_run_id: run!.id,
      packet_step_index: 0,
    });

    // Sequential mode: the FIRST signer is invited, not both.
    expect(mail.sent).toEqual([
      { to: 'thandi@example.com', subject: 'Signature Request: Mandate' },
    ]);

    const signers = await getEnvelopeSigners(firstEnvelopeId!);
    expect(signers.map((s) => s.email)).toEqual(['thandi@example.com', 'pieter@example.com']);
    expect(signers[0].status).toBe('sent');
    expect(signers[0].invite_sent_at).toBeTruthy();
    // The second signer is not invited yet.
    expect(signers[1].invite_sent_at).toBeFalsy();
  });

  it('orders recipients by their `order`, not by array position', async () => {
    seedTemplate('tpl-a');
    const { packet } = await createPacket({
      firmId: FIRM,
      name: 'P',
      steps: [{ templateId: 'tpl-a' }],
      createdByUserId: USER,
    });

    const { firstEnvelopeId } = await startPacketRun({
      packetId: packet!.id,
      firmId: FIRM,
      clientId: CLIENT,
      // Deliberately out of order.
      recipients: [
        { name: 'Second', email: 'second@example.com', role: 'Spouse', order: 2 },
        { name: 'First', email: 'first@example.com', role: 'Client', order: 1 },
      ],
      documentIdsByStep: ['doc-a'],
      createdByUserId: USER,
    });

    const signers = await getEnvelopeSigners(firstEnvelopeId!);
    expect(signers.map((s) => s.email)).toEqual(['first@example.com', 'second@example.com']);
    expect(mail.sent[0].to).toBe('first@example.com');
  });

  it('rejects a run whose document count does not match the step count', async () => {
    seedTemplate('tpl-a');
    seedTemplate('tpl-b');
    const { packet } = await createPacket({
      firmId: FIRM,
      name: 'Two steps',
      steps: [{ templateId: 'tpl-a' }, { templateId: 'tpl-b' }],
      createdByUserId: USER,
    });

    const { error, run } = await startPacketRun({
      packetId: packet!.id,
      firmId: FIRM,
      clientId: CLIENT,
      recipients: RECIPIENTS,
      documentIdsByStep: ['only-one'],
      createdByUserId: USER,
    });

    expect(error).toBe('Expected 2 document id(s) (one per step), got 1');
    expect(run).toBeUndefined();
    expect(await listPacketRuns()).toEqual([]);
  });

  it('rejects a run with no recipients, and one against an unknown packet', async () => {
    seedTemplate('tpl-a');
    const { packet } = await createPacket({
      firmId: FIRM,
      name: 'P',
      steps: [{ templateId: 'tpl-a' }],
      createdByUserId: USER,
    });

    expect(
      (
        await startPacketRun({
          packetId: packet!.id,
          firmId: FIRM,
          clientId: CLIENT,
          recipients: [],
          documentIdsByStep: ['doc-a'],
          createdByUserId: USER,
        })
      ).error,
    ).toBe('At least one recipient required');

    expect(
      (
        await startPacketRun({
          packetId: 'no-such-packet',
          firmId: FIRM,
          clientId: CLIENT,
          recipients: RECIPIENTS,
          documentIdsByStep: ['doc-a'],
          createdByUserId: USER,
        })
      ).error,
    ).toBe('Packet not found');
  });

  it('marks the run failed when step 0 cannot be materialised', async () => {
    seedTemplate('tpl-a');
    const { packet } = await createPacket({
      firmId: FIRM,
      name: 'P',
      steps: [{ templateId: 'tpl-a' }],
      createdByUserId: USER,
    });

    // Delete the template AFTER the packet snapshotted it, so materialisation
    // finds neither the pinned version nor the live record.
    kvStore.delete(EsignKeys.template('tpl-a'));

    const { run, error } = await startPacketRun({
      packetId: packet!.id,
      firmId: FIRM,
      clientId: CLIENT,
      recipients: RECIPIENTS,
      documentIdsByStep: ['doc-a'],
      createdByUserId: USER,
    });

    expect(error).toBe('Template tpl-a not found');
    expect(run!.status).toBe('failed');
    expect(run!.steps[0]).toMatchObject({ status: 'failed', error: 'Template tpl-a not found' });
    expect(mail.sent).toEqual([]);
  });

  it('keeps the document plan off the run record the dashboard reads', async () => {
    const { run } = await startTwoStepRun();
    const stored = await getPacketRun(run!.id);
    // The plan lives in a side-channel record so the listing endpoint cannot
    // leak document ids.
    expect(JSON.stringify(stored)).not.toContain('doc-b');
    expect(kvStore.get(`${EsignKeys.packetRun(run!.id)}:plan`)).toMatchObject({
      documentIdsByStep: ['doc-a', 'doc-b'],
      clientId: CLIENT,
    });
  });
});

// ============================================================================
// COMPLETION → ADVANCE
// ============================================================================

describe('advancePacketRunFromCompletion', () => {
  it('completes step N and sends step N+1 to the first signer', async () => {
    const { run, firstEnvelopeId } = await startTwoStepRun();
    mail.sent.length = 0;

    await advancePacketRunFromCompletion(firstEnvelopeId!, run!.id, 0);

    const advanced = (await getPacketRun(run!.id))!;
    expect(advanced.status).toBe('running');
    expect(advanced.current_step_index).toBe(1);
    expect(advanced.steps[0]).toMatchObject({ status: 'completed', envelope_id: firstEnvelopeId });
    expect(advanced.steps[0].completed_at).toBeTruthy();
    expect(advanced.steps[1].status).toBe('sent');
    expect(advanced.steps[1].envelope_id).toBeTruthy();

    // The second step's envelope carries the SECOND template's title.
    const second = await getEnvelopeDetails(advanced.steps[1].envelope_id!);
    expect(second).toMatchObject({ title: 'Risk Disclosure', packet_step_index: 1 });
    expect(mail.sent).toEqual([
      { to: 'thandi@example.com', subject: 'Signature Request: Risk Disclosure' },
    ]);
  });

  it('finalises the run when the LAST step completes, spawning nothing further', async () => {
    const { run, firstEnvelopeId } = await startTwoStepRun();
    await advancePacketRunFromCompletion(firstEnvelopeId!, run!.id, 0);

    const midway = (await getPacketRun(run!.id))!;
    mail.sent.length = 0;

    await advancePacketRunFromCompletion(midway.steps[1].envelope_id!, run!.id, 1);

    const finished = (await getPacketRun(run!.id))!;
    expect(finished.status).toBe('completed');
    expect(finished.current_step_index).toBe(1);
    expect(finished.steps[1].status).toBe('completed');
    expect(mail.sent).toEqual([]);
  });

  it('does nothing for a cancelled or already-completed run', async () => {
    const { run, firstEnvelopeId } = await startTwoStepRun();
    await cancelPacketRun(run!.id);
    mail.sent.length = 0;

    await advancePacketRunFromCompletion(firstEnvelopeId!, run!.id, 0);

    const after = (await getPacketRun(run!.id))!;
    expect(after.status).toBe('cancelled');
    expect(after.steps[1].status).toBe('skipped');
    expect(mail.sent).toEqual([]);
  });

  it('is a no-op for an unknown run rather than throwing', async () => {
    await expect(
      advancePacketRunFromCompletion('env-x', 'run-that-never-existed', 0),
    ).resolves.toBeUndefined();
  });

  it('leaves the run recoverable when the NEXT step cannot be materialised', async () => {
    const { run, firstEnvelopeId } = await startTwoStepRun();
    // Remove step 1's template between sending step 0 and completing it.
    kvStore.delete(EsignKeys.template('tpl-b'));
    mail.sent.length = 0;

    await advancePacketRunFromCompletion(firstEnvelopeId!, run!.id, 0);

    const after = (await getPacketRun(run!.id))!;
    expect(after.status).toBe('failed');
    expect(after.steps[1]).toMatchObject({ status: 'failed', error: 'Template tpl-b not found' });
    // Step 0's completion still stands — the failure to advance does not undo
    // a signature that already happened.
    expect(after.steps[0].status).toBe('completed');
    expect(mail.sent).toEqual([]);
  });
});

// ============================================================================
// CANCELLATION
// ============================================================================

describe('cancelPacketRun', () => {
  it('marks pending steps skipped and leaves sent ones alone', async () => {
    const { run } = await startTwoStepRun();

    const { run: cancelled } = await cancelPacketRun(run!.id);
    expect(cancelled!.status).toBe('cancelled');
    expect(cancelled!.steps[0].status).toBe('sent');
    expect(cancelled!.steps[1].status).toBe('skipped');
  });

  it('refuses to cancel a completed run, and 404s an unknown one', async () => {
    const { run, firstEnvelopeId } = await startTwoStepRun();
    await advancePacketRunFromCompletion(firstEnvelopeId!, run!.id, 0);
    const midway = (await getPacketRun(run!.id))!;
    await advancePacketRunFromCompletion(midway.steps[1].envelope_id!, run!.id, 1);

    expect((await cancelPacketRun(run!.id)).error).toBe('Run already completed');
    expect((await cancelPacketRun('nope')).error).toBe('Packet run not found');
  });
});

// ============================================================================
// AUDIT TRAIL
// ============================================================================

describe('audit trail', () => {
  it('records invite_sent with the packet provenance', async () => {
    const { run, firstEnvelopeId } = await startTwoStepRun();

    const events = await auditFor(firstEnvelopeId!);
    const invite = events.find((e) => e.action === 'invite_sent');
    expect(invite).toMatchObject({ action: 'invite_sent', email: 'thandi@example.com' });
    expect(invite!.metadata).toMatchObject({
      via: 'packet_run',
      packetRunId: run!.id,
      packetStepIndex: 0,
    });
  });

  it('records invite_send_failed — not invite_sent — when the email was not accepted', async () => {
    // `sendEmail` returns false WITHOUT throwing on three paths: no SendGrid
    // key, a non-OK response, and any caught error. Only the signer's
    // `invite_sent_at` was ever guarded by that result; the audit write was
    // unconditional, so the trail asserted an invite that never went out while
    // the signer record correctly showed none was.
    //
    // The trail is the ECTA evidence artefact for the signature, so an
    // overstatement here is the wrong direction to be wrong in: it favours the
    // firm's account of events over the recipient's.
    mail.ok = false;
    const { firstEnvelopeId } = await startTwoStepRun();

    const events = await auditFor(firstEnvelopeId!);
    expect(events.some((e) => e.action === 'invite_sent')).toBe(false);

    const failure = events.find((e) => e.action === 'invite_send_failed');
    expect(failure).toMatchObject({
      action: 'invite_send_failed',
      email: 'thandi@example.com',
    });
    // The provenance survives the failure — this is the record an operator
    // needs to work out which packet step stalled and why.
    expect(failure!.metadata).toMatchObject({ via: 'packet_run', packetStepIndex: 0 });
    expect(mail.sent).toEqual([]);

    const signers = await getEnvelopeSigners(firstEnvelopeId!);
    expect(signers[0].invite_sent_at).toBeFalsy();
    expect(signers[0].status).not.toBe('sent');
  });

  it('leaves the signer and the trail agreeing on a successful send', async () => {
    const { firstEnvelopeId } = await startTwoStepRun();

    const events = await auditFor(firstEnvelopeId!);
    expect(events.some((e) => e.action === 'invite_send_failed')).toBe(false);
    expect(events.some((e) => e.action === 'invite_sent')).toBe(true);

    const signers = await getEnvelopeSigners(firstEnvelopeId!);
    expect(signers[0].invite_sent_at).toBeTruthy();
  });
});
