import type { ClientProfile, ProfileData } from './types';

/**
 * Normalise KV `user_profile:*:personal_info` for admin UI lists & search.
 *
 * Legacy blobs may contain BOTH root-level `{ firstName, lastName }` updated by
 * the Personal Info editor AND an older nested `personalInformation.{firstName,...}`.
 * The previous merge put nested fields last, so stale nested names silently overwrote
 * fresh root edits ("Aaron" saved at root still displayed as nested "Individual").
 *
 * Merge rule: overlapping keys favour **root (flat) KV fields** over nested copies.
 */
export function normalizeClientProfileKv(raw: unknown): ClientProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;

  if (obj.personalInformation && typeof obj.personalInformation === 'object') {
    const { personalInformation, ...flatProfileFields } = obj;
    return {
      ...obj,
      personalInformation: {
        ...(personalInformation as Record<string, unknown>),
        ...flatProfileFields,
      } as ProfileData,
    } as ClientProfile;
  }

  return { personalInformation: obj as ProfileData };
}
