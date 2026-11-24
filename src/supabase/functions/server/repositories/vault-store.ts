/**
 * Storage for everything around the logins: services, skills, AI agent
 * connections, approvals, activity and unlock state. Secrets never live here —
 * only hashes of tokens and references to vault entries.
 */
import type {
  Service,
  Skill,
  VaultApproval,
  VaultConnection,
  VaultEvent,
} from '../../../../shared/password-manager.ts';
import { createKvRepository } from './kv-repository.ts';
import { db } from './password-vault.ts';

const TABLE = 'kv_store_91ed8379';

export interface StoredConnection extends VaultConnection {
  secretHash: string;
  tokenHash: string;
  tokenExpires: number;
}
export interface StoredApproval extends VaultApproval {
  revision: string;
}
export interface UnlockRecord {
  lastActive: number;
}
export interface VaultSettings {
  aiPaused: boolean;
}

export const connections = createKvRepository<StoredConnection>('pvault-connection:');
export const services = createKvRepository<Service>('pvault-service:');
export const skills = createKvRepository<Skill>('pvault-skill:');
export const approvals = createKvRepository<StoredApproval>('pvault-approval:');
export const events = createKvRepository<VaultEvent>('pvault-event:');
export const unlocks = createKvRepository<UnlockRecord>('pvault-unlock:');
export const settings = createKvRepository<VaultSettings>('pvault-settings:');

/**
 * Compare-and-set on any KV row whose value carries `field`. Returns false when
 * another writer got there first, so callers re-read instead of overwriting.
 */
export async function compareAndSet(
  key: string,
  value: unknown,
  field: string,
  expected: string,
): Promise<boolean> {
  const { data, error } = await db()
    .from(TABLE)
    .update({ value })
    .eq('key', key)
    .eq('value->>' + field, expected)
    .select('key');
  if (error) throw new Error('Password vault update failed');
  return Boolean(data?.length);
}

export async function isAiPaused() {
  return (await settings.get('global'))?.aiPaused ?? false;
}
