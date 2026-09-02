/**
 * Client document summaries — the behaviour that keeps the timeline honest.
 * ========================================================================
 *
 * This feature writes a narrative record of what was done for a client and
 * hands it to a weekly job that runs unattended. Three things can go wrong in
 * ways nobody would notice until the record is already wrong:
 *
 *   1. The scan re-summarises a batch it has already summarised — paying twice
 *      and duplicating the timeline. The whole idempotency argument rests on
 *      the group key being DERIVED, so that is pinned first.
 *   2. The scan overwrites wording a super admin corrected. An edit is the one
 *      thing in this feature a human did deliberately; a scheduled job silently
 *      replacing it is the worst failure available here.
 *   3. A model failure disappears. A failed run that stores nothing is
 *      indistinguishable from a run that never happened.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/client-document-summaries-service.test.ts
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';

const store = new Map<string, unknown>();

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (k: string) => store.get(k) ?? null),
  set: vi.fn(async (k: string, v: unknown) => {
    store.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    store.delete(k);
  }),
  mget: vi.fn(async (ks: string[]) => ks.map((k) => store.get(k) ?? null)),
  getByPrefix: vi.fn(async (p: string) =>
    [...store.entries()].filter(([k]) => k.startsWith(p)).map(([, v]) => v),
  ),
  listByPrefix: vi.fn(async (p: string, o?: { limit?: number; startAfter?: string }) => {
    let rows = [...store.entries()]
      .filter(([k]) => k.startsWith(p))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => ({ key, value }));
    if (o?.startAfter) rows = rows.filter((r) => r.key > o.startAfter!);
    return rows.slice(0, o?.limit ?? 100);
  }),
}));

const generateSummaryDraft = vi.fn();
vi.mock('../client-document-summaries-ai.ts', () => ({
  generateSummaryDraft: (...args: unknown[]) => generateSummaryDraft(...args),
}));

const {
  groupDocuments,
  groupKeyFor,
  listSummaries,
  generateSummaryForGroup,
  updateSummary,
  deleteSummary,
  runWeeklySummaryScan,
} = await import('../client-document-summaries-service.ts');

const NOW = new Date('2026-09-05T09:00:00.000Z');
/** Inside a 7-day lookback from NOW. */
const THIS_WEEK = '2026-09-02T08:00:00.000Z';
/** Well outside it. */
const LAST_YEAR = '2025-09-02T08:00:00.000Z';

function seedDoc(over: Record<string, unknown> = {}) {
  const doc = {
    id: 'doc_1',
    userId: 'client-1',
    type: 'document',
    title: 'Policy schedule',
    uploadDate: THIS_WEEK,
    productCategory: 'Life',
    policyNumber: 'POL-1',
    status: 'new',
    isFavourite: false,
    uploadedBy: 'admin-1',
    fileName: 'schedule.pdf',
    filePath: 'client-1/schedule.pdf',
    ...over,
  };
  store.set(`document:${doc.userId}:${doc.id}`, doc);
  return doc;
}

function draft(over: Record<string, unknown> = {}) {
  return {
    headline: 'New Sanlam life cover issued',
    summary: 'A life policy was issued with cover of R2 000 000.',
    highlights: ['Sanlam life cover R2 000 000'],
    followUps: [],
    documents: [{ id: 'doc_1', title: 'Policy schedule', productCategory: 'Life', analysed: true }],
    model: 'gpt-4o',
    ...over,
  };
}

beforeEach(() => {
  store.clear();
  generateSummaryDraft.mockReset();
  generateSummaryDraft.mockResolvedValue(draft());
});

// ---------------------------------------------------------------------------

describe('grouping', () => {
  it('derives the group key from the pack, not from a random id', () => {
    // The idempotency of the weekly scan rests entirely on this: the same batch
    // must produce the same key on every run, in every process.
    expect(groupKeyFor({ id: 'doc_1', packId: 'pack_99' })).toBe('pack_pack_99');
    expect(groupKeyFor({ id: 'doc_1' })).toBe('doc_doc_1');
  });

  it('collapses a pack into one batch and leaves singles alone', () => {
    const groups = groupDocuments('client-1', [
      { id: 'doc_1', packId: 'pack_9', packTitle: 'Onboarding', uploadDate: THIS_WEEK },
      { id: 'doc_2', packId: 'pack_9', packTitle: 'Onboarding', uploadDate: THIS_WEEK },
      { id: 'doc_3', title: 'Consent form', uploadDate: LAST_YEAR },
    ]);

    expect(groups.map((g) => g.key)).toEqual(['pack_pack_9', 'doc_doc_3']);
    expect(groups[0].documents).toHaveLength(2);
    expect(groups[0].scope).toBe('pack');
    expect(groups[1].scope).toBe('document');
  });

  it('anchors a pack on its EARLIEST upload', () => {
    // A file added to a pack days later must not drag the whole entry forward
    // in the timeline — the batch happened when it happened.
    const groups = groupDocuments('client-1', [
      { id: 'doc_1', packId: 'p', uploadDate: '2026-05-13T00:00:00.000Z' },
      { id: 'doc_2', packId: 'p', uploadDate: '2026-06-20T00:00:00.000Z' },
    ]);

    expect(groups[0].documentDate).toBe('2026-05-13T00:00:00.000Z');
  });

  it('excludes hidden documents', () => {
    // Hidden documents are the communication module's internal attachments.
    // They are not client filing and must not appear in a client's history.
    const groups = groupDocuments('client-1', [
      { id: 'doc_1', uploadDate: THIS_WEEK },
      { id: 'doc_2', uploadDate: THIS_WEEK, isHidden: true },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('doc_doc_1');
  });
});

// ---------------------------------------------------------------------------

describe('generating one batch', () => {
  it('stores a summary under the derived key', async () => {
    seedDoc();

    const { summary, created } = await generateSummaryForGroup({
      clientId: 'client-1',
      documentId: 'doc_1',
      source: 'manual',
      actorId: 'admin-1',
    });

    expect(created).toBe(true);
    expect(summary.status).toBe('generated');
    expect(summary.headline).toBe('New Sanlam life cover issued');
    expect(store.get('client-doc-summary:client-1:doc_doc_1')).toBeTruthy();
  });

  it('returns the existing summary rather than paying for a second one', async () => {
    seedDoc();
    await generateSummaryForGroup({
      clientId: 'client-1',
      documentId: 'doc_1',
      source: 'manual',
      actorId: 'admin-1',
    });
    generateSummaryDraft.mockClear();

    const { created } = await generateSummaryForGroup({
      clientId: 'client-1',
      documentId: 'doc_1',
      source: 'manual',
      actorId: 'admin-1',
    });

    expect(created).toBe(false);
    expect(generateSummaryDraft).not.toHaveBeenCalled();
  });

  it('regenerates when forced', async () => {
    seedDoc();
    await generateSummaryForGroup({
      clientId: 'client-1',
      documentId: 'doc_1',
      source: 'manual',
      actorId: 'admin-1',
    });
    generateSummaryDraft.mockResolvedValue(draft({ headline: 'Rewritten' }));

    const { summary, created } = await generateSummaryForGroup({
      clientId: 'client-1',
      documentId: 'doc_1',
      force: true,
      source: 'manual',
      actorId: 'admin-1',
    });

    expect(created).toBe(true);
    expect(summary.headline).toBe('Rewritten');
  });

  it('records a model failure instead of losing it', async () => {
    // A failed run that stores nothing looks exactly like a run that never
    // happened. The timeline has to be able to say "this was attempted".
    seedDoc();
    generateSummaryDraft.mockRejectedValue(new Error('OpenAI request failed (429)'));

    const { summary } = await generateSummaryForGroup({
      clientId: 'client-1',
      documentId: 'doc_1',
      source: 'manual',
      actorId: 'admin-1',
    });

    expect(summary.status).toBe('failed');
    expect(summary.error).toContain('429');
    expect(store.get('client-doc-summary:client-1:doc_doc_1')).toBeTruthy();
  });

  it('rejects a batch that does not exist', async () => {
    await expect(
      generateSummaryForGroup({
        clientId: 'client-1',
        documentId: 'nope',
        source: 'manual',
        actorId: 'admin-1',
      }),
    ).rejects.toThrow(/No documents found/);
  });
});

// ---------------------------------------------------------------------------

describe('super admin edits', () => {
  it("keeps the model's original wording the first time it is overwritten", async () => {
    seedDoc();
    await generateSummaryForGroup({
      clientId: 'client-1',
      documentId: 'doc_1',
      source: 'manual',
      actorId: 'admin-1',
    });

    const first = await updateSummary(
      'client-1',
      'doc_doc_1',
      { summary: 'Corrected wording.' },
      'super-1',
    );
    const second = await updateSummary(
      'client-1',
      'doc_doc_1',
      { summary: 'Corrected again.' },
      'super-1',
    );

    expect(first?.originalSummary).toBe('A life policy was issued with cover of R2 000 000.');
    // The SECOND edit must not overwrite the original with the first edit —
    // otherwise the audit trail decays into "whatever was there last time".
    expect(second?.originalSummary).toBe('A life policy was issued with cover of R2 000 000.');
    expect(second?.summary).toBe('Corrected again.');
    expect(second?.edited).toBe(true);
    expect(second?.editedBy).toBe('super-1');
  });

  it('returns null for a summary that is not there', async () => {
    await expect(updateSummary('client-1', 'missing', { summary: 'x' }, 'super-1')).resolves.toBe(
      null,
    );
  });

  it('deletes a summary and reports whether it existed', async () => {
    seedDoc();
    await generateSummaryForGroup({
      clientId: 'client-1',
      documentId: 'doc_1',
      source: 'manual',
      actorId: 'admin-1',
    });

    await expect(deleteSummary('client-1', 'doc_doc_1')).resolves.toBe(true);
    await expect(deleteSummary('client-1', 'doc_doc_1')).resolves.toBe(false);
    await expect(listSummaries('client-1')).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('weekly scan', () => {
  const scanOptions = {
    lookbackDays: 7,
    maxGroups: 40,
    force: false,
    actorId: 'scheduled',
    now: NOW,
  };

  it('only considers documents uploaded inside the lookback window', async () => {
    seedDoc({ id: 'doc_recent', uploadDate: THIS_WEEK });
    seedDoc({ id: 'doc_old', uploadDate: LAST_YEAR });

    const report = await runWeeklySummaryScan({ ...scanOptions, dryRun: false });

    expect(report.candidateGroups).toBe(1);
    expect(report.generated).toBe(1);
    expect(report.results[0].groupKey).toBe('doc_doc_recent');
  });

  it('writes nothing on a dry run', async () => {
    seedDoc();

    const report = await runWeeklySummaryScan({ ...scanOptions, dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.generated).toBe(0);
    expect(generateSummaryDraft).not.toHaveBeenCalled();
    expect(store.get('client-doc-summary:client-1:doc_doc_1')).toBeUndefined();
  });

  it('never overwrites a summary a super admin edited', async () => {
    // The failure this feature could not recover from: the Saturday job
    // silently replacing a human's correction with fresh model output.
    seedDoc();
    await generateSummaryForGroup({
      clientId: 'client-1',
      documentId: 'doc_1',
      source: 'manual',
      actorId: 'admin-1',
    });
    await updateSummary('client-1', 'doc_doc_1', { summary: 'Human wording.' }, 'super-1');
    generateSummaryDraft.mockClear();

    const report = await runWeeklySummaryScan({ ...scanOptions, dryRun: false });

    expect(report.alreadySummarised).toBe(1);
    expect(report.generated).toBe(0);
    expect(generateSummaryDraft).not.toHaveBeenCalled();
    const stored = await listSummaries('client-1');
    expect(stored[0].summary).toBe('Human wording.');
  });

  it('groups per client, so two clients cannot share a pack id', async () => {
    // packId is `pack_<timestamp>`, which is not globally unique. If grouping
    // were done across clients, two uploads in the same millisecond would merge
    // one client's documents into another's timeline.
    seedDoc({ id: 'doc_a', userId: 'client-1', packId: 'pack_same' });
    seedDoc({ id: 'doc_b', userId: 'client-2', packId: 'pack_same' });

    const report = await runWeeklySummaryScan({ ...scanOptions, dryRun: true });

    expect(report.candidateGroups).toBe(2);
    expect(new Set(report.results.map((r) => r.clientId))).toEqual(
      new Set(['client-1', 'client-2']),
    );
  });

  it('stops at maxGroups and says how many it skipped', async () => {
    seedDoc({ id: 'doc_1' });
    seedDoc({ id: 'doc_2' });
    seedDoc({ id: 'doc_3' });

    const report = await runWeeklySummaryScan({ ...scanOptions, dryRun: false, maxGroups: 2 });

    expect(report.generated).toBe(2);
    expect(report.skipped).toBe(1);
  });

  it('counts a failed batch without abandoning the rest of the run', async () => {
    seedDoc({ id: 'doc_1', uploadDate: '2026-09-03T08:00:00.000Z' });
    seedDoc({ id: 'doc_2', uploadDate: '2026-09-02T08:00:00.000Z' });
    generateSummaryDraft
      .mockRejectedValueOnce(new Error('model exploded'))
      .mockResolvedValueOnce(draft());

    const report = await runWeeklySummaryScan({ ...scanOptions, dryRun: false });

    expect(report.failed).toBe(1);
    expect(report.generated).toBe(1);
  });
});
