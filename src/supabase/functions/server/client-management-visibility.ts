import { PERSONNEL_ROLES } from './constants.ts';

interface AuthUserLike {
  id: string;
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

export function isPersonnelAuthUser(
  user: AuthUserLike,
  personnelIds: Set<string>,
): boolean {
  const metaRole = user.user_metadata?.role as string | undefined;
  if (metaRole && (PERSONNEL_ROLES as readonly string[]).includes(metaRole)) {
    return true;
  }

  return personnelIds.has(user.id);
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
