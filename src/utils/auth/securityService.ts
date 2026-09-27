// Client-side Security Service
// Integrates with server-side security features

import { projectId, publicAnonKey } from '../supabase/info';
import { getSupabaseClient } from '../supabase/client';
import { logger } from '../logger';
import { api } from '../api/client';
import { SECURITY_API_ENDPOINTS } from './securityConstants';
import {
  ActivityLogEntry,
  PendingEmailChangeSummary,
  SecurityStatus,
  TwoFactorMethod,
} from './securityTypes';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/auth`;

// --- Existing Authentication Validation Functions ---

/**
 * Validate signup data on server before submitting to Supabase
 */
export async function validateSignupData(data: {
  email: string;
  password: string;
  firstName: string;
  surname: string;
  phoneNumber: string;
  countryCode: string;
}): Promise<{ valid: boolean; error?: string; sanitized?: Record<string, unknown> }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${API_BASE}/signup-validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        return {
          valid: false,
          error: result.error || 'Too many attempts. Please try again later.',
        };
      }
      return {
        valid: false,
        error: result.error || 'Validation failed',
      };
    }

    return {
      valid: true,
      sanitized: result.sanitized,
    };
  } catch (error) {
    // If it's a network error or timeout, allow signup to proceed
    // Client-side validation will still be enforced
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('fetch'))
    ) {
      console.warn('⚠️ Server validation unavailable, proceeding with client-side validation only');
      return {
        valid: true, // Allow to proceed
        sanitized: data, // Use original data
      };
    }

    console.error('Signup validation error:', error);

    return {
      valid: false,
      error: 'Unable to validate signup data. Please try again.',
    };
  }
}

/**
 * Record a sign-out for the CURRENT session.
 *
 * Must be called BEFORE the session is ended: the server takes the identity
 * from this access token rather than from anything in the body, so that nobody
 * can write sign-out entries into a stranger's security log by naming their id.
 * Best-effort — a sign-out must never fail because it could not be logged.
 */
export async function logLogout(accessToken: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: publicAnonKey,
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch (error) {
    // Silently ignore abort errors during logout - they're not critical
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Failed to log logout:', error);
    }
  }
}

/**
 * Log password change
 */
/**
 * Tell the server a password change happened.
 *
 * This does more than log: the endpoint draws the session-revocation
 * watermark for the account, which is what ends any session that predates the
 * change. It therefore sends the USER'S access token, not the anon key — the
 * server derives the identity from that token and ignores the body, so that
 * nobody can revoke a stranger's sessions by naming their id.
 *
 * `email` and `userId` are still accepted for call-site compatibility and are
 * no longer transmitted; the server has both from the token.
 */
export async function logPasswordChange(_email: string, _userId: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const {
      data: { session },
    } = await getSupabaseClient().auth.getSession();

    if (!session?.access_token) {
      // No session means no way to prove which account this is for, and the
      // server would (correctly) reject the call. The password itself has
      // already changed; say so in the console and move on rather than
      // throwing inside a post-change bookkeeping step.
      logger.warn('Password change not recorded: no active session');
      clearTimeout(timeoutId);
      return;
    }

    await fetch(`${API_BASE}/password-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: publicAnonKey,
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch (error) {
    // Silently ignore AbortError as it's expected on timeout
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Failed to log password change:', error);
    }
  }
}

// --- New Security Management Functions (Refactored) ---

export const securityService = {
  /**
   * Fetch security status (2FA, password changed date)
   */
  getSecurityStatus: async (userId: string): Promise<SecurityStatus | null> => {
    try {
      const data = await api.get<{ success: boolean; status?: SecurityStatus }>(
        SECURITY_API_ENDPOINTS.STATUS(userId),
      );

      if (data.success && data.status) {
        return {
          twoFactorEnabled: data.status.twoFactorEnabled || false,
          twoFactorMethod: data.status.twoFactorMethod || 'email',
          loginNotifications: data.status.loginNotifications !== false,
          passwordLastChanged: data.status.passwordLastChanged || null,
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Error fetching security status:', error);
      return null;
    }
  },

  /**
   * Fetch activity logs
   */
  getActivityLogs: async (userId: string, limit = 20): Promise<ActivityLogEntry[]> => {
    try {
      const data = await api.get<{ success: boolean; logs?: ActivityLogEntry[] }>(
        `${SECURITY_API_ENDPOINTS.ACTIVITY(userId)}?limit=${limit}`,
      );

      if (data.success) {
        return data.logs || [];
      }
      return [];
    } catch (error) {
      console.error('❌ Error fetching activity logs:', error);
      return [];
    }
  },

  /**
   * Update password.
   *
   * The server revokes every session minted before the change, this caller's
   * token included (see session-revocation.ts for why there is no exception
   * for it). So the session is refreshed immediately afterwards, using the
   * refresh token that `scope: 'others'` deliberately leaves alive — otherwise
   * the next API call from this tab would 401 on a change that succeeded.
   */
  updatePassword: async (userId: string, currentPassword: string, newPassword: string) => {
    const data = await api.post<{ success: boolean; error?: string }>(
      SECURITY_API_ENDPOINTS.PASSWORD(userId),
      {
        currentPassword,
        newPassword,
      },
    );

    if (!data.success) {
      throw new Error(data.error || 'Failed to update password');
    }

    // Non-fatal: the password HAS changed by now, so a failure here means
    // "sign in again", not "the change failed".
    try {
      const { error } = await getSupabaseClient().auth.refreshSession();
      if (error) {
        logger.warn('Session refresh after password change failed; sign-in will be required', {
          error: error.message,
        });
      }
    } catch (error) {
      logger.warn('Session refresh after password change threw', { error });
    }

    return data;
  },

  /**
   * Toggle 2FA
   */
  toggleTwoFactor: async (userId: string, enabled: boolean, method: TwoFactorMethod) => {
    const data = await api.post<{ success: boolean; error?: string }>(
      SECURITY_API_ENDPOINTS.TWO_FACTOR(userId),
      {
        enabled,
        method,
      },
    );

    if (!data.success) {
      throw new Error(data.error || 'Failed to toggle 2FA');
    }
    return data;
  },

  /**
   * Send 2FA code
   */
  sendTwoFactorCode: async (userId: string, _email?: string) => {
    // The server delivers to the address on the account and ignores any
    // address in the request — a second factor sent wherever the caller asks
    // is no second factor. `_email` stays for call-site compatibility.
    const data = await api.post<{ success: boolean; error?: string }>(
      SECURITY_API_ENDPOINTS.SEND_CODE(userId),
      {},
    );

    if (!data.success) {
      throw new Error(data.error || 'Failed to resend code');
    }
    return data;
  },

  /**
   * Verify 2FA code
   */
  verifyTwoFactorCode: async (userId: string, code: string) => {
    const data = await api.post<{ success: boolean; error?: string }>(
      SECURITY_API_ENDPOINTS.VERIFY_CODE(userId),
      { code },
    );

    if (!data.success) {
      throw new Error(data.error || 'Invalid verification code');
    }
    return data;
  },

  requestEmailChange: async (
    userId: string,
    payload: { newEmail: string; currentPassword?: string },
  ) => {
    const data = await api.post<{
      success: boolean;
      error?: string;
      pendingEmailChange?: PendingEmailChangeSummary | null;
    }>(SECURITY_API_ENDPOINTS.EMAIL_CHANGE_REQUEST(userId), payload);

    if (!data.success) {
      throw new Error(data.error || 'Failed to start email change');
    }
    return data;
  },

  verifyEmailChange: async (
    userId: string,
    payload: { requestId?: string; currentEmailCode?: string; newEmailCode: string },
  ) => {
    const data = await api.post<{
      success: boolean;
      error?: string;
      email?: string;
      requiresReauth?: boolean;
    }>(SECURITY_API_ENDPOINTS.EMAIL_CHANGE_VERIFY(userId), payload);

    if (!data.success) {
      throw new Error(data.error || 'Failed to verify email change');
    }
    return data;
  },

  resendEmailChangeCodes: async (
    userId: string,
    payload: { requestId?: string; target?: 'current' | 'new' | 'both' },
  ) => {
    const data = await api.post<{
      success: boolean;
      error?: string;
      pendingEmailChange?: PendingEmailChangeSummary | null;
    }>(SECURITY_API_ENDPOINTS.EMAIL_CHANGE_RESEND(userId), payload);

    if (!data.success) {
      throw new Error(data.error || 'Failed to resend verification code');
    }
    return data;
  },
};
