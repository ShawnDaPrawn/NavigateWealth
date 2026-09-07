// Authentication Service - Core Supabase auth operations

import { getSupabaseClient } from '../supabase/client';
import { User } from '@supabase/supabase-js';
import { AuthUser, SignUpResult, SignInResult, AuthCallback } from './types';
import { AuthError, parseAuthError } from './errorHandler';
import { AUTH_ERRORS, AUTH_ROUTES } from './constants';
import { projectId, publicAnonKey } from '../supabase/info';
import { validateSignupData, logLogout, logPasswordChange } from './securityService';
import { logger } from '../logger';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

/**
 * Sign up new user with email and password
 */
export async function signUp(
  email: string,
  password: string,
  metadata?: {
    firstName?: string;
    surname?: string;
    fullPhoneNumber?: string;
    countryCode?: string;
    phoneNumber?: string;
  },
): Promise<SignUpResult> {
  try {
    logger.info('Starting signup process...', { email });

    // Server-side validation with rate limiting
    const validation = await validateSignupData({
      email,
      password,
      firstName: metadata?.firstName || '',
      surname: metadata?.surname || '',
      phoneNumber: metadata?.phoneNumber || '',
      countryCode: metadata?.countryCode || '+27',
    });

    if (!validation.valid) {
      throw new AuthError(validation.error || 'Validation failed', 'validation_failed');
    }

    // Use sanitized data from server
    const sanitizedFirstName = validation.sanitized?.firstName || metadata?.firstName;
    const sanitizedSurname = validation.sanitized?.surname || metadata?.surname;

    // Call backend signup endpoint which handles user creation, application, and admin notification
    logger.info('Calling backend signup endpoint...');
    const response = await fetch(`${API_BASE}/auth-signup/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
        apikey: publicAnonKey,
      },
      body: JSON.stringify({
        email,
        password,
        firstName: sanitizedFirstName,
        surname: sanitizedSurname,
        countryCode: metadata?.countryCode || '+27',
        phoneNumber: metadata?.phoneNumber || '',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Backend signup error:', errorData);
      throw new AuthError(errorData.error || 'Signup failed', 'signup_failed');
    }

    await response.json();
    logger.info('Backend signup accepted');

    // The endpoint returns NOTHING account-specific — same body whether the
    // address was new or already registered, so that signup cannot be used to
    // test whether someone is a client of the firm (see auth-signup.ts). There
    // is therefore no id or confirmed-email state to report, and the caller's
    // only correct next step is the "check your email" screen.
    return {
      user: {
        id: '',
        email,
        emailConfirmed: false, // Email verification required
        createdAt: new Date().toISOString(),
      },
      session: null, // No session until email is verified
    };
  } catch (error) {
    console.error('❌ Signup error:', error);
    throw parseAuthError(error);
  }
}

/**
 * Sign in existing user with email and password.
 *
 * WHY THIS GOES THROUGH THE EDGE FUNCTION
 * ---------------------------------------
 * It used to ask the server "may I try?" (`validateLoginAttempt`) and then, if
 * told yes, authenticate against GoTrue directly. The lockout therefore only
 * held for clients that chose to ask — which is to say it held for this app
 * and for nobody attacking it. `POST /auth/login` performs the rate-limit
 * check and the credential check in the same handler, so attempt six cannot
 * reach GoTrue at all.
 *
 * The endpoint returns the GoTrue session unchanged; `setSession` installs it
 * so every downstream consumer (`onAuthStateChange`, the token refresh loop,
 * `getSession`) behaves exactly as it did when the browser signed in itself.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const supabase = getSupabaseClient();

  try {
    logger.info('Starting sign in process...', { email });

    // One request, one round trip: the server rate-limits, authenticates, logs
    // the attempt and clears the counters on success.
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // `apikey` only, and no `Authorization` — this endpoint is public by
          // necessity and no route authenticates the anon key, so sending it as
          // a bearer would disguise "not logged in" as "token rejected". See
          // the anon-key-bearer ratchet.
          apikey: publicAnonKey,
        },
        body: JSON.stringify({ email, password }),
      });
    } catch (networkError) {
      // The login service being unreachable is not a licence to fall back to
      // signing in around it — that fallback is precisely the bypass this
      // change removes, and an attacker can cause it at will by blocking one
      // host. Fail closed and say so.
      logger.warn('Login service unreachable', { error: networkError });
      throw new AuthError(
        'We could not reach the sign-in service. Please check your connection and try again.',
        'network_error',
      );
    }

    const result = (await response.json().catch(() => ({}))) as {
      session?: { access_token?: string; refresh_token?: string } | null;
      user?: { id?: string } | null;
      error?: string;
      blocked?: boolean;
    };

    if (!response.ok) {
      if (response.status === 429) {
        throw new AuthError(
          result.error || 'Too many login attempts. Please try again later.',
          'rate_limited',
        );
      }
      throw new AuthError(result.error || AUTH_ERRORS.INVALID_CREDENTIALS, 'invalid_credentials');
    }

    if (!result.session?.access_token || !result.session?.refresh_token || !result.user) {
      throw new AuthError(AUTH_ERRORS.INVALID_CREDENTIALS, 'invalid_credentials');
    }

    // Install the session the server obtained. This is what makes the rest of
    // the app — which reads `supabase.auth.getSession()` — see a normal login.
    const { data, error: setSessionError } = await supabase.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    });

    if (setSessionError || !data.user) {
      logger.error('Failed to install session after login', setSessionError);
      throw parseAuthError(setSessionError ?? new Error('Session could not be established'));
    }

    logger.info('Sign in successful', { userId: data.user.id });

    return {
      user: mapSupabaseUserToAuthUser(data.user),
      session: data.session,
    };
  } catch (error) {
    console.error('❌ Exception in signIn:', error);
    if (error instanceof AuthError) throw error;
    throw parseAuthError(error);
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    logger.info('Signing out...');

    // Get current user before signing out
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('❌ Sign out error:', error);
      throw parseAuthError(error);
    }

    // Log logout event
    if (user) {
      await logLogout(user.email || '', user.id);
    }

    logger.info('Sign out successful');
  } catch (error) {
    throw parseAuthError(error);
  }
}

/**
 * Get current session
 */
export async function getSession() {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ Get session error:', error);
      return null;
    }

    return data.session;
  } catch (error) {
    console.error('❌ Get session error:', error);
    return null;
  }
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    return mapSupabaseUserToAuthUser(data.user);
  } catch (error) {
    console.error('❌ Get current user error:', error);
    return null;
  }
}

/**
 * Shape returned by {@link getCurrentUserWithMetadata} / {@link mapSupabaseUserToMetadataSnapshot}.
 */
export type SupabaseUserMetadataSnapshot = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  displayName?: string;
  accountStatus?: string;
  emailConfirmed: boolean;
  createdAt: string;
  role?: string;
  invited?: boolean;
};

export function mapSupabaseUserToMetadataSnapshot(user: User): SupabaseUserMetadataSnapshot {
  const metadata = user.user_metadata || {};
  const role = typeof metadata.role === 'string' ? metadata.role : undefined;
  return {
    id: user.id,
    email: user.email || '',
    firstName: metadata.first_name || '',
    lastName: metadata.surname || metadata.firstName || '',
    phoneNumber: metadata.full_phone_number || '',
    displayName: metadata.display_name || '',
    accountStatus: metadata.accountStatus || undefined,
    emailConfirmed: user.email_confirmed_at !== null,
    createdAt: user.created_at || '',
    role,
    invited: metadata.invited === true,
  };
}

/**
 * Get current user with full metadata
 */
export async function getCurrentUserWithMetadata(): Promise<SupabaseUserMetadataSnapshot | null> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    return mapSupabaseUserToMetadataSnapshot(data.user);
  } catch (error) {
    console.error('❌ Get current user with metadata error:', error);
    return null;
  }
}

/**
 * Get user metadata including creation time (returns null if user doesn't exist)
 */
export async function getUserMetadata(email: string): Promise<{
  userId: string;
  createdAt: string;
  emailConfirmed: boolean;
} | null> {
  const supabase = getSupabaseClient();

  try {
    // We can't directly query by email without admin access,
    // so we need to rely on the current session or sign-in attempt
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user || data.user.email !== email) {
      return null;
    }

    return {
      userId: data.user.id,
      createdAt: data.user.created_at || '',
      emailConfirmed: data.user.email_confirmed_at !== null,
    };
  } catch (error) {
    console.error('❌ Get user metadata error:', error);
    return null;
  }
}

/**
 * Check if email is verified
 */
export async function isEmailVerified(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.emailConfirmed || false;
}

/**

/**
 * Send password reset email.
 *
 * Goes through `POST /auth/password-reset` rather than calling
 * `resetPasswordForEmail` here. The old order was: send the mail, THEN tell
 * the server about it — so the server's 3-per-hour limit was counting messages
 * that had already left. The server now applies the limit and sends the mail
 * on the far side of it.
 *
 * The endpoint answers identically whatever happens (unknown address, limit
 * hit, provider error), so there is nothing to branch on and nothing here that
 * could leak whether the account exists.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    const redirectTo = `${window.location.origin}/reset-password`;

    logger.info('Requesting password reset', { email, redirectTo });

    const response = await fetch(`${API_BASE}/auth/password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Public endpoint — `apikey` only, no anon-key bearer. See signIn.
        apikey: publicAnonKey,
      },
      body: JSON.stringify({ email, redirectTo }),
    });

    if (!response.ok) {
      // The route is built to return 200 for every outcome a caller is allowed
      // to distinguish, so a non-200 means the service itself is unhealthy.
      logger.error('Password reset request failed', { status: response.status });
      throw new AuthError(
        'We could not process that request right now. Please try again shortly.',
        'reset_request_failed',
      );
    }

    logger.info('Password reset request accepted');
  } catch (error) {
    if (error instanceof AuthError) throw error;
    console.error('❌ [SEND RESET] Password reset failed:', error);
    throw parseAuthError(error);
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    logger.info('Resending verification email', { email });

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: window.location.origin + AUTH_ROUTES.AUTH_CALLBACK,
      },
    });

    if (error) {
      console.error('❌ Resend verification email error:', error);
      throw parseAuthError(error);
    }

    logger.info('Verification email resent successfully');
  } catch (error) {
    throw parseAuthError(error);
  }
}

/**
 * Update password (for reset flow)
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    logger.info('Attempting to update password...');

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('❌ Password update error:', error);

      // Check if it's a "same password" error
      if (error.message?.includes('same') || error.message?.includes('current')) {
        throw new AuthError(
          'New password cannot be the same as your previous password',
          'same_password',
          error,
        );
      }

      throw parseAuthError(error);
    }

    logger.info('Password updated successfully');

    // End every OTHER session for this account.
    //
    // `updateUser({ password })` rotates the credential and leaves every
    // already-issued token alive until it expires on its own — so a user who
    // changes their password *because* someone else has it does not evict
    // them. `scope: 'others'` revokes the sibling refresh tokens at the
    // identity provider while keeping this tab signed in.
    //
    // Non-fatal on purpose: the password has already changed by this point,
    // and reporting failure would send the user back to retry a change that
    // has already taken effect, using a password that no longer works. The
    // server-side watermark written by `POST /security/:userId/password`
    // (see session-revocation.ts) is the backstop when this call fails.
    try {
      const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' });
      if (revokeError) {
        logger.warn('Could not revoke other sessions after password change', {
          error: revokeError.message,
        });
      } else {
        logger.info('Other sessions revoked after password change');
      }
    } catch (revokeError) {
      logger.warn('Could not revoke other sessions after password change', { error: revokeError });
    }

    // Then take a NEW access token, because the server is about to refuse
    // every token minted before this change — this one included.
    //
    // The server-side watermark (`sessionsValidFrom`, see session-revocation.ts)
    // is set to the moment of the change with no exception for the caller's own
    // token: exempting it would also exempt an attacker who signed in more
    // recently than the victim, which is the exact case the revocation exists
    // for. `scope: 'others'` above deliberately leaves THIS session's refresh
    // token alive so this call can succeed.
    //
    // If it fails the user is signed out and logs back in with the password
    // they just set. That is the right direction to fail.
    try {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        logger.warn('Session refresh after password change failed; sign-in will be required', {
          error: refreshError.message,
        });
      }
    } catch (refreshError) {
      logger.warn('Session refresh after password change threw', { error: refreshError });
    }

    // Log password change
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await logPasswordChange(user.email || '', user.id);
    }
  } catch (error) {
    // Re-throw AuthError instances
    if (error instanceof AuthError) {
      throw error;
    }
    throw parseAuthError(error);
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: AuthCallback) {
  const supabase = getSupabaseClient();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (event, session) => {
    logger.info('Auth state changed', { event });

    if (session?.user) {
      await callback(mapSupabaseUserToAuthUser(session.user), {
        event,
        supabaseUser: session.user,
        accessToken: session.access_token,
      });
    } else {
      await callback(null, { event });
    }
  });

  return subscription;
}

/** Used to bootstrap auth before/without waiting for the subscription's first event. */
export function authUserFromSupabaseUser(supabaseUser: User): AuthUser {
  return mapSupabaseUserToAuthUser(supabaseUser);
}

// Helper Functions

/**
 * Map Supabase user to AuthUser
 */
function mapSupabaseUserToAuthUser(supabaseUser: User): AuthUser {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    emailConfirmed:
      supabaseUser.email_confirmed_at !== null && supabaseUser.email_confirmed_at !== undefined,
    createdAt: supabaseUser.created_at || '',
  };
}
