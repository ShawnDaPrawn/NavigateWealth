/**
 * Route Guards for Navigate Wealth
 * Comprehensive route protection based on user role and account status
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import { PageLoader } from '../ui/page-loader';

// ============================================================================
// TYPES
// ============================================================================

export type AccountStatus = 
  | 'no_application' 
  | 'application_in_progress' 
  | 'submitted_for_review' 
  | 'approved' 
  | 'declined';

export type UserRole = 'admin' | 'client';

/** Minimal user shape required by route guard logic */
interface RouteGuardUser {
  id?: string;
  role?: string;
  accountStatus?: string;
  applicationStatus?: string;
  [key: string]: unknown;
}

// Helper function to check if user has admin privileges
function isAdminUser(user: RouteGuardUser): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get redirect path based on user role and account status
 */
export function getAuthenticatedRedirectPath(user: RouteGuardUser | null): string {
  if (!user) return '/dashboard';
  
  // Admin users always go to /admin
  if (isAdminUser(user)) {
    return '/admin';
  }
  
  // Client users: route based on accountStatus
  if (user.role === 'client') {
    const status = user.accountStatus || user.applicationStatus;
    
    switch (status) {
      case 'no_application':
        return '/onboarding/choose-account';
      case 'application_in_progress':
        return '/application/personal-client';
      case 'submitted_for_review':
        return '/dashboard/pending';
      case 'approved':
        return '/dashboard';
      case 'declined':
        return '/application/declined';
      default:
        return '/dashboard';
    }
  }
  
  return '/dashboard';
}

/**
 * Check if user can access a route based on their status
 */
function canAccessRoute(
  user: RouteGuardUser | null, 
  requiredStatus: AccountStatus | AccountStatus[] | 'any',
  allowAdmin: boolean = false
): boolean {
  if (!user) return false;
  
  // Admins can access if allowAdmin is true
  if (allowAdmin && isAdminUser(user)) {
    return true;
  }
  
  // Get current status
  const currentStatus: AccountStatus = user.accountStatus || user.applicationStatus || 'no_application';
  
  // If 'any' authenticated user can access
  if (requiredStatus === 'any') {
    return true;
  }
  
  // Check if current status matches required status
  if (Array.isArray(requiredStatus)) {
    return requiredStatus.includes(currentStatus);
  }
  
  return currentStatus === requiredStatus;
}

// ============================================================================
// ROUTE GUARD COMPONENTS
// ============================================================================

/**
 * ProtectedRoute - Requires authentication only
 * Use for routes that any authenticated user can access
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (!isAuthenticated) {
    console.log('🔒 ProtectedRoute: Not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <div className="contents">{children}</div>;
}

/**
 * PublicRoute - Redirects authenticated users to appropriate location
 * Use for login/signup pages
 */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (isAuthenticated) {
    const redirectPath = getAuthenticatedRedirectPath(user);
    console.log('🔄 PublicRoute: Already authenticated, redirecting to', redirectPath);
    return <Navigate to={redirectPath} replace />;
  }
  
  return <div className="contents">{children}</div>;
}

/**
 * FlexibleRoute - Accessible to both authenticated and public users
 * Use for marketing pages, contact, etc.
 */
export function FlexibleRoute({ children }: { children: React.ReactNode }) {
  return <div className="contents">{children}</div>;
}

/**
 * AdminRoute - Requires admin role
 * Use for admin dashboard and admin-only features
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  console.log('🔒 AdminRoute check:', { 
    isAuthenticated, 
    userRole: user?.role,
    email: user?.email,
  });
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (!isAuthenticated) {
    console.log('❌ AdminRoute: Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  if (!isAdminUser(user)) {
    console.log('❌ AdminRoute: Not an admin, redirecting to appropriate location');
    const redirectPath = getAuthenticatedRedirectPath(user);
    return <Navigate to={redirectPath} replace />;
  }
  
  console.log('✅ AdminRoute: Admin access granted');
  return <div className="contents">{children}</div>;
}

/**
 * DashboardRoute - Requires approved status (or admin)
 * Use for full dashboard access (approved clients only)
 */
export function DashboardRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  console.log('🔒 DashboardRoute check:', {
    isAuthenticated,
    role: user?.role,
    accountStatus: user?.accountStatus || user?.applicationStatus,
  });
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (!isAuthenticated) {
    console.log('❌ DashboardRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }
  
  // Admin users can always access dashboard
  if (isAdminUser(user)) {
    console.log('✅ DashboardRoute: Admin access granted');
    return <div className="contents">{children}</div>;
  }
  
  // Client users: check accountStatus
  const status = user?.accountStatus || user?.applicationStatus;
  
  // Only allow dashboard access if approved
  if (status === 'approved') {
    console.log('✅ DashboardRoute: Approved client access granted');
    return <div className="contents">{children}</div>;
  }
  
  // Otherwise redirect to appropriate page
  console.log('❌ DashboardRoute: Not approved, redirecting based on status:', status);
  const redirectPath = getAuthenticatedRedirectPath(user);
  return <Navigate to={redirectPath} replace />;
}

/**
 * OnboardingRoute - For account type selection
 * Only accessible if user has no_application status
 */
export function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  console.log('🔒 OnboardingRoute check:', {
    isAuthenticated,
    accountStatus: user?.accountStatus || user?.applicationStatus,
  });
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (!isAuthenticated) {
    console.log('❌ OnboardingRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }
  
  const status = user?.accountStatus || user?.applicationStatus;
  
  // Only allow if status is no_application
  if (status === 'no_application' || !status) {
    console.log('✅ OnboardingRoute: Access granted');
    return <div className="contents">{children}</div>;
  }
  
  // If they already have an application, redirect to appropriate location
  console.log('❌ OnboardingRoute: Already has application, redirecting');
  const redirectPath = getAuthenticatedRedirectPath(user);
  return <Navigate to={redirectPath} replace />;
}

/**
 * ApplicationRoute - For filling out the application
 * Only accessible if user has application_in_progress status
 */
export function ApplicationRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  console.log('🔒 ApplicationRoute check:', {
    isAuthenticated,
    accountStatus: user?.accountStatus || user?.applicationStatus,
  });
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (!isAuthenticated) {
    console.log('❌ ApplicationRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }
  
  const status = user?.accountStatus || user?.applicationStatus;
  
  // Allow access if application is in progress OR declined (can resubmit)
  if (status === 'application_in_progress' || status === 'declined') {
    console.log('✅ ApplicationRoute: Access granted (status:', status, ')');
    return <div className="contents">{children}</div>;
  }
  
  // If no application yet, redirect to onboarding
  if (status === 'no_application' || !status) {
    console.log('❌ ApplicationRoute: No application started, redirecting to onboarding');
    return <Navigate to="/onboarding/choose-account" replace />;
  }
  
  // Otherwise redirect to appropriate location
  console.log('❌ ApplicationRoute: Cannot access, redirecting based on status:', status);
  const redirectPath = getAuthenticatedRedirectPath(user);
  return <Navigate to={redirectPath} replace />;
}

/**
 * PendingRoute - For users awaiting review
 * Only accessible if user has submitted_for_review status
 */
export function PendingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  console.log('🔒 PendingRoute check:', {
    isAuthenticated,
    accountStatus: user?.accountStatus || user?.applicationStatus,
  });
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (!isAuthenticated) {
    console.log('❌ PendingRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }
  
  const status = user?.accountStatus || user?.applicationStatus;
  
  // Only allow if status is submitted_for_review
  if (status === 'submitted_for_review') {
    console.log('✅ PendingRoute: Access granted');
    return <div className="contents">{children}</div>;
  }
  
  // Otherwise redirect to appropriate location
  console.log('❌ PendingRoute: Not in review, redirecting based on status:', status);
  const redirectPath = getAuthenticatedRedirectPath(user);
  return <Navigate to={redirectPath} replace />;
}

/**
 * DeclinedRoute - For users with declined applications
 * Only accessible if user has declined status
 */
export function DeclinedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  console.log('🔒 DeclinedRoute check:', {
    isAuthenticated,
    accountStatus: user?.accountStatus || user?.applicationStatus,
  });
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (!isAuthenticated) {
    console.log('❌ DeclinedRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }
  
  const status = user?.accountStatus || user?.applicationStatus;
  
  // Only allow if status is declined
  if (status === 'declined') {
    console.log('✅ DeclinedRoute: Access granted');
    return <div className="contents">{children}</div>;
  }
  
  // Otherwise redirect to appropriate location
  console.log('❌ DeclinedRoute: Not declined, redirecting based on status:', status);
  const redirectPath = getAuthenticatedRedirectPath(user);
  return <Navigate to={redirectPath} replace />;
}

/**
 * StatusBasedRoute - Generic guard for specific status requirements
 * Use when you need custom status logic
 */
export function StatusBasedRoute({ 
  children,
  requiredStatus,
  allowAdmin = false,
}: { 
  children: React.ReactNode;
  requiredStatus: AccountStatus | AccountStatus[] | 'any';
  allowAdmin?: boolean;
}) {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  console.log('🔒 StatusBasedRoute check:', {
    isAuthenticated,
    requiredStatus,
    currentStatus: user?.accountStatus || user?.applicationStatus,
    allowAdmin,
  });
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (!isAuthenticated) {
    console.log('❌ StatusBasedRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }
  
  if (canAccessRoute(user, requiredStatus, allowAdmin)) {
    console.log('✅ StatusBasedRoute: Access granted');
    return <div className="contents">{children}</div>;
  }
  
  // Redirect to appropriate location based on status
  console.log('❌ StatusBasedRoute: Access denied, redirecting');
  const redirectPath = getAuthenticatedRedirectPath(user);
  return <Navigate to={redirectPath} replace />;
}