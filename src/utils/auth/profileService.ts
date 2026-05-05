// User Profile Service - Handles profile data operations

import { projectId, publicAnonKey } from '../supabase/info';
import { AppUser, UserProfile, UserSuspensionStatus, AccountStatus } from './types';
import { AUTH_ERRORS, DEFAULT_APPLICATION_STATUS, DEFAULT_ACCOUNT_STATUS, DEFAULT_ROLE, SUPER_ADMIN_EMAIL } from './constants';
import { getCurrentUserWithMetadata } from './authService';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

/**
 * Personnel (staff) roles - matches the server-side PERSONNEL_ROLES constant.
 * Users with any of these roles should NOT get a client-type profile created.
 */
const PERSONNEL_ROLES = [
  'super_admin', 'admin', 'adviser', 'paraplanner', 'compliance', 'viewer',
] as const;

/**
 * Normalise legacy or malformed account status values into the finite set the
 * route guards understand. This prevents successful sign-ins from landing in
 * redirect loops when older profiles contain values like "pending".
 */
function normalizeAccountStatus(status?: string | null): AccountStatus | undefined {
  switch (status) {
    case 'approved':
    case 'declined':
    case 'submitted_for_review':
    case 'application_in_progress':
    case 'no_application':
      return status;
    case 'pending':
    case 'not_started':
      return 'no_application';
    case 'draft':
    case 'in_progress':
      return 'application_in_progress';
    case 'submitted':
      return 'submitted_for_review';
    default:
      return undefined;
  }
}

type SessionUserLike = {
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
} | null | undefined;

/**
 * Best-effort AppUser when KV/profile loading fails or times out. Uses Supabase
 * session metadata for personnel detection so admin routes are not bricked.
 */
export function buildAppUserFromAuthSessionFallback(
  userId: string,
  email: string,
  sessionUser?: SessionUserLike,
): AppUser {
  const metadata = sessionUser?.user_metadata || {};
  const metaRole = typeof metadata.role === 'string' ? metadata.role : undefined;
  const invited =
    metadata.invited === true || sessionUser?.app_metadata?.invited === true;

  const isPersonnel =
    (!!metaRole && (PERSONNEL_ROLES as readonly string[]).includes(metaRole)) || invited;

  if (isPersonnel) {
    return {
      id: userId,
      email,
      firstName: '',
      lastName: '',
      role: (metaRole || 'admin') as AppUser['role'],
      applicationStatus: DEFAULT_APPLICATION_STATUS,
      accountStatus: 'approved',
      accountType: undefined,
      adviserAssigned: true,
      suspended: false,
    };
  }

  const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  return {
    id: userId,
    email,
    firstName: '',
    lastName: '',
    role: isSuperAdmin ? 'super_admin' : DEFAULT_ROLE,
    applicationStatus: DEFAULT_APPLICATION_STATUS,
    accountStatus: isSuperAdmin ? 'approved' : DEFAULT_ACCOUNT_STATUS,
    accountType: undefined,
    adviserAssigned: isSuperAdmin,
    suspended: false,
  };
}

/**
 * Fetch security status including suspension info.
 */
async function fetchSecurityStatus(userId: string): Promise<UserSuspensionStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${API_BASE}/security/${userId}/status`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey,
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('Security status fetch failed, assuming not suspended');
      return { suspended: false };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.warn('Security status returned HTML, assuming not suspended');
      return { suspended: false };
    }

    const data = await response.json();
    return data.status || { suspended: false };
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('Failed to fetch'))) {
      console.log('Security status unavailable, proceeding with default');
    } else {
      console.warn('Error fetching security status:', error);
    }
    return { suspended: false };
  }
}

async function fetchProfileResponse(encodedKey: string, encodedEmail: string): Promise<Response> {
  let retries = 3;
  let lastError: unknown;

  while (retries > 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${API_BASE}/profile/personal-info?key=${encodedKey}&email=${encodedEmail}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey,
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      return response;
    } catch (err) {
      lastError = err;
      if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('Failed to fetch'))) {
        console.log(`Profile fetch timed out, retrying... (${retries} attempts left)`);
      } else {
        console.warn(`Profile fetch failed, retrying... (${retries} attempts left)`);
      }
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw lastError || new Error('Failed to connect to server');
}

/**
 * Load user profile from KV store.
 */
export async function loadUserProfile(userId: string, email: string): Promise<AppUser> {
  try {
    console.log('Loading user profile for:', userId, email);

    if (!userId || !email) {
      console.warn('Missing userId or email for profile load, skipping fetch.');
      throw new Error('Missing required user credentials');
    }

    const key = `user_profile:${userId}:personal_info`;
    const encodedKey = encodeURIComponent(key);
    const encodedEmail = encodeURIComponent(email);

    const [supabaseUserData, securityStatus, response] = await Promise.all([
      getCurrentUserWithMetadata(),
      fetchSecurityStatus(userId),
      fetchProfileResponse(encodedKey, encodedEmail),
    ]);

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error('Profile load returned HTML instead of JSON');
        throw new Error('Server returned HTML error page');
      }

      const result = await response.json();
      const profileData: UserProfile = result.data || result;

      console.log('Profile loaded successfully:', {
        role: profileData.role,
        email,
        isSuperAdmin: email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase(),
        applicationStatus: profileData.applicationStatus,
        adviserAssigned: profileData.adviserAssigned,
        suspended: securityStatus?.suspended,
      });

      const preDecisionStatuses = ['submitted_for_review', 'application_in_progress', 'no_application'];
      const kvStatus = profileData.accountStatus;
      const supabaseStatus = supabaseUserData?.accountStatus;

      if (
        kvStatus &&
        supabaseStatus &&
        preDecisionStatuses.includes(kvStatus) &&
        (supabaseStatus === 'approved' || supabaseStatus === 'declined')
      ) {
        console.log(
          'KV/Supabase accountStatus mismatch detected - auto-healing.',
          `KV: "${kvStatus}", Supabase: "${supabaseStatus}".`
        );
        profileData.accountStatus = supabaseStatus as AccountStatus;
        try {
          await updateUserProfile(userId, { accountStatus: supabaseStatus } as Partial<UserProfile>);
          console.log('KV profile auto-healed to', supabaseStatus);
        } catch (healErr) {
          console.warn('Failed to persist KV profile auto-heal:', healErr);
        }
      }

      return mapProfileToAppUser(userId, email, profileData, supabaseUserData, securityStatus);
    }

    if (response.status === 404 || !response.ok) {
      const metaRole = (supabaseUserData as (Awaited<ReturnType<typeof getCurrentUserWithMetadata>> & { role?: string; invited?: boolean }) | null)?.role;
      const isInvited = (supabaseUserData as (Awaited<ReturnType<typeof getCurrentUserWithMetadata>> & { role?: string; invited?: boolean }) | null)?.invited === true;
      const isPersonnel =
        (metaRole && (PERSONNEL_ROLES as readonly string[]).includes(metaRole)) ||
        isInvited;

      if (isPersonnel) {
        console.log('User is personnel - skipping client profile creation', {
          userId,
          email,
          metaRole,
          isInvited,
        });
        return {
          id: userId,
          email,
          firstName: supabaseUserData?.firstName || '',
          lastName: supabaseUserData?.lastName || '',
          role: (metaRole || 'admin') as AppUser['role'],
          applicationStatus: DEFAULT_APPLICATION_STATUS,
          accountStatus: 'approved' as AccountStatus,
          accountType: undefined,
          adviserAssigned: true,
          suspended: securityStatus?.suspended || false,
        };
      }

      console.log('Profile not found (or error), creating default profile. Status:', response.status);
      await createDefaultProfile(userId, email, supabaseUserData?.firstName || '');

      const retryResponse = await fetchProfileResponse(encodedKey, encodedEmail);

      if (retryResponse.ok) {
        const result = await retryResponse.json();
        const profileData: UserProfile = result.data || result;
        return mapProfileToAppUser(userId, email, profileData, supabaseUserData, securityStatus);
      }
    }

    throw new Error('Failed to load profile after creation');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Profile loading timed out or aborted');
    } else {
      console.error('Error loading profile:', error);
    }

    const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    console.log('Login validation server unavailable (likely cold start or dev mode), proceeding with login.');

    return {
      id: userId,
      email,
      firstName: '',
      lastName: '',
      role: isSuperAdmin ? 'super_admin' : DEFAULT_ROLE,
      applicationStatus: DEFAULT_APPLICATION_STATUS,
      accountStatus: isSuperAdmin ? 'approved' : DEFAULT_ACCOUNT_STATUS,
      accountType: undefined,
      adviserAssigned: isSuperAdmin,
      suspended: false,
    };
  }
}

/**
 * Create default profile for new user.
 */
export async function createDefaultProfile(userId: string, email: string, displayName: string = ''): Promise<void> {
  try {
    console.log('Creating default profile for user:', userId);

    const response = await fetch(`${API_BASE}/profile/create-default`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
      },
      body: JSON.stringify({
        userId,
        email,
        displayName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.trim().startsWith('<!DOCTYPE html') || errorText.trim().startsWith('<html')) {
        console.error('Failed to create default profile: Server returned HTML error page');
      } else {
        console.error('Failed to create default profile:', errorText);
      }
    } else {
      const responseData = await response.json();
      console.log('Default profile created successfully:', responseData);
    }
  } catch (error) {
    console.error('Error creating default profile:', error);
    throw new Error(AUTH_ERRORS.PROFILE_LOAD_ERROR);
  }
}

/**
 * Update user profile.
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> {
  try {
    const key = `user_profile:${userId}:personal_info`;

    const response = await fetch(`${API_BASE}/profile/personal-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
      },
      body: JSON.stringify({ key, data: updates }),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    console.log('Profile updated successfully');
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

// Helper Functions

/**
 * Map profile data to AppUser.
 */
function mapProfileToAppUser(
  userId: string,
  email: string,
  profileData: UserProfile,
  supabaseUserData: Awaited<ReturnType<typeof getCurrentUserWithMetadata>> | null,
  securityStatus?: UserSuspensionStatus
): AppUser {
  const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const userRole = isSuperAdmin ? 'super_admin' : (profileData.role || DEFAULT_ROLE);

  const normalizedProfileStatus = normalizeAccountStatus(profileData.accountStatus);
  const normalizedSupabaseStatus = normalizeAccountStatus(supabaseUserData?.accountStatus);
  const resolvedAccountStatus: AccountStatus = (
    normalizedProfileStatus ||
    normalizedSupabaseStatus ||
    (isSuperAdmin ? 'approved' : DEFAULT_ACCOUNT_STATUS)
  ) as AccountStatus;

  const mappedUser: AppUser = {
    id: userId,
    email,
    firstName: profileData.personalInformation?.firstName || supabaseUserData?.firstName || '',
    lastName: profileData.personalInformation?.lastName || supabaseUserData?.lastName || '',
    role: userRole,
    applicationStatus: (profileData.applicationStatus as AppUser['applicationStatus']) || DEFAULT_APPLICATION_STATUS,
    accountStatus: resolvedAccountStatus,
    accountType: (profileData.accountType as AppUser['accountType']) || undefined,
    adviserAssigned: profileData.adviserAssigned || isSuperAdmin,
    suspended: securityStatus?.suspended || false,
    suspendedReason: securityStatus?.suspendedReason,
    suspendedAt: securityStatus?.suspendedAt,
  };

  console.log('Mapped profile to AppUser:', {
    email,
    isSuperAdmin,
    profileRole: profileData.role,
    finalRole: mappedUser.role,
    supabaseAccountStatus: supabaseUserData?.accountStatus,
    kvAccountStatus: profileData.accountStatus,
    finalAccountStatus: mappedUser.accountStatus,
    applicationStatus: mappedUser.applicationStatus,
  });

  return mappedUser;
}
