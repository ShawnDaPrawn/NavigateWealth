/**
 * E-Signature CRM Prefill Resolver (Phase 3.6 + Key Manager tokens)
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { resolveCanonicalValueForClient } from './form-prefill-resolver.ts';
import type { EsignField, EsignSigner } from './esign-types.ts';

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
  signer: EsignSigner;
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
    log.warn(
      `Failed to load client ${clientId} for prefill: ${err instanceof Error ? err.message : String(err)}`,
    );
    return {};
  }
}

async function resolveToken(
  token: PrefillToken,
  ctx: PrefillContext,
  client: Record<string, unknown>,
): Promise<string> {
  if (token.startsWith('key:')) {
    const canonicalKey = token.replace('key:', '');
    const resolved = await resolveCanonicalValueForClient(ctx.signer.client_id, canonicalKey);
    return resolved?.value !== undefined && resolved?.value !== null ? String(resolved.value) : '';
  }

  switch (token) {
    case 'client.name':
      return String(client.name ?? ctx.signer.name ?? '');
    case 'client.email':
      return String(client.email ?? ctx.signer.email ?? '');
    case 'client.phone':
      return String(client.phone ?? ctx.signer.phone ?? '');
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
    default: {
      const _exhaustive: never = token;
      void _exhaustive;
      return '';
    }
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

  const client = await loadClientFields(ctx.signer.client_id);
  let resolved = 0;

  for (const field of bound) {
    const meta = field.metadata as {
      prefill?: { token: PrefillToken; locked?: boolean; resolvedAt?: string };
    };
    if (!meta.prefill) continue;
    const value = await resolveToken(meta.prefill.token, ctx, client);
    field.value = value;
    meta.prefill.resolvedAt = new Date().toISOString();
    if (value) resolved += 1;
  }

  log.info(
    `Prefill resolved ${resolved}/${bound.length} bound field(s) for signer ${ctx.signer.email}`,
  );
  return resolved;
}
