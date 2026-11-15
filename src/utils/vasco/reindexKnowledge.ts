/**
 * Walk POST /vasco/index until the rebuild finishes.
 *
 * Embedding every published article in one Edge Function invocation exceeds
 * the 2s CPU limit and the platform answers 546 before our code can. Each
 * request now indexes one page. A server that does not send `done: false`
 * (the previous one-shot rebuild) is treated as already finished, so an old
 * response shape still completes in a single call.
 */

export interface ReindexBatchResult {
  articlesIndexed: number;
  kbEntriesIndexed: number;
  totalChunks: number;
  errors: string[];
  durationMs: number;
  done?: boolean;
  nextCursor?: string | null;
}

const MAX_STEPS = 500;

export async function reindexKnowledge(
  post: (cursor: string | null) => Promise<Partial<ReindexBatchResult> | null | undefined>,
): Promise<ReindexBatchResult> {
  const totals: ReindexBatchResult = {
    articlesIndexed: 0,
    kbEntriesIndexed: 0,
    totalChunks: 0,
    errors: [],
    durationMs: 0,
  };
  let cursor: string | null = null;
  const seen = new Set<string>();

  for (let step = 0; step < MAX_STEPS; step++) {
    const key = cursor ?? '';
    if (seen.has(key)) {
      totals.errors.push('Reindex stopped because the server repeated a cursor.');
      return totals;
    }
    seen.add(key);

    const batch: Partial<ReindexBatchResult> = (await post(cursor)) ?? {};
    totals.articlesIndexed += batch.articlesIndexed ?? 0;
    totals.kbEntriesIndexed += batch.kbEntriesIndexed ?? 0;
    totals.totalChunks += batch.totalChunks ?? 0;
    totals.durationMs += batch.durationMs ?? 0;
    if (batch.errors?.length) totals.errors.push(...batch.errors);

    if (batch.done !== false || !batch.nextCursor) return totals;
    cursor = batch.nextCursor;
  }

  totals.errors.push('Reindex stopped after the step limit.');
  return totals;
}
