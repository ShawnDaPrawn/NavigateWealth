// Authentication Error Handling

import { AUTH_ERRORS } from './constants';

export class AuthError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Parse and normalize authentication errors
 */
export function parseAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error;
  }

  const message = (error instanceof Error) ? error.message : 
                 (typeof error === 'object' && error !== null && 'message' in error) ? String((error as Record<string, unknown>).message) :
                 '';
  
  // Check for Supabase rate limiting (this comes BEFORE invalid credentials check)
  if (
    message.includes('Too many') ||
    message.includes('rate') ||
    message.includes('rate_limited') ||
    message.includes('too many login attempts')
  ) {
    return new AuthError(
      'Too many login attempts. Please wait 5-10 minutes before trying again.',
      'rate_limited',
      error
    );
  }
  
  // Check for duplicate email
  if (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('User already registered')
  ) {
    return new AuthError(AUTH_ERRORS.DUPLICATE_EMAIL, 'duplicate_email', error);
  }

  // Check for email not confirmed
  if (
    message.includes('Email not confirmed') ||
    message.includes('email_not_confirmed') ||
    message.includes('email not verified')
  ) {
    return new AuthError(AUTH_ERRORS.EMAIL_NOT_VERIFIED, 'email_not_verified', error);
  }

  // Check for invalid credentials
  if (
    message.includes('Invalid login credentials') ||
    message.includes('invalid password') ||
    message.includes('invalid_grant') ||
    message.includes('Invalid credentials') ||
    message.includes('User not found') ||
    message.includes('user not found') ||
    message.includes('No user found') ||
    message.includes('Email not found')
  ) {
    return new AuthError(AUTH_ERRORS.INVALID_CREDENTIALS, 'invalid_credentials', error);
  }

  // Check for network errors
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('network request failed') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ERR_CONNECTION_REFUSED') ||
    message.includes('Load failed')
  ) {
    return new AuthError(
      'Unable to connect to the authentication server. This may be a temporary server issue — please try again in a moment.',
      'network_error',
      error
    );
  }

  // Default error
  return new AuthError(
    message || AUTH_ERRORS.UNKNOWN_ERROR,
    'unknown_error',
    error
  );
}

/**
 * Get user-friendly error message
 */
export function getUserErrorMessage(errorMessage: string): string {
  const lowerMessage = errorMessage.toLowerCase();
  
  // Invalid credentials
  if (
    lowerMessage.includes('invalid login') ||
    lowerMessage.includes('invalid email or password') ||
    lowerMessage.includes('invalid credentials') ||
    lowerMessage.includes('incorrect credentials') ||
    lowerMessage.includes('user not found') ||
    lowerMessage.includes('email not found') ||
    lowerMessage.includes('no user found')
  ) {
    return 'Incorrect Password or Username';
  }
  
  // Email already exists
  if (
    lowerMessage.includes('already registered') ||
    lowerMessage.includes('already exists') ||
    lowerMessage.includes('duplicate')
  ) {
    return AUTH_ERRORS.DUPLICATE_EMAIL;
  }
  
  // Email not verified
  if (lowerMessage.includes('email not confirmed')) {
    return AUTH_ERRORS.EMAIL_NOT_VERIFIED;
  }
  
  // Rate limiting
  if (lowerMessage.includes('rate') || lowerMessage.includes('too many')) {
    return 'Too many attempts. Please try again later.';
  }
  
  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('connection')
  ) {
    return AUTH_ERRORS.NETWORK_ERROR;
  }
  
  // Default fallback - don't expose raw error messages
  return 'An error occurred. Please try again.';
}