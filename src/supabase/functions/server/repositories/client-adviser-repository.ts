/**
 * Client adviser assignment repository
 * ====================================
 *
 * A client's assigned adviser lives on their profile record,
 * `user_profile:{clientId}:personal_info`, as `adviserId` (and, on older
 * records, `personalInformation.adviserId`). That is what
 * `fna-intake-adviser-resolver.ts` and `client-access.ts` read, and what the
 * Personnel › Client book lists. This repository is the typed way to read and
 * write that one record for the bulk reassignment; other code still reaches
 * the profile directly and is not migrated here.
 */

import { createKvRepository } from './kv-repository.ts';
import type { PersonnelProfile } from '../client-management-personnel-types.ts';

/** The fields of a client profile record this repository reads or changes. */
export interface ClientProfileRecord {
  adviserId?: string;
  adviserAssigned?: boolean;
  personalInformation?: { adviserId?: string; [key: string]: unknown };
  updatedAt?: string;
  [key: string]: unknown;
}

/** Profiles share the `user_profile:` namespace with other facets; the id carries the facet. */
const PROFILE_NAMESPACE = 'user_profile:';
export const clientProfileId = (clientId: string) => `${clientId}:personal_info`;

export const clientProfiles = createKvRepository<ClientProfileRecord>(PROFILE_NAMESPACE);

/** Staff records (`personnel:profile:{id}`), read to check a reassignment's target. */
export const personnelProfiles = createKvRepository<PersonnelProfile>('personnel:profile:');
