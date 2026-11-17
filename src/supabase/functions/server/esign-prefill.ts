/**
 * E-Signature CRM Prefill Resolver (Phase 3.6 + Key Manager tokens)
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { resolveCanonicalValueForClient } from './form-prefill-resolver.ts';
import type { EsignField, EsignSigner } from './esign-types.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const log = createModuleLogger('esign-prefill');

export type PrefillToken =
  | 'client.name'
  | 'client.email'
  | 'client.phone'
  | 'client.id_number'
  | 'client.address'
  | 'client.tax_number'
  | 'client.date_of_birth'
  | 'client.marital_status'
  | 'key:profile_first_name'
  | 'key:profile_last_name'
  | 'key:profile_email'
  | 'key:profile_phone_number'
  | 'key:profile_id_number'
  | 'key:profile_tax_number'
  | 'key:profile_date_of_birth'
  | 'key:profile_marital_status'
  | 'key:profile_gross_monthly_income'
  | 'key:profile_net_monthly_income'
  | 'envelope.advice_case_id'
  | 'envelope.product_id'
  | 'envelope.request_id';

interface PrefillContext {
  /** The signer the fields are assigned to (who completes them). */
  signer: EsignSigner;
  /**
   * Every signer on the envelope. A binding may name a DIFFERENT signer as
   * its data source (`prefill.source_signer_id`) — e.g. the spouse's ID
   * number on a form the main client completes. Without this the source is
   * always the assignee.
   */
  signers?: EsignSigner[];
  envelope: {
    advice_case_id?: string;
    product_id?: string;
    request_id?: string;
  };
}

function flattenProfile(raw: Record<string, unknown>): Record<string, unknown> {
  const personal =
    raw.personalInformation && typeof raw.personalInformation === 'object'
      ? (raw.personalInformation as Record<string, unknown>)
      : {};
  return { ...personal, ...raw };
}

async function loadClientFields(clientId: string | undefined): Promise<Record<string, unknown>> {
  if (!clientId || clientId === 'standalone') return {};
  try {
    const profileRaw = (await kv.get(`user_profile:${clientId}:personal_info`)) as Record<
      string,
      unknown
    > | null;
    if (profileRaw) {
      const profile = flattenProfile(profileRaw);
      const first = String(profile.firstName || profile.profile_first_name || '');
      const last = String(profile.lastName || profile.profile_last_name || '');
      const addressParts = [
        profile.residentialAddressLine1,
        profile.residentialSuburb,
        profile.residentialCity,
        profile.residentialProvince,
        profile.residentialPostalCode,
      ].filter(Boolean);

      return {
        name: `${first} ${last}`.trim() || profile.fullName,
        email: profile.email || profile.profile_email,
        phone: profile.phoneNumber || profile.cellphone || profile.profile_phone_number,
        id_number: profile.idNumber || profile.profile_id_number,
        tax_number: profile.taxNumber || profile.profile_tax_number,
        date_of_birth: profile.dateOfBirth || profile.profile_date_of_birth,
        marital_status: profile.maritalStatus || profile.profile_marital_status,
        address: addressParts.join(', ') || profile.residentialAddress,
        profile,
      };
    }

    const legacy = (await kv.get(`client:${clientId}`)) as Record<string, unknown> | null;
    if (!legacy) return {};
    const get = (k: string) => (typeof legacy[k] === 'string' ? legacy[k] : undefined);
    return {
      name: get('name') ?? get('full_name'),
      email: get('email'),
      phone: get('phone') ?? get('mobile'),
      id_number: get('id_number') ?? get('idNumber') ?? get('national_id'),
      address: get('address') ?? get('physical_address'),
    };
  } catch (err) {
    log.warn(`Failed to load client ${clientId} for prefill: ${getErrMsg(err)}`);
    return {};
  }
}

async function resolveToken(
  token: PrefillToken,
  ctx: PrefillContext,
  source: EsignSigner,
  client: Record<string, unknown>,
): Promise<string> {
  if (token.startsWith('key:')) {
    const canonicalKey = token.replace('key:', '');
    const resolved = await resolveCanonicalValueForClient(source.client_id ?? '', canonicalKey);
    return resolved?.value !== undefined && resolved?.value !== null ? String(resolved.value) : '';
  }

  switch (token) {
    case 'client.name':
      return String(client.name ?? source.name ?? '');
    case 'client.email':
      return String(client.email ?? source.email ?? '');
    case 'client.phone':
      return String(client.phone ?? source.phone ?? '');
    case 'client.id_number':
      return String(client.id_number ?? '');
    case 'client.address':
      return String(client.address ?? '');
    case 'client.tax_number':
      return String(client.tax_number ?? '');
    case 'client.date_of_birth':
      return String(client.date_of_birth ?? '');
    case 'client.marital_status':
      return String(client.marital_status ?? '');
    case 'envelope.advice_case_id':
      return ctx.envelope.advice_case_id ?? '';
    case 'envelope.product_id':
      return ctx.envelope.product_id ?? '';
    case 'envelope.request_id':
      return ctx.envelope.request_id ?? '';
    default:
      return '';
  }
}

export async function resolvePrefilledFields(
  fields: EsignField[],
  ctx: PrefillContext,
): Promise<number> {
  const bound = fields.filter((f) => {
    const meta = f.metadata as { prefill?: { token?: PrefillToken } } | undefined;
    return !!meta?.prefill?.token;
  });
  if (bound.length === 0) return 0;

  // Client records are loaded once per source signer.
  const clientCache = new Map<string, Record<string, unknown>>();
  const clientFor = async (source: EsignSigner) => {
    const key = source.client_id ?? '';
    if (!clientCache.has(key)) clientCache.set(key, await loadClientFields(source.client_id));
    return clientCache.get(key)!;
  };
  let resolved = 0;

  for (const field of bound) {
    const meta = field.metadata as {
      prefill?: {
        token: PrefillToken;
        locked?: boolean;
        resolvedAt?: string;
        source_signer_id?: string;
      };
    };
    if (!meta.prefill) continue;
    const sourceId = meta.prefill.source_signer_id;
    const source = (sourceId && ctx.signers?.find((s) => s.id === sourceId)) || ctx.signer;
    const value = await resolveToken(meta.prefill.token, ctx, source, await clientFor(source));
    field.value = value;
    meta.prefill.resolvedAt = new Date().toISOString();
    if (value) resolved += 1;
  }

  log.info(
    `Prefill resolved ${resolved}/${bound.length} bound field(s) for signer ${ctx.signer.email}`,
  );
  return resolved;
}

/**
 * Translate a binding's data source from the sender's wire form to a signer
 * id. The studio names the source by position in the recipient list
 * (`prefill.source_index`), because the real signer ids only exist once the
 * send route has created them. Unknown or absent indexes leave the binding
 * untouched, so the source falls back to the field's assignee.
 */
export function withPrefillSourceSigner(
  metadata: Record<string, unknown> | undefined,
  signerIds: string[],
): Record<string, unknown> | undefined {
  const prefill = metadata?.prefill as Record<string, unknown> | undefined;
  if (!metadata || !prefill || typeof prefill !== 'object') return metadata;
  const idx = prefill.source_index;
  if (typeof idx !== 'number' || !Number.isInteger(idx) || !signerIds[idx]) return metadata;
  return { ...metadata, prefill: { ...prefill, source_signer_id: signerIds[idx] } };
}
