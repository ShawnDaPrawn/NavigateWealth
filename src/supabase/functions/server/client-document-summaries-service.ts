/**
 * Client Document Summary — service.
 *
 * Owns grouping, storage and the scan; the model call lives in
 * `client-document-summaries-ai.ts`. All KV access goes through the typed
 * repository layer (`repositories/kv-repository.ts`) rather than raw `kv.*`.
 *
 * GROUPING
 * --------
 * The unit of a timeline entry is the unit the adviser uploaded: a pack, or a
 * lone document. The group key is derived from that (`pack_<packId>` /
 * `doc_<documentId>`) so the weekly scan is idempotent — re-running it over the
 * same week recognises what it already wrote instead of paying for it twice and
 * duplicating the timeline.
 *
 * Guidelines §4.2 (service owns business logic + KV access), §5.4 (KV key
 * naming), §14.1 (maintenance jobs are dry-run by default).
 */

import { createKvRepository } from './repositories/kv-repository.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import {
  generateSummaryDraft,
  SummaryGenerationError,
  type DocumentForSummary,
} from './client-document-summaries-ai.ts';
import type {
  DocumentGroup,
  DocumentSummaryRecord,
  SummaryScanReport,
  SummaryScanState,
  SummarySource,
} from './client-document-summaries-types.ts';

const log = createModuleLogger('client-doc-summaries');

/** KV namespace for the stored summaries (one repository per client). */
export const SUMMARY_NAMESPACE = 'client-doc-summary:';
/** KV namespace the documents module writes to: `document:{userId}:{docId}`. */
const DOCUMENT_NAMESPACE = 'document:';
/** Where the weekly scan keeps its cursor. One document, one id. */
const SCAN_STATE_NAMESPACE = 'client-doc-summary-scan:';
const SCAN_STATE_ID = 'state';

/** Page size when walking the whole document namespace during a scan. */
const SCAN_PAGE_SIZE = 500;
/** Hard ceiling on scan pages, so a runaway namespace cannot hang the job. */
const MAX_SCAN_PAGES = 200;

type RawDocument = Record<string, unknown>;

const summaryRepo = (clientId: string) =>
  createKvRepository<DocumentSummaryRecord>(`${SUMMARY_NAMESPACE}${clientId}:`);

const clientDocumentsRepo = (clientId: string) =>
  createKvRepository<RawDocument>(`${DOCUMENT_NAMESPACE}${clientId}:`);

const allDocumentsRepo = () => createKvRepository<RawDocument>(DOCUMENT_NAMESPACE);

const scanStateRepo = () => createKvRepository<SummaryScanState>(SCAN_STATE_NAMESPACE);

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

/** A document that should never reach a summary — hidden, or not a real record. */
function isSummarisable(doc: RawDocument | null | undefined): boolean {
  if (!doc || typeof doc !== 'object') return false;
  if (!str(doc.id)) return false;
  if (doc.isHidden === true) return false;
  return true;
}

/** The derived, stable key for the group a document belongs to. */
export function groupKeyFor(doc: RawDocument): string {
  const packId = str(doc.packId);
  return packId ? `pack_${packId}` : `doc_${str(doc.id)}`;
}

/**
 * Collapse a client's documents into the batches a timeline entry covers.
 *
 * Sorted newest batch first, matching how the timeline reads.
 */
export function groupDocuments(clientId: string, documents: RawDocument[]): DocumentGroup[] {
  const groups = new Map<string, DocumentGroup>();

  for (const doc of documents) {
    if (!isSummarisable(doc)) continue;

    const key = groupKeyFor(doc);
    const uploadDate = str(doc.uploadDate, new Date(0).toISOString());
    const existing = groups.get(key);

    if (existing) {
      existing.documents.push(doc);
      // The batch is anchored on its earliest upload — a file added to a pack
      // later should not drag the whole entry forward in the timeline. The
      // latest upload is tracked separately because that is what decides
      // whether the scan should look at the batch again.
      if (uploadDate < existing.documentDate) existing.documentDate = uploadDate;
      if (uploadDate > existing.latestDocumentDate) existing.latestDocumentDate = uploadDate;
      continue;
    }

    const packId = str(doc.packId);
    groups.set(key, {
      key,
      clientId,
      scope: packId ? 'pack' : 'document',
      packId: packId || undefined,
      title: packId
        ? str(doc.packTitle, str(doc.title, 'Document pack').replace(/\s\(\d+\)$/, ''))
        : str(doc.title, 'Untitled document'),
      documentDate: uploadDate,
      latestDocumentDate: uploadDate,
      documents: [doc],
    });
  }

  return [...groups.values()].sort((a, b) => b.documentDate.localeCompare(a.documentDate));
}

/** Narrow a raw KV document to the fields the model call needs. */
function toDocumentForSummary(doc: RawDocument): DocumentForSummary {
  return {
    id: str(doc.id),
    title: str(doc.title, 'Untitled document'),
    fileName: str(doc.fileName) || undefined,
    fileSize: typeof doc.fileSize === 'number' ? doc.fileSize : undefined,
    filePath: str(doc.filePath) || undefined,
    productCategory: str(doc.productCategory, 'General'),
    policyNumber: str(doc.policyNumber) || undefined,
    type: str(doc.type, 'document'),
    url: str(doc.url) || undefined,
    description: str(doc.description) || undefined,
    sourceSystem: str(doc.sourceSystem) || undefined,
    uploadDate: str(doc.uploadDate),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Every stored summary for a client, newest document batch first. */
export async function listSummaries(clientId: string): Promise<DocumentSummaryRecord[]> {
  const stored = await summaryRepo(clientId).listAll(
    `client document summary timeline for ${clientId}`,
  );
  return stored
    .filter((entry): entry is DocumentSummaryRecord => Boolean(entry?.id))
    .sort((a, b) => (b.documentDate || '').localeCompare(a.documentDate || ''));
}

export async function getSummary(
  clientId: string,
  summaryId: string,
): Promise<DocumentSummaryRecord | null> {
  return await summaryRepo(clientId).get(summaryId);
}

/**
 * The client's document batches, each carrying the summary it already has.
 *
 * This is what the Documents tab renders: batches with no summary are the
 * "Summarise" buttons, batches with one are the timeline.
 */
export async function listGroupsWithSummaries(clientId: string): Promise<{
  groups: DocumentGroup[];
  summaries: DocumentSummaryRecord[];
}> {
  const [documents, summaries] = await Promise.all([
    clientDocumentsRepo(clientId).listAll(`document batches for client ${clientId}`),
    listSummaries(clientId),
  ]);
  return { groups: groupDocuments(clientId, documents), summaries };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  clientId: string;
  packId?: string;
  documentId?: string;
  force?: boolean;
  source: SummarySource;
  actorId: string;
}

/** Locate the single group a generate request names, or null when it is gone. */
async function findGroup(
  clientId: string,
  packId: string | undefined,
  documentId: string | undefined,
): Promise<DocumentGroup | null> {
  const documents = await clientDocumentsRepo(clientId).listAll(
    `document batch lookup for client ${clientId}`,
  );
  const groups = groupDocuments(clientId, documents);
  const wanted = packId ? `pack_${packId}` : `doc_${documentId}`;
  return groups.find((group) => group.key === wanted) ?? null;
}

/**
 * True when a stored record should stop a re-generation.
 *
 * A `failed` record must NOT: it is the marker for a batch that was attempted
 * and did not work, usually because the model was rate-limited for a moment.
 * Treating it as done made the failure permanent for everyone except a super
 * admin — `force` is the only other way past this check and it is super-admin
 * only — while the record itself told the reader to "retry from the timeline".
 */
function blocksRegeneration(existing: DocumentSummaryRecord | null): boolean {
  return existing !== null && existing.status !== 'failed';
}

/**
 * Generate and store the summary for one group.
 *
 * A successful or edited summary is left alone unless `force` is set: the
 * weekly scan must never quietly overwrite a super admin's wording. A failed
 * one is retried on the next ordinary request.
 */
export async function generateSummaryForGroup(
  options: GenerateOptions,
): Promise<{ summary: DocumentSummaryRecord; created: boolean }> {
  const { clientId, packId, documentId, force = false, source, actorId } = options;

  const group = await findGroup(clientId, packId, documentId);
  if (!group) {
    throw new Error('No documents found for the requested pack or document');
  }

  const repo = summaryRepo(clientId);
  const existing = await repo.get(group.key);
  if (blocksRegeneration(existing) && !force) {
    return { summary: existing!, created: false };
  }

  return {
    summary: await summariseGroup(group, { source, actorId }),
    created: true,
  };
}

/**
 * The one place a group becomes a stored record.
 *
 * A model failure is stored as a `failed` record rather than thrown away, so
 * the timeline can show that the batch was attempted and why it did not work —
 * otherwise a failed weekly run is indistinguishable from one that never ran.
 */
async function summariseGroup(
  group: DocumentGroup,
  context: { source: SummarySource; actorId: string },
): Promise<DocumentSummaryRecord> {
  const repo = summaryRepo(group.clientId);
  const documents = group.documents.map(toDocumentForSummary);
  const categories = [...new Set(documents.map((doc) => doc.productCategory).filter(Boolean))];
  const now = new Date().toISOString();

  const base = {
    id: group.key,
    clientId: group.clientId,
    scope: group.scope,
    packId: group.packId,
    title: group.title,
    documentDate: group.documentDate,
    documentCount: documents.length,
    productCategories: categories,
    source: context.source,
    generatedAt: now,
    generatedBy: context.actorId,
    // A re-generation resets the edited flag: the text on screen is the
    // model's again, so claiming a human wrote it would be a lie.
    edited: false,
  };

  try {
    const draft = await generateSummaryDraft(documents);
    const record: DocumentSummaryRecord = {
      ...base,
      documents: draft.documents,
      headline: draft.headline,
      summary: draft.summary,
      highlights: draft.highlights,
      followUps: draft.followUps,
      status: 'generated',
      model: draft.model,
    };
    await repo.put(group.key, record);
    log.info('Document summary stored', {
      clientId: group.clientId,
      groupKey: group.key,
      documentCount: documents.length,
      source: context.source,
    });
    return record;
  } catch (error) {
    const message = getErrMsg(error);
    log.error('Document summary generation failed', {
      clientId: group.clientId,
      groupKey: group.key,
      error: message,
    });
    // A SummaryGenerationError knows what was actually sent and which model
    // rejected it. Falling back to "nothing was analysed" is only correct when
    // the failure happened before any of that was decided — asserting it
    // unconditionally is what made a failed entry claim "0 of 6 files read by
    // the AI" for six PDFs that had all been attached.
    const attempted = error instanceof SummaryGenerationError ? error : null;
    const record: DocumentSummaryRecord = {
      ...base,
      model: attempted?.model,
      documents:
        attempted?.documents ??
        documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          fileName: doc.fileName,
          productCategory: doc.productCategory,
          analysed: false,
        })),
      headline: `Summary unavailable — ${group.title}`,
      summary: 'The AI summary could not be generated for this batch. Retry from the timeline.',
      highlights: [],
      followUps: [],
      status: 'failed',
      error: message,
    };
    await repo.put(group.key, record);
    return record;
  }
}

// ---------------------------------------------------------------------------
// Editing (super admin only — enforced at the route)
// ---------------------------------------------------------------------------

export interface SummaryEdit {
  headline?: string;
  summary?: string;
  highlights?: string[];
  followUps?: string[];
}

/**
 * Apply a super admin's edit.
 *
 * The model's original headline and summary are kept the FIRST time they are
 * overwritten — an edit is a correction, not an erasure of what the AI said.
 */
export async function updateSummary(
  clientId: string,
  summaryId: string,
  edit: SummaryEdit,
  actorId: string,
): Promise<DocumentSummaryRecord | null> {
  const repo = summaryRepo(clientId);
  const existing = await repo.get(summaryId);
  if (!existing) return null;

  const updated: DocumentSummaryRecord = {
    ...existing,
    headline: edit.headline ?? existing.headline,
    summary: edit.summary ?? existing.summary,
    highlights: edit.highlights ?? existing.highlights,
    followUps: edit.followUps ?? existing.followUps,
    status: 'edited',
    edited: true,
    editedAt: new Date().toISOString(),
    editedBy: actorId,
    originalHeadline: existing.edited ? existing.originalHeadline : existing.headline,
    originalSummary: existing.edited ? existing.originalSummary : existing.summary,
  };

  await repo.put(summaryId, updated);
  return updated;
}

export async function deleteSummary(clientId: string, summaryId: string): Promise<boolean> {
  const repo = summaryRepo(clientId);
  const existing = await repo.get(summaryId);
  if (!existing) return false;
  await repo.remove(summaryId);
  return true;
}

// ---------------------------------------------------------------------------
// Weekly scan
// ---------------------------------------------------------------------------

export interface WeeklyScanOptions {
  lookbackDays: number;
  dryRun: boolean;
  maxGroups: number;
  force: boolean;
  actorId: string;
  /** Injected in tests so the window is not wall-clock dependent. */
  now?: Date;
}

/** Walk every document key, page by page, so the scan is bounded per round-trip. */
async function collectAllDocuments(): Promise<RawDocument[]> {
  const repo = allDocumentsRepo();
  const collected: RawDocument[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_SCAN_PAGES; page++) {
    const result = await repo.list({ limit: SCAN_PAGE_SIZE, startAfter: cursor ?? undefined });
    collected.push(...result.items);
    cursor = result.nextCursor;
    if (!cursor) return collected;
  }

  log.warn('Document scan hit the page ceiling — later documents were not considered', {
    pages: MAX_SCAN_PAGES,
    collected: collected.length,
  });
  return collected;
}

/**
 * Resolve the window this run should cover.
 *
 * Normally that is `lookbackDays` back from now. When the previous run had to
 * defer work because of `maxGroups`, its cursor is older than that and wins —
 * otherwise the deferred batches would age out of the window and never be
 * summarised, which is exactly what "picked up by the next run" is supposed to
 * mean.
 */
async function resolveScanWindow(
  now: Date,
  lookbackDays: number,
): Promise<{ since: string; resumedFromCursor: boolean }> {
  const windowStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const state = await scanStateRepo().get(SCAN_STATE_ID);
  const cursor = typeof state?.cursor === 'string' ? state.cursor : '';

  if (cursor && cursor < windowStart) return { since: cursor, resumedFromCursor: true };
  return { since: windowStart, resumedFromCursor: false };
}

/**
 * Find every document batch with recent activity and summarise the ones that
 * have no usable summary yet.
 *
 * Intended for a weekly (Saturday) pg_cron job. Dry-run by default; the job
 * sends `dryRun: false`.
 *
 * Two properties are worth stating because getting either wrong is silent:
 *
 *   - Groups are built from a client's WHOLE document set and only then tested
 *     against the window. Filtering documents first would summarise the recent
 *     half of a pack that straddles the boundary, store it under the full
 *     pack's key, and leave the older file permanently unanalysed behind a key
 *     that now looks done.
 *   - Work deferred by `maxGroups` is carried by the cursor, oldest first, so
 *     the backlog drains instead of ageing out.
 */
export async function runWeeklySummaryScan(options: WeeklyScanOptions): Promise<SummaryScanReport> {
  const now = options.now ?? new Date();
  const { since, resumedFromCursor } = await resolveScanWindow(now, options.lookbackDays);

  const documents = await collectAllDocuments();

  // Group per client over the client's COMPLETE document set — a packId is only
  // unique within the client it was uploaded for, and a partial group would be
  // stored under the whole pack's key.
  const byClient = new Map<string, RawDocument[]>();
  for (const doc of documents) {
    if (!isSummarisable(doc)) continue;
    const clientId = str(doc.userId);
    if (!clientId) continue;
    const bucket = byClient.get(clientId);
    if (bucket) bucket.push(doc);
    else byClient.set(clientId, [doc]);
  }

  const groups: DocumentGroup[] = [];
  for (const [clientId, clientDocs] of byClient) {
    // A batch is a candidate when ANY of its documents landed inside the
    // window: a file added to an old pack this week makes that pack newly
    // worth summarising, and its summary then covers the whole pack.
    groups.push(
      ...groupDocuments(clientId, clientDocs).filter((group) => group.latestDocumentDate >= since),
    );
  }
  // Oldest first, so a run that hits the cap drains the backlog rather than
  // re-doing the newest batches every week.
  groups.sort((a, b) => a.latestDocumentDate.localeCompare(b.latestDocumentDate));

  const report: SummaryScanReport = {
    scannedDocuments: documents.length,
    candidateGroups: groups.length,
    alreadySummarised: 0,
    generated: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
    dryRun: options.dryRun,
    lookbackDays: options.lookbackDays,
    since,
    resumedFromCursor,
    nextCursor: null,
    results: [],
  };

  /** Batches the cap pushed to a later run; the cursor must not pass these. */
  const deferred: DocumentGroup[] = [];

  for (const group of groups) {
    const existing = options.force ? null : await summaryRepo(group.clientId).get(group.key);
    if (blocksRegeneration(existing)) {
      report.alreadySummarised += 1;
      report.results.push({
        clientId: group.clientId,
        groupKey: group.key,
        title: group.title,
        outcome: 'already-summarised',
      });
      continue;
    }

    const isRetry = existing?.status === 'failed';

    if (report.generated + report.failed >= options.maxGroups) {
      report.skipped += 1;
      deferred.push(group);
      report.results.push({
        clientId: group.clientId,
        groupKey: group.key,
        title: group.title,
        outcome: 'deferred-to-next-run',
      });
      continue;
    }

    if (options.dryRun) {
      report.results.push({
        clientId: group.clientId,
        groupKey: group.key,
        title: group.title,
        outcome: 'dry-run',
      });
      continue;
    }

    const record = await summariseGroup(group, {
      source: 'scheduled',
      actorId: options.actorId,
    });

    if (isRetry) report.retried += 1;

    if (record.status === 'failed') {
      report.failed += 1;
      report.results.push({
        clientId: group.clientId,
        groupKey: group.key,
        title: group.title,
        outcome: 'failed',
        error: record.error,
      });
    } else {
      report.generated += 1;
      report.results.push({
        clientId: group.clientId,
        groupKey: group.key,
        title: group.title,
        outcome: isRetry ? 'retried' : 'generated',
      });
    }
  }

  // A dry run writes nothing, cursor included — otherwise a rehearsal would
  // move the window for the real run that follows it.
  if (!options.dryRun) {
    // Hold the window open at the oldest deferred batch, so the next run still
    // sees it. With nothing deferred the backlog is clear and the cursor moves
    // to now, which is the ordinary lookback behaviour again.
    const nextCursor = deferred.length
      ? deferred.reduce(
          (oldest, group) =>
            group.latestDocumentDate < oldest ? group.latestDocumentDate : oldest,
          deferred[0].latestDocumentDate,
        )
      : now.toISOString();

    await scanStateRepo().put(SCAN_STATE_ID, {
      cursor: nextCursor,
      lastRunAt: now.toISOString(),
      deferred: deferred.length,
    });
    report.nextCursor = nextCursor;
  }

  log.info('Weekly document summary scan complete', {
    dryRun: report.dryRun,
    since: report.since,
    resumedFromCursor: report.resumedFromCursor,
    candidateGroups: report.candidateGroups,
    generated: report.generated,
    retried: report.retried,
    failed: report.failed,
    alreadySummarised: report.alreadySummarised,
    deferred: report.skipped,
    nextCursor: report.nextCursor,
  });

  return report;
}
