/**
 * The super admin password manager's REST calls, typed from the shared
 * contract (`src/shared/password-manager.ts`). Every vault call goes through
 * `guard`, so a 423 `VAULT_LOCKED` answer anywhere sends the workspace back
 * to its unlock gate.
 */
import { api } from '../../../utils/api/client';
import { SECURITY_API_ENDPOINTS } from '../../../utils/auth/securityConstants';
import type {
  Collection,
  CollectionInput,
  ConnectionInput,
  ConnectionPatch,
  CredentialInput,
  EventPage,
  IssuedConnection,
  OneTimeCode,
  OwnedLogin,
  OwnedLoginInput,
  RevealedCredential,
  TrustSuggestion,
  VaultApproval,
  VaultConnection,
  VaultEventActor,
  VaultLockState,
  VaultPage,
  VaultRun,
  VaultSummary,
  VaultWorkflow,
  WorkflowInput,
  WorkflowVersion,
} from '../../../shared/password-manager';

export const vaultPath = '/password-vault';
export const minePath = '/password-vault-mine';
export const request = { retryTransientFailures: false, cache: 'no-store' } as const;

const lockListeners = new Set<() => void>();

/** Runs `listener` whenever a vault call answers that the vault is locked. */
export function onVaultLocked(listener: () => void): () => void {
  lockListeners.add(listener);
  return () => {
    lockListeners.delete(listener);
  };
}

export function isVaultLocked(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { statusCode?: unknown; code?: unknown };
  return e.statusCode === 423 || e.code === 'VAULT_LOCKED';
}

export function errorMessage(error: unknown, fallback = 'Request failed. Try again.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function guard<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (isVaultLocked(error)) lockListeners.forEach((listener) => listener());
    throw error;
  }
}

const get = <T>(path: string) => guard(api.get<T>(vaultPath + path, request));
const post = <T>(path: string, body: unknown = {}) =>
  guard(api.post<T>(vaultPath + path, body, request));
const put = <T>(path: string, body: unknown) => guard(api.put<T>(vaultPath + path, body, request));
const remove = <T>(path: string) => guard(api.delete<T>(vaultPath + path, request));

/** Lists may come back bare or wrapped as `{ items }`; accept either. */
type Listed<T> = T[] | { items?: T[] } | null | undefined;
function listOf<T>(value: Listed<T>): T[] {
  if (Array.isArray(value)) return value;
  return value?.items ?? [];
}
const id = (value: string) => '/' + encodeURIComponent(value);
const query = (params: Record<string, string | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? '?' + text : '';
};

// ── Unlock ──────────────────────────────────────────────────────────────────

export const getStatus = () => get<VaultLockState>('/status');
export const unlockVault = () => post<VaultLockState>('/unlock');
export const lockVault = () => post<unknown>('/lock');

async function securityCall(path: string, body: unknown, fallback: string) {
  const result = await api.post<{ success?: boolean; error?: string }>(path, body, request);
  if (result && result.success === false) throw new Error(result.error || fallback);
}
export const sendTwoFactorCode = (userId: string) =>
  securityCall(SECURITY_API_ENDPOINTS.SEND_CODE(userId), {}, 'Could not send a code.');
export const verifyTwoFactorCode = (userId: string, code: string) =>
  securityCall(SECURITY_API_ENDPOINTS.VERIFY_CODE(userId), { code }, 'That code did not work.');

// ── Collections ─────────────────────────────────────────────────────────────

export const listCollections = async () => listOf(await get<Listed<Collection>>('/collections'));
export const createCollection = (input: CollectionInput) => post<Collection>('/collections', input);

// ── Credentials ─────────────────────────────────────────────────────────────

export async function listCredentials(): Promise<VaultSummary[]> {
  const all: VaultSummary[] = [];
  let cursor: string | null = null;
  do {
    const page: VaultPage = await get<VaultPage>(query({ after: cursor }));
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}
export const createCredentials = (entries: CredentialInput[]) =>
  guard(api.post<{ count: number }>(vaultPath, { entries }, request));
export const updateCredential = (
  credentialId: string,
  revision: string,
  credential: CredentialInput,
  clearPortal: boolean,
) => put<unknown>(id(credentialId), { revision, credential, clearPortal });
export const deleteCredential = (credentialId: string) => remove<unknown>(id(credentialId));
export const revealCredential = (credentialId: string) =>
  post<RevealedCredential>(id(credentialId) + '/reveal');
export const oneTimeCode = (credentialId: string) => post<OneTimeCode>(id(credentialId) + '/otp');
export const moveCredential = (credentialId: string, revision: string, collectionId: string) =>
  post<unknown>(id(credentialId) + '/move', { revision, collectionId });

export type IssuedToken = { token: string; expiresAt: string };
export const issueLegacyToken = (credentialId: string, revision: string) =>
  post<IssuedToken>(id(credentialId) + '/connect', { revision });
export const revokeLegacyToken = (credentialId: string, revision: string) =>
  post<unknown>(id(credentialId) + '/revoke', { revision });

// ── Workflows ───────────────────────────────────────────────────────────────

export const listWorkflows = async (credentialId: string) =>
  listOf(await get<Listed<VaultWorkflow>>(id(credentialId) + '/workflows'));
export const createWorkflow = (credentialId: string, workflow: WorkflowInput) =>
  post<VaultWorkflow>(id(credentialId) + '/workflows', workflow);
export const updateWorkflow = (workflowId: string, revision: string, workflow: WorkflowInput) =>
  put<VaultWorkflow>('/workflows' + id(workflowId), { revision, workflow });
export const deleteWorkflow = (workflowId: string) =>
  remove<unknown>('/workflows' + id(workflowId));
export const publishWorkflow = (workflowId: string, revision: string) =>
  post<VaultWorkflow>('/workflows' + id(workflowId) + '/publish', { revision });
export const listWorkflowVersions = async (workflowId: string) =>
  listOf(await get<Listed<WorkflowVersion>>('/workflows' + id(workflowId) + '/versions'));

// ── Connections ─────────────────────────────────────────────────────────────

export const listConnections = async () =>
  listOf(await get<Listed<VaultConnection>>('/connections'));
export const createConnection = (input: ConnectionInput) =>
  post<IssuedConnection>('/connections', input);
export const updateConnection = (connectionId: string, patch: ConnectionPatch) =>
  put<VaultConnection>('/connections' + id(connectionId), patch);
export const revokeConnection = (connectionId: string) =>
  post<unknown>('/connections' + id(connectionId) + '/revoke');
export const pauseAllConnections = () => post<unknown>('/connections/pause-all');
export const resumeAllConnections = () => post<unknown>('/connections/resume-all');
export const trustSuggestions = async (connectionId: string) =>
  listOf(await get<Listed<TrustSuggestion>>('/connections' + id(connectionId) + '/trust'));

// ── Approvals, runs and activity ────────────────────────────────────────────

export const listApprovals = async (state: 'pending' | 'all') =>
  listOf(await get<Listed<VaultApproval>>('/approvals' + query({ state })));
export const approve = (approvalId: string) =>
  post<unknown>('/approvals' + id(approvalId) + '/approve');
export const deny = (approvalId: string) => post<unknown>('/approvals' + id(approvalId) + '/deny');
export const listRuns = async () => listOf(await get<Listed<VaultRun>>('/runs'));
export const getRun = (runId: string) => get<VaultRun>('/runs' + id(runId));
export const cancelRun = (runId: string) => post<unknown>('/runs' + id(runId) + '/cancel');
export const listEvents = (after: string | null, actorKind: VaultEventActor | '') =>
  get<EventPage>('/events' + query({ after, actorKind }));

// ── Staff directory (for picking a person) ──────────────────────────────────

export interface StaffMember {
  id: string;
  name: string;
  email: string;
}
export async function listStaff(): Promise<StaffMember[]> {
  const result = await api.get<{
    data?: { id: string; firstName?: string; lastName?: string; name?: string; email?: string }[];
  }>('/personnel/list', request);
  return (result?.data ?? []).map((p) => ({
    id: p.id,
    name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || p.email || p.id,
    email: p.email ?? '',
  }));
}

// ── Collection owners (write-only) ──────────────────────────────────────────

export const listMine = async () => listOf(await api.get<Listed<OwnedLogin>>(minePath, request));
export const addMine = (input: OwnedLoginInput) => api.post<OwnedLogin>(minePath, input, request);
export const replaceMyPassword = (loginId: string, password: string) =>
  api.put<unknown>(minePath + id(loginId) + '/password', { password }, request);
