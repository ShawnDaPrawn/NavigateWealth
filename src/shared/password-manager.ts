/**
 * Password manager — the contract shared by the super admin module and the
 * Edge Function (`password-vault-*.ts`, `vault-*.ts`).
 *
 * The product in one paragraph. The password manager is the bridge between
 * outside AI agents (Claude, ChatGPT, anything that speaks MCP) and the
 * systems the firm works in. It holds three things:
 *
 *   SERVICES — the systems you sign in to: Allan Gray, GoAML, a bank. Navigate
 *              Wealth itself is a built-in service that is always there.
 *   LOGINS   — one saved sign-in for a service. Ten brokers with ten Allan Gray
 *              logins are ten logins under one service.
 *   SKILLS   — instructions in plain English that tell an agent how to do a
 *              job. A skill is shared by every login of its service (written
 *              once, used by all ten Allan Gray logins) or belongs to one login
 *              (extra steps for that login only, read after the shared ones).
 *
 * AI AGENTS connect over MCP from wherever they run. Each agent is given the
 * services it may reach and whether it may receive passwords. An agent finds a
 * login, reads its skills, then asks for the password to sign in itself. A
 * login can be hidden from AI, need your approval each time, or be allowed.
 *
 * REST surface (all under `/password-vault`, super admin only):
 *   GET  /status
 *   GET|POST /services · PUT|DELETE /services/:sid
 *   GET|POST /skills · PUT|DELETE /skills/:kid
 *   GET / · POST / · PUT|DELETE /:id · POST /:id/reveal · POST /:id/otp
 *   GET|POST /connections · PUT /connections/:cid · POST /connections/:cid/revoke
 *   POST /connections/pause-all · POST /connections/resume-all
 *   GET /approvals (?state) · POST /approvals/:aid/approve|deny
 *   GET /events (?after, ?actorKind)
 * AI agents use the MCP server at `/mcp/password-vault`.
 */
import type { PortalProfile } from './broker-operations.ts';

// ── Services ─────────────────────────────────────────────────────────────────

/** The built-in service for the Navigate Wealth platform itself. */
export const NAVIGATE_WEALTH_SERVICE_ID = 'navigate-wealth';
export const NAVIGATE_WEALTH_ADMIN_URL = 'https://www.navigatewealth.co/admin';

export interface ServiceInput {
  name: string;
  /** The address people sign in at. Optional. */
  website: string;
  /** One or two sentences: what the firm uses this service for. */
  description: string;
}

export interface Service extends ServiceInput {
  id: string;
  /** Navigate Wealth: cannot be renamed away or deleted. */
  builtIn: boolean;
  createdAt: string;
}

export interface ServiceSummary extends Service {
  logins: number;
  skills: number;
}

// ── Logins ───────────────────────────────────────────────────────────────────

/** What an AI agent may do with one login. */
export type AiUse = 'off' | 'ask' | 'allowed';
export const aiUseLabels: Record<AiUse, string> = {
  off: 'Hidden from AI',
  ask: 'Ask me first',
  allowed: 'Allowed',
};
export const aiUseHelp: Record<AiUse, string> = {
  off: 'AI agents cannot see this login at all.',
  ask: 'Agents can see it and read its skills, but must ask you before they get the password.',
  allowed: 'Agents can see it, read its skills and get the password when a task needs it.',
};

export interface CredentialInput {
  serviceId: string;
  /** How people tell this login apart, e.g. "Broker 1234 — Sarah". Defaults to the website. */
  name: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  aiUse?: AiUse;
  /** Remind to change the password after this many months; 0 = never. */
  rotateMonths?: number;
  /** Base32 authenticator setup key. Write-only: never returned by the API. */
  otpSecret?: string;
  /** Encryption collection. Defaults to the firm's. */
  collectionId?: string;
}

export interface CredentialHealth {
  reused: boolean;
  /** Older than its change reminder. */
  stale: boolean;
  weak: boolean;
  /** Given to an AI agent since the password last changed. */
  exposed: boolean;
}

export interface AiExposure {
  connectionId: string;
  connectionName: string;
  at: string;
}

export interface VaultSummary {
  id: string;
  revision: string;
  serviceId: string;
  name: string;
  url: string;
  username: string;
  collectionId: string;
  aiUse: AiUse;
  rotateMonths: number;
  passwordChangedAt: string | null;
  hasOtp: boolean;
  health: CredentialHealth;
  seenByAi: AiExposure[];
  /**
   * @deprecated Broker-reporting profile from the retired selector workflows.
   * Never written any more; kept so the dormant broker-operations backend
   * still type-checks until it is removed.
   */
  portal?: PortalProfile;
}

export interface RevealedCredential extends VaultSummary {
  password: string;
  notes: string;
}

export interface OneTimeCode {
  code: string;
  /** Seconds until the code rolls over. */
  expiresIn: number;
}

/** Whether a login needs looking at, in words. Empty when it is fine. */
export function healthIssues(h: CredentialHealth): string[] {
  const out: string[] = [];
  if (h.exposed) out.push('Given to an AI since it last changed');
  if (h.reused) out.push('Same password as another login');
  if (h.weak) out.push('Weak password');
  if (h.stale) out.push('Due for a change');
  return out;
}

// ── Skills ───────────────────────────────────────────────────────────────────

export interface SkillInput {
  /** A short title: "Download a monthly commission statement". */
  name: string;
  /** One line an agent reads to decide whether this skill fits the task. */
  whenToUse: string;
  /** The instructions, written the way you would brief a new colleague. */
  instructions: string;
  serviceId: string;
  /** Set for a skill that belongs to one login only; null for a shared skill. */
  credentialId: string | null;
}

export interface Skill extends SkillInput {
  id: string;
  revision: string;
  updatedAt: string;
  updatedBy: string;
}

// ── AI agents (connections) ──────────────────────────────────────────────────

export type ConnectionTool = 'claude' | 'chatgpt' | 'other';
export const connectionTools: Record<ConnectionTool, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  other: 'Another MCP client',
};

/** Whether an agent may receive passwords and one-time codes. */
export type PasswordAccess = 'never' | 'ask' | 'allowed';
export const passwordAccessLabels: Record<PasswordAccess, string> = {
  never: 'Never — skills only',
  ask: 'Ask me each time',
  allowed: 'Allowed',
};
export const passwordAccessHelp: Record<PasswordAccess, string> = {
  never: 'The agent can find logins and read skills, but never receives a password.',
  ask: 'Each time the agent needs a password you get a request under Activity.',
  allowed:
    'The agent gets passwords when it needs them, unless the login itself says “Ask me first”.',
};

export interface ConnectionInput {
  name: string;
  tool: ConnectionTool;
  /** Services the agent may reach; null = every service, including ones added later. */
  serviceIds: string[] | null;
  passwords: PasswordAccess;
  /**
   * May add and update skills for one login at a time (the MCP save_skill tool).
   * Off unless a person switches it on: a skill steers every agent that reads it.
   * Connections stored before this existed have no value, which means off.
   */
  writesSkills?: boolean;
  /** HTTPS OAuth callback; empty string issues a bearer token instead. */
  redirectUri: string;
  expiresInDays: number;
}

export interface VaultConnection extends Omit<ConnectionInput, 'expiresInDays'> {
  id: string;
  status: 'active' | 'paused' | 'revoked';
  createdAt: string;
  expiresAt: string;
  lastUsed: string | null;
}

export interface IssuedConnection {
  connection: VaultConnection;
  /** OAuth client secret, shown once. */
  clientSecret?: string;
  /** Bearer token, shown once (when no callback URL). */
  token?: string;
}

export type ConnectionPatch = Partial<
  Pick<VaultConnection, 'name' | 'serviceIds' | 'passwords' | 'status' | 'writesSkills'>
>;

// ── Approvals and activity ───────────────────────────────────────────────────

export interface VaultApproval {
  id: string;
  connectionId: string;
  connectionName: string;
  action: 'reveal' | 'otp';
  credentialId: string;
  credentialName: string;
  /** The agent's own words for why it needs it. */
  reason: string;
  state: 'pending' | 'approved' | 'denied' | 'expired' | 'consumed';
  decidedBy: string | null;
  createdAt: string;
  expiresAt: string;
}

export type VaultEventActor = 'person' | 'connection';

export interface VaultEvent {
  id: string;
  at: string;
  actorKind: VaultEventActor;
  actorId: string;
  actorName: string;
  action: string;
  credentialId: string | null;
  credentialName: string | null;
  detail: string;
  outcome: 'ok' | 'denied' | 'pending' | 'failed';
}

export interface EventPage {
  items: VaultEvent[];
  nextCursor: string | null;
}

// ── Lock state ───────────────────────────────────────────────────────────────

/**
 * Every vault route requires a super admin, and super admins open the vault
 * without a code (owner's request, 2026-11-24). The two-factor gate survives
 * in `vault-unlock.ts` for any role that is ever let in later.
 */
export interface VaultLockState {
  unlocked: boolean;
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  expiresAt: string | null;
}

// ── Encryption collections ───────────────────────────────────────────────────

/**
 * Collections are an encryption boundary, not something people manage: every
 * firm login is sealed with the Brokerage collection's data key.
 */
export const BROKERAGE_COLLECTION_ID = 'brokerage';

export interface Collection {
  id: string;
  name: string;
  kind: 'brokerage' | 'person';
  ownerUserId: string | null;
  ownerName: string;
  createdAt: string;
}
