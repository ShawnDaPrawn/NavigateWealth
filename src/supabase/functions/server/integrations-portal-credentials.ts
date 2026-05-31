/**
 * Portal automation — credential records (Phase 5 decomposition).
 * ===============================================================
 *
 * Extracted verbatim from integrations.tsx. KV-backed portal credential storage
 * + profile-id canonicalisation (the Capital Legacy alias) + status projection.
 * Deps: KV store + the shared portal credential types only. Behaviour-preserving.
 */
import * as kv from './kv_store.tsx';
import type {
  PortalCredentialRecord,
  PortalCredentialStatus,
} from './integrations-portal-types.ts';

export function portalCredentialKey(providerId: string, profileId: string): string {
  return `portal-credential:${providerId}:${profileId}`;
}

const CAPITAL_LEGACY_CANONICAL_CREDENTIAL_PROFILE_ID = 'capital_legacy-env';
const CAPITAL_LEGACY_LEGACY_CREDENTIAL_PROFILE_ID = 'capital-legacy-env';

export function normalisePortalCredentialProfileId(profileId: string): string {
  return profileId === CAPITAL_LEGACY_LEGACY_CREDENTIAL_PROFILE_ID
    ? CAPITAL_LEGACY_CANONICAL_CREDENTIAL_PROFILE_ID
    : profileId;
}

export function portalCredentialProfileAliases(profileId: string): string[] {
  const canonical = normalisePortalCredentialProfileId(String(profileId || '').trim());
  if (!canonical) return [];
  if (canonical === CAPITAL_LEGACY_CANONICAL_CREDENTIAL_PROFILE_ID) {
    return [
      CAPITAL_LEGACY_CANONICAL_CREDENTIAL_PROFILE_ID,
      CAPITAL_LEGACY_LEGACY_CREDENTIAL_PROFILE_ID,
    ];
  }
  return [canonical];
}

export async function loadPortalCredentialRecord(
  providerId: string,
  profileId: string,
): Promise<PortalCredentialRecord | null> {
  for (const alias of portalCredentialProfileAliases(profileId)) {
    const record = (await kv.get(
      portalCredentialKey(providerId, alias),
    )) as PortalCredentialRecord | null;
    if (record?.username || record?.password) {
      return {
        ...record,
        profileId: normalisePortalCredentialProfileId(String(record.profileId || alias)),
      };
    }
  }
  return null;
}

export async function savePortalCredentialRecord(record: PortalCredentialRecord): Promise<void> {
  const canonicalRecord = {
    ...record,
    profileId: normalisePortalCredentialProfileId(String(record.profileId || '')),
  };
  for (const alias of portalCredentialProfileAliases(canonicalRecord.profileId)) {
    await kv.set(portalCredentialKey(canonicalRecord.providerId, alias), canonicalRecord);
  }
}

export function portalCredentialStatus(
  record: PortalCredentialRecord | null,
  providerId: string,
  profileId: string,
): PortalCredentialStatus {
  return {
    providerId,
    profileId: normalisePortalCredentialProfileId(profileId),
    hasUsername: !!record?.username,
    hasPassword: !!record?.password,
    updatedAt: record?.updatedAt,
    updatedBy: record?.updatedBy,
  };
}
