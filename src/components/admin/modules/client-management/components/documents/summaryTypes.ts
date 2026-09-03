/**
 * Client document AI summary — client-side types.
 *
 * Mirrors `client-document-summaries-types.ts` on the edge server. Kept as a
 * separate declaration rather than imported: the server tree is Deno code that
 * the SPA build does not compile.
 */

export type SummaryStatus = 'generated' | 'edited' | 'failed';
export type SummarySource = 'manual' | 'scheduled';

export interface SummarisedDocument {
  id: string;
  title: string;
  fileName?: string;
  productCategory: string;
  /** False when the file's contents could not be read by the model. */
  analysed: boolean;
}

export interface DocumentSummary {
  id: string;
  clientId: string;
  scope: 'pack' | 'document';
  packId?: string;
  title: string;
  /** The upload date of the batch — what the timeline is ordered by. */
  documentDate: string;
  documents: SummarisedDocument[];
  documentCount: number;
  productCategories: string[];
  headline: string;
  summary: string;
  highlights: string[];
  followUps: string[];
  status: SummaryStatus;
  source: SummarySource;
  model?: string;
  generatedAt: string;
  generatedBy: string;
  edited: boolean;
  editedAt?: string;
  editedBy?: string;
  originalHeadline?: string;
  originalSummary?: string;
  error?: string;
}

/** A batch of documents as the server groups them, summarised or not. */
export interface DocumentBatch {
  key: string;
  scope: 'pack' | 'document';
  packId?: string;
  title: string;
  documentDate: string;
  documentCount: number;
  hasSummary: boolean;
}

export interface DocumentSummariesResponse {
  success: boolean;
  summaries: DocumentSummary[];
  batches: DocumentBatch[];
  /** Server's answer to "may this user rewrite a summary" — super admin only. */
  canEdit: boolean;
  /** Whether this user may spend AI budget generating summaries. */
  canGenerate: boolean;
}

/** The editable fields of a summary. */
export interface SummaryEditDraft {
  headline: string;
  summary: string;
  highlights: string[];
  followUps: string[];
}
