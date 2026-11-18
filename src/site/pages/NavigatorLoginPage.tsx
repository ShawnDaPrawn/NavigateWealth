/**
 * NavigatorLoginPage — /login in the Navigator design.
 *
 * Presentation only. The sign-in itself — password check, account lifecycle
 * gate (closed / suspended), the per-session two-factor challenge, the
 * rate-limit and lockout messages, the returnUrl redirect — is useLoginFlow,
 * the same hook the live LoginPage runs, so both designs make identical auth
 * calls in the same order. The two-factor step reuses the live TwoFactorModal.
 *
 * In the installed app (PWA) the page renders in the app frame with the
 * Sign In / Sign Up switch, as the live page does.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { TwoFactorModal } from '../../components/auth/TwoFactorModal';
import { LOGIN_BRAND_FEATURES } from '../../components/pages/auth/authConstants';
import { useLoginFlow, type LoginFlow } from '../../components/pages/auth/useLoginFlow';
import { PageLoader } from '../../components/ui/page-loader';
import { useIsStandalone } from '../../hooks/useIsStandalone';
import { AccountAlert } from '../account/AccountAlert';
import { AccountBrandPanel, BrandFeatureList } from '../account/AccountBrandPanel';
import { AccountField, PasswordInput } from '../account/AccountField';
import {
  AccountAppShell,
  AccountModeSwitch,
  AccountSplit,
  AccountTrustLine,
} from '../account/AccountLayout';
import { describedBy, fieldErrorId, useFocusOnInvalid } from '../account/accountUi';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/account.css';

const PAGE_CLASS = 'nwx-login';
const IDS = {
  email: 'nwac-login-email',
  password: 'nwac-login-password',
  remember: 'nwac-login-remember',
  error: 'nwac-login-error',
} as const;

function LoginForm({ flow, isStandalone }: { flow: LoginFlow; isStandalone: boolean }) {
  const [attempt, setAttempt] = useState(0);
  useFocusOnInvalid(attempt, flow.errorField ? IDS[flow.errorField] : null);

  const onSubmit = (e: FormEvent) => {
    setAttempt((n) => n + 1);
    void flow.handleSubmit(e);
  };

  // Validation messages sit under their field; everything else (wrong
  // password, lockout, suspended account…) is a form-level alert.
  const emailError = flow.errorField === 'email' ? flow.error : null;
  const passwordError = flow.errorField === 'password' ? flow.error : null;
  const formError = flow.error && !flow.errorField ? flow.error : '';

  return (
    <div className="nwac-form">
      {isStandalone ? <AccountModeSwitch active="signin" /> : null}

      <div className="nwac-head">
        <h1 className="nwac-title">Log in to Navigate Wealth</h1>
        <p className="nwac-sub">Enter your details to access your account.</p>
      </div>

      {flow.successMessage ? (
        <AccountAlert tone="success">{flow.successMessage}</AccountAlert>
      ) : null}

      {flow.verificationEmailSent ? (
        <AccountAlert tone="success">
          Verification email sent! Please check your inbox.
        </AccountAlert>
      ) : null}

      {formError ? (
        <AccountAlert tone="error" id={IDS.error}>
          {formError}
          {flow.canResendVerification ? (
            <>
              {' '}
              <button
                type="button"
                className="nwac-linkbtn"
                onClick={flow.handleResendVerification}
              >
                Resend verification email
              </button>
            </>
          ) : null}
        </AccountAlert>
      ) : null}

      <form
        className="nwac-fields"
        onSubmit={onSubmit}
        noValidate
        aria-label="Log in"
        aria-describedby={formError ? IDS.error : undefined}
      >
        <AccountField htmlFor={IDS.email} label="Email Address" error={emailError}>
          <input
            id={IDS.email}
            name="email"
            type="email"
            className="nwac-input"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={flow.email}
            onChange={(e) => flow.setEmail(e.target.value)}
            placeholder="your.email@example.com"
            disabled={flow.isSubmitting}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={describedBy(emailError && fieldErrorId(IDS.email))}
          />
        </AccountField>

        <AccountField
          htmlFor={IDS.password}
          label="Password"
          error={passwordError}
          aside={
            <Link to="/forgot-password" className="nwac-link nwac-forgot">
              Forgot<span className="nw-sr-only"> your password</span>?
            </Link>
          }
        >
          <PasswordInput
            id={IDS.password}
            name="password"
            autoComplete="current-password"
            required
            value={flow.password}
            onChange={(e) => flow.setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={flow.isSubmitting}
            shown={flow.showPassword}
            onToggle={flow.toggleShowPassword}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={describedBy(passwordError && fieldErrorId(IDS.password))}
          />
        </AccountField>

        <label className="nwac-check" htmlFor={IDS.remember}>
          <input
            id={IDS.remember}
            type="checkbox"
            checked={flow.rememberMe}
            onChange={(e) => flow.setRememberMe(e.target.checked)}
          />
          Keep me signed in
        </label>

        <button
          type="submit"
          className="nw-btn nwac-submit"
          disabled={flow.isSubmitting}
          aria-busy={flow.isSubmitting || undefined}
        >
          {flow.isSubmitting ? (
            <>
              <span className="nwac-spin" aria-hidden="true" />
              Signing in...
            </>
          ) : (
            <>
              Log In
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      {isStandalone ? null : (
        <p className="nwac-alt">
          New to Navigate Wealth?{' '}
          <Link to="/signup" className="nwac-link">
            Get started
          </Link>
        </p>
      )}

      <AccountTrustLine always={isStandalone} />
    </div>
  );
}

export function NavigatorLoginPage() {
  const isStandalone = useIsStandalone();
  const flow = useLoginFlow();

  // Signed in: hand over to the destination with the same transition loader
  // the live page shows, rather than flashing the form.
  if (flow.isRedirecting) return <PageLoader />;

  const challenge = flow.twoFactorChallenge;
  const twoFactorModal = challenge ? (
    <TwoFactorModal
      email={challenge.email}
      onVerified={challenge.onVerified}
      onCancel={challenge.onCancel}
      verifyCode={challenge.verifyCode}
      resendCode={challenge.resendCode}
    />
  ) : null;

  const form = <LoginForm flow={flow} isStandalone={isStandalone} />;

  if (isStandalone) {
    return (
      <>
        {twoFactorModal}
        <AccountAppShell pageClass={PAGE_CLASS}>{form}</AccountAppShell>
      </>
    );
  }

  return (
    <>
      {twoFactorModal}
      <AccountSplit
        pageClass={PAGE_CLASS}
        brand={
          <AccountBrandPanel
            heading="Welcome back to your wealth journey."
            lead="Sign in to manage your financial plan, documents and adviser communication."
          >
            <BrandFeatureList items={LOGIN_BRAND_FEATURES} />
          </AccountBrandPanel>
        }
      >
        {form}
      </AccountSplit>
    </>
  );
}
