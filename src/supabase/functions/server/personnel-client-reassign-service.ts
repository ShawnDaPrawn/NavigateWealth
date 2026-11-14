/**
 * Bulk reassignment of a staff member's client book (Personnel › Client book).
 *
 * Moves the chosen clients from one adviser to another by rewriting the same
 * field a client's assignment is stored in today: `adviserId` on
 * `user_profile:{clientId}:personal_info` (plus the legacy
 * `personalInformation.adviserId` when a record carries it). A client is only
 * moved if it is currently assigned to the source adviser, so a stale list in
 * the browser cannot take a client away from someone else.
 */

import {
  clientProfileId,
  clientProfiles,
  personnelProfiles,
} from './repositories/client-adviser-repository.ts';
import type { ClientProfileRecord } from './repositories/client-adviser-repository.ts';
import { canHoldClientBook } from './client-access.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('personnel-client-reassign');

/** One request moves at most this many clients (every id goes into one mget URL). */
export const MAX_REASSIGN_BATCH = 200;

export type ReassignSkipReason = 'not_found' | 'not_assigned';

export interface ReassignResult {
  reassigned: string[];
  skipped: Array<{ clientId: string; reason: ReassignSkipReason }>;
}

export class ReassignError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404,
  ) {
    super(message);
  }
}

/** The adviser a profile record is assigned to, wherever the record keeps it. */
export function currentAdviserId(profile: ClientProfileRecord): string | null {
  if (typeof profile.adviserId === 'string' && profile.adviserId) return profile.adviserId;
  const legacy = profile.personalInformation?.adviserId;
  return typeof legacy === 'string' && legacy ? legacy : null;
}

export async function reassignClients(
  fromId: string,
  toId: string,
  clientIds: string[],
  now: Date = new Date(),
): Promise<ReassignResult> {
  if (fromId === toId) throw new ReassignError('Choose a different staff member', 400);
  const ids = [...new Set(clientIds)];
  if (ids.length === 0) throw new ReassignError('Select at least one client', 400);
  if (ids.length > MAX_REASSIGN_BATCH) {
    throw new ReassignError(`Reassign at most ${MAX_REASSIGN_BATCH} clients at a time`, 400);
  }

  const [source, target] = await personnelProfiles.getMany([fromId, toId]);
  if (!source) throw new ReassignError('Staff member not found', 404);
  if (!target) throw new ReassignError('The staff member to reassign to was not found', 404);
  if (target.status !== 'active') {
    throw new ReassignError('Clients can only move to an active staff member', 400);
  }
  if (!canHoldClientBook(target.role)) {
    throw new ReassignError('Clients can only move to an adviser or an admin', 400);
  }

  const profiles = await clientProfiles.getMany(ids.map(clientProfileId));
  const updatedAt = now.toISOString();
  const writes: Array<readonly [string, ClientProfileRecord]> = [];
  const result: ReassignResult = { reassigned: [], skipped: [] };

  ids.forEach((clientId, i) => {
    const profile = profiles[i];
    if (!profile) {
      result.skipped.push({ clientId, reason: 'not_found' });
      return;
    }
    if (currentAdviserId(profile) !== fromId) {
      result.skipped.push({ clientId, reason: 'not_assigned' });
      return;
    }
    const next: ClientProfileRecord = {
      ...profile,
      adviserId: toId,
      adviserAssigned: true,
      updatedAt,
    };
    if (profile.personalInformation && 'adviserId' in profile.personalInformation) {
      next.personalInformation = { ...profile.personalInformation, adviserId: toId };
    }
    writes.push([clientProfileId(clientId), next]);
    result.reassigned.push(clientId);
  });

  await clientProfiles.putMany(writes);
  log.info('Reassigned clients', {
    moved: result.reassigned.length,
    skipped: result.skipped.length,
  });
  return result;
}
