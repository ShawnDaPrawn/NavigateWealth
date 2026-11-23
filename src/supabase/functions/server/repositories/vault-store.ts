/**
 * Storage for the AI side of the password manager: connections, workflows,
 * runs, approvals, activity and unlock state. Secrets never live here — only
 * hashes of tokens and references to vault entries.
 */
import type {
  VaultApproval,
  VaultConnection,
  VaultEvent,
  VaultRun,
  VaultWorkflow,
  WorkflowInput,
} from '../../../../shared/password-manager.ts';
import { createKvRepository } from './kv-repository.ts';
import { db } from './password-vault.ts';

const TABLE = 'kv_store_91ed8379';

export interface StoredConnection extends VaultConnection {
  secretHash: string;
  tokenHash: string;
  tokenExpires: number;
}
export interface StoredRun extends VaultRun {
  revision: string;
  /** Hash of workflow + inputs, for the duplicate check. */
  signature: string;
  requestId: string;
  /** Checkpoint steps a person has already approved. */
  approvedSteps: number[];
  /** When a held money move may be submitted. */
  holdUntil: string | null;
}
export interface StoredApproval extends VaultApproval {
  revision: string;
}
export type StoredWorkflow = VaultWorkflow;
export interface WorkflowSnapshot extends WorkflowInput {
  version: number;
  publishedAt: string;
  publishedBy: string;
}
export interface UnlockRecord {
  lastActive: number;
}
export interface VaultSettings {
  aiPaused: boolean;
}

export const connections = createKvRepository<StoredConnection>('pvault-connection:');
export const workflows = createKvRepository<StoredWorkflow>('pvault-workflow:');
export const workflowVersions = createKvRepository<WorkflowSnapshot>('pvault-workflow-version:');
export const runs = createKvRepository<StoredRun>('pvault-run:');
export const approvals = createKvRepository<StoredApproval>('pvault-approval:');
export const events = createKvRepository<VaultEvent>('pvault-event:');
export const unlocks = createKvRepository<UnlockRecord>('pvault-unlock:');
export const settings = createKvRepository<VaultSettings>('pvault-settings:');
export const ownerHistory = createKvRepository<{ secret: unknown; keyRef?: string; until: number }>(
  'pvault-previous:',
);

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

export const versionKey = (workflowId: string, version: number) =>
  workflowId + ':' + String(version).padStart(6, '0');

export async function isAiPaused() {
  return (await settings.get('global'))?.aiPaused ?? false;
}
