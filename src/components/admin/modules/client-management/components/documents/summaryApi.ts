/**
 * Client document AI summary — API calls.
 *
 * Every call goes through the centralised `api` client (Guidelines §5.3 — no
 * raw fetch in components).
 */

import { api } from '../../../../../../utils/api';
import type { DocumentSummariesResponse, DocumentSummary, SummaryEditDraft } from './summaryTypes';

const BASE = 'client-document-summaries';

export const documentSummaryApi = {
  /**
   * The client's timeline plus the batches that still have no summary.
   *
   * Named `list` rather than `fetch` on purpose: the raw-fetch ratchet matches
   * `\bfetch(`, so a method called `fetch` reads at every call site as a raw
   * network call the shared client was meant to replace.
   */
  list: (clientId: string): Promise<DocumentSummariesResponse> =>
    api.get<DocumentSummariesResponse>(`/${BASE}/${clientId}`),

  /**
   * Summarise one batch.
   *
   * `force` re-runs the model over a batch that already has a summary and is
   * rejected by the server for anyone but a super admin.
   */
  generate: (
    clientId: string,
    target: { packId?: string; documentId?: string },
    force = false,
  ): Promise<{ success: boolean; summary: DocumentSummary; created: boolean }> =>
    api.post<{ success: boolean; summary: DocumentSummary; created: boolean }>(
      `/${BASE}/${clientId}/generate`,
      { ...target, force },
    ),

  /** Super admin only — the server enforces it. */
  update: (
    clientId: string,
    summaryId: string,
    edit: Partial<SummaryEditDraft>,
  ): Promise<{ success: boolean; summary: DocumentSummary }> =>
    api.patch<{ success: boolean; summary: DocumentSummary }>(
      `/${BASE}/${clientId}/${summaryId}`,
      edit,
    ),

  /** Super admin only — the server enforces it. */
  remove: (clientId: string, summaryId: string): Promise<{ success: boolean }> =>
    api.delete<{ success: boolean }>(`/${BASE}/${clientId}/${summaryId}`),
};

/**
 * Turn a batch key back into the target the generate endpoint expects.
 *
 * Batch keys are derived server-side (`pack_<packId>` / `doc_<documentId>`),
 * so this is the inverse of that derivation rather than a second convention.
 */
export function targetForBatchKey(key: string): { packId?: string; documentId?: string } {
  if (key.startsWith('pack_')) return { packId: key.slice('pack_'.length) };
  return { documentId: key.slice('doc_'.length) };
}
