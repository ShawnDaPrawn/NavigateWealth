/**
 * Password Manager REST calls, typed from the shared contract
 * (`src/shared/password-manager.ts`). Super admin only.
 */
import { APIError, api } from '../../../../utils/api/client';
import type {
  ConnectionInput,
  ConnectionPatch,
  CredentialInput,
  EventPage,
  IssuedConnection,
  OneTimeCode,
  RevealedCredential,
  Service,
  ServiceInput,
  ServiceSummary,
  Skill,
  SkillInput,
  VaultApproval,
  VaultConnection,
  VaultEventActor,
  VaultSummary,
} from '../../../../shared/password-manager';

const base = '/password-vault';
/** Secrets are never cached and a failed write is never retried behind the person's back. */
const opts = { retryTransientFailures: false, cache: 'no-store' } as const;

export type LoginEdit = Omit<CredentialInput, 'password' | 'notes'> & {
  /** Empty keeps the saved password. */
  password: string;
  /** Absent keeps the saved notes. */
  notes?: string;
};

export const vaultApi = {
  // Logins
  logins: async () => (await api.get<{ items: VaultSummary[] }>(base, opts)).items,
  addLogins: (entries: CredentialInput[]) =>
    api.post<{ count: number; ids: string[] }>(base, { entries }, opts),
  editLogin: (id: string, revision: string, credential: LoginEdit, clearOtp = false) =>
    api.put<{ success: true }>(base + '/' + id, { revision, credential, clearOtp }, opts),
  deleteLogin: (id: string) => api.delete<{ success: true }>(base + '/' + id, opts),
  reveal: (id: string) => api.post<RevealedCredential>(base + '/' + id + '/reveal', {}, opts),
  oneTimeCode: (id: string) => api.post<OneTimeCode>(base + '/' + id + '/otp', {}, opts),

  // Services
  services: async () =>
    (await api.get<{ items: ServiceSummary[] }>(base + '/services', opts)).items,
  addService: (input: ServiceInput) => api.post<Service>(base + '/services', input, opts),
  editService: (id: string, input: ServiceInput) =>
    api.put<Service>(base + '/services/' + id, input, opts),
  deleteService: (id: string) => api.delete<{ success: true }>(base + '/services/' + id, opts),

  // Skills
  skills: async () => (await api.get<{ items: Skill[] }>(base + '/skills', opts)).items,
  addSkill: (input: SkillInput) => api.post<Skill>(base + '/skills', input, opts),
  editSkill: (id: string, revision: string, skill: SkillInput) =>
    api.put<Skill>(base + '/skills/' + id, { revision, skill }, opts),
  deleteSkill: (id: string) => api.delete<{ success: true }>(base + '/skills/' + id, opts),

  // AI agents
  agents: () =>
    api.get<{ items: VaultConnection[]; aiPaused: boolean }>(base + '/connections', opts),
  addAgent: (input: ConnectionInput) =>
    api.post<IssuedConnection>(base + '/connections', input, opts),
  editAgent: (id: string, patch: ConnectionPatch) =>
    api.put<VaultConnection>(base + '/connections/' + id, patch, opts),
  disconnectAgent: (id: string) =>
    api.post<{ seen: { credentialId: string; name: string; at: string }[] }>(
      base + '/connections/' + id + '/revoke',
      {},
      opts,
    ),
  pauseAll: (paused: boolean) =>
    api.post<{ aiPaused: boolean }>(
      base + '/connections/' + (paused ? 'pause-all' : 'resume-all'),
      {},
      opts,
    ),

  // Approvals and activity
  approvals: async () =>
    (await api.get<{ items: VaultApproval[] }>(base + '/approvals', opts)).items,
  decide: (id: string, decision: 'approve' | 'deny') =>
    api.post<VaultApproval>(base + '/approvals/' + id + '/' + decision, {}, opts),
  events: (after?: string, actorKind?: VaultEventActor) => {
    const q = new URLSearchParams();
    if (after) q.set('after', after);
    if (actorKind) q.set('actorKind', actorKind);
    const qs = q.toString();
    return api.get<EventPage>(base + '/events' + (qs ? '?' + qs : ''), opts);
  },
};

// ── Sign-in approval for Claude / ChatGPT (OAuth consent) ───────────────────
// The OAuth authorization server is shared with broker operations; the
// authorize page stores the request in session storage and sends the person
// here to approve it.

export { clearConsent, pendingConsent } from '../../layout/pendingConsent';

export const consentApi = {
  details: (params: Record<string, string>) =>
    api.post<{ name: string; redirectUri: string; kind: 'vault' | 'broker' }>(
      '/broker-operations/consent/details',
      params,
      opts,
    ),
  approve: (params: Record<string, string>) =>
    api.post<{ redirect: string }>('/broker-operations/consent/approve', params, opts),
};

/**
 * The message to show for a failed call. A 400 from body validation says only
 * "Validation failed"; the fields it names are appended, so a person (or the
 * agent helping them) can tell which part of the request was refused.
 */
export function errorText(error: unknown, fallback = 'Something went wrong. Try again.') {
  if (!(error instanceof Error) || !error.message) return fallback;
  const errors =
    error instanceof APIError
      ? (error.details as { errors?: unknown } | undefined)?.errors
      : undefined;
  const fields = errors && typeof errors === 'object' ? Object.keys(errors).filter(Boolean) : [];
  return fields.length ? error.message + ' (' + fields.join(', ') + ')' : error.message;
}
