import { PERSONNEL_ROLES, SUPER_ADMIN_EMAIL } from './constants.ts';

interface AuthUserLike {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

interface ClientManagementVisibilityInput {
  user: AuthUserLike;
  personnelIds: Set<string>;
  profile?: Record<string, unknown> | null;
  applicationStatus?: unknown;
}

function normalizeStatus(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

export function isPersonnelAuthUser(user: AuthUserLike, personnelIds: Set<string>): boolean {
  const metaRole = user.user_metadata?.role as string | undefined;
  if (metaRole && (PERSONNEL_ROLES as readonly string[]).includes(metaRole)) {
    return true;
  }

  return personnelIds.has(user.id);
}

/** Whether to load client profile KV for this auth user (before visibility decision). */
export function shouldLoadClientManagementProfile(
  user: AuthUserLike,
  personnelIds: Set<string>,
): boolean {
  // Super admin may have a dual personal-client profile — always load KV first
  if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }

  return !isPersonnelAuthUser(user, personnelIds);
}

export function isRejectedClientStatus(...statuses: unknown[]): boolean {
  return statuses.some((status) => {
    const normalized = normalizeStatus(status);
    return normalized === 'declined' || normalized === 'rejected';
  });
}

export function shouldIncludeInClientManagement({
  user,
  personnelIds,
  profile,
  applicationStatus,
}: ClientManagementVisibilityInput): boolean {
  // Shawn-only: super admin can also appear as a test personal client in Client Management
  if (
    user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() &&
    profile?.personalClientEnabled === true
  ) {
    return true;
  }

  if (isPersonnelAuthUser(user, personnelIds)) {
    return false;
  }

  if (
    isRejectedClientStatus(
      applicationStatus,
      profile?.applicationStatus,
      profile?.accountStatus,
      user.user_metadata?.applicationStatus,
      user.user_metadata?.accountStatus,
    )
  ) {
    return false;
  }

  return true;
}
