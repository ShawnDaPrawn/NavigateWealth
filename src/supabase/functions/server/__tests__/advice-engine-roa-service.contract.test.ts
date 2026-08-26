/**
 * advice-engine-roa-service.ts — Contract Tests
 * =============================================
 *
 * The Record of Advice draft lifecycle: save, clone from a finalised version,
 * submit, delete, and the client/adviser snapshots pinned onto each draft.
 * 209 statements, 4% covered.
 *
 * An RoA is the FAIS record of what advice was given, to whom, on what basis.
 * The snapshotting is the part that matters: a finalised RoA has to keep the
 * client and adviser details as they were when the advice was given, not as
 * they are now. So does its version history.
 *
 * `advice-engine-roa-service-helpers.ts` and the utils run for real — both are
 * KV — so `buildClientContext`, `buildAdviserSnapshot` and the audit-event
 * appending are exercised rather than mocked. Stubbed: the blob storage and the
 * PDF/DOCX generators, which are the two real IO boundaries.
 *
 * One behaviour is asserted as a DEFECT and flagged at its test: deleting a
 * draft leaves its evidence blobs in the bucket.
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

/** The blob boundary. `blobs` is the stand-in bucket, so the tests can see what survives. */
const storage = vi.hoisted(() => ({ blobs: new Map<string, Uint8Array>() }));
vi.mock('../advice-engine-roa-storage.ts', async () => {
  const real = await vi.importActual<typeof import('../advice-engine-roa-storage.ts')>(
    '../advice-engine-roa-storage.ts',
  );
  return {
    ...real,
    ensureRoADocumentsBucket: vi.fn(async () => undefined),
    uploadRoABlob: vi.fn(async (objectPath: string, bytes: Uint8Array) => {
      storage.blobs.set(objectPath, bytes);
      return objectPath;
    }),
    downloadRoABlob: vi.fn(async (objectPath: string) => {
      const found = storage.blobs.get(objectPath);
      if (!found) throw new Error(`no blob at ${objectPath}`);
      return found;
    }),
  };
});

vi.mock('../advice-engine-roa-document-gen.ts', () => ({
  createCanonicalRoAPdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
  createCanonicalRoADocx: vi.fn(async () => new Uint8Array([4, 5, 6])),
}));

import { kvStore } from './helpers/contract-harness.ts';

const { AdviceEngineRoAService, CONVERSATION_PREFIX } =
  await import('../advice-engine-roa-service.ts');
const { ValidationError, NotFoundError } = await import('../error.middleware.ts');

const service = new AdviceEngineRoAService();

const CLIENT = 'client-1';
const ADVISER = { id: 'adviser-1', email: 'adviser@navigatewealth.co' };
const OTHER_ADVISER = { id: 'adviser-2', email: 'other@navigatewealth.co' };

/** A client profile complete enough for `buildClientContext` to succeed. */
function seedClient(clientId = CLIENT, overrides: Record<string, unknown> = {}) {
  kvStore.set(`user_profile:${clientId}:personal_info`, {
    firstName: 'Thandi',
    lastName: 'Mokoena',
    dateOfBirth: '1986-04-12',
    idNumber: '8604125000087',
    maritalStatus: 'married',
    email: 'thandi@example.com',
    cellphone: '+27821234567',
    ...overrides,
  });
}

const DRAFT_KEY = (id: string) => `roa:draft:${id}`;
const draftRow = (id: string) => kvStore.get(DRAFT_KEY(id)) as Record<string, never> | undefined;

beforeEach(() => {
  kvStore.clear();
  storage.blobs.clear();
});

// ============================================================================
// SAVE
// ============================================================================

describe('saveDraft', () => {
  it('creates a draft, stamps authorship, and indexes it by client and adviser', async () => {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT, selectedModules: ['risk'] }, ADVISER);

    expect(draft).toMatchObject({
      clientId: CLIENT,
      status: 'draft',
      version: 1,
      createdBy: ADVISER.id,
      updatedBy: ADVISER.id,
      adviserId: ADVISER.id,
      authoringMode: 'conversation',
      selectedModules: ['risk'],
    });

    expect(draftRow(draft.id)).toBeTruthy();
    // Two index rows so the draft is findable from either side.
    expect(kvStore.get(`roa:client:${CLIENT}:draft:${draft.id}`)).toMatchObject({
      draftId: draft.id,
      status: 'draft',
    });
    expect(kvStore.get(`roa:adviser:${ADVISER.id}:draft:${draft.id}`)).toMatchObject({
      draftId: draft.id,
      clientId: CLIENT,
    });
  });

  it('captures a client snapshot at save time', async () => {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT }, ADVISER);

    expect(draft.clientSnapshot).toBeTruthy();
    expect(draft.contextCapturedAt).toBeTruthy();
    // `adviserId`, not `id` — the snapshot names the adviser explicitly so it
    // cannot be confused with the draft's own id when both are in scope.
    expect(draft.adviserSnapshot).toMatchObject({ adviserId: ADVISER.id });
  });

  it('does NOT re-snapshot the client on a subsequent save of the same draft', async () => {
    // The snapshot is the record of what was true when the advice was given.
    // Refreshing it on every keystroke would quietly rewrite that.
    seedClient();
    const first = await service.saveDraft({ clientId: CLIENT }, ADVISER);

    kvStore.set(`user_profile:${CLIENT}:personal_info`, {
      firstName: 'CHANGED',
      lastName: 'Mokoena',
      email: 'thandi@example.com',
    });

    const second = await service.saveDraft(
      { id: first.id, clientId: CLIENT, selectedModules: ['risk'] },
      ADVISER,
    );
    expect(second.contextCapturedAt).toBe(first.contextCapturedAt);
    expect(JSON.stringify(second.clientSnapshot)).toContain('Thandi');
    expect(JSON.stringify(second.clientSnapshot)).not.toContain('CHANGED');
  });

  it('DOES re-snapshot when the draft is moved to a different client', async () => {
    seedClient();
    seedClient('client-2', { firstName: 'Pieter', lastName: 'van Wyk' });

    // The clock is stepped because `contextCapturedAt` is
    // `new Date().toISOString()` — two saves in the same millisecond produce
    // the same string, and the test would then pass or fail on how fast the
    // machine is rather than on whether a re-snapshot happened. Asserting the
    // snapshot CONTENT changed is the real check; the timestamp is corroboration.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.parse('2026-03-01T09:00:00.000Z'));
      const first = await service.saveDraft({ clientId: CLIENT }, ADVISER);

      vi.setSystemTime(Date.parse('2026-03-01T09:05:00.000Z'));
      const moved = await service.saveDraft({ id: first.id, clientId: 'client-2' }, ADVISER);

      expect(moved.contextCapturedAt).not.toBe(first.contextCapturedAt);
      expect(JSON.stringify(moved.clientSnapshot)).toContain('Pieter');
      expect(JSON.stringify(moved.clientSnapshot)).not.toContain('Thandi');
    } finally {
      vi.useRealTimers();
    }
  });

  it('records an audit event when the client is first selected', async () => {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT }, ADVISER);
    const actions = (draft.auditEvents ?? []).map((e) => (e as { action: string }).action);
    expect(actions).toContain('client_selected');
  });

  it('records added and removed modules', async () => {
    seedClient();
    const first = await service.saveDraft(
      { clientId: CLIENT, selectedModules: ['risk', 'estate'] },
      ADVISER,
    );
    const second = await service.saveDraft(
      { id: first.id, clientId: CLIENT, selectedModules: ['risk', 'tax'] },
      ADVISER,
    );

    // The payload field is `details`, not `metadata` — `appendAuditEvent`
    // builds { id, action, summary, createdAt, createdBy, details }.
    const modulesEvent = (second.auditEvents ?? [])
      .map((e) => e as { action: string; details?: Record<string, unknown> })
      .filter((e) => e.action === 'modules_updated')
      .pop();
    expect(modulesEvent!.details).toMatchObject({
      addedModules: ['tax'],
      removedModules: ['estate'],
    });
  });

  it('keeps createdBy and createdAt from the original save', async () => {
    seedClient();
    const first = await service.saveDraft({ clientId: CLIENT }, ADVISER);
    const second = await service.saveDraft({ id: first.id, clientId: CLIENT }, OTHER_ADVISER);

    expect(second.createdBy).toBe(ADVISER.id);
    expect(second.createdAt).toBe(first.createdAt);
    // But the editor is recorded.
    expect(second.updatedBy).toBe(OTHER_ADVISER.id);
    // And the owning adviser does not change hands on an edit.
    expect(second.adviserId).toBe(ADVISER.id);
  });

  it('refuses to save over a finalised draft', async () => {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT }, ADVISER);
    kvStore.set(DRAFT_KEY(draft.id), { ...draft, lockedAt: '2026-03-01T09:00:00.000Z' });

    await expect(
      service.saveDraft({ id: draft.id, clientId: CLIENT }, ADVISER),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('fails when the client has no profile to snapshot', async () => {
    await expect(service.saveDraft({ clientId: 'ghost' }, ADVISER)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

// ============================================================================
// READ
// ============================================================================

describe('getDraft / listDrafts', () => {
  it('throws NotFound for an unknown draft', async () => {
    await expect(service.getDraft('nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists drafts newest-updated first', async () => {
    seedClient();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.parse('2026-03-01T09:00:00.000Z'));
      const older = await service.saveDraft({ clientId: CLIENT }, ADVISER);
      vi.setSystemTime(Date.parse('2026-03-02T09:00:00.000Z'));
      const newer = await service.saveDraft({ clientId: CLIENT }, ADVISER);

      const all = await service.listDrafts({});
      expect(all.map((d) => d.id)).toEqual([newer.id, older.id]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('filters by status, client and adviser', async () => {
    seedClient();
    seedClient('client-2', { firstName: 'Pieter' });

    const mine = await service.saveDraft({ clientId: CLIENT }, ADVISER);
    await service.saveDraft({ clientId: 'client-2' }, OTHER_ADVISER);
    await service.submitDraft(mine.id, ADVISER);

    expect((await service.listDrafts({ clientId: CLIENT })).map((d) => d.id)).toEqual([mine.id]);
    expect(
      (await service.listDrafts({ adviserId: OTHER_ADVISER.id })).map((d) => d.clientId),
    ).toEqual(['client-2']);
    expect((await service.listDrafts({ status: 'submitted' })).map((d) => d.id)).toEqual([mine.id]);
  });
});

// ============================================================================
// SUBMIT
// ============================================================================

describe('submitDraft', () => {
  it('marks the draft submitted and bumps the version', async () => {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT }, ADVISER);
    expect(draft.version).toBe(1);

    const submitted = await service.submitDraft(draft.id, ADVISER);
    expect(submitted).toMatchObject({ status: 'submitted', version: 2, id: draft.id });
    expect(draftRow(draft.id)).toMatchObject({ status: 'submitted' });
  });

  it('updates the client and adviser index rows too', async () => {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT }, ADVISER);
    await service.submitDraft(draft.id, ADVISER);

    expect(kvStore.get(`roa:client:${CLIENT}:draft:${draft.id}`)).toMatchObject({
      status: 'submitted',
    });
  });
});

// ============================================================================
// CLONE FROM FINAL
// ============================================================================

describe('cloneDraftFromFinal', () => {
  /** A finalised, locked draft — the only kind that can be branched. */
  async function finalised() {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT, selectedModules: ['risk'] }, ADVISER);
    const locked = {
      ...draft,
      status: 'final',
      version: 3,
      finalisedAt: '2026-03-01T09:00:00.000Z',
      finalisedBy: ADVISER.id,
      lockedAt: '2026-03-01T09:00:00.000Z',
    };
    kvStore.set(DRAFT_KEY(draft.id), locked);
    return locked;
  }

  it('branches a finalised RoA into a new editable draft at the next version', async () => {
    const source = await finalised();
    const clone = await service.cloneDraftFromFinal(source.id, ADVISER);

    expect(clone.id).not.toBe(source.id);
    expect(clone).toMatchObject({
      clientId: CLIENT,
      version: 4,
      status: 'draft',
      selectedModules: ['risk'],
    });
    // The branch is editable — the lock does not come across.
    expect(clone.lockedAt).toBeFalsy();
    expect(clone.finalisedAt).toBeFalsy();
  });

  it('leaves the finalised source untouched', async () => {
    const source = await finalised();
    await service.cloneDraftFromFinal(source.id, ADVISER);

    expect(draftRow(source.id)).toMatchObject({
      version: 3,
      status: 'final',
      lockedAt: '2026-03-01T09:00:00.000Z',
    });
  });

  it('refuses to branch a draft that was never finalised', async () => {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT }, ADVISER);
    await expect(service.cloneDraftFromFinal(draft.id, ADVISER)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('throws NotFound for an unknown source', async () => {
    await expect(service.cloneDraftFromFinal('nope', ADVISER)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

// ============================================================================
// DELETE
// ============================================================================

describe('deleteDraft', () => {
  it('removes the draft and both index rows', async () => {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT }, ADVISER);

    await service.deleteDraft(draft.id, ADVISER);

    expect(draftRow(draft.id)).toBeUndefined();
    expect(kvStore.has(`roa:client:${CLIENT}:draft:${draft.id}`)).toBe(false);
    expect(kvStore.has(`roa:adviser:${ADVISER.id}:draft:${draft.id}`)).toBe(false);
  });

  it('removes the generated-document records and the client register entries', async () => {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT }, ADVISER);
    kvStore.set(DRAFT_KEY(draft.id), {
      ...draft,
      generatedDocuments: [{ id: 'gen-1' }],
    });
    kvStore.set('roa:generated:gen-1', { id: 'gen-1' });
    kvStore.set(`roa:client:${CLIENT}:document:gen-1`, { id: 'gen-1' });
    kvStore.set(`roa:client:${CLIENT}:file:gen-1`, { id: 'gen-1' });
    kvStore.set(`document:${CLIENT}:gen-1`, { id: 'gen-1' });

    await service.deleteDraft(draft.id, ADVISER);

    for (const key of [
      'roa:generated:gen-1',
      `roa:client:${CLIENT}:document:gen-1`,
      `roa:client:${CLIENT}:file:gen-1`,
      `document:${CLIENT}:gen-1`,
    ]) {
      expect([key, kvStore.has(key)]).toEqual([key, false]);
    }
  });

  it('removes the per-module conversation transcripts', async () => {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT }, ADVISER);
    kvStore.set(`${CONVERSATION_PREFIX}${draft.id}:risk`, { moduleId: 'risk', turns: [] });
    kvStore.set(`${CONVERSATION_PREFIX}${draft.id}:estate`, { moduleId: 'estate', turns: [] });

    await service.deleteDraft(draft.id, ADVISER);

    expect(kvStore.has(`${CONVERSATION_PREFIX}${draft.id}:risk`)).toBe(false);
    expect(kvStore.has(`${CONVERSATION_PREFIX}${draft.id}:estate`)).toBe(false);
  });

  it('refuses to delete a finalised draft', async () => {
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT }, ADVISER);
    kvStore.set(DRAFT_KEY(draft.id), { ...draft, lockedAt: '2026-03-01T09:00:00.000Z' });

    await expect(service.deleteDraft(draft.id, ADVISER)).rejects.toBeInstanceOf(ValidationError);
    expect(draftRow(draft.id)).toBeTruthy();
  });

  it('LEAVES the evidence blob in storage — deletion does not delete', async () => {
    // Asserted as the defect it is.
    //
    // `deleteDraft` collects `ev.storagePath` into `keysToDelete` and passes
    // the lot to `kv.mdel`. But `storagePath` addresses a Supabase Storage
    // object, not a KV row — so that call deletes a KV key nothing ever wrote,
    // and the blob is untouched. `advice-engine-roa-storage.ts` has no
    // delete/remove export at all, and nothing anywhere in the RoA surface
    // removes a blob.
    //
    // The code READS as though it cleans storage up, which is why it survived.
    // Consequence: evidence a client uploaded to support advice, and the
    // generated RoA documents, stay in the bucket after the draft is deleted —
    // a deletion that does not delete, which is a POPIA problem before it is a
    // storage-cost one.
    seedClient();
    const draft = await service.saveDraft({ clientId: CLIENT }, ADVISER);

    const blobPath = `roa/${CLIENT}/${draft.id}/evidence/ev-1.pdf`;
    storage.blobs.set(blobPath, new Uint8Array([7, 7, 7]));
    kvStore.set(DRAFT_KEY(draft.id), {
      ...draft,
      moduleEvidence: { risk: { 'ev-1': { id: 'ev-1', storagePath: blobPath } } },
    });

    await service.deleteDraft(draft.id, ADVISER);

    expect(draftRow(draft.id)).toBeUndefined();
    // The draft is gone; the client's document is not.
    expect(storage.blobs.has(blobPath)).toBe(true);
  });
});
