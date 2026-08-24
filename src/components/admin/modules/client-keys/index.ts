/**
 * client-keys module — public API.
 *
 * The KV store of derived per-client values (total life cover, medical aid
 * premium, retirement contribution, …) calculated from a client's policies.
 *
 * This was living inside client-management, which meant risk-planning-fna and
 * medical-fna had to reach into that module's api.ts and hooks/ to read a
 * client's keys. Three feature modules consume this data and none of them owns
 * it, so it is its own module.
 */
export { clientKeysApi } from './api';
export { useClientKeys, useRecalculateClientKeys, useClientKeyHistory } from './hooks';
export type { ClientKeyValue, ClientKeysResponse, ContributingPolicy } from './types';
