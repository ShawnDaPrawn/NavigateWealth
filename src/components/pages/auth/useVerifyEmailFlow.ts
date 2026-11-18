/**
 * useVerifyEmailFlow — the "check your email" screen's logic without its
 * markup: which address the link went to, the already-verified redirect, and
 * the resend that is the recovery path when the first send failed.
 *
 * Extracted verbatim from VerifyEmailPage.tsx so the live page and the
 * Navigator redesign (src/site/pages/NavigatorVerifyEmailPage.tsx) run one
 * implementation. The session read below was moved here from the page, not
 * added: only one of the two pages is ever bundled.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getCurrentUser, getSupabaseClient, resendVerificationEmail } from '../../../utils/auth';
import { logger } from '../../../utils/logger';

export type ResendState = 'idle' | 'sending' | 'sent';

export function useVerifyEmailFlow() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [success, setSuccess] = useState('');
  const [resendState, setResendState] = useState<ResendState>('idle');
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    // Get email from location state or current user
    const checkAuthStatus = async () => {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          const user = await getCurrentUser();

          if (user) {
            setEmail(user.email);
            setIsVerified(user.emailConfirmed);

            // If already verified, redirect to dashboard
            if (user.emailConfirmed) {
              logger.info('Email already verified, redirecting to dashboard');
              setSuccess('Email already verified! Redirecting to dashboard...');
              setTimeout(() => {
                navigate('/dashboard');
              }, 2000);
            }
          }
        } else {
          // No session - use email from location state if provided
          if (location.state?.email) {
            setEmail(location.state.email);
          }
        }
      } catch (err) {
        console.error('Error checking auth status:', err);
      }
    };

    checkAuthStatus();
  }, [location, navigate]);

  /**
   * Resend the confirmation link.
   *
   * This page is the ONLY reliable place to offer it. Signup now creates an
   * unconfirmed account (auth-signup.ts), so the confirmation mail is what
   * unlocks sign-in — and if that first send fails, the person lands here
   * looking at "check your email" for a mail that never left.
   *
   * LoginPage.tsx also has a resend button, but it is rendered only when the
   * sign-in error text contains "verify your email", which requires Supabase to
   * answer `Email not confirmed`. For an account created through
   * `admin.createUser` it can instead answer `Invalid login credentials` —
   * errorHandler.ts maps that to invalid_credentials, and the button never
   * appears. Recovery cannot depend on that classification, so it lives here,
   * where the email address is already known and no error parsing is involved.
   */
  const handleResend = async () => {
    if (!email) {
      setResendError('Enter your email on the sign-in page to resend the link.');
      return;
    }
    setResendError('');
    setResendState('sending');
    try {
      await resendVerificationEmail(email);
      setResendState('sent');
    } catch (err: unknown) {
      setResendState('idle');
      setResendError(
        err instanceof Error ? err.message : 'Could not resend the verification email.',
      );
    }
  };

  const handleBackToSignIn = () => {
    navigate('/login');
  };

  return {
    email,
    isVerified,
    success,
    resendState,
    resendError,
    handleResend,
    handleBackToSignIn,
  };
}
