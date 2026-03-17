/**
 * Route Guards — Unit Tests
 *
 * Tests getAuthenticatedRedirectPath and redirect behaviour so that
 * changing roles or account statuses doesn’t break post-login routing.
 *
 * Run: npm test -- src/components/auth/__tests__/RouteGuards.test.ts
 *
 * @module components/auth/__tests__/RouteGuards
 */

import { describe, it, expect } from 'vitest';
import { getAuthenticatedRedirectPath } from '../RouteGuards';

// Minimal user shape used by route guard logic (matches RouteGuardUser)
type TestUser = {
  id?: string;
  role?: string;
  accountStatus?: string;
  applicationStatus?: string;
  [key: string]: unknown;
};

describe('getAuthenticatedRedirectPath', () => {
  describe('when user is null or missing', () => {
    it('returns /dashboard for null', () => {
      expect(getAuthenticatedRedirectPath(null)).toBe('/dashboard');
    });
  });

  describe('admin users', () => {
    it('returns /admin for role admin', () => {
      const user: TestUser = { id: '1', role: 'admin' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/admin');
    });

    it('returns /admin for role super_admin', () => {
      const user: TestUser = { id: '1', role: 'super_admin' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/admin');
    });

    it('ignores accountStatus for admin (always /admin)', () => {
      const user: TestUser = { id: '1', role: 'admin', accountStatus: 'approved' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/admin');
    });
  });

  describe('client users — accountStatus', () => {
    it('returns /onboarding/choose-account for no_application', () => {
      const user: TestUser = { id: '1', role: 'client', accountStatus: 'no_application' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/onboarding/choose-account');
    });

    it('returns /application/personal-client for application_in_progress', () => {
      const user: TestUser = { id: '1', role: 'client', accountStatus: 'application_in_progress' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/application/personal-client');
    });

    it('returns /dashboard/pending for submitted_for_review', () => {
      const user: TestUser = { id: '1', role: 'client', accountStatus: 'submitted_for_review' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/dashboard/pending');
    });

    it('returns /dashboard for approved', () => {
      const user: TestUser = { id: '1', role: 'client', accountStatus: 'approved' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/dashboard');
    });

    it('returns /application/declined for declined', () => {
      const user: TestUser = { id: '1', role: 'client', accountStatus: 'declined' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/application/declined');
    });
  });

  describe('client users — applicationStatus fallback', () => {
    it('uses applicationStatus when accountStatus is missing', () => {
      const user: TestUser = { id: '1', role: 'client', applicationStatus: 'submitted_for_review' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/dashboard/pending');
    });

    it('prefers accountStatus over applicationStatus when both present', () => {
      const user: TestUser = {
        id: '1',
        role: 'client',
        accountStatus: 'approved',
        applicationStatus: 'submitted_for_review',
      };
      expect(getAuthenticatedRedirectPath(user)).toBe('/dashboard');
    });
  });

  describe('client users — unknown or missing status', () => {
    it('returns /dashboard when status is undefined', () => {
      const user: TestUser = { id: '1', role: 'client' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/dashboard');
    });

    it('returns /dashboard when status is empty string', () => {
      const user: TestUser = { id: '1', role: 'client', accountStatus: '' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/dashboard');
    });

    it('returns /dashboard for unknown status value', () => {
      const user: TestUser = { id: '1', role: 'client', accountStatus: 'unknown_status' as string };
      expect(getAuthenticatedRedirectPath(user)).toBe('/dashboard');
    });
  });

  describe('unknown or other roles', () => {
    it('returns /dashboard for role client with no status (default path)', () => {
      const user: TestUser = { id: '1', role: 'client' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/dashboard');
    });

    it('returns /dashboard for unrecognised role', () => {
      const user: TestUser = { id: '1', role: 'adviser' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/dashboard');
    });

    it('returns /dashboard when role is missing', () => {
      const user: TestUser = { id: '1', accountStatus: 'approved' };
      expect(getAuthenticatedRedirectPath(user)).toBe('/dashboard');
    });
  });
});

// Optional: Add component tests for ProtectedRoute, PublicRoute, AdminRoute, etc.
// using @testing-library/react and a mocked useAuth(). Example: render guard with
// MemoryRouter, mock useAuth to return { isAuthenticated, user, isLoading }, then
// expect(screen.getByRole('...') or expect(redirect to path)).
