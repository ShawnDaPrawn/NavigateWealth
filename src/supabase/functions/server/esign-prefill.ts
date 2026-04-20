/**
 * E-Signature CRM Prefill Resolver (Phase 3.6)
 * ============================================================================
 * The studio lets a sender bind a text field to a CRM token (e.g.
 * `client.name`, `client.id_number`). At envelope-send time we resolve
 * those tokens against the targeted signer's client record and the
 * envelope's metadata, then write the resolved value into the field's
 * `value` column. The signer view honours `metadata.prefill.locked` to
 * decide if the value is editable or read-only.
 *
 * Resolution rules:
 *   - Token resolution is BEST-EFFORT. A missing CRM record / blank field
 *     returns an empty string and the signer is prompted to fill it in.
 *     We never block sending on a missed prefill — the sender chose the
 *     binding knowingly.
 *   - We resolve once at send-time, not per-signer-view. Re-resolving on
 *     every view would let CRM edits silently mutate a sent envelope,
 *     which breaks the audit trail.
 *   - Resolved values are stored on `EsignField.value` in addition to a
 *     `metadata.prefill.resolvedAt` timestamp so the audit trail can
 *     prove what the prefill was at send-time.
 *
 * The token list is the same closed set defined in the admin module's
 * `types.ts → PrefillToken`. Adding a token requires a code change here
 * AND on the frontend — intentional friction so a security review can
 * track every PII source we touch.
 * ============================================================================
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import type { EsignField, EsignSigner } from './esign-types.ts';

const log = createModuleLogger('esign-prefill');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PrefillToken =
  | 'client.name'
  | 'client.email'
  | 'client.phone'
  | 'client.id_number'
  | 'client.address'
  | 'envelope.advice_case_id'
  | 'envelope.product_id'
  | 'envelope.request_id';

interface PrefillContext {
  /** Signer the field is bound to — drives `client.*` token lookups. */
  signer: EsignSigner;
  /** Envelope-level metadata for `envelope.*` tokens. */
  envelope: {
    advice_case_id?: string;
    product_id?: string;
    request_id?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Token resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pull the client record from the KV store. We deliberately keep the
 * lookup small here — only the fields we expose through tokens. If the
 * CRM schema changes, only this function needs updating.
 */
async function loadClientFields(clientId: string | undefined): Promise<{
  name?: string;
  email?: string;
  phone?: string;
  id_number?: string;
  address?: string;
}> {
  if (!clientId || clientId === 'standalone') return {};
  try {
    // The CRM client record is stored under the `client:` prefix. We
    // fall back to an empty object on miss — never throw.
    const record = (await kv.get(`client:${clientId}`)) as Record<string, unknown> | null;
    if (!record) return {};
    const get = (k: string) => (typeof record[k] === 'string' ? (record[k] as string) : undefined);
    return {
      name: get('name') ?? get('full_name'),
      email: get('email'),
      phone: get('phone') ?? get('mobile'),
      id_number: get('id_number') ?? get('idNumber') ?? get('national_id'),
      address: get('address') ?? get('physical_address'),
    };
  } catch (err) {
    log.warn(`Failed to load client ${clientId} for prefill: ${err instanceof Error ? err.message : String(err)}`);
    return {};
  }
}

function resolveToken(
  token: PrefillToken,
  ctx: PrefillContext,
  client: Awaited<ReturnType<typeof loadClientFields>>,
): string {
  switch (token) {
    case 'client.name': return client.name ?? ctx.signer.name ?? '';
    case 'client.email': return client.email ?? ctx.signer.email ?? '';
    case 'client.phone': return client.phone ?? ctx.signer.phone ?? '';
    case 'client.id_number': return client.id_number ?? '';
    case 'client.address': return client.address ?? '';
    case 'envelope.advice_case_id': return ctx.envelope.advice_case_id ?? '';
    case 'envelope.product_id': return ctx.envelope.product_id ?? '';
    case 'envelope.request_id': return ctx.envelope.request_id ?? '';
    default: {
      // Exhaustiveness check: TS will flag any unhandled token.
      const _exhaustive: never = token;
      void _exhaustive;
      return '';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve every prefill-bound field on a list of fields. Mutates field
 * `value` and stamps `metadata.prefill.resolvedAt` so the audit trail can
 * prove what was prefilled at send-time. Returns the count of fields that
 * had their value populated (a `0` here usually means no fields had a
 * prefill binding, which is normal).
 *
 * Idempotent — re-running on already-resolved fields overwrites the same
 * values from the same CRM lookup. The send-time call is guarded so this
 * only runs once per envelope.
 */
export async function resolvePrefilledFields(
  fields: EsignField[],
  ctx: PrefillContext,
): Promise<number> {
  // Cheap pre-check — skip the CRM lookup entirely when nothing is bound.
  const bound = fields.filter((f) => {
    const meta = f.metadata as { prefill?: { token?: PrefillToken } } | undefined;
    return !!meta?.prefill?.token;
  });
  if (bound.length === 0) return 0;

  const client = await loadClientFields(ctx.signer.client_id);
  let resolved = 0;

  for (const field of bound) {
    const meta = field.metadata as { prefill?: { token: PrefillToken; locked?: boolean; resolvedAt?: string } };
    if (!meta.prefill) continue;
    const value = resolveToken(meta.prefill.token, ctx, client);
    field.value = value;
    meta.prefill.resolvedAt = new Date().toISOString();
    if (value) resolved += 1;
  }

  log.info(`Prefill resolved ${resolved}/${bound.length} bound field(s) for signer ${ctx.signer.email}`);
  return resolved;
}
