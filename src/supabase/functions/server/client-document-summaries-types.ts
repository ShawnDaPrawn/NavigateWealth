/**
 * Client Document Summary — types
 *
 * A summary is an AI-written record of what a batch of client documents
 * contains and what it means was done for the client. One summary covers one
 * "group": either a document pack (several files uploaded together under a
 * `packId`) or a single standalone document.
 *
 * Stacked newest-first, the summaries form the client's document timeline —
 * a readable history of the work done for them, without opening every file.
 *
 * KV key pattern: `client-doc-summary:{clientId}:{groupKey}` (§5.4).
 * The group key is derived, not random, so a re-run of the weekly scan
 * recognises a group it has already summarised instead of duplicating it.
 */

/** How a summary came to exist. */
export type SummarySource = 'manual' | 'scheduled';

/** Lifecycle of a summary record. */
export type SummaryStatus = 'generated' | 'edited' | 'failed';

/** One document as it appears inside a summary (metadata only — no content). */
export interface SummarisedDocument {
  id: string;
  title: string;
  fileName?: string;
  productCategory: string;
  /** Whether the document's bytes were actually sent to the model. */
  analysed: boolean;
}

export interface DocumentSummaryRecord {
  /** Stable, derived id — `pack_<packId>` or `doc_<documentId>`. */
  id: string;
  clientId: string;
  /** Whether this covers a multi-file pack or a single document. */
  scope: 'pack' | 'document';
  packId?: string;
  /** Display title for the timeline entry (pack title or document title). */
  title: string;
  /** Earliest upload date in the group — the timeline anchors on this. */
  documentDate: string;
  documents: SummarisedDocument[];
  documentCount: number;
  productCategories: string[];

  /** One-line "what this was" for the collapsed timeline row. */
  headline: string;
  /** The narrative paragraph shown when the entry is expanded. */
  summary: string;
  /** Bullet points: the concrete things the documents show were done. */
  highlights: string[];
  /** Anything the documents suggest still needs attention. */
  followUps: string[];

  status: SummaryStatus;
  source: SummarySource;
  model?: string;
  generatedAt: string;
  /** User id that triggered generation, or `scheduled` for the weekly job. */
  generatedBy: string;

  /** Set only once a super admin has edited the text. */
  edited: boolean;
  editedAt?: string;
  editedBy?: string;
  /**
   * The model's original wording, kept the first time a human overwrites it.
   * Without this an edit silently destroys the only record of what the AI
   * actually said about the documents.
   */
  originalSummary?: string;
  originalHeadline?: string;

  /** Populated when `status === 'failed'` so the UI can say why. */
  error?: string;
}

/** A batch of documents to be summarised together. */
export interface DocumentGroup {
  key: string;
  clientId: string;
  scope: 'pack' | 'document';
  packId?: string;
  title: string;
  /** EARLIEST upload in the batch — what the timeline is ordered by. */
  documentDate: string;
  /**
   * LATEST upload in the batch. Distinct from `documentDate` because a pack can
   * gain a file weeks after it was created, and the two dates answer different
   * questions: where the entry sits in the history, versus whether the scan
   * should look at it again.
   */
  latestDocumentDate: string;
  documents: Array<Record<string, unknown>>;
}

/**
 * Persisted state for the weekly scan.
 *
 * One timestamp, and it exists for one reason: `maxGroups` caps a run's spend,
 * and without this the capped remainder would fall out of the next run's
 * lookback window and never be summarised at all. The cursor holds the window
 * open over deferred work until it has actually been done.
 */
export interface SummaryScanState {
  /**
   * The scan will not start its window later than this. Set to `now` when a run
   * cleared its whole candidate set, or to the oldest deferred batch's latest
   * upload date when the cap bit.
   */
  cursor: string;
  lastRunAt: string;
  /** How many batches the last run had to defer. */
  deferred: number;
}

/** Outcome of one weekly-scan run. */
export interface SummaryScanReport {
  scannedDocuments: number;
  candidateGroups: number;
  alreadySummarised: number;
  generated: number;
  /** Failed records re-attempted this run (a subset of generated + failed). */
  retried: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  lookbackDays: number;
  /** Start of the window actually used — the cursor when a backlog is open. */
  since: string;
  /** Whether `since` came from the carried cursor rather than lookbackDays. */
  resumedFromCursor: boolean;
  /** The cursor stored for the next run. Null on a dry run (nothing written). */
  nextCursor: string | null;
  /** Per-group outcome, capped so a large run cannot bloat the response. */
  results: Array<{
    clientId: string;
    groupKey: string;
    title: string;
    outcome:
      | 'generated'
      | 'retried'
      | 'failed'
      | 'already-summarised'
      | 'deferred-to-next-run'
      | 'dry-run';
    error?: string;
  }>;
}
