import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createKvRepository } from './kv-repository.ts';
import type {
  Broker,
  Workflow,
  PortalRun,
  ConnectionInfo,
  PortalProfile,
  PortalCheckpoint,
} from '../../../../shared/broker-operations.ts';
export interface Client extends ConnectionInfo {
  secretHash: string;
  tokenHash: string;
  tokenExpires: number;
}
export interface StoredRun extends PortalRun {
  workflow: Workflow;
  homeUrl: string;
  identity: string;
  loginUrl: string;
  lease: string;
  revision: string;
  mfaPrompt: string;
}
export interface Grant {
  clientId: string;
  redirectUri: string;
  challenge: string;
  expires: number;
  resource: string;
}
export const brokers = createKvRepository<Broker>('broker-ops:broker:');
export const workflows = createKvRepository<Workflow>('broker-ops:workflow:');
export const clients = createKvRepository<Client>('broker-ops:client:');
export const runs = createKvRepository<StoredRun>('broker-ops:run:');
export const checkpoints = createKvRepository<PortalCheckpoint>('broker-ops:checkpoint:');
export const grants = createKvRepository<Grant>('broker-ops:grant:');
export const db = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const table = 'kv_store_91ed8379';
export type Batch = { id: string; actor: string; signature: string; ids: string[] };
export const batches = createKvRepository<Batch>('broker-ops:batch:');
export async function createRuns(batch: Batch, rows: StoredRun[]) {
  const { error } = await db()
    .from(table)
    .insert([
      { key: batches.key(batch.id), value: batch },
      ...rows.map((row) => ({ key: runs.key(row.id), value: row })),
    ]);
  if (error && error.code !== '23505') throw new Error('Could not queue runs');
  return !error;
}
export async function changeRun(row: StoredRun, patch: Partial<StoredRun>) {
  const next = {
    ...row,
    ...patch,
    updatedAt: new Date().toISOString(),
    revision: crypto.randomUUID(),
  };
  const { data, error } = await db()
    .from(table)
    .update({ value: next })
    .eq('key', runs.key(row.id))
    .eq('value->>revision', row.revision)
    .select('key');
  if (error) throw new Error('Could not update run');
  return data?.length ? next : null;
}
export async function takeGrant(id: string) {
  const { data, error } = await db()
    .from(table)
    .delete()
    .eq('key', grants.key(id))
    .select('value')
    .maybeSingle();
  if (error) throw new Error('Could not redeem authorization');
  return data?.value as Grant | undefined;
}
export async function updateClient(row: Client, patch: Partial<Client>) {
  const { data, error } = await db()
    .from(table)
    .update({ value: { ...row, ...patch } })
    .eq('key', clients.key(row.id))
    .eq('value->>tokenHash', row.tokenHash)
    .select('key');
  if (error) throw new Error('Could not update connection');
  return !!data?.length;
}
export async function latestRuns(brokerId?: string, month?: string, page = 0) {
  let query = db().from(table).select('value').like('key', 'broker-ops:run:%');
  if (brokerId) query = query.eq('value->>brokerId', brokerId);
  if (month) query = query.eq('value->>month', month);
  const { data, error } = await query
    .order('value->>createdAt', { ascending: false })
    .order('key', { ascending: true })
    .range(page * 50, page * 50 + 49);
  if (error) throw new Error('Could not list runs');
  return (data ?? []).map((row: { value: StoredRun }) => publicRun(row.value));
}
export function publicRun(row: StoredRun): PortalRun {
  const {
    id,
    batchId,
    actor,
    accountId,
    accountName,
    brokerId,
    brokerName,
    code,
    provider,
    workflowId,
    workflowName,
    kind,
    month,
    state,
    message,
    createdAt,
    updatedAt,
    deadline,
    verifiedIdentity,
    verifiedAt,
    document,
  } = row;
  const run = {
    id,
    batchId,
    actor,
    accountId,
    accountName,
    brokerId,
    brokerName,
    code,
    provider,
    workflowId,
    workflowName,
    kind,
    month,
    state,
    message,
    createdAt,
    updatedAt,
    deadline,
    verifiedIdentity,
    verifiedAt,
    document,
  };
  if (active(run.state) && run.deadline <= Date.now())
    return { ...run, state: 'failed', message: 'Runner timed out. Retry this broker.' };
  return run;
}
export const active = (state: PortalRun['state']) =>
  ['queued', 'running', 'awaiting_mfa'].includes(state);
export function clientInfo(row: Client): ConnectionInfo {
  return {
    id: row.id,
    name: row.name,
    redirectUri: row.redirectUri,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastUsed: row.lastUsed,
  };
}
export async function verifyBrokerLinks(p: PortalProfile) {
  return (await Promise.all(p.brokers.map((b) => brokers.get(b.brokerId)))).every(Boolean);
}

export async function accountHistory(accountId: string) {
  const base = () =>
    db()
      .from(table)
      .select('value')
      .like('key', 'broker-ops:run:%')
      .eq('value->>accountId', accountId);
  const [verified, completed] = await Promise.all([
    base()
      .not('value->>verifiedAt', 'is', null)
      .order('value->>verifiedAt', { ascending: false })
      .limit(1)
      .maybeSingle(),
    base()
      .eq('value->>state', 'completed')
      .eq('value->>kind', 'monthly_statement')
      .order('value->>updatedAt', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (verified.error || completed.error) throw new Error('Could not load account history');
  return {
    lastVerified: (verified.data?.value as StoredRun | undefined)?.verifiedAt ?? null,
    lastReport: (completed.data?.value as StoredRun | undefined)?.updatedAt ?? null,
  };
}
