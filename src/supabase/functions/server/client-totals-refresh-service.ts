/**
 * Client totals refresh — bringing a client's profile up to date after a
 * policy was written straight into the database.
 *
 * The totals a client's profile shows (`user_profile:{clientId}:client_keys`)
 * are derived from their policies by `recalculateClientTotals`, which every
 * app path that writes policies already calls. An external agent that writes
 * `policies:client:{clientId}` through the Supabase connector calls nothing,
 * so the migration `client_totals_refresh` marks that client stale and wakes
 * this worker, which works out the same totals. The owner's rule is that an
 * agent's update applies with no further action or approval
 * (docs/ROADMAP.md §9a), and this is the part that makes the profile follow.
 * See docs/runbooks/client-totals-refresh.md.
 *
 * One client at a time, under a claim from the database, so overlapping runs
 * never work on the same client. The totals are worked out from the policies
 * the claim returned (`computeClientTotals`, which raises rather than logs),
 * and the database stores them only while the claim stands and the policies
 * are unchanged: an older run can never store its totals over a newer one. A
 * failure is recorded and the client backed off; it is never reported done.
 *
 * A run keeps going until nothing is stale or `TOTALS_RUN_BUDGET_MS` is spent,
 * so a burst of writes needs one wake-up. Whatever is left is picked up by
 * the next wake-up or the 2-minute sweep.
 */
import { createModuleLogger } from './stderr-logger.ts';
import { computeClientTotals } from './integrations-derive.ts';
import {
  claimStaleClient,
  failClientTotalsRefresh,
  writeClientTotals,
  type ClaimedClient,
  type TotalsWriteOutcome,
} from './repositories/client-totals-refresh-repository.ts';

const log = createModuleLogger('client-totals-refresh');

/** No new client is started once a run has taken this long. */
export const TOTALS_RUN_BUDGET_MS = 40_000;

/**
 * A client taken more often than this in one run is backed off and the run
 * ends: something is rewriting its policies faster than they can be totalled,
 * or the database is not keeping what this worker stores.
 */
export const TOTALS_MAX_TAKES_PER_CLIENT = 3;

export interface TotalsRefreshResult {
  /** Totals stored, a client stored twice in one run counting twice. */
  refreshed: number;
  /** Of those, stored while a newer write was already waiting; it is taken next. */
  stillStale: number;
  /** Not stored: the policies changed after they were read. Taken again with the new ones. */
  superseded: number;
  /** Recorded as failed; the client is retried after a back-off. */
  failed: number;
  /** This run's claim was gone when it reported back: it lapsed and another run took over. */
  lost: number;
  /** Clients whose totals were stored. */
  clientIds: string[];
}

/** Bring every stale client's totals up to date, within the run's budget. */
export async function refreshStaleClientTotals(
  options: { budgetMs?: number; now?: () => number } = {},
): Promise<TotalsRefreshResult> {
  const budgetMs = options.budgetMs ?? TOTALS_RUN_BUDGET_MS;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const result: TotalsRefreshResult = {
    refreshed: 0,
    stillStale: 0,
    superseded: 0,
    failed: 0,
    lost: 0,
    clientIds: [],
  };
  const takes = new Map<string, number>();

  while (now() - startedAt < budgetMs) {
    const claim = await claimStaleClient();
    if (!claim) break;

    const taken = (takes.get(claim.clientId) ?? 0) + 1;
    takes.set(claim.clientId, taken);
    if (taken > TOTALS_MAX_TAKES_PER_CLIENT) {
      await recordFailure(
        claim,
        `taken ${TOTALS_MAX_TAKES_PER_CLIENT} times in one run without settling`,
        result,
      );
      break;
    }

    let totals: Record<string, number>;
    try {
      totals = await computeClientTotals(claim.policies ?? []);
    } catch (error) {
      await recordFailure(claim, `could not work out the totals: ${messageOf(error)}`, result);
      continue;
    }

    let outcome: TotalsWriteOutcome;
    try {
      outcome = await writeClientTotals(claim, totals);
    } catch (error) {
      // Whether the write landed is unknown. If it did, the claim went with
      // it, and this records nothing.
      await recordFailure(claim, `could not store the totals: ${messageOf(error)}`, result);
      continue;
    }

    switch (outcome) {
      case 'refreshed':
      case 'stale':
        result.refreshed++;
        if (outcome === 'stale') result.stillStale++;
        if (!result.clientIds.includes(claim.clientId)) result.clientIds.push(claim.clientId);
        break;
      case 'superseded':
        result.superseded++;
        break;
      case 'lost':
        result.lost++;
        break;
    }
  }

  if (result.refreshed + result.superseded + result.failed + result.lost > 0) {
    log.info('Client totals refreshed after direct policy writes', {
      refreshed: result.refreshed,
      clients: result.clientIds.length,
      stillStale: result.stillStale,
      superseded: result.superseded,
      failed: result.failed,
      lost: result.lost,
    });
  }
  return result;
}

/** Record a failure under the claim: the client is released and backed off. */
async function recordFailure(
  claim: ClaimedClient,
  reason: string,
  result: TotalsRefreshResult,
): Promise<void> {
  log.error('Client totals refresh failed; the client is retried after a back-off', reason, {
    clientId: claim.clientId,
  });
  if (await failClientTotalsRefresh(claim, reason)) {
    result.failed++;
  } else {
    result.lost++;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
