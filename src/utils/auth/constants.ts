// Authentication Constants

import type { UserRole, AccountStatus } from './types';

export const AUTH_ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  ADMIN: '/admin',
  APPLICATION: '/application',
  APPLICATION_PERSONAL: '/application/personal-client',
  ACCOUNT_TYPE: '/onboarding/choose-account', // Updated path for consistency
  PENDING: '/dashboard/pending',
  DECLINED: '/application/declined',
  VERIFY_EMAIL: '/verify-email',
  RESET_PASSWORD: '/reset-password',
  AUTH_CALLBACK: '/auth/callback',
} as const;

export const AUTH_ERRORS = {
  DUPLICATE_EMAIL: 'This email is already registered. Please sign in instead.',
  INVALID_CREDENTIALS: 'You entered the incorrect username or password.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNKNOWN_ERROR: 'An error occurred. Please try again.',
  NO_USER: 'No user found.',
  EMAIL_NOT_VERIFIED: 'Please verify your email before signing in.',
  PROFILE_LOAD_ERROR: 'Failed to load user profile.',
  UNAUTHORIZED: 'You do not have permission to access this resource.',
} as const;

export const DEFAULT_ACCOUNT_TYPE = 'personal' as const;
export const DEFAULT_APPLICATION_STATUS = 'incomplete' as const; // DEPRECATED
export const DEFAULT_ACCOUNT_STATUS: AccountStatus = 'no_application'; // NEW

// Role-based access control
export const USER_ROLES: Record<string, UserRole> = {
  CLIENT: 'client',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export const DEFAULT_ROLE: UserRole = 'client';

// Super admin email (only user who gets admin role)
export const SUPER_ADMIN_EMAIL = 'shawn@navigatewealth.co';