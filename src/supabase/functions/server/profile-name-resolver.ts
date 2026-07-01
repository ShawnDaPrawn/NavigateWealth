/**
 * Shared client-name resolution for transactional emails.
 *
 * The client-management profile (`user_profile:{userId}:personal_info`) is the
 * source of truth for a client's name. Several email flows previously froze the
 * name at queue/submission time and could greet a renamed client with their old
 * name. These helpers resolve the CURRENT name at send time, with graceful
 * fallbacks so external subscribers and not-yet-provisioned applicants still get
 * a sensible greeting.
 *
 * Leaf module: imports only kv_store + logger so it stays a clean dependency
 * (no cycles with the recipient/notification services that consume it).
 *
 * @module profile-name-resolver
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('profile-name-resolver');

/**
 * Derive a presentable first name from an email local-part.
 * Used as a last-resort fallback when no stored name is available.
 */
export function extractFirstName(email: string): string {
  const local = email.split('@')[0] || 'Subscriber';
  const cleaned = local.replace(/[._-]/g, ' ').replace(/\d+/g, '').trim();

  if (!cleaned) return 'Subscriber';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).split(' ')[0];
}

export function getProfileEmail(
  profile: Record<string, unknown> | null | undefined,
): string | null {
  if (!profile) return null;

  const personalInformation = (profile.personalInformation || {}) as Record<string, unknown>;
  const contactDetails = (profile.contactDetails || {}) as Record<string, unknown>;
  const email = profile.email || personalInformation.email || contactDetails.email;

  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

export function getProfileFirstName(
  profile: Record<string, unknown> | null | undefined,
  fallbackEmail: string,
): string {
  if (!profile) return extractFirstName(fallbackEmail);

  const personalInformation = (profile.personalInformation || {}) as Record<string, unknown>;
  const firstName = profile.firstName || personalInformation.firstName || profile.preferredName;

  return typeof firstName === 'string' && firstName.trim()
    ? firstName.trim()
    : extractFirstName(fallbackEmail);
}

export function getProfileFullName(
  profile: Record<string, unknown> | null | undefined,
  firstName: string,
): string {
  if (!profile) return firstName;

  const personalInformation = (profile.personalInformation || {}) as Record<string, unknown>;
  const name = profile.name;
  const first = profile.firstName || personalInformation.firstName;
  const last = profile.lastName || personalInformation.lastName || personalInformation.surname;

  if (typeof name === 'string' && name.trim()) return name.trim();
  if ((typeof first === 'string' && first.trim()) || (typeof last === 'string' && last.trim())) {
    return `${typeof first === 'string' ? first.trim() : ''} ${typeof last === 'string' ? last.trim() : ''}`.trim();
  }

  return firstName;
}

/**
 * Pull the raw first name stored on a profile (root, nested, or preferredName),
 * or '' when none is present. Unlike getProfileFirstName this does NOT derive a
 * name from an email — the caller decides the fallback order.
 */
function getRawProfileFirstName(profile: Record<string, unknown> | null | undefined): string {
  if (!profile) return '';

  const personalInformation = (profile.personalInformation || {}) as Record<string, unknown>;
  const firstName = profile.firstName || personalInformation.firstName || profile.preferredName;

  return typeof firstName === 'string' && firstName.trim() ? firstName.trim() : '';
}

/**
 * Pull the last name from a profile, checking root and nested locations plus
 * the legacy `surname` alias.
 */
function getProfileLastName(profile: Record<string, unknown> | null | undefined): string {
  if (!profile) return '';

  const personalInformation = (profile.personalInformation || {}) as Record<string, unknown>;
  const last = profile.lastName || personalInformation.lastName || personalInformation.surname;

  return typeof last === 'string' && last.trim() ? last.trim() : '';
}

export interface ResolvedClientNames {
  firstName: string;
  lastName: string;
  fullName: string;
}

/**
 * Resolve a client's current name at send time.
 *
 * Precedence:
 *   1. Live `user_profile:{userId}:personal_info` (root fields, nested
 *      personalInformation, preferredName, legacy surname)
 *   2. Caller-supplied fallback snapshot (e.g. application form data)
 *   3. A first name derived from the fallback email
 *   4. Literal 'Client'
 *
 * Never throws — a KV read error degrades to the fallback so email sending is
 * never blocked by name resolution.
 */
export async function resolveClientNamesByUserId(
  userId: string | null | undefined,
  fallback: { firstName?: string; lastName?: string; email?: string | null },
): Promise<ResolvedClientNames> {
  const fallbackEmail = fallback.email?.trim() || '';

  let profile: Record<string, unknown> | null = null;
  if (userId) {
    try {
      profile = ((await kv.get(`user_profile:${userId}:personal_info`)) || null) as Record<
        string,
        unknown
      > | null;
    } catch (error) {
      log.warn('Failed to read profile for name resolution — falling back to snapshot', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const profileFirst = getRawProfileFirstName(profile);
  const profileLast = getProfileLastName(profile);

  const firstName =
    profileFirst ||
    fallback.firstName?.trim() ||
    (fallbackEmail ? extractFirstName(fallbackEmail) : '') ||
    'Client';
  const lastName = profileLast || fallback.lastName?.trim() || '';
  const fullName = `${firstName} ${lastName}`.trim() || firstName;

  return { firstName, lastName, fullName };
}
