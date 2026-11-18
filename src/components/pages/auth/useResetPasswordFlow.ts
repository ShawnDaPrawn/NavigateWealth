/**
 * useResetPasswordFlow — the reset/invite link check and the new-password
 * submit, without their markup.
 *
 * Extracted verbatim from ResetPasswordPage.tsx so the live page and the
 * Navigator redesign (src/site/pages/NavigatorResetPasswordPage.tsx) establish
 * the recovery session the same way (PKCE `?code=`, implicit-flow tokens, or a
 * short getSession retry when the client already consumed the URL), apply the
 * same password rules and redirect to the same place. The calls below were
 * moved here from the page, not added: only one of the two pages is bundled.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { updatePassword } from '../../../utils/auth/authService';
import { validatePassword } from '../../../utils/auth/passwordValidation';
import { getUserErrorMessage } from '../../../utils/errorUtils';
import { getSupabaseClient } from '../../../utils/supabase/client';

/** Client-side validation messages, and the field each one is about. */
export const RESET_PASSWORD_FIELD_ERRORS = {
  'Password does not meet security requirements': 'newPassword',
  'Passwords do not match': 'confirmPassword',
} as const satisfies Record<string, string>;

export type ResetPasswordField =
  (typeof RESET_PASSWORD_FIELD_ERRORS)[keyof typeof RESET_PASSWORD_FIELD_ERRORS];

export function useResetPasswordFlow() {
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

  const handleSubmit = async (e: FormEvent) => {
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

  const errorField: ResetPasswordField | null =
    (RESET_PASSWORD_FIELD_ERRORS as Record<string, ResetPasswordField>)[error] ?? null;

  return {
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showNewPassword,
    toggleShowNewPassword: () => setShowNewPassword(!showNewPassword),
    showConfirmPassword,
    toggleShowConfirmPassword: () => setShowConfirmPassword(!showConfirmPassword),
    passwordStrength,
    passwordsMatch,
    isLoading,
    error,
    errorField,
    success,
    isVerifying,
    isExpired,
    isInviteFlow,
    /** The submit stays disabled until the rules pass and the passwords match. */
    canSubmit: !(isLoading || !passwordStrength.isValid || !passwordsMatch),
    handleSubmit,
  };
}

export type ResetPasswordFlow = ReturnType<typeof useResetPasswordFlow>;
