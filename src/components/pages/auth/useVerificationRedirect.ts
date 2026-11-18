/**
 * useVerificationRedirect — where the "email verified" screen sends people,
 * and the five-second countdown before it does.
 *
 * Extracted verbatim from VerificationSuccessPage.tsx so the live page and the
 * Navigator redesign (src/site/pages/NavigatorVerificationSuccessPage.tsx)
 * pick the same destination: a signed-in person with an incomplete
 * application goes to /account-type or /application, a signed-in person
 * otherwise to /dashboard, and everyone else to /login.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { logger } from '../../../utils/logger';
import { useAuth } from '../../auth/AuthContext';

/** Seconds before the automatic redirect. */
export const VERIFICATION_REDIRECT_SECONDS = 5;

export function useVerificationRedirect() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [countdown, setCountdown] = useState(VERIFICATION_REDIRECT_SECONDS);

  useEffect(() => {
    // Determine where to redirect based on authentication status
    const getRedirectPath = () => {
      if (isAuthenticated && user) {
        // User is authenticated, redirect to application flow
        if (user.applicationStatus === 'incomplete') {
          return !user.accountType ? '/account-type' : '/application';
        }
        return '/dashboard';
      }
      // User is not authenticated, redirect to login
      return '/login';
    };

    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const redirectPath = getRedirectPath();
          logger.info('Redirecting', { path: redirectPath });
          navigate(redirectPath, { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, isAuthenticated, user]);

  // Determine the call-to-action based on authentication status
  const ctaPath =
    isAuthenticated && user
      ? user.applicationStatus === 'incomplete'
        ? !user.accountType
          ? '/account-type'
          : '/application'
        : '/dashboard'
      : '/login';

  const ctaText = isAuthenticated ? 'Continue to Application' : 'Continue to Login';

  return { countdown, ctaPath, ctaText };
}
