// Authentication Service - Core Supabase auth operations

import { getSupabaseClient } from '../supabase/client';
import { User } from '@supabase/supabase-js@2.39.3';
import { AuthUser, SignUpResult, SignInResult, AuthCallback } from './types';
import { AuthError, parseAuthError } from './errorHandler';
import { AUTH_ERRORS, AUTH_ROUTES } from './constants';
import { projectId, publicAnonKey } from '../supabase/info';
import { 
  validateSignupData, 
  validateLoginAttempt, 
  logLoginSuccess, 
  logLoginFailure,
  logLogout,
  logPasswordResetRequest,
  logPasswordChange 
} from './securityService';

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
  }
): Promise<SignUpResult> {
  try {
    console.log('🔐 Starting signup process...', { email });
    
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
    console.log('📤 Calling backend signup endpoint...');
    const response = await fetch(`${API_BASE}/auth-signup/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
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

    const data = await response.json();
    console.log('✅ Backend signup successful:', data);

    // Return success - user needs to verify email before they can sign in
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
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
 * Sign in existing user with email and password
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const supabase = getSupabaseClient();
  
  try {
    console.log('🔐 Starting sign in process...', { email });
    
    // Check rate limiting and validate on server (fails open if server unavailable)
    const validation = await validateLoginAttempt(email);
    
    if (!validation.allowed) {
      const errorMsg = validation.error || 'Too many login attempts. Please try again later.';
      await logLoginFailure(email, errorMsg);
      throw new AuthError(errorMsg, 'rate_limited');
    }
    
    console.log('✅ Rate limit check passed, attempting Supabase authentication...');
    
    // Attempt Supabase authentication with retry for transient network errors
    let lastError: unknown = null;
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('❌ Sign in error:', error);
          console.error('   Error name:', error.name);
          console.error('   Error message:', error.message);
          console.error('   Error status:', error.status);
          
          // Check if it's a Supabase rate limit error (status 429)
          if (error.status === 429 || error.message.includes('Too many')) {
            console.error('⚠️ Supabase rate limit detected - user has been temporarily blocked');
            await logLoginFailure(email, 'Supabase rate limit');
            throw new AuthError(
              'Too many login attempts. Please wait 5-10 minutes before trying again.',
              'rate_limited',
              error
            );
          }
          
          // WORKAROUND: unconfirmed-email-login-fix
          // Legacy users created with email_confirm:false get "Invalid login credentials"
          // from Supabase. Attempt to auto-confirm their email server-side and retry once.
          if (
            error.status === 400 &&
            error.message.includes('Invalid login credentials') &&
            attempt === 0
          ) {
            console.log('⚠️ Invalid credentials — checking if email needs confirmation...');
            try {
              const confirmRes = await fetch(`${API_BASE}/auth/confirm-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${publicAnonKey}`,
                },
                body: JSON.stringify({ email }),
              });
              const confirmData = await confirmRes.json();
              if (confirmData.confirmed && !confirmData.alreadyConfirmed) {
                console.log('✅ Email auto-confirmed, retrying sign in...');
                continue; // retry the sign-in loop
              }
            } catch (confirmErr) {
              console.warn('⚠️ Email confirmation check failed (non-blocking):', confirmErr);
            }
          }
          
          await logLoginFailure(email, error.message);
          throw parseAuthError(error);
        }

        if (!data.user) {
          console.error('❌ No user returned from Supabase');
          await logLoginFailure(email, 'No user returned');
          throw new AuthError(AUTH_ERRORS.INVALID_CREDENTIALS, 'invalid_credentials');
        }
        
        console.log('✅ Supabase authentication successful');
        console.log('   User ID:', data.user.id);
        console.log('   Email:', data.user.email);
        console.log('   Email verified:', data.user.email_confirmed_at ? 'Yes' : 'No');

        console.log('✅ Sign in successful:', data.user.id);
        
        // Log successful login (non-blocking)
        logLoginSuccess(email, data.user.id).catch(() => {});

        return {
          user: mapSupabaseUserToAuthUser(data.user),
          session: data.session,
        };
      } catch (retryError) {
        lastError = retryError;
        
        // Only retry on network errors (TypeError: Failed to fetch), not on auth errors
        const isNetworkError = retryError instanceof TypeError && 
          (retryError.message.includes('Failed to fetch') || retryError.message.includes('Load failed'));
        
        if (isNetworkError && attempt < maxRetries) {
          console.log(`⚠️ Network error on auth attempt ${attempt + 1}, retrying in ${(attempt + 1) * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
          continue;
        }
        
        // Not a retryable error or retries exhausted — throw
        throw retryError;
      }
    }
    
    // Should not reach here, but just in case
    throw lastError || new AuthError('Authentication failed after retries', 'auth_failed');
  } catch (error) {
    console.error('❌ Exception in signIn:', error);
    throw parseAuthError(error);
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  
  try {
    console.log('🔐 Signing out...');
    
    // Get current user before signing out
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('❌ Sign out error:', error);
      throw parseAuthError(error);
    }
    
    // Log logout event
    if (user) {
      await logLogout(user.email || '', user.id);
    }

    console.log('✅ Sign out successful');
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
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  try {
    // Build the redirect URL - ensure it matches EXACTLY what's in Supabase dashboard
    const currentOrigin = window.location.origin;
    const redirectUrl = `${currentOrigin}/reset-password`;
    
    console.log('🔐 [SEND RESET] Starting password reset email process...');
    console.log('🔐 [SEND RESET] Email:', email);
    console.log('🔐 [SEND RESET] Current origin:', currentOrigin);
    console.log('🔐 [SEND RESET] Redirect URL:', redirectUrl);
    console.log('');
    console.log('⚠️  CRITICAL: Add this EXACT URL to Supabase Dashboard:');
    console.log('   Go to: Authentication → URL Configuration → Redirect URLs');
    console.log('   Add:', redirectUrl);
    console.log('   Also add (as backup):', `${currentOrigin}/**`);
    console.log('');
    
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    console.log('🔐 [SEND RESET] Supabase response:', { data, error });

    if (error) {
      console.error('❌ [SEND RESET] Password reset email error:', error);
      console.error('❌ [SEND RESET] Error details:', {
        message: error.message,
        status: error.status,
        name: error.name
      });
      throw parseAuthError(error);
    }

    console.log('✅ [SEND RESET] Password reset email request completed successfully');
    console.log('⚠️ [SEND RESET] Note: Supabase always returns success even if email does not exist (security feature)');
    console.log('📧 [SEND RESET] If email exists in database, user should receive email from Supabase');
    
    // Log password reset request
    await logPasswordResetRequest(email);
  } catch (error) {
    console.error('❌ [SEND RESET] Password reset failed (catch block):', error);
    throw parseAuthError(error);
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  try {
    console.log('📧 Resending verification email to:', email);
    
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

    console.log('✅ Verification email resent successfully');
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
    console.log('🔄 Attempting to update password...');
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('❌ Password update error:', error);
      
      // Check if it's a "same password" error
      if (error.message?.includes('same') || error.message?.includes('current')) {
        throw new AuthError('New password cannot be the same as your previous password', 'same_password', error);
      }
      
      throw parseAuthError(error);
    }

    console.log('✅ Password updated successfully');
    
    // Log password change
    const { data: { user } } = await supabase.auth.getUser();
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
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      console.log('🔐 Auth state changed:', event);
      
      if (session?.user) {
        await callback(mapSupabaseUserToAuthUser(session.user), {
          event,
          supabaseUser: session.user,
        });
      } else {
        await callback(null, { event });
      }
    }
  );

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
    emailConfirmed: supabaseUser.email_confirmed_at !== null && supabaseUser.email_confirmed_at !== undefined,
    createdAt: supabaseUser.created_at || '',
  };
}