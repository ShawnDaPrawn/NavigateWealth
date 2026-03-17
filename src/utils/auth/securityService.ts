// Client-side Security Service
// Integrates with server-side security features

import { projectId, publicAnonKey } from '../supabase/info';
import { api } from '../api/client';
import { SECURITY_API_ENDPOINTS } from './securityConstants';
import { ActivityLogEntry, SecurityStatus, TwoFactorMethod } from './securityTypes';

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
        'Authorization': `Bearer ${publicAnonKey}`,
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
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch'))) {
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
 * Validate login attempt on server (rate limiting check)
 */
export async function validateLoginAttempt(email: string): Promise<{
  allowed: boolean;
  error?: string;
  blocked?: boolean;
  resetAt?: Date;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${API_BASE}/login-validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        return {
          allowed: false,
          blocked: result.blocked,
          error: result.error || 'Too many login attempts',
          resetAt: result.resetAt ? new Date(result.resetAt) : undefined,
        };
      }
      return {
        allowed: true, // Allow attempt, let Supabase handle validation
      };
    }

    return { allowed: true };
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch'))) {
      console.log('ℹ️ Login validation server unavailable (likely cold start or dev mode), proceeding with login.');
      return { allowed: true };
    }
    console.error('Login validation error:', error);
    // Fail open - allow login attempt to proceed
    return { allowed: true };
  }
}

/**
 * Log successful login
 */
export async function logLoginSuccess(email: string, userId: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${API_BASE}/login-success`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ email, userId }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
  } catch (error) {
    // Don't throw - logging failure shouldn't break login
    // Silently ignore AbortError as it's expected on timeout
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Failed to log login success:', error);
    }
  }
}

/**
 * Log failed login
 */
export async function logLoginFailure(email: string, reason: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    await fetch(`${API_BASE}/login-failure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ email, reason }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
  } catch (error) {
    // Silently ignore AbortError as it's expected on timeout
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Failed to log login failure:', error);
    }
  }
}

/**
 * Log logout event
 */
export async function logLogout(email: string, userId: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ email, userId }),
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
 * Log password reset request
 */
export async function logPasswordResetRequest(email: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${API_BASE}/password-reset-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    // Always return generic message (prevent account enumeration)
    return {
      success: true,
      message: result.message || 'If an account exists with this email, a password reset link has been sent.',
    };
  } catch (error) {
    console.error('Password reset request error:', error);
    // Generic message even on error
    return {
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    };
  }
}

/**
 * Log password change
 */
export async function logPasswordChange(email: string, userId: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    await fetch(`${API_BASE}/password-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ email, userId }),
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
      const data = await api.get<{ success: boolean; status?: SecurityStatus }>(SECURITY_API_ENDPOINTS.STATUS(userId));
      
      if (data.success && data.status) {
        return {
          twoFactorEnabled: data.status.twoFactorEnabled || false,
          twoFactorMethod: data.status.twoFactorMethod || 'email',
          loginNotifications: data.status.loginNotifications !== false,
          passwordLastChanged: data.status.passwordLastChanged || null
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
      const data = await api.get<{ success: boolean; logs?: ActivityLogEntry[] }>(`${SECURITY_API_ENDPOINTS.ACTIVITY(userId)}?limit=${limit}`);
      
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
   * Update password
   */
  updatePassword: async (userId: string, currentPassword: string, newPassword: string) => {
    const data = await api.post<{ success: boolean; error?: string }>(SECURITY_API_ENDPOINTS.PASSWORD(userId), {
      currentPassword,
      newPassword
    });
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to update password');
    }
    return data;
  },

  /**
   * Toggle 2FA
   */
  toggleTwoFactor: async (userId: string, enabled: boolean, method: TwoFactorMethod) => {
    const data = await api.post<{ success: boolean; error?: string }>(SECURITY_API_ENDPOINTS.TWO_FACTOR(userId), {
      enabled,
      method
    });

    if (!data.success) {
      throw new Error(data.error || 'Failed to toggle 2FA');
    }
    return data;
  },

  /**
   * Send 2FA code
   */
  sendTwoFactorCode: async (userId: string, email?: string) => {
    const data = await api.post<{ success: boolean; error?: string }>(SECURITY_API_ENDPOINTS.SEND_CODE(userId), { email });
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to resend code');
    }
    return data;
  },

  /**
   * Verify 2FA code
   */
  verifyTwoFactorCode: async (userId: string, code: string) => {
    const data = await api.post<{ success: boolean; error?: string }>(SECURITY_API_ENDPOINTS.VERIFY_CODE(userId), { code });

    if (!data.success) {
      throw new Error(data.error || 'Invalid verification code');
    }
    return data;
  }
};