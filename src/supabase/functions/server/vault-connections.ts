/**
 * AI connections to the password manager: one per person per AI tool, scoped
 * to collections, with an access level and an autonomy policy. They sign in
 * through the same OAuth authorization server as broker reporting (see
 * broker-ops-auth.ts), or with a bearer token for clients without OAuth.
 */
import { Buffer } from 'node:buffer';
import type {
  ConnectionInput,
  ConnectionPatch,
  IssuedConnection,
  VaultConnection,
} from '../../../shared/password-manager.ts';
import { constantTimeEqual } from './crypto-utils.ts';
import { sha256Hex } from './sha256.ts';
import {
  compareAndSet,
  connections,
  isAiPaused,
  type StoredConnection,
} from './repositories/vault-store.ts';

/**
 * The MCP server's address, straight to this edge function. Connectors use this
 * one: the website address below passes through Vercel's edge firewall, whose
 * AI-bot rules can drop an assistant's calls (sent as `Claude-User` and the
 * like) before they reach us. On 2026-11-25 Claude signed in through the website
 * address four times and its first authenticated call never arrived.
 */
export const vaultResourceUrl =
  'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/mcp/password-vault';
/** The same server through the website (vercel.json rewrite), kept for connectors added with it. */
export const vaultWebsiteResourceUrl = 'https://www.navigatewealth.co/mcp/password-vault';
/** Both addresses a vault token may be issued for; the first is the one to give out. */
export const vaultResourceUrls = [vaultResourceUrl, vaultWebsiteResourceUrl];
export const VAULT_TOKEN_PREFIX = 'nwvc_';
const random = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');

export function publicConnection(row: StoredConnection): VaultConnection {
  const { secretHash: _s, tokenHash: _t, tokenExpires: _e, ...rest } = row;
  return rest;
}

export async function issueConnection(input: ConnectionInput): Promise<IssuedConnection> {
  const id = crypto.randomUUID();
  const secret = random();
  const token = VAULT_TOKEN_PREFIX + id + '.' + random();
  const now = Date.now();
  const expiresAt = new Date(now + input.expiresInDays * 86400000).toISOString();
  const { expiresInDays: _days, ...fields } = input;
  const row: StoredConnection = {
    ...fields,
    id,
    status: 'active',
    createdAt: new Date(now).toISOString(),
    expiresAt,
    lastUsed: null,
    secretHash: await sha256Hex(secret),
    // OAuth clients get their token at exchange; until then nothing matches.
    tokenHash: input.redirectUri ? await sha256Hex(random()) : await sha256Hex(token),
    tokenExpires: input.redirectUri ? 0 : Date.parse(expiresAt),
  };
  await connections.put(id, row);
  return {
    connection: publicConnection(row),
    clientSecret: input.redirectUri ? secret : undefined,
    token: input.redirectUri ? undefined : token,
  };
}

/** Patch a connection unless an OAuth exchange rotated its token meanwhile. */
export async function updateConnection(row: StoredConnection, patch: Partial<StoredConnection>) {
  const next = { ...row, ...patch };
  return (await compareAndSet(connections.key(row.id), next, 'tokenHash', row.tokenHash))
    ? next
    : null;
}

export async function patchConnection(id: string, patch: ConnectionPatch) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await connections.get(id);
    if (!row || row.status === 'revoked') return null;
    const updated = await updateConnection(row, patch);
    if (updated) return updated;
  }
  throw new Error('This connection is busy. Try again.');
}

export type ConnectionAuth =
  { ok: true; row: StoredConnection } | { ok: false; reason: 'invalid' | 'paused' };

export async function authenticateVaultConnection(header: string): Promise<ConnectionAuth> {
  const m = /^Bearer (nwvc_([0-9a-f-]{36})\.[A-Za-z0-9_-]{43})$/i.exec(header);
  if (!m) return { ok: false, reason: 'invalid' };
  const row = await connections.get(m[2]);
  if (
    !row ||
    row.status === 'revoked' ||
    row.tokenExpires <= Date.now() ||
    Date.parse(row.expiresAt) <= Date.now() ||
    !constantTimeEqual(row.tokenHash, await sha256Hex(m[1]))
  )
    return { ok: false, reason: 'invalid' };
  if (row.status === 'paused' || (await isAiPaused())) return { ok: false, reason: 'paused' };
  if (!row.lastUsed || Date.now() - Date.parse(row.lastUsed) > 60000)
    await updateConnection(row, { lastUsed: new Date().toISOString() });
  return { ok: true, row };
}

/** For the shared OAuth server: an active connection with a registered callback. */
export async function oauthConnection(id: string) {
  const row = await connections.get(id);
  return row && row.status !== 'revoked' && row.redirectUri ? row : null;
}
