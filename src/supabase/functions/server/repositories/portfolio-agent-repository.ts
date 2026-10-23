/**
 * Portfolio agent tokens — one token per outside agent.
 * ====================================================
 *
 * Owns `public.portfolio_agent_tokens` (migration `portfolio_agent_tokens`)
 * and nothing else: hashing and minting tokens, finding the live agent a token
 * belongs to, and the list / issue / revoke the admin panel drives.
 *
 * WHAT IS STORED: only the lowercase hex SHA-256 of each token. A token is 32
 * random bytes behind the `nwpa_` prefix, so its hash is useless to whoever
 * reads it; the plaintext is returned once, by `issueAgentToken`, and lives
 * on only in the agent's own configuration. Nothing here ever returns a hash.
 *
 * WHY THE SERVICE-ROLE CLIENT: the table is service-role only (RLS on, no
 * policy, anon and authenticated revoked), because a row is a credential.
 * Lazy for the same reason as every other client here — constructing it at
 * module top level crashes the function on deploy.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.49.8';
import {
  PORTFOLIO_AGENT_TOKEN_PREFIX,
  type PortfolioAgent,
} from '../../../../shared/integrations/portfolio-table.ts';

export const PORTFOLIO_AGENT_TABLE = 'portfolio_agent_tokens';

/**
 * How stale `last_used_at` may be before a verified request refreshes it. An
 * agent's call should not cost a write every time just to move a timestamp.
 */
export const LAST_USED_REFRESH_MS = 5 * 60 * 1000;

/** Every column the panel may see. Deliberately not `token_hash`. */
const PUBLIC_COLUMNS = 'agent_name, created_at, created_by, last_used_at, revoked_at, revoked_by';

/** Bounded read: the table holds a handful of agents and their revoked history. */
const LIST_LIMIT = 200;

interface AgentRow {
  agent_name: string;
  created_at: string;
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

let _client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _client;
}

/** Test hook. */
export function resetPortfolioAgentClient(): void {
  _client = null;
}

const toPortfolioAgent = (row: AgentRow): PortfolioAgent => ({
  name: row.agent_name,
  createdAt: row.created_at,
  createdBy: row.created_by,
  lastUsedAt: row.last_used_at,
  revokedAt: row.revoked_at,
  revokedBy: row.revoked_by,
});

/**
 * Lowercase hex SHA-256 of the token's UTF-8 bytes — byte for byte what
 * `encode(extensions.digest(token, 'sha256'), 'hex')` gives in SQL, which is
 * how the migration carried the shared Vault token over.
 */
export async function hashAgentToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** `nwpa_` + 32 random bytes as unpadded base64url: safe in a header, a URL or a shell. */
export function generateAgentToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${PORTFOLIO_AGENT_TOKEN_PREFIX}${encoded}`;
}

export interface ActiveAgent {
  id: string;
  name: string;
  lastUsedAt: string | null;
}

/** The live agent a token belongs to, or null. Throws on a database error. */
export async function findActiveAgentByToken(token: string): Promise<ActiveAgent | null> {
  const { data, error } = await db()
    .from(PORTFOLIO_AGENT_TABLE)
    .select('id, agent_name, last_used_at')
    .eq('token_hash', await hashAgentToken(token))
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { id: string; agent_name: string; last_used_at: string | null };
  return { id: row.id, name: row.agent_name, lastUsedAt: row.last_used_at };
}

/** Record that the agent called, at most once per `LAST_USED_REFRESH_MS`. */
export async function markAgentUsed(agent: ActiveAgent, now = new Date()): Promise<void> {
  if (agent.lastUsedAt && now.getTime() - Date.parse(agent.lastUsedAt) < LAST_USED_REFRESH_MS) {
    return;
  }
  const { error } = await db()
    .from(PORTFOLIO_AGENT_TABLE)
    .update({ last_used_at: now.toISOString() })
    .eq('id', agent.id);
  if (error) throw new Error(error.message);
}

/** Every agent token, newest first, live and revoked. */
export async function listAgents(): Promise<PortfolioAgent[]> {
  const { data, error } = await db()
    .from(PORTFOLIO_AGENT_TABLE)
    .select(PUBLIC_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(error.message);
  return ((data ?? []) as AgentRow[]).map(toPortfolioAgent);
}

export type IssueAgentTokenResult =
  { status: 'issued'; agent: PortfolioAgent; token: string } | { status: 'exists' };

/**
 * Mint a token for `name`. Refused (`exists`) while the name has a live token:
 * the partial unique index on live names makes that race-free, so two admins
 * issuing at once cannot both succeed.
 */
export async function issueAgentToken(
  name: string,
  issuedBy: string,
): Promise<IssueAgentTokenResult> {
  const token = generateAgentToken();
  const { data, error } = await db()
    .from(PORTFOLIO_AGENT_TABLE)
    .insert({ agent_name: name, token_hash: await hashAgentToken(token), created_by: issuedBy })
    .select(PUBLIC_COLUMNS)
    .single();
  if (error) {
    if (error.code === '23505') return { status: 'exists' };
    throw new Error(error.message);
  }
  return { status: 'issued', agent: toPortfolioAgent(data as AgentRow), token };
}

export type RevokeAgentTokenResult =
  { status: 'revoked'; agent: PortfolioAgent } | { status: 'not_found' };

/** Revoke `name`'s live token. The row stays, as the record of the old token. */
export async function revokeAgentToken(
  name: string,
  revokedBy: string,
  now = new Date(),
): Promise<RevokeAgentTokenResult> {
  const { data, error } = await db()
    .from(PORTFOLIO_AGENT_TABLE)
    .update({ revoked_at: now.toISOString(), revoked_by: revokedBy })
    .eq('agent_name', name)
    .is('revoked_at', null)
    .select(PUBLIC_COLUMNS);
  if (error) throw new Error(error.message);
  const [row] = (data ?? []) as AgentRow[];
  return row ? { status: 'revoked', agent: toPortfolioAgent(row) } : { status: 'not_found' };
}
