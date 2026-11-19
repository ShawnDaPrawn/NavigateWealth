/**
 * NavigatorVerifyEmailPage — the redesigned "check your email" page
 * (/verify-email), where signup sends a new account to wait for its
 * confirmation link.
 *
 * The layout is the "VerifyEmail" board of the Website Redesign canvas: a
 * standalone page with no site header or footer, as the live route renders it
 * (AppRoutes.tsx: showNavAndFooter={false}). The layout already supplies the
 * page's <main>, so the board's <main> is a <div> here.
 *
 * AUTH IS SAFETY-CRITICAL ON THIS PAGE, so everything that is not drawing is
 * the live page's (VerifyEmailPage.tsx), copied line for line rather than
 * reworked: the same session check (getSupabaseClient().auth.getSession, then
 * getCurrentUser) on the same dependencies, the address from the signed-in
 * user or else from router state, the same two-second hop to /dashboard when
 * the address is already confirmed, the same resendVerificationEmail(email)
 * call with the same guard, states and error strings, and "Back to Sign In"
 * to /login. Nothing here touches AuthContext, profileService or the route
 * guards. The tests render this page and the live one side by side and
 * compare every call.
 *
 * Neither the live page nor the board has a resend cooldown or limit, so
 * there is none here; the server's own rate limit comes back as the error
 * line, as it does on the live page.
 *
 * Like the live page, it sets no SEO tags: the route is kept out of search by
 * the noindex header in vercel.json and the robots.txt Disallow.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import navigateWealthLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import { getCurrentUser, getSupabaseClient, resendVerificationEmail } from '../../utils/auth';
import { logger } from '../../utils/logger';
import { COMPANY } from '../../config/companyFacts';
import { VerifyEmailIcon } from '../sections/VerifyEmailIcons';
import { VerifyEmailPending, type ResendState } from '../sections/VerifyEmailPending';
import { VerifyEmailProgress } from '../sections/VerifyEmailProgress';
import { VerifyEmailVerified } from '../sections/VerifyEmailVerified';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/verify-email.css';

export function NavigatorVerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [success, setSuccess] = useState('');
  const [resendState, setResendState] = useState<ResendState>('idle');
  const [resendError, setResendError] = useState('');

  // The live page's session check, unchanged.
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

  // The live page's resend, unchanged: see VerifyEmailPage.tsx for why this
  // page is the one reliable place to offer it.
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

  const verified = isVerified || Boolean(success);

  return (
    <div className="nw-site nwve">
      <Link to="/" className="nwve-home" aria-label="Navigate Wealth home">
        <img src={navigateWealthLogo} alt="" className="nwve-logo" />
      </Link>

      <VerifyEmailProgress verified={verified} />

      <div className="nwve-card">
        <div className="nwve-card-bar" aria-hidden="true" />
        <div className="nwve-card-body">
          {verified ? (
            <VerifyEmailVerified
              message={success || 'Email verified successfully! Redirecting to dashboard...'}
            />
          ) : (
            <VerifyEmailPending
              email={email}
              resendState={resendState}
              resendError={resendError}
              onResend={handleResend}
              signInHref="/login"
              supportEmail={COMPANY.email}
            />
          )}
        </div>
      </div>

      {!verified && (
        <p className="nw-mono nwve-expiry">
          <VerifyEmailIcon name="clock" size={14} />
          The verification link will expire in 24 hours
        </p>
      )}
      <p className="nw-mono nwve-fsp">Proudly South African · FSP No. {COMPANY.fspNumber}</p>
    </div>
  );
}

export default NavigatorVerifyEmailPage;
