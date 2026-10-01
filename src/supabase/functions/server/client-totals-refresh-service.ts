/**
 * Client totals refresh — bringing a client's profile up to date after a
 * policy was written straight into the database.
 *
 * The totals a client's profile shows (`user_profile:{clientId}:client_keys`)
 * are derived from their policies by `recalculateClientTotals`, which every
 * app path that writes policies already calls. An external agent that writes
 * `policies:client:{clientId}` through the Supabase connector calls nothing,
 * so the migration `client_totals_refresh` marks that client stale and wakes
 * this worker, which runs the same recalculation. The owner's rule is that an
 * agent's update applies with no further action or approval
 * (docs/ROADMAP.md §9a), and this is the part that makes the profile follow.
 * See docs/runbooks/client-totals-refresh.md.
 *
 * A run keeps going until nothing is stale or `TOTALS_RUN_BUDGET_MS` is spent,
 * so a burst of writes needs one wake-up. Whatever is left is picked up by
 * the next wake-up or the 2-minute sweep.
 */
import { createModuleLogger } from './stderr-logger.ts';
import { recalculateClientTotals } from './integrations-derive.ts';
import {
  listStaleClients,
  markClientTotalsRefreshed,
} from './repositories/client-totals-refresh-repository.ts';

const log = createModuleLogger('client-totals-refresh');

/** Stale clients fetched per round trip. */
export const TOTALS_BATCH_SIZE = 25;

/** No new client is started once a run has taken this long. */
export const TOTALS_RUN_BUDGET_MS = 40_000;

export interface TotalsRefreshResult {
  /** Recalculations run, a client written to twice in one run counting twice. */
  refreshed: number;
  /** Clients a newer write left stale, for the next pass. */
  stillStale: number;
  clientIds: string[];
}

/** Recalculate the totals of every stale client, within the run's budget. */
export async function refreshStaleClientTotals(
  options: { budgetMs?: number; batchSize?: number; now?: () => number } = {},
): Promise<TotalsRefreshResult> {
  const budgetMs = options.budgetMs ?? TOTALS_RUN_BUDGET_MS;
  const batchSize = options.batchSize ?? TOTALS_BATCH_SIZE;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const result: TotalsRefreshResult = { refreshed: 0, stillStale: 0, clientIds: [] };
  // The counter each client was last recalculated at in this run, so a client
  // whose report did not take is not recalculated again and again.
  const seen = new Map<string, number>();

  const withinBudget = () => now() - startedAt < budgetMs;

  while (withinBudget()) {
    const batch = (await listStaleClients(batchSize)).filter(
      (client) => (seen.get(client.clientId) ?? -1) < client.dirtySeq,
    );
    if (batch.length === 0) break;

    for (const client of batch) {
      if (!withinBudget()) break;
      await recalculateClientTotals(client.clientId);
      seen.set(client.clientId, client.dirtySeq);
      result.refreshed++;
      if (!result.clientIds.includes(client.clientId)) result.clientIds.push(client.clientId);
      const upToDate = await markClientTotalsRefreshed(client);
      if (!upToDate) result.stillStale++;
    }
  }

  if (result.refreshed > 0) {
    log.info('Client totals refreshed after direct policy writes', {
      refreshed: result.refreshed,
      clients: result.clientIds.length,
      stillStale: result.stillStale,
    });
  }
  return result;
}
