/**
 * NavigatorSignupPage — the redesigned sign-up page.
 *
 * The layout is the "Signup" board of the Website Redesign canvas (and its
 * phone view, "MobileSignup"). Account creation itself is the live page's,
 * unchanged: SignupPage.tsx and this page both run useSignupForm, so the
 * field checks, the password rules, the POST to /auth-signup/signup, the
 * messages and the hand-off to /verify-email are one piece of code. The Terms
 * of Service and Privacy Policy open in the live page's document viewer.
 *
 * Like the live page it emits no SEO tags: /signup is kept out of search by
 * robots.txt and the noindex header (vercel.json), not by the page.
 */
import { SIGNUP_BRAND_FEATURES } from '../../components/pages/auth/authConstants';
import { useSignupForm } from '../../components/pages/auth/useSignupForm';
import {
  LegalDocumentDialog,
  useLegalDocumentViewer,
} from '../../components/shared/LegalDocumentViewer';
import { LoginCard } from '../sections/LoginCard';
import { SignupForm } from '../sections/SignupForm';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/login.css';
import '../styles/signup.css';

export function NavigatorSignupPage() {
  const form = useSignupForm();
  const legalViewer = useLegalDocumentViewer();

  return (
    <>
      <div className="nw-site nwli nwsu">
        <LoginCard
          headline="Start your wealth journey today."
          lead="Create your account to begin your personalised financial plan with Navigate Wealth."
          features={SIGNUP_BRAND_FEATURES}
          variant="signup"
        >
          <SignupForm
            form={form}
            openDocument={legalViewer.openDocument}
            loadingSlug={legalViewer.loadingSlug}
          />
        </LoginCard>
      </div>
      <LegalDocumentDialog
        open={legalViewer.viewerOpen}
        onOpenChange={legalViewer.setViewerOpen}
        document={legalViewer.viewerDocument}
      />
    </>
  );
}

export default NavigatorSignupPage;
