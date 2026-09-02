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
  documentDate: string;
  documents: Array<Record<string, unknown>>;
}

/** Outcome of one weekly-scan run. */
export interface SummaryScanReport {
  scannedDocuments: number;
  candidateGroups: number;
  alreadySummarised: number;
  generated: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  lookbackDays: number;
  since: string;
  /** Per-group outcome, capped so a large run cannot bloat the response. */
  results: Array<{
    clientId: string;
    groupKey: string;
    title: string;
    outcome: 'generated' | 'failed' | 'already-summarised' | 'skipped-limit' | 'dry-run';
    error?: string;
  }>;
}
