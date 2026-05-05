// Authentication Type Definitions

import { Session, User as SupabaseUser } from '@supabase/supabase-js@2.39.3';

// User roles in the system
export type UserRole = 'client' | 'admin' | 'super_admin';

// Account status for application workflow
export type AccountStatus = 
  | 'no_application'           // New user, hasn't started onboarding
  | 'application_in_progress'  // User selected account type, filling application
  | 'submitted_for_review'     // Application submitted, pending admin review
  | 'approved'                 // Application approved, full access granted
  | 'declined';                // Application declined

export interface UserSuspensionStatus {
  suspended: boolean;
  suspendedReason?: string;
  suspendedAt?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
  createdAt: string;
}

export interface AppUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole; // New: Role-based access control
  applicationStatus?: 'pending' | 'approved' | 'incomplete'; // DEPRECATED: Kept for backward compatibility
  accountStatus?: AccountStatus; // NEW: Account status for onboarding workflow
  accountType?: 'personal' | 'business' | 'adviser' | 'broker';
  adviserAssigned?: boolean;
  suspended?: boolean; // Account suspension status
  suspendedReason?: string; // Reason for suspension
  suspendedAt?: string; // When account was suspended
}

export interface UserProfile {
  profileType: string;
  userId: string;
  role?: UserRole; // New: Role field in profile
  accountStatus?: AccountStatus; // NEW: Account status field
  accountType?: string;
  applicationStatus?: string; // DEPRECATED
  adviserAssigned?: boolean;
  personalInformation?: {
    title?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    taxNumber?: string;
    maritalStatus?: string;
    maritalRegime?: string;
    grossIncome?: number;
    netIncome?: number;
    identityDocuments?: unknown[];
  };
  metadata?: {
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  };
}

export interface SignUpResult {
  user: AuthUser | null;
  session: Session | null;
}

export interface SignInResult {
  user: AuthUser | null;
  session: Session | null;
}

/** Second argument carries the Supabase auth event (INITIAL_SESSION, SIGNED_IN, etc.). */
export type AuthCallback = (
  user: AuthUser | null,
  details: { event: string; supabaseUser?: SupabaseUser },
) => void | Promise<void>;