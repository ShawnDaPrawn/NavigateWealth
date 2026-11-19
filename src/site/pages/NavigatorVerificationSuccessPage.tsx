/**
 * NavigatorVerificationSuccessPage — the redesigned "email verified" page
 * (/verification-success), where the confirmation link's callback sends a
 * person who comes back signed in.
 *
 * The layout is the "VerificationSuccess" board of the Website Redesign
 * canvas: a standalone page with no site header or footer, as the live route
 * renders it (AppRoutes.tsx: showNavAndFooter={false}). The layout already
 * supplies the page's <main>, so the board's <main> is a <div> here.
 *
 * AUTH IS SAFETY-CRITICAL ON THIS PAGE, so everything that is not drawing is
 * the live page's (VerificationSuccessPage.tsx), copied line for line rather
 * than reworked: it only reads useAuth(), counts down from five a second at a
 * time, then replaces the history entry with /account-type or /application
 * (signed in, application incomplete, without or with an account type),
 * /dashboard (signed in otherwise) or /login (signed out); "Continue" goes to
 * the same place, labelled "Continue to Application" when signed in and
 * "Continue to Login" when not. Nothing here touches AuthContext,
 * profileService or the route guards. The tests render this page and the live
 * one side by side and compare every redirect.
 *
 * Like the live page, it sets no SEO tags.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import navigateWealthLogo from 'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png';
import { useAuth } from '../../components/auth/AuthContext';
import { logger } from '../../utils/logger';
import { COMPANY } from '../../config/companyFacts';
import { VerificationSuccessCard } from '../sections/VerificationSuccessCard';
import { VerificationSuccessIcon } from '../sections/VerificationSuccessIcons';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/verification-success.css';

/** The live page's countdown starts at five seconds. */
const COUNTDOWN_FROM = 5;

export function NavigatorVerificationSuccessPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);

  // The live page's countdown and redirect, unchanged.
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

  return (
    <div className="nw-site nwvs">
      <Link to="/" className="nwvs-home" aria-label="Navigate Wealth home">
        <img src={navigateWealthLogo} alt="" className="nwvs-logo" />
      </Link>

      <VerificationSuccessCard
        ctaHref={ctaPath}
        ctaText={ctaText}
        countdown={countdown}
        countdownFrom={COUNTDOWN_FROM}
        contactHref="/contact"
      />

      <Link className="nwvs-quiet" to="/">
        <VerificationSuccessIcon name="arrowLeft" size={15} />
        Back to Home
      </Link>
      <p className="nw-mono nwvs-fsp">Proudly South African · FSP No. {COMPANY.fspNumber}</p>
    </div>
  );
}

export default NavigatorVerificationSuccessPage;
