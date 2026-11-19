/**
 * NavigatorResetPasswordPage — the redesigned /reset-password page.
 *
 * The layout is the "ResetPassword" board of the Website Redesign canvas: a
 * single card under the logo, on its own (the route renders without the site's
 * header and footer, as the board draws it). Everything the page does is the
 * live page's (ResetPasswordPage.tsx), and the logic below is a verbatim copy
 * of it — NavigatorResetPasswordPage.test.tsx fails if the two drift apart:
 *
 *   - the link is read the same way: an `error` / `error_description` in the
 *     hash or query shows the expired card; a PKCE `?code=` is exchanged with
 *     exchangeCodeForSession; implicit-flow `access_token` / `refresh_token`
 *     with type recovery or invite go to setSession; otherwise getSession is
 *     retried at 0, 150, 350 and 600 ms for a session detectSessionInUrl may
 *     already have made; the tokens are then cleared from the address bar;
 *   - an invite (type=invite, router state fromInvite, or user_metadata.invited)
 *     shows the "Set up your account" wording and lands on /admin;
 *   - the password must pass validatePassword and match its confirmation
 *     before the button enables; updatePassword(newPassword) is the one call;
 *   - success redirects after 2 seconds to /login (or /admin for an invite);
 *   - every message is the live page's, errors through getUserErrorMessage.
 *
 * The live page emits no SEO tags (robots.txt and the X-Robots-Tag header keep
 * the route out of search), and neither does this.
 */
import { useNavigate, useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import { updatePassword } from '../../utils/auth/authService';
import { getSupabaseClient } from '../../utils/supabase/client';
import { validatePassword } from '../../utils/auth/passwordValidation';
import { getUserErrorMessage } from '../../utils/errorUtils';
import { COMPANY } from '../../config/companyFacts';
import { ResetPasswordShell } from '../sections/ResetPasswordShell';
import { ResetPasswordVerifying } from '../sections/ResetPasswordVerifying';
import { ResetPasswordExpired } from '../sections/ResetPasswordExpired';
import { ResetPasswordForm } from '../sections/ResetPasswordForm';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/reset-password.css';

const FOOTNOTE = `Proudly South African · FSP No. ${COMPANY.fspNumber}`;

export function NavigatorResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { fromInvite?: boolean } | null;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(locationState?.fromInvite === true);

  const passwordStrength = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  // Verify and establish session from URL (implicit hash, PKCE ?code=, or client auto-detection race)
  useEffect(() => {
    const verifySession = async () => {
      const supabase = getSupabaseClient();

      const hashRaw = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hashRaw);
      const searchParams = new URLSearchParams(window.location.search);
      const pick = (key: string) => hashParams.get(key) ?? searchParams.get(key);

      const urlError = pick('error');
      const errorDescription = pick('error_description');

      try {
        if (urlError) {
          console.warn('[reset-password] URL auth error:', urlError, errorDescription);
          const readable = errorDescription
            ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
            : urlError;
          setError(readable);
          setIsExpired(true);
          setHasValidToken(false);
          return;
        }

        const type = pick('type');
        if (type === 'invite' || locationState?.fromInvite) {
          setIsInviteFlow(true);
        }

        const code = searchParams.get('code');
        /** PKCE (common on newer Supabase) — redirect is /reset-password?code=... */
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (data.session && !error) {
            if (pick('type') === 'invite' || data.session.user.user_metadata?.invited) {
              setIsInviteFlow(true);
            }
            setHasValidToken(true);
            setIsExpired(false);
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }
          console.warn(
            '[reset-password] PKCE exchange failed — will retry via getSession (code may already be consumed)',
            error?.message,
          );
        }

        const accessToken = pick('access_token');
        const refreshToken = pick('refresh_token');

        // Implicit-flow tokens in fragment (legacy)
        if (accessToken && (type === 'recovery' || type === 'invite')) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error || !data.session) {
            setIsExpired(true);
            setHasValidToken(false);
          } else {
            setHasValidToken(true);
            setIsExpired(false);

            if (data.session.user.user_metadata?.invited) {
              setIsInviteFlow(true);
            }

            window.history.replaceState(null, '', window.location.pathname);
          }
          return;
        }

        // Hash already consumed by detectSessionInUrl or exchange ran elsewhere — retry getSession briefly
        let session:
          Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null = null;
        const delays = [0, 150, 350, 600];
        for (const ms of delays) {
          if (ms > 0) {
            await new Promise((r) => setTimeout(r, ms));
          }
          const { data: sessWrap, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) {
            console.warn('[reset-password] getSession:', sessionErr.message);
          }
          if (sessWrap.session) {
            session = sessWrap.session;
            break;
          }
        }

        if (session) {
          setHasValidToken(true);
          setIsExpired(false);
          if (session.user.user_metadata?.invited) {
            setIsInviteFlow(true);
          }
        } else {
          setIsExpired(true);
          setHasValidToken(false);
        }
      } catch (error: unknown) {
        setIsExpired(true);
        setError(getUserErrorMessage(error));
      } finally {
        setIsVerifying(false);
      }
    };

    void verifySession();
  }, [locationState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Check if we have a valid session
    if (!hasValidToken) {
      setError('Auth session missing! Please click the reset link from your email again.');
      return;
    }

    // Validate password
    if (!passwordStrength.isValid) {
      setError('Password does not meet security requirements');
      return;
    }

    // Check passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await updatePassword(newPassword);
      setSuccess(true);

      // Invited personnel → admin panel; regular users → login
      const redirectTarget = isInviteFlow ? '/admin' : '/login';
      setTimeout(() => {
        navigate(redirectTarget);
      }, 2000);
    } catch (error: unknown) {
      setError(getUserErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // End of the live page's logic.

  if (isVerifying) {
    return (
      <ResetPasswordShell footnote={FOOTNOTE}>
        <ResetPasswordVerifying />
      </ResetPasswordShell>
    );
  }

  if (isExpired) {
    return (
      <ResetPasswordShell footnote={FOOTNOTE}>
        <ResetPasswordExpired />
      </ResetPasswordShell>
    );
  }

  return (
    <ResetPasswordShell footnote={FOOTNOTE}>
      <ResetPasswordForm
        invite={isInviteFlow}
        success={success}
        error={error}
        newPassword={newPassword}
        onNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        onConfirmPassword={setConfirmPassword}
        showNew={showNewPassword}
        onToggleNew={() => setShowNewPassword(!showNewPassword)}
        showConfirm={showConfirmPassword}
        onToggleConfirm={() => setShowConfirmPassword(!showConfirmPassword)}
        strength={passwordStrength}
        passwordsMatch={passwordsMatch}
        loading={isLoading}
        submitDisabled={isLoading || !passwordStrength.isValid || !passwordsMatch}
        onSubmit={handleSubmit}
      />
    </ResetPasswordShell>
  );
}

export default NavigatorResetPasswordPage;
