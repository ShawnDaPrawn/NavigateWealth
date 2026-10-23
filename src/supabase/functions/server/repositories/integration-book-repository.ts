/**
 * Integration book repository
 * ===========================
 *
 * The KV namespaces the portfolio table reads and writes, typed once so the
 * new code does not reach past the layer into `kv_store` the way the older
 * integrations modules do — the `kv-direct-access` ratchet exists to stop
 * exactly that, and new code has no excuse to add to the pile.
 *
 * Every namespace here already existed; this file gives each one a name and a
 * shape rather than a template literal repeated at every call site.
 */

import * as kv from '../kv_store.tsx';
import { createKvRepository } from './kv-repository.ts';
import type {
  IntegrationConfig,
  IntegrationSyncRun,
  UploadHistory,
} from '../integrations-core-types.ts';
import type { KvPolicy } from '../integrations-types.ts';

/**
 * The firm-wide field mapping for one provider + product category. The id is
 * `${providerId}:${categoryId}`.
 */
export const INTEGRATION_CONFIG_NAMESPACE = 'config:mapping:';

export const integrationConfigs = createKvRepository<IntegrationConfig>(
  INTEGRATION_CONFIG_NAMESPACE,
);

/** A staged or published sync run, keyed by run id. */
export const SYNC_RUN_NAMESPACE = 'sync-run:';

export const syncRuns = createKvRepository<IntegrationSyncRun>(SYNC_RUN_NAMESPACE);

/** One client's policies — an ARRAY per client, keyed by client id. */
export const CLIENT_POLICIES_NAMESPACE = 'policies:client:';

export const clientPolicies = createKvRepository<KvPolicy[]>(CLIENT_POLICIES_NAMESPACE);

/**
 * Client profiles. The row for a client sits at `user_profile:<id>:personal_info`,
 * so the repository id is `${clientId}:personal_info` — see {@link profileId}.
 */
export const CLIENT_PROFILE_NAMESPACE = 'user_profile:';

export const clientProfiles = createKvRepository<Record<string, unknown>>(CLIENT_PROFILE_NAMESPACE);

export function profileId(clientId: string): string {
  return `${clientId}:personal_info`;
}

/**
 * Keys per `getMany` call. `kv.mget` filters with PostgREST's `in.(...)`,
 * which travels in the request URL, so one call cannot carry an unbounded
 * key list (the same bound `kv-batch.ts` applies).
 */
const PROFILE_BATCH = 200;

/** Client profiles for many ids at once, keyed by client id; missing rows are absent. */
export async function getClientProfiles(
  clientIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const unique = [...new Set(clientIds.filter(Boolean))];
  const byId = new Map<string, Record<string, unknown>>();
  for (let start = 0; start < unique.length; start += PROFILE_BATCH) {
    const batch = unique.slice(start, start + PROFILE_BATCH);
    const rows = await clientProfiles.getMany(batch.map(profileId));
    batch.forEach((id, index) => {
      const row = rows[index];
      if (row) byId.set(id, row);
    });
  }
  return byId;
}

/**
 * Record an upload/sync in the provider + category history the Integrations
 * header reads its "last sync" from.
 *
 * Same key shape as `integrations-upload-routes.ts`: the entry id is in the
 * key because `Date.now()` is only millisecond-resolution and `kv.set`
 * upserts. The reader prefix-scans `history:{providerId}:{categoryId}` and
 * sorts by `uploadedAt`, not by the key.
 */
export async function recordUploadHistory(entry: UploadHistory): Promise<void> {
  await kv.set(`history:${entry.providerId}:${entry.categoryId}:${Date.now()}:${entry.id}`, entry);
}
