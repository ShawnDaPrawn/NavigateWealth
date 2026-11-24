/**
 * Password manager — the contract shared by the super admin UI and the Edge
 * Function (`password-vault-*.ts`).
 *
 * Model in one paragraph: every login (a "credential") lives in exactly one
 * COLLECTION — the firm-wide Brokerage collection or a person's own. AI tools
 * reach the vault through CONNECTIONS (one per person per tool) scoped to
 * collections, given an access LEVEL (find → use → reveal → full) and an
 * AUTONOMY policy that decides, action by action, whether the AI carries on or
 * waits for a person. Nothing about autonomy is hard-coded: every action, check
 * and limit is a setting, up to full access with no human in the loop. Each
 * credential carries WORKFLOWS: fixed "automated" steps (the broker-reporting
 * runner) or a written SKILL an AI follows in a hosted browser session.
 *
 * REST surface (all under `/password-vault`, super admin only):
 *   GET  /status · POST /unlock · POST /lock
 *   GET|POST /collections · PUT|DELETE /collections/:id
 *   GET / (?after, ?collection) · POST / · PUT|DELETE /:id · POST /:id/reveal
 *   POST /:id/otp · POST /:id/move
 *   GET|POST /:id/workflows · GET /workflows · PUT|DELETE /workflows/:wid
 *   POST /workflows/:wid/publish · GET /workflows/:wid/versions
 *   GET|POST /connections · PUT /connections/:cid · POST /connections/:cid/revoke
 *   POST /connections/pause-all · POST /connections/resume-all
 *   GET /connections/:cid/trust
 *   GET /approvals (?state) · POST /approvals/:aid/approve|deny
 *   GET /runs (?connection, ?workflow) · GET /runs/:rid · POST /runs/:rid/cancel
 *   GET /events (?after, ?actorKind)
 * Collection owners (any signed-in staff member) use `/password-vault-mine`:
 *   GET / · POST / · PUT /:id/password
 * AI tools use the MCP server at `/mcp/password-vault`.
 */
import type { PortalProfile } from './broker-operations.ts';

// ── Credentials ──────────────────────────────────────────────────────────────

export type CredentialKind = 'login' | 'api_key' | 'note' | 'recovery_codes';
export const credentialKinds: Record<CredentialKind, string> = {
  login: 'Login',
  api_key: 'API key',
  note: 'Secure note',
  recovery_codes: 'Recovery codes',
};

/** The most any AI connection may do with one credential (below Full access). */
export type AiAccess = 'never' | 'find' | 'use' | 'reveal';
export const aiAccessLabels: Record<AiAccess, string> = {
  never: 'Never',
  find: 'Find only',
  use: 'Use only',
  reveal: 'Reveal',
};

export interface CredentialInput {
  name: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  portal?: PortalProfile;
  kind?: CredentialKind;
  /** Defaults to the Brokerage collection. */
  collectionId?: string;
  tags?: string[];
  /** Free label such as "Provider portal", "Banking", "Regulator". */
  category?: string;
  aiAccess?: AiAccess;
  /** Ask a person before any AI uses or reveals it (overridden by Full autonomy). */
  askFirst?: boolean;
  /** Rotation reminder in months; 0 = never. */
  rotateMonths?: number;
  /** Base32 authenticator setup key. Write-only: never returned by the API. */
  otpSecret?: string;
}

export interface CredentialHealth {
  reused: boolean;
  /** Older than its rotation reminder. */
  stale: boolean;
  weak: boolean;
  /** Revealed to an AI since the password last changed. */
  exposed: boolean;
}

export interface AiExposure {
  connectionId: string;
  connectionName: string;
  at: string;
}

export interface VaultSummary extends Pick<CredentialInput, 'name' | 'url' | 'username'> {
  portal?: PortalProfile;
  id: string;
  revision: string;
  /** Legacy single-credential MCP token. */
  connectionExpiresAt: string | null;
  collectionId: string;
  kind: CredentialKind;
  tags: string[];
  category: string;
  aiAccess: AiAccess;
  askFirst: boolean;
  rotateMonths: number;
  passwordChangedAt: string | null;
  hasOtp: boolean;
  health: CredentialHealth;
  seenByAi: AiExposure[];
}

export interface VaultPage {
  items: VaultSummary[];
  nextCursor: string | null;
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

// ── Collections ──────────────────────────────────────────────────────────────

export const BROKERAGE_COLLECTION_ID = 'brokerage';

export interface Collection {
  id: string;
  name: string;
  kind: 'brokerage' | 'person';
  /** Supabase user id of the person the collection belongs to. */
  ownerUserId: string | null;
  ownerName: string;
  createdAt: string;
}

export interface CollectionInput {
  name: string;
  kind: 'brokerage' | 'person';
  ownerUserId: string | null;
  ownerName: string;
}

// ── Unlock ───────────────────────────────────────────────────────────────────

/**
 * The vault opens only for a session that passed two-factor in the last five
 * minutes (the existing `/security/:userId/2fa/send-code` + `verify-code`
 * flow), then stays open while used and locks after 15 idle minutes. Super
 * admins skip the code and the idle lock (see `twoFactorRequired`).
 */
export interface VaultLockState {
  unlocked: boolean;
  twoFactorEnabled: boolean;
  /**
   * False for a super admin, who opens the vault without a code and is never
   * locked out for idling; true for everyone else.
   */
  twoFactorRequired: boolean;
  /** When the vault locks if left idle. */
  expiresAt: string | null;
}

// ── Connections and autonomy ─────────────────────────────────────────────────

export type ConnectionLevel = 'find' | 'use' | 'reveal' | 'full';
export const connectionLevels: Record<ConnectionLevel, string> = {
  find: 'Find',
  use: 'Find and use',
  reveal: 'Find, use and reveal',
  full: 'Full access',
};

export type AutonomyLevel = 'supervised' | 'checks' | 'full';
export const autonomyLevels: Record<AutonomyLevel, string> = {
  supervised: 'Supervised',
  checks: 'Checks only',
  full: 'Full autonomy',
};

export type ActionKey =
  'reveal' | 'ask_first_logins' | 'read_workflow' | 'change_workflow' | 'money_workflow';
export const actionLabels: Record<ActionKey, string> = {
  reveal: 'Reveal a password or one-time code',
  ask_first_logins: 'Use logins marked “Ask first”',
  read_workflow: 'Run read-only workflows',
  change_workflow: 'Change client records',
  money_workflow: 'Move money',
};

/** auto = runs on its own · ask_on_fail = asks only when a check fails · ask = asks every time · deny = not allowed */
export type ActionMode = 'auto' | 'ask_on_fail' | 'ask' | 'deny';
export const actionModes: Record<ActionMode, string> = {
  auto: 'Runs on its own',
  ask_on_fail: 'Ask when a check fails',
  ask: 'Ask every time',
  deny: 'Not allowed',
};

export type CheckKey =
  | 'roa_document'
  | 'identity_match'
  | 'per_instruction_limit'
  | 'daily_limit'
  | 'duplicate_24h'
  | 'page_matches';
export const checkLabels: Record<CheckKey, string> = {
  roa_document: 'A signed instruction or Record of Advice is attached',
  identity_match: 'Client name and ID on the page match Navigate Wealth',
  per_instruction_limit: 'Amount is under the per-instruction limit',
  daily_limit: 'Money moved today stays under the daily limit',
  duplicate_24h: 'No similar instruction in the last 24 hours',
  page_matches: 'The page looks like the skill expects',
};

export type CheckMode = 'block' | 'ask' | 'log' | 'off';
export const checkModes: Record<CheckMode, string> = {
  block: 'Block the step',
  ask: 'Ask a person',
  log: 'Log only',
  off: 'Off',
};

export type Approver = 'owner_then_super' | 'any_super' | 'two_people';
export const approverLabels: Record<Approver, string> = {
  owner_then_super: 'The connection’s person, then any super admin',
  any_super: 'Any super admin',
  two_people: 'Two people',
};

export interface AutonomyPolicy {
  level: AutonomyLevel | 'custom';
  actions: Record<ActionKey, ActionMode>;
  checks: Record<CheckKey, CheckMode>;
  /** Per-workflow override of its action line. */
  workflowOverrides: Record<string, ActionMode>;
  limits: {
    /** Rand. null = no limit. */
    perInstruction: number | null;
    perDay: number | null;
    signInsPerHour: number | null;
  };
  /** Minutes a money move waits before it is submitted, so it can be cancelled. */
  holdMinutes: number;
  approver: Approver;
}

const allActions = (mode: ActionMode): Record<ActionKey, ActionMode> => ({
  reveal: mode,
  ask_first_logins: mode,
  read_workflow: mode,
  change_workflow: mode,
  money_workflow: mode,
});

/** The three presets. Picking one fills every line; editing a line makes it `custom`. */
export function autonomyPreset(level: AutonomyLevel): AutonomyPolicy {
  if (level === 'full')
    return {
      level,
      actions: allActions('auto'),
      checks: {
        roa_document: 'log',
        identity_match: 'block',
        per_instruction_limit: 'off',
        daily_limit: 'off',
        duplicate_24h: 'log',
        page_matches: 'block',
      },
      workflowOverrides: {},
      limits: { perInstruction: null, perDay: null, signInsPerHour: null },
      holdMinutes: 0,
      approver: 'owner_then_super',
    };
  if (level === 'checks')
    return {
      level,
      actions: { ...allActions('ask_on_fail'), read_workflow: 'auto' },
      checks: {
        roa_document: 'ask',
        identity_match: 'block',
        per_instruction_limit: 'ask',
        daily_limit: 'ask',
        duplicate_24h: 'ask',
        page_matches: 'block',
      },
      workflowOverrides: {},
      limits: { perInstruction: null, perDay: null, signInsPerHour: 20 },
      holdMinutes: 0,
      approver: 'owner_then_super',
    };
  return {
    level,
    actions: { ...allActions('ask'), read_workflow: 'auto' },
    checks: {
      roa_document: 'ask',
      identity_match: 'block',
      per_instruction_limit: 'ask',
      daily_limit: 'ask',
      duplicate_24h: 'ask',
      page_matches: 'block',
    },
    workflowOverrides: {},
    limits: { perInstruction: null, perDay: null, signInsPerHour: 20 },
    holdMinutes: 0,
    approver: 'owner_then_super',
  };
}

export type ConnectionTool = 'claude' | 'chatgpt' | 'other';

export interface ConnectionInput {
  name: string;
  personUserId: string | null;
  personName: string;
  tool: ConnectionTool;
  collectionIds: string[];
  /** Only credentials carrying this tag, when set. */
  tagFilter: string | null;
  level: ConnectionLevel;
  autonomy: AutonomyPolicy;
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
  /** Bearer token, shown once (when no redirect URI). */
  token?: string;
}

export type ConnectionPatch = Partial<
  Pick<
    VaultConnection,
    'name' | 'collectionIds' | 'tagFilter' | 'level' | 'autonomy' | 'status' | 'personName'
  >
>;

export interface TrustSuggestion {
  workflowId: string;
  workflowName: string;
  credentialName: string;
  current: ActionMode;
  suggested: ActionMode;
  cleanRuns: number;
  reason: string;
}

// ── Workflows and skills ─────────────────────────────────────────────────────

export type WorkflowRisk = 'read' | 'change' | 'money';
export const workflowRisks: Record<WorkflowRisk, string> = {
  read: 'Read only',
  change: 'Changes records',
  money: 'Moves money',
};

export interface WorkflowInputField {
  name: string;
  type: 'text' | 'number' | 'amount' | 'choice' | 'document' | 'fields';
  required: boolean;
  description: string;
  choices?: string[];
}

export interface WorkflowStep {
  text: string;
  /** The connection's autonomy decides whether a checkpoint waits for a person. */
  checkpoint: boolean;
}

export interface WorkflowInput {
  name: string;
  /** "When to use it" — what an AI reads to pick the workflow. */
  description: string;
  kind: 'automated' | 'skill';
  risk: WorkflowRisk;
  /** For automated workflows: the broker-reporting workflow it runs. */
  automatedWorkflowId: string | null;
  inputs: WorkflowInputField[];
  steps: WorkflowStep[];
  guardrails: {
    /** Origins the hosted session may visit; defaults to the credential's site. */
    allowedOrigins: string[];
    /** Controls whose label contains one of these words are checkpoints. */
    checkpointLabels: string[];
    never: string[];
    stopIf: string[];
  };
  returns: string;
}

export interface VaultWorkflow extends WorkflowInput {
  id: string;
  credentialId: string;
  revision: string;
  /** Draft version number being edited. */
  version: number;
  status: 'draft' | 'live';
  liveVersion: number | null;
  updatedAt: string;
  updatedBy: string;
}

export interface WorkflowVersion {
  version: number;
  publishedAt: string;
  publishedBy: string;
}

// ── Runs, approvals and activity ─────────────────────────────────────────────

export type VaultRunState =
  'running' | 'waiting_for_approval' | 'held' | 'completed' | 'failed' | 'blocked' | 'cancelled';

export interface CheckResult {
  key: CheckKey;
  mode: CheckMode;
  passed: boolean | null;
  note: string;
}

export interface VaultRunStep {
  index: number;
  text: string;
  state: 'done' | 'waiting' | 'todo';
  note: string;
  at: string | null;
}

export interface VaultRun {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  credentialId: string;
  credentialName: string;
  connectionId: string | null;
  connectionName: string;
  risk: WorkflowRisk;
  mode: ActionMode;
  state: VaultRunState;
  message: string;
  inputs: Record<string, unknown>;
  amount: number | null;
  steps: VaultRunStep[];
  checks: CheckResult[];
  approvalId: string | null;
  sessionId: string | null;
  /** Broker-reporting job, for automated workflows. */
  portalJobId: string | null;
  result: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface VaultApproval {
  id: string;
  connectionId: string;
  connectionName: string;
  personName: string;
  action: 'reveal' | 'otp' | 'use' | 'workflow' | 'checkpoint';
  credentialId: string;
  credentialName: string;
  workflowId: string | null;
  runId: string | null;
  reason: string;
  detail: string;
  requiredApprovals: number;
  approvals: { userId: string; at: string }[];
  state: 'pending' | 'approved' | 'denied' | 'expired' | 'consumed';
  createdAt: string;
  expiresAt: string;
}

export type VaultEventActor = 'person' | 'connection' | 'runner';

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

// ── Collection owners (write-only) ───────────────────────────────────────────

export interface OwnedLogin {
  id: string;
  name: string;
  url: string;
  username: string;
  passwordChangedAt: string | null;
  due: boolean;
}

export interface OwnedLoginInput {
  name: string;
  url: string;
  username: string;
  password: string;
}
