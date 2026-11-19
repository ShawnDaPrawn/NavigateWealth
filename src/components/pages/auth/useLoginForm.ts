/**
 * useLoginForm — the log-in page's state and sign-in flow, shared by both
 * designs of /login.
 *
 * Moved verbatim out of LoginPage.tsx so the legacy page and the Navigator
 * redesign (src/site/pages/NavigatorLoginPage.tsx) run one copy of it: the
 * same checks, the same calls to authService and the edge function, in the
 * same order, with the same messages. Only how the page looks differs between
 * them. Nothing here may be changed for one design alone.
 *
 * The flow, as before: check the password without installing the session
 * (`authenticateWithPassword`), read the account's security status with the
 * tokens held, refuse closed and suspended accounts, hold the session through
 * the email two-factor challenge, and only then `installSession`. AuthContext
 * hydrates from that, and the effect below sends the user on: to a same-origin
 * `returnUrl` if one was given, otherwise wherever RouteGuards says.
 * LoginPage.twoFactor.test.tsx pins the order.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  authenticateWithPassword,
  discardPendingSession,
  installSession,
  resendVerificationEmail,
  type PendingSession,
} from '../../../utils/auth/authService';
import { AuthError } from '../../../utils/auth/errorHandler';
import { useAuth } from '../../auth/AuthContext';
import { getAuthenticatedRedirectPath } from '../../auth/RouteGuards';
import { safeInternalPath } from '../../../utils/auth/safeRedirect';
import { projectId } from '../../../utils/supabase/info';

export function useLoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  /**
   * A sign-in whose password checked out but whose second factor has not.
   * It is held here, NOT installed in the Supabase client, until the code is
   * verified: installing it starts AuthContext hydration, every API call
   * refuses an unverified session, and AuthContext answers that by signing
   * out — revoking the very session this page is verifying the code with.
   */
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null);
  const [tempUserEmail, setTempUserEmail] = useState<string>('');

  // Get success message from location state (e.g., from email verification)
  const successMessage = location.state?.message;

  // Read returnUrl from query parameters (set by session-expiry redirect)
  const returnUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    // Same-origin paths only. A prefix check let `/\evil.example` through,
    // which the browser resolves to another site — see safeInternalPath.
    return safeInternalPath(params.get('returnUrl'), window.location.origin);
  }, []);

  // Handle redirect when user becomes authenticated
  useEffect(() => {
    // Only automatically redirect if we are NOT in the middle of a login flow
    // (isSubmitting) and NOT showing the 2FA modal.
    if (isAuthenticated && user && !isSubmitting && !show2FAModal) {
      // If a returnUrl was provided (e.g. from session-expiry redirect), use it.
      // Otherwise, use the RouteGuards helper to determine the correct redirect path.
      const redirectPath = returnUrl || getAuthenticatedRedirectPath(user);

      // Perform a hard refresh to ensure the dashboard has the latest UI and data
      window.location.href = redirectPath;
    }
  }, [isAuthenticated, user, navigate, isSubmitting, show2FAModal, returnUrl]);

  const isRedirectingToAuthenticatedArea = isAuthenticated && user && !show2FAModal;

  const handleResendVerification = async () => {
    try {
      setVerificationEmailSent(false);
      await resendVerificationEmail(email);
      setVerificationEmailSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend verification email.';
      setError(msg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerificationEmailSent(false);

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check the password without installing the session yet — see
      // `pendingSession` above for why it waits for the second factor.
      const pending = await authenticateWithPassword(email, password);
      const { userId, accessToken } = pending;

      try {
        const securityResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${userId}/status`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        if (!securityResponse.ok) {
          throw new Error('Security status request failed');
        }
        const securityData = await securityResponse.json();
        if (!securityData.success) {
          throw new Error('Security status response was invalid');
        }

        // -- Account lifecycle gate --
        // A closed (soft-deleted) account never gets a session. All data
        // remains visible to admin.
        if (securityData.status?.deleted) {
          await discardPendingSession(pending);
          setError(
            'Your account has been closed. If you believe this is an error, please contact Navigate Wealth support.',
          );
          return;
        }

        if (securityData.status?.suspended) {
          await discardPendingSession(pending);
          setError(
            'Your account has been suspended. Please contact Navigate Wealth support for assistance.',
          );
          return;
        }

        // The challenge is skipped only if THIS session has already passed it.
        // The server records verification per sign-in and refuses every other
        // API call until this session verifies, so skipping on the account-wide
        // `last2faVerifiedAt` (as this used to) would leave a fresh sign-in
        // stranded — and was the gap that let a second sign-in with a stolen
        // password ride on the owner's code.
        if (
          securityData.status?.twoFactorEnabled &&
          securityData.status?.sessionTwoFactorVerified !== true
        ) {
          const sendCodeResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${userId}/2fa/send-code`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({}),
            },
          );

          if (!sendCodeResponse.ok) {
            throw new Error('Failed to send 2FA code');
          }

          // Hold the session, uninstalled, until handle2FAVerified.
          setPendingSession(pending);
          setTempUserEmail(email);
          setShow2FAModal(true);
          return;
        }

        // 2FA is not enabled — flag this so the dashboard can prompt the user
        if (!securityData.status?.twoFactorEnabled) {
          sessionStorage.setItem('nw_show_2fa_prompt', 'true');
        }
      } catch (twoFAError: unknown) {
        await discardPendingSession(pending);
        throw new Error('Unable to verify account security status. Please try again.', {
          cause: twoFAError,
        });
      }

      // Every check passed: install the session. Don't redirect here — the
      // useEffect above does, once AuthContext has hydrated from it.
      await installSession(pending);
    } catch (error: unknown) {
      // AuthError carries a `code` property for reliable classification
      if (error instanceof AuthError) {
        switch (error.code) {
          case 'rate_limited':
            setError(
              'Too many login attempts. Navigate Wealth has temporarily blocked further attempts for security reasons. Please wait 5-10 minutes before trying again.',
            );
            break;
          case 'email_not_verified':
            setError(
              'Please verify your email address before signing in. Check your inbox for the verification link.',
            );
            break;
          case 'invalid_credentials':
            setError('You entered the incorrect username or password.');
            break;
          case 'network_error':
            setError(
              'Unable to connect to the authentication server. This may be a temporary issue — please wait a moment and try again. If the problem persists, contact support.',
            );
            break;
          default:
            setError(error.message || 'An error occurred. Please try again.');
        }
      } else if (error instanceof Error) {
        // Fallback for non-AuthError exceptions
        console.error('Login error:', error.message);
        setError('An unexpected error occurred. Please try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handle2FAVerified = async () => {
    const verified = pendingSession;
    setShow2FAModal(false);
    setError('');
    setPendingSession(null);
    setTempUserEmail('');
    if (!verified) return;

    // The session has passed its factor, so hydration can now use it. The
    // useEffect above redirects once AuthContext has the user.
    setIsSubmitting(true);
    try {
      await installSession(verified);
    } catch {
      setError(
        'Your code was accepted, but we could not start your session. Please sign in again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handle2FACancel = async () => {
    const abandoned = pendingSession;
    setShow2FAModal(false);
    setPendingSession(null);
    setTempUserEmail('');
    setError('Login cancelled. Two-factor authentication is required.');
    if (abandoned) await discardPendingSession(abandoned);
  };

  /** The two-factor challenge's props, while a held sign-in is waiting on it. */
  const twoFactor =
    show2FAModal && pendingSession
      ? {
          email: tempUserEmail,
          onVerified: handle2FAVerified,
          onCancel: handle2FACancel,
          verifyCode: async (code: string) => {
            const response = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${pendingSession.userId}/2fa/verify-code`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${pendingSession.accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
              },
            );
            const data = await response.json();
            if (!response.ok || !data.success) {
              // If the account was suspended due to too many failures,
              // close the modal and show the suspension error on the login page.
              if (data.suspended) {
                const suspended = pendingSession;
                setShow2FAModal(false);
                setPendingSession(null);
                setTempUserEmail('');
                void discardPendingSession(suspended);
                setError(
                  data.error ||
                    'Your account has been suspended. Please contact Navigate Wealth support.',
                );
                return { success: false, error: '' }; // Error shown on login page, not in modal
              }
              return { success: false, error: data.error || 'Verification failed' };
            }
            return { success: true };
          },
          resendCode: async () => {
            const response = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${pendingSession.userId}/2fa/send-code`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${pendingSession.accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              },
            );
            const data = await response.json();
            if (!response.ok || !data.success) {
              return { success: false, error: data.error || 'Failed to resend code' };
            }
            return { success: true };
          },
        }
      : null;

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    rememberMe,
    setRememberMe,
    isSubmitting,
    error,
    verificationEmailSent,
    successMessage,
    isRedirectingToAuthenticatedArea,
    handleResendVerification,
    handleSubmit,
    twoFactor,
  };
}
