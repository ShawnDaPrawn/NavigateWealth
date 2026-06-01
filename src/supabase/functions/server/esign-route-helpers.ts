/**
 * esign route helpers — shared request/audit/auth utilities (Phase 5).
 * ====================================================================
 *
 * Neutral home for the small helpers that were defined locally in
 * esign-routes.tsx but are called by many route handlers. Hoisting them here
 * lets the per-group route sub-apps (esign-<group>-routes.ts) import them
 * without a circular dependency back into esign-routes.tsx. Behaviour-
 * preserving move (verbatim) — the route contract suite is the guard since
 * tsc does not type-check edge code.
 *
 * Also re-exports the two shared route-level record shapes (SignerRecord,
 * FieldRecord) used across several route groups.
 */
import type { Context } from 'npm:hono';
import { initializeStorageBuckets } from './esign-storage.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { resolveFirmId as resolveFirmIdShared } from './esign-firm-scope.ts';
import { resolveApiKey } from './api-key-service.ts';

const log = createModuleLogger('esign-route-helpers');

/** Shared callback types for e-sign route operations */
export interface SignerRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  order?: number;
  status?: string;
  access_token?: string;
  requiresOtp?: boolean;
  accessCode?: string;
  clientId?: string;
  [key: string]: unknown;
}
export interface FieldRecord {
  id?: string;
  type?: string;
  signerId?: string;
  signerIndex?: number;
  signer_id?: string;
  [key: string]: unknown;
}

/**
 * Extract client IP and User Agent from request
 */
export function getRequestMetadata(c: { req: { header: (name: string) => string | undefined } }) {
  return {
    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    userAgent: c.req.header('user-agent') || 'unknown',
  };
}

/**
 * P2.5 2.8 — derive the audit actor_type for a given signer.
 *
 * Witnesses are first-class actors in the evidence trail. A primary signer's
 * `signed` event and a witness's `witness_attestation` event are both legally
 * meaningful but signify different things — they must be distinguishable in
 * the audit log without a metadata lookup.
 *
 * `kind` is optional on `EsignSigner` for back-compat with KV records written
 * before the field existed; a missing kind falls back to `'signer'`.
 */
export function audActor(signer: { kind?: string } | null | undefined): 'signer' | 'witness' {
  return signer?.kind === 'witness' ? 'witness' : 'signer';
}

// Storage bucket initialization is deferred to first upload request
// to avoid top-level async side effects that can cause deployment errors (544).
let storageBucketsInitialized = false;
export async function ensureStorageBuckets(): Promise<void> {
  if (storageBucketsInitialized) return;
  try {
    await initializeStorageBuckets();
    storageBucketsInitialized = true;
  } catch (error) {
    log.error('Failed to initialize E-Sign storage buckets:', error);
  }
}

// P6.9 — canonical firm-scope helper now lives in `esign-firm-scope.ts`.
// We keep a thin local alias so existing call sites compile unchanged.
export function resolveFirmId(user: {
  id: string;
  user_metadata?: Record<string, unknown>;
}): string {
  return resolveFirmIdShared(user);
}

// API-key auth for the public /v1 surface.
// Authenticated via `Authorization: Bearer navsig_<prefix>_<secret>`.
export async function requireApiKey(
  c: Context,
): Promise<{ ok: true; firmId: string; keyId: string } | { ok: false; response: Response }> {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) {
    return { ok: false, response: c.json({ error: 'Missing API key' }, 401) };
  }
  const key = await resolveApiKey(token);
  if (!key) {
    return { ok: false, response: c.json({ error: 'Invalid or revoked API key' }, 401) };
  }
  return { ok: true, firmId: key.firm_id, keyId: key.id };
}
