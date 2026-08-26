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
import {
  resolveFirmId as resolveFirmIdShared,
  assertFirmAccess,
  FirmScopeError,
} from './esign-firm-scope.ts';
import { getEnvelopeDetails } from './esign-services.ts';
import type { EsignEnvelopeDetails } from './esign-types.ts';
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

/**
 * Fetch an envelope and assert the caller's firm owns it (P1.4 / S6).
 * ==================================================================
 *
 * THE HOLE THIS CLOSES
 * --------------------
 * Eight e-sign download/audit handlers did this:
 *
 *     const _ctx = await getAuthContext(c);
 *
 * — authenticate, then throw the answer away. The underscore is the tell. Any
 * authenticated user could download ANY completed envelope's signed PDF, its
 * audit trail, its completion certificate or its evidence pack, by supplying
 * someone else's envelope id. On a platform whose envelopes are legally binding
 * signatures over client financial documents, that is a cross-tenant leak, not
 * a missing nicety. Authentication was never the control here; ownership is.
 *
 * `assertFirmAccess` already existed — PR #207 added it, correctly, and then
 * wired it to nothing. This is the fourth "capability written, never
 * connected" found in this codebase (see also S14's dead
 * `security.middleware.ts` and A19's unused schemas), which is why the caller
 * count is now ratcheted.
 *
 * WHY IT DENIES AN ENVELOPE WITH NO firm_id
 * -----------------------------------------
 * `belongsToFirm` requires an exact match, so a record carrying no `firm_id`
 * is denied to everyone. That is the correct default for a security boundary,
 * but it is also the one case this repo cannot verify: `createEnvelope`
 * requires `firmId: string`, yet `esign-retention-service.ts:206` and
 * `esign-recovery-bin.ts:55` both defend against it being absent, which
 * suggests older envelopes may predate firm scoping.
 *
 * So the denial is LOGGED DISTINCTLY. If legacy envelopes exist, an operator
 * sees "envelope has no firm_id" in the logs and can backfill, rather than
 * chasing an unexplained 403. Failing open instead would keep the leak.
 */
export async function requireOwnedEnvelope(
  user: { id: string; app_metadata?: Record<string, unknown> },
  envelopeId: string,
): Promise<EsignEnvelopeDetails | null> {
  // Returns getEnvelopeDetails' own type rather than a widened record: callers
  // read `envelope.document.storage_path` and friends, and handing them
  // `Record<string, unknown>` would turn every such read into a type error.
  const envelope = await getEnvelopeDetails(envelopeId);
  if (!envelope) return null;

  assertEnvelopeOwnership(user, envelopeId, envelope as { firm_id?: string | null });
  return envelope;
}

/**
 * The ownership half of `requireOwnedEnvelope`, for a handler that has ALREADY
 * loaded the envelope.
 *
 * `requireOwnedEnvelope` goes through `getEnvelopeDetails`, which is four KV
 * reads (envelope, document, signers, fields). A handler that only needs
 * `status` and `document_id` has already paid one read for
 * `kv.get(EsignKeys.envelope(id))`, and routing it through the fuller helper
 * would add three more to every request — on a surface already sitting behind
 * a ~1s platform floor. Same check, same distinct log, no extra crossings.
 *
 * Throws `FirmScopeError`; map it with `firmScopeResponse`.
 */
export function assertEnvelopeOwnership(
  user: { id: string; app_metadata?: Record<string, unknown> },
  envelopeId: string,
  envelope: { firm_id?: string | null },
): void {
  if (!envelope.firm_id) {
    log.warn(
      'Envelope carries no firm_id — denying by default. If this is a legacy ' +
        'envelope, backfill firm_id rather than relaxing this check.',
      { envelopeId, callerFirmId: resolveFirmIdShared(user) },
    );
  }

  assertFirmAccess(user, envelope);
}

/** Map a firm-scope denial to 403; returns null when the error is something else. */
export function firmScopeResponse(c: Context, error: unknown) {
  return error instanceof FirmScopeError ? c.json({ error: 'Forbidden' }, 403) : null;
}
