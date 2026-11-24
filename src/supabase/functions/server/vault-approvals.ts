/**
 * Requests that wait for a person. They exist only when a connection's own
 * autonomy settings ask for one; under Full autonomy none are created.
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
  fields: Pick<
    VaultApproval,
    'action' | 'credentialId' | 'credentialName' | 'workflowId' | 'runId' | 'reason' | 'detail'
  >,
  ttlMinutes: number,
): Promise<StoredApproval> {
  const now = Date.now();
  const row: StoredApproval = {
    ...fields,
    id: crypto.randomUUID(),
    revision: crypto.randomUUID(),
    connectionId: conn.id,
    connectionName: conn.name,
    personName: conn.personName,
    requiredApprovals: conn.autonomy.approver === 'two_people' ? 2 : 1,
    approvals: [],
    state: 'pending',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMinutes * 60000).toISOString(),
  };
  await approvals.put(row.id, row);
  return row;
}

/** Whether `userId` may decide this approval as the connection's own person. */
export function ownerMayDecide(conn: StoredConnection | null, userId: string) {
  return Boolean(conn && conn.personUserId === userId && conn.autonomy.approver !== 'any_super');
}

export async function decide(
  id: string,
  userId: string,
  decision: 'approve' | 'deny',
): Promise<StoredApproval | 'not_found' | 'closed' | 'already'> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await approvals.get(id);
    if (!row) return 'not_found';
    const now = current(row);
    if (now.state !== 'pending') return 'closed';
    if (row.approvals.some((a) => a.userId === userId)) return 'already';
    const nextApprovals =
      decision === 'approve'
        ? [...row.approvals, { userId, at: new Date().toISOString() }]
        : row.approvals;
    const next: StoredApproval = {
      ...row,
      approvals: nextApprovals,
      state:
        decision === 'deny'
          ? 'denied'
          : nextApprovals.length >= row.requiredApprovals
            ? 'approved'
            : 'pending',
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
