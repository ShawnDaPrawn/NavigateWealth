// User Profile Service - Handles profile data operations

import { projectId, publicAnonKey } from '../supabase/info';
import { AppUser, UserProfile, UserSuspensionStatus, AccountStatus } from './types';
import { AUTH_ERRORS, DEFAULT_ACCOUNT_TYPE, DEFAULT_APPLICATION_STATUS, DEFAULT_ACCOUNT_STATUS, DEFAULT_ROLE, SUPER_ADMIN_EMAIL } from './constants';
import { getCurrentUserWithMetadata } from './authService';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

/**
 * Personnel (staff) roles — matches the server-side PERSONNEL_ROLES constant.
 * Users with any of these roles should NOT get a client-type profile created.
 */
const PERSONNEL_ROLES = [
  'super_admin', 'admin', 'adviser', 'paraplanner', 'compliance', 'viewer',
] as const;

/**
 * Fetch security status including suspension info
 */
async function fetchSecurityStatus(userId: string): Promise<UserSuspensionStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for non-critical check

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
      console.warn('⚠️ Failed to fetch security status, assuming not suspended');
      return { suspended: false };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
        console.warn('⚠️ Security status check returned HTML (likely server error), assuming not suspended');
        return { suspended: false };
    }

    const data = await response.json();
    return data.status || { suspended: false };
  } catch (error) {
    // Suppress network errors (backend might be sleeping)
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('Failed to fetch'))) {
      console.log('ℹ️ Backend unreachable for security status check, proceeding with default.');
    } else {
      console.warn('⚠️ Error fetching security status:', error);
    }
    return { suspended: false };
  }
}

/**
 * Load user profile from KV store
 */
export async function loadUserProfile(userId: string, email: string): Promise<AppUser> {
  try {
    console.log('📝 Loading user profile for:', userId, email);
    
    // Get Supabase user metadata first
    const supabaseUserData = await getCurrentUserWithMetadata();
    
    // Check suspension status
    const securityStatus = await fetchSecurityStatus(userId);
    
    if (!userId || !email) {
      console.warn('⚠️ Missing userId or email for profile load, skipping fetch.');
      throw new Error('Missing required user credentials');
    }

    const key = `user_profile:${userId}:personal_info`;
    const encodedKey = encodeURIComponent(key);
    const encodedEmail = encodeURIComponent(email);
    
    // Retry logic for fetching profile
    let response;
    let retries = 3;
    let lastError;

    while (retries > 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        response = await fetch(
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
        break; // Success or non-network error, break loop
      } catch (err) {
        lastError = err;
        // Suppress retry warnings for network errors
        if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('Failed to fetch'))) {
          console.log(`ℹ️ Backend unreachable or timed out (profile), retrying... (${retries} attempts left)`);
        } else {
          console.warn(`⚠️ Failed to fetch profile, retrying... (${retries} attempts left)`);
        }
        retries--;
        if (retries > 0) await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to connect to server');
    }

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
          console.error('❌ Profile load returned HTML instead of JSON');
          throw new Error('Server returned HTML error page');
      }

      const result = await response.json();
      const profileData: UserProfile = result.data || result;
      
      console.log('✅ Profile loaded successfully:', { 
        role: profileData.role,
        email: email,
        isSuperAdmin: email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase(),
        applicationStatus: profileData.applicationStatus,
        adviserAssigned: profileData.adviserAssigned,
        suspended: securityStatus?.suspended,
      });

      // ── Self-healing reconciliation (§5.4, §12.3) ──────────────────────────
      // If the Supabase auth metadata says 'approved' or 'declined' but the KV
      // profile still has a pre-decision status (e.g. 'submitted_for_review'),
      // it means an admin approved/declined the application before the server-side
      // fix that writes accountStatus back to the KV profile. Patch the KV profile
      // so the mismatch is resolved permanently.
      const PRE_DECISION_STATUSES = ['submitted_for_review', 'application_in_progress', 'no_application'];
      const kvStatus = profileData.accountStatus;
      const supabaseStatus = supabaseUserData?.accountStatus;

      if (
        kvStatus &&
        supabaseStatus &&
        PRE_DECISION_STATUSES.includes(kvStatus) &&
        (supabaseStatus === 'approved' || supabaseStatus === 'declined')
      ) {
        console.log(
          `ℹ️ KV/Supabase accountStatus mismatch detected — auto-healing.`,
          `KV: "${kvStatus}", Supabase: "${supabaseStatus}".`
        );
        // Patch the KV profile before mapping so this reconciliation only runs once
        profileData.accountStatus = supabaseStatus as AccountStatus;
        try {
          await updateUserProfile(userId, { accountStatus: supabaseStatus } as Partial<UserProfile>);
          console.log('✅ KV profile auto-healed to', supabaseStatus);
        } catch (healErr) {
          // Non-blocking: the in-memory patch still ensures correct routing this session
          console.warn('⚠️ Failed to persist KV profile auto-heal:', healErr);
        }
      }
      
      return mapProfileToAppUser(userId, email, profileData, supabaseUserData, securityStatus);
    }

    // Profile doesn't exist (404) or other error - create default profile
    if (response.status === 404 || !response.ok) {
      // ── Personnel guard (Change E) ──────────────────────────────────
      // If the user's Supabase metadata indicates a personnel role or
      // the invited flag, skip client profile creation and return a
      // minimal personnel AppUser instead.
      const metaRole = supabaseUserData?.role as string | undefined;
      const isInvited = supabaseUserData?.invited === true;
      const isPersonnel =
        (metaRole && (PERSONNEL_ROLES as readonly string[]).includes(metaRole)) ||
        isInvited;

      if (isPersonnel) {
        console.log('ℹ️ User is personnel — skipping client profile creation', {
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
          role: metaRole || 'admin',
          applicationStatus: DEFAULT_APPLICATION_STATUS, // DEPRECATED — personnel users get default
          accountStatus: 'approved' as AccountStatus,
          accountType: undefined,
          adviserAssigned: true,
          suspended: securityStatus?.suspended || false,
        };
      }

      console.log('❌ Profile not found (or error), creating default profile. Status:', response.status);
      await createDefaultProfile(userId, email, supabaseUserData?.firstName || '');
      
      // Reload the profile after creation with simple retry
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const retryResponse = await fetch(
        `${API_BASE}/profile/personal-info?key=${encodedKey}&email=${encodedEmail}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (retryResponse.ok) {
        const result = await retryResponse.json();
        const profileData: UserProfile = result.data || result;
        return mapProfileToAppUser(userId, email, profileData, supabaseUserData, securityStatus);
      }
    }

    throw new Error('Failed to load profile after creation');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('ℹ️ Profile loading timed out or aborted');
    } else {
      console.error('❌ Error loading profile:', error);
    }
    
    // If all else fails, return a minimal user object to prevent login failures
    const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    console.log('ℹ️ Login validation server unavailable (likely cold start or dev mode), proceeding with login.');
    
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
 * Create default profile for new user
 */
export async function createDefaultProfile(userId: string, email: string, displayName: string = ''): Promise<void> {
  try {
    console.log('📝 Creating default profile for user:', userId);
    
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
      // Don't log full HTML if it's an HTML error page
      if (errorText.trim().startsWith('<!DOCTYPE html') || errorText.trim().startsWith('<html')) {
         console.error('❌ Failed to create default profile: Server returned HTML error page');
      } else {
         console.error('❌ Failed to create default profile:', errorText);
      }
    } else {
      const responseData = await response.json();
      console.log('✅ Default profile created successfully:', responseData);
    }
  } catch (error) {
    console.error('❌ Error creating default profile:', error);
    throw new Error(AUTH_ERRORS.PROFILE_LOAD_ERROR);
  }
}

/**
 * Update user profile
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
    
    console.log('✅ Profile updated successfully');
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    throw error;
  }
}

// Helper Functions

/**
 * Map profile data to AppUser
 */
function mapProfileToAppUser(
  userId: string,
  email: string,
  profileData: UserProfile,
  supabaseUserData: Awaited<ReturnType<typeof getCurrentUserWithMetadata>> | null,
  securityStatus?: UserSuspensionStatus
): AppUser {
  // Check if this is the super admin email
  const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  
  // Determine role: super_admin for super admin, otherwise use profile data or default to client
  const userRole = isSuperAdmin ? 'super_admin' : (profileData.role || DEFAULT_ROLE);
  
  // accountStatus resolution: KV profile is the source of truth.
  // Self-healing reconciliation (when KV and Supabase metadata diverge after
  // approval/decline) is handled upstream in loadUserProfile — by the time we
  // reach this function, profileData.accountStatus is already corrected.
  const resolvedAccountStatus: AccountStatus = (
    profileData.accountStatus ||
    (supabaseUserData?.accountStatus as AccountStatus) ||
    (isSuperAdmin ? 'approved' : DEFAULT_ACCOUNT_STATUS)
  ) as AccountStatus;

  const mappedUser: AppUser = {
    id: userId,
    email,
    // Use KV store data if available, otherwise fall back to Supabase metadata
    firstName: profileData.personalInformation?.firstName || supabaseUserData?.firstName || '',
    lastName: profileData.personalInformation?.lastName || supabaseUserData?.lastName || '',
    role: userRole, // Role-based access control
    applicationStatus: (profileData.applicationStatus as AppUser['applicationStatus']) || DEFAULT_APPLICATION_STATUS, // DEPRECATED
    accountStatus: resolvedAccountStatus,
    accountType: (profileData.accountType as AppUser['accountType']) || undefined,
    adviserAssigned: profileData.adviserAssigned || isSuperAdmin,
    // Security status
    suspended: securityStatus?.suspended || false,
    suspendedReason: securityStatus?.suspendedReason,
    suspendedAt: securityStatus?.suspendedAt,
  };
  
  console.log('🗺️ Mapped profile to AppUser:', {
    email,
    isSuperAdmin,
    profileRole: profileData.role,
    finalRole: mappedUser.role,
    supabaseAccountStatus: supabaseUserData?.accountStatus,
    kvAccountStatus: profileData.accountStatus,
    finalAccountStatus: mappedUser.accountStatus,
    applicationStatus: mappedUser.applicationStatus
  });
  
  return mappedUser;
}