/**
 * Password requests that wait for a person: an agent asked for a password or
 * one-time code, and the login or the agent is set to "ask". A super admin
 * approves or denies it under Activity; an approval is used once.
 */
import type { VaultApproval } from '../../../shared/password-manager.ts';
import {
  approvals,
  compareAndSet,
  type StoredApproval,
  type StoredConnection,
} from './repositories/vault-store.ts';

export function current(a: StoredApproval): StoredApproval {
  return a.state === 'pending' && Date.parse(a.expiresAt) <= Date.now()
    ? { ...a, state: 'expired' }
    : a;
}

export function publicApproval(row: StoredApproval): VaultApproval {
  const { revision: _r, ...rest } = current(row);
  return rest;
}

export async function requestApproval(
  conn: StoredConnection,
  fields: Pick<VaultApproval, 'action' | 'credentialId' | 'credentialName' | 'reason'>,
  ttlMinutes: number,
): Promise<StoredApproval> {
  const now = Date.now();
  const row: StoredApproval = {
    ...fields,
    id: crypto.randomUUID(),
    revision: crypto.randomUUID(),
    connectionId: conn.id,
    connectionName: conn.name,
    state: 'pending',
    decidedBy: null,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMinutes * 60000).toISOString(),
  };
  await approvals.put(row.id, row);
  return row;
}

export async function decide(
  id: string,
  decidedBy: string,
  decision: 'approve' | 'deny',
): Promise<StoredApproval | 'not_found' | 'closed'> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await approvals.get(id);
    if (!row) return 'not_found';
    if (current(row).state !== 'pending') return 'closed';
    const next: StoredApproval = {
      ...row,
      state: decision === 'approve' ? 'approved' : 'denied',
      decidedBy,
      revision: crypto.randomUUID(),
    };
    if (await compareAndSet(approvals.key(id), next, 'revision', row.revision)) return next;
  }
  throw new Error('This request is busy. Try again.');
}

/** Use an approved request exactly once, for exactly what it approved. */
export async function consume(
  id: string,
  match: { connectionId: string; credentialId: string; action: VaultApproval['action'] },
) {
  const row = await approvals.get(id);
  if (
    !row ||
    current(row).state !== 'approved' ||
    row.connectionId !== match.connectionId ||
    row.credentialId !== match.credentialId ||
    row.action !== match.action
  )
    return false;
  return compareAndSet(
    approvals.key(id),
    { ...row, state: 'consumed', revision: crypto.randomUUID() },
    'revision',
    row.revision,
  );
}

export async function listApprovals(state: 'pending' | 'all') {
  const rows = (await approvals.listAll('password vault: approvals queue')).map(publicApproval);
  return rows
    .filter((a) => state === 'all' || a.state === 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 200);
}
