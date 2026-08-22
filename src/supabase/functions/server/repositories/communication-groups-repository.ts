/**
 * Communication groups repository (Stage B seed)
 * =============================================
 *
 * The first concrete repository, chosen because `provider-group-service.ts` is
 * self-contained, already typed against `Group`, has test coverage, and its
 * `kv.getByPrefix(GROUP_KV_PREFIX)` is one of the 278 unbounded scans this
 * layer exists to make visible.
 *
 * The key strings live here rather than in the service, so the namespace has
 * exactly one definition.
 */

import type { Group } from '../communication-types.ts';
import { createKvRepository } from './kv-repository.ts';

/** Namespace for all communication groups, auto-generated or hand-made. */
export const GROUP_NAMESPACE = 'communication:groups:';

/** Last-sync marker for the auto provider-group job. Not part of the namespace. */
export const LAST_PROVIDER_SYNC_KEY = 'communication:auto_provider_groups:last_sync';

export const communicationGroups = createKvRepository<Group>(GROUP_NAMESPACE);
