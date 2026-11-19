/**
 * NavigatorLoginPage — the redesigned log-in page.
 *
 * The layout is the "Login" board of the Website Redesign canvas. The sign-in
 * itself is the live page's, unchanged: LoginPage.tsx and this page both run
 * useLoginForm, so the password check, the account-status gate, the email
 * two-factor challenge, the session install, the `returnUrl` redirect (same
 * origin only) and every message are one piece of code. The challenge is the
 * live TwoFactorModal; the board does not draw it.
 *
 * Like the live page it emits no SEO tags: /login is kept out of search by
 * robots.txt and the noindex header (vercel.json), not by the page.
 */
import { LOGIN_BRAND_FEATURES } from '../../components/pages/auth/authConstants';
import { useLoginForm } from '../../components/pages/auth/useLoginForm';
import { TwoFactorModal } from '../../components/auth/TwoFactorModal';
import { PageLoader } from '../../components/ui/page-loader';
import { LoginCard } from '../sections/LoginCard';
import { LoginForm } from '../sections/LoginForm';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/login.css';

export function NavigatorLoginPage() {
  const form = useLoginForm();

  // As on the live page: once signed in, a loader holds the screen while the
  // browser goes to the destination.
  if (form.isRedirectingToAuthenticatedArea) {
    return <PageLoader />;
  }

  return (
    <>
      {form.twoFactor ? <TwoFactorModal {...form.twoFactor} /> : null}
      <div className="nw-site nwli">
        <LoginCard
          headline="Welcome back to your wealth journey."
          lead="Sign in to manage your financial plan, documents and adviser communication."
          features={LOGIN_BRAND_FEATURES}
        >
          <LoginForm form={form} />
        </LoginCard>
      </div>
    </>
  );
}

export default NavigatorLoginPage;
