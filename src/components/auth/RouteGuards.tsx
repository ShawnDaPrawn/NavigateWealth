/**
 * Route Guards for Navigate Wealth
 * Comprehensive route protection based on user role and account status
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import { PageLoader } from '../ui/page-loader';
import { logger } from '../../utils/logger';

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

/** Minimal user shape required by route guard logic. No index signature, so
 *  the concrete AppUser interface (which has no index signature) is assignable. */
interface RouteGuardUser {
  id?: string;
  role?: string;
  accountStatus?: string;
  applicationStatus?: string;
}

// Helper function to check if user has admin privileges
function isAdminUser(user: RouteGuardUser | null): boolean {
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
  allowAdmin: boolean = false,
): boolean {
  if (!user) return false;

  // Admins can access if allowAdmin is true
  if (allowAdmin && isAdminUser(user)) {
    return true;
  }

  // Get current status
  const currentStatus = (user.accountStatus ||
    user.applicationStatus ||
    'no_application') as AccountStatus;

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
    logger.info('ProtectedRoute: Not authenticated, redirecting to login');
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
    logger.info('PublicRoute: Already authenticated, redirecting', { redirectPath });
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

  logger.debug('AdminRoute check', {
    isAuthenticated,
    userRole: user?.role,
    email: user?.email,
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    logger.info('AdminRoute: Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (!isAdminUser(user)) {
    logger.info('AdminRoute: Not an admin, redirecting to appropriate location');
    const redirectPath = getAuthenticatedRedirectPath(user);
    return <Navigate to={redirectPath} replace />;
  }

  logger.info('AdminRoute: Admin access granted');
  return <div className="contents">{children}</div>;
}

/**
 * DashboardRoute - Requires approved status (or admin)
 * Use for full dashboard access (approved clients only)
 */
export function DashboardRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();

  logger.debug('DashboardRoute check', {
    isAuthenticated,
    role: user?.role,
    accountStatus: user?.accountStatus || user?.applicationStatus,
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    logger.info('DashboardRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }

  // Admin users can always access dashboard
  if (isAdminUser(user)) {
    logger.info('DashboardRoute: Admin access granted');
    return <div className="contents">{children}</div>;
  }

  // Client users: check accountStatus
  const status = user?.accountStatus || user?.applicationStatus;

  // Only allow dashboard access if approved
  if (status === 'approved') {
    logger.info('DashboardRoute: Approved client access granted');
    return <div className="contents">{children}</div>;
  }

  // Otherwise redirect to appropriate page
  logger.info('DashboardRoute: Not approved, redirecting based on status', { status });
  const redirectPath = getAuthenticatedRedirectPath(user);
  return <Navigate to={redirectPath} replace />;
}

/**
 * OnboardingRoute - For account type selection
 * Only accessible if user has no_application status
 */
export function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();

  logger.debug('OnboardingRoute check', {
    isAuthenticated,
    accountStatus: user?.accountStatus || user?.applicationStatus,
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    logger.info('OnboardingRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }

  const status = user?.accountStatus || user?.applicationStatus;

  // Only allow if status is no_application
  if (status === 'no_application' || !status) {
    logger.info('OnboardingRoute: Access granted');
    return <div className="contents">{children}</div>;
  }

  // If they already have an application, redirect to appropriate location
  logger.info('OnboardingRoute: Already has application, redirecting');
  const redirectPath = getAuthenticatedRedirectPath(user);
  return <Navigate to={redirectPath} replace />;
}

/**
 * ApplicationRoute - For filling out the application
 * Only accessible if user has application_in_progress status
 */
export function ApplicationRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();

  logger.debug('ApplicationRoute check', {
    isAuthenticated,
    accountStatus: user?.accountStatus || user?.applicationStatus,
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    logger.info('ApplicationRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }

  const status = user?.accountStatus || user?.applicationStatus;

  // Allow access if application is in progress OR declined (can resubmit)
  if (status === 'application_in_progress' || status === 'declined') {
    logger.info('ApplicationRoute: Access granted', { status });
    return <div className="contents">{children}</div>;
  }

  // If no application yet, redirect to onboarding
  if (status === 'no_application' || !status) {
    logger.info('ApplicationRoute: No application started, redirecting to onboarding');
    return <Navigate to="/onboarding/choose-account" replace />;
  }

  // Otherwise redirect to appropriate location
  logger.info('ApplicationRoute: Cannot access, redirecting based on status', { status });
  const redirectPath = getAuthenticatedRedirectPath(user);
  return <Navigate to={redirectPath} replace />;
}

/**
 * PendingRoute - For users awaiting review
 * Only accessible if user has submitted_for_review status
 */
export function PendingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();

  logger.debug('PendingRoute check', {
    isAuthenticated,
    accountStatus: user?.accountStatus || user?.applicationStatus,
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    logger.info('PendingRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }

  const status = user?.accountStatus || user?.applicationStatus;

  // Only allow if status is submitted_for_review
  if (status === 'submitted_for_review') {
    logger.info('PendingRoute: Access granted');
    return <div className="contents">{children}</div>;
  }

  // Otherwise redirect to appropriate location
  logger.info('PendingRoute: Not in review, redirecting based on status', { status });
  const redirectPath = getAuthenticatedRedirectPath(user);
  return <Navigate to={redirectPath} replace />;
}

/**
 * DeclinedRoute - For users with declined applications
 * Only accessible if user has declined status
 */
export function DeclinedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();

  logger.debug('DeclinedRoute check', {
    isAuthenticated,
    accountStatus: user?.accountStatus || user?.applicationStatus,
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    logger.info('DeclinedRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }

  const status = user?.accountStatus || user?.applicationStatus;

  // Only allow if status is declined
  if (status === 'declined') {
    logger.info('DeclinedRoute: Access granted');
    return <div className="contents">{children}</div>;
  }

  // Otherwise redirect to appropriate location
  logger.info('DeclinedRoute: Not declined, redirecting based on status', { status });
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

  logger.debug('StatusBasedRoute check', {
    isAuthenticated,
    requiredStatus,
    currentStatus: user?.accountStatus || user?.applicationStatus,
    allowAdmin,
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    logger.info('StatusBasedRoute: Not authenticated');
    return <Navigate to="/login" replace />;
  }

  if (canAccessRoute(user, requiredStatus, allowAdmin)) {
    logger.info('StatusBasedRoute: Access granted');
    return <div className="contents">{children}</div>;
  }

  // Redirect to appropriate location based on status
  logger.info('StatusBasedRoute: Access denied, redirecting');
  const redirectPath = getAuthenticatedRedirectPath(user);
  return <Navigate to={redirectPath} replace />;
}
