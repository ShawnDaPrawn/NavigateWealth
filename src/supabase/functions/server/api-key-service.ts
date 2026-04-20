/**
 * P5.5 — API-key management.
 *
 * Token format: `navsig_<prefix>_<secret>`
 *   - `prefix`  9 chars, lowercase base36, used as a fast lookup index.
 *   - `secret`  48 chars of random hex. Never stored in plaintext.
 *
 * Dual-active rotation:
 *   - Multiple keys can be active per firm at the same time.
 *   - `rotateApiKey` issues a new key without deleting the old one, so
 *     consumers can switch over without downtime.
 *   - Revocation is explicit via `deactivateApiKey` / `deleteApiKey`.
 *
 * Security notes:
 *   - SHA-256 hash of `<prefix>:<secret>` stored (prevents rainbow attack
 *     on just the secret).
 *   - The full token is shown exactly once (on create / rotate). Existing
 *     sessions only see the prefix + masked tail.
 *   - `last_used_at` updated on each successful request — not strongly
 *     consistent but good enough for a "stale key" dashboard.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const log = createModuleLogger('api-key-service');

// ============================================================================
// TYPES
// ============================================================================

export interface ApiKey {
  id: string;
  firm_id: string;
  name: string;
  prefix: string;
  hashed_secret: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  active: boolean;
  last_used_at?: string;
  revoked_at?: string;
  expires_at?: string;
  /** Coarse-grained scope tags. Reserved for future expansion. */
  scopes?: string[];
}

export interface CreatedApiKey {
  key: ApiKey;
  /** Plaintext token. Returned only on create / rotate. */
  token: string;
}

// ============================================================================
// KV KEYS
// ============================================================================

const KEYS = {
  byId: (id: string) => `esign:apikey:${id}`,
  byFirm: (firmId: string) => `esign:apikey:by_firm:${firmId}`,
  byPrefix: (prefix: string) => `esign:apikey:by_prefix:${prefix}`,
} as const;

const SECRET_LENGTH = 48;
const PREFIX_LENGTH = 9;

// ============================================================================
// TOKEN HELPERS
// ============================================================================

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

function generatePrefix(): string {
  const bytes = new Uint8Array(PREFIX_LENGTH);
  crypto.getRandomValues(bytes);
  // base36 digest, length PREFIX_LENGTH.
  let out = '';
  for (let i = 0; i < PREFIX_LENGTH; i++) out += (bytes[i] % 36).toString(36);
  return out;
}

function generateSecret(): string {
  const bytes = new Uint8Array(SECRET_LENGTH / 2);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashTokenPart(prefix: string, secret: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${prefix}:${secret}`),
  );
  return bytesToHex(new Uint8Array(buf));
}

export function formatToken(prefix: string, secret: string): string {
  return `navsig_${prefix}_${secret}`;
}

export interface ParsedToken {
  prefix: string;
  secret: string;
}

export function parseToken(token: string): ParsedToken | null {
  const m = /^navsig_([a-z0-9]+)_([a-f0-9]+)$/i.exec(token.trim());
  if (!m) return null;
  return { prefix: m[1], secret: m[2] };
}

// ============================================================================
// INDEX HELPERS
// ============================================================================

async function getIndex(key: string): Promise<string[]> {
  const raw = await kv.get(key);
  return Array.isArray(raw) ? (raw as string[]) : [];
}

async function addToFirmIndex(firmId: string, id: string): Promise<void> {
  const ids = await getIndex(KEYS.byFirm(firmId));
  if (!ids.includes(id)) {
    ids.push(id);
    await kv.set(KEYS.byFirm(firmId), ids);
  }
}

async function removeFromFirmIndex(firmId: string, id: string): Promise<void> {
  const ids = await getIndex(KEYS.byFirm(firmId));
  const filtered = ids.filter((x) => x !== id);
  if (filtered.length !== ids.length) {
    await kv.set(KEYS.byFirm(firmId), filtered);
  }
}

// ============================================================================
// CRUD
// ============================================================================

export async function createApiKey(params: {
  firmId: string;
  userId: string;
  name: string;
  scopes?: string[];
  expiresAt?: string;
}): Promise<CreatedApiKey> {
  const prefix = generatePrefix();
  const secret = generateSecret();
  const hashed = await hashTokenPart(prefix, secret);
  const now = new Date().toISOString();
  const key: ApiKey = {
    id: crypto.randomUUID(),
    firm_id: params.firmId,
    name: params.name,
    prefix,
    hashed_secret: hashed,
    created_by_user_id: params.userId,
    created_at: now,
    updated_at: now,
    active: true,
    expires_at: params.expiresAt,
    scopes: params.scopes,
  };
  await kv.set(KEYS.byId(key.id), key);
  await kv.set(KEYS.byPrefix(prefix), key.id);
  await addToFirmIndex(params.firmId, key.id);
  log.info(`API key created: id=${key.id} firm=${params.firmId} prefix=${prefix}`);
  return { key, token: formatToken(prefix, secret) };
}

export async function listApiKeysByFirm(firmId: string): Promise<ApiKey[]> {
  const ids = await getIndex(KEYS.byFirm(firmId));
  const keys = await Promise.all(ids.map((id) => kv.get(KEYS.byId(id))));
  return keys.filter(Boolean) as ApiKey[];
}

export async function getApiKey(id: string): Promise<ApiKey | null> {
  return (await kv.get(KEYS.byId(id))) as ApiKey | null;
}

export async function updateApiKey(
  id: string,
  patch: Partial<Pick<ApiKey, 'name' | 'active' | 'scopes' | 'expires_at'>>,
): Promise<ApiKey | null> {
  const existing = await getApiKey(id);
  if (!existing) return null;
  const updated: ApiKey = {
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await kv.set(KEYS.byId(id), updated);
  return updated;
}

export async function deleteApiKey(id: string): Promise<boolean> {
  const existing = await getApiKey(id);
  if (!existing) return false;
  await removeFromFirmIndex(existing.firm_id, id);
  await kv.del(KEYS.byPrefix(existing.prefix));
  await kv.del(KEYS.byId(id));
  return true;
}

/**
 * Issue a new key that shares the same name / firm as the current one.
 * The existing key is NOT deactivated — caller does that explicitly once
 * their consumers have switched over.
 */
export async function rotateApiKey(existingId: string): Promise<CreatedApiKey | null> {
  const existing = await getApiKey(existingId);
  if (!existing) return null;
  return createApiKey({
    firmId: existing.firm_id,
    userId: existing.created_by_user_id,
    name: `${existing.name} (rotated)`,
    scopes: existing.scopes,
    expiresAt: existing.expires_at,
  });
}

// ============================================================================
// AUTH
// ============================================================================

/**
 * Resolve an API key from an incoming `Authorization: Bearer <token>`
 * header. Returns null when the header is missing, malformed, the prefix
 * is unknown, the hash does not match, the key is inactive, or the key
 * has expired.
 *
 * On success also bumps `last_used_at` (best-effort; hash match is the
 * real source of truth).
 */
export async function resolveApiKey(token: string): Promise<ApiKey | null> {
  try {
    const parsed = parseToken(token);
    if (!parsed) return null;
    const keyId = (await kv.get(KEYS.byPrefix(parsed.prefix))) as string | null;
    if (!keyId) return null;
    const key = (await kv.get(KEYS.byId(keyId))) as ApiKey | null;
    if (!key || !key.active) return null;
    if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) return null;
    const expected = await hashTokenPart(parsed.prefix, parsed.secret);
    // Timing-safe compare — both hex strings of fixed length.
    if (!constantTimeEqual(expected, key.hashed_secret)) return null;

    // Non-blocking "last used" write. Intentionally not awaited.
    void kv.set(KEYS.byId(key.id), { ...key, last_used_at: new Date().toISOString() });
    return key;
  } catch (err) {
    log.error('resolveApiKey failed:', err);
    return null;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Redact a key for display in the UI. Never include the raw secret; only
 * the prefix and a short tail of the hashed secret (so two keys with the
 * same prefix — which can't happen by design — would still be
 * distinguishable).
 */
export function redactApiKey(key: ApiKey): Omit<ApiKey, 'hashed_secret'> & { preview: string } {
  const { hashed_secret, ...rest } = key;
  return {
    ...rest,
    preview: `navsig_${key.prefix}_****${hashed_secret.slice(-4)}`,
  };
}
