import React, { Suspense } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import { Mail, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { TwoFactorModal } from '../auth/TwoFactorModal';
import { LOGIN_BRAND_FEATURES } from './auth/authConstants';
import { AuthBrandPanel } from './auth/AuthBrandPanel';
import { AuthPaperBackground } from './auth/AuthPaperBackground';
import { AuthTrustBar } from './auth/AuthTrustBar';
import { MobileAuthLayout } from './auth/MobileAuthLayout';
import { AuthModeToggle } from './auth/AuthModeToggle';
import { useLoginForm } from './auth/useLoginForm';
import { PageLoader } from '../ui/page-loader';
import { useIsStandalone } from '../../hooks/useIsStandalone';
import { SITE_DESIGN } from '../../site/design';

const NavigatorLoginPage = React.lazy(() =>
  import('../../site/pages/NavigatorLoginPage').then((m) => ({
    default: m.NavigatorLoginPage,
  })),
);

/**
 * The log-in page. The build's design switch picks the layout; both run the
 * same sign-in flow from useLoginForm, so they check, call and redirect
 * exactly alike. The installed PWA keeps its app shell (MobileAuthLayout)
 * whichever design is live: there is no Navigator board for it.
 */
export function LoginPage() {
  const isStandalone = useIsStandalone();
  if (SITE_DESIGN === 'navigator' && !isStandalone) {
    return (
      <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
        <NavigatorLoginPage />
      </Suspense>
    );
  }
  return <LegacyLoginPage />;
}

function LegacyLoginPage() {
  const isStandalone = useIsStandalone();
  const {
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
  } = useLoginForm();

  // Once auth is confirmed, replace the login form with a transition loader
  // so the dashboard layout doesn't appear above the login screen while the
  // destination route finishes loading.
  if (isRedirectingToAuthenticatedArea) {
    return <PageLoader />;
  }

  const formContent = (
    <>
      {/* Installed PWA: segmented Sign In / Sign Up switch */}
      {isStandalone && <AuthModeToggle active="signin" />}

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-gray-900 text-2xl font-bold">Log in</h2>
        <p className="mt-1.5 text-gray-500 text-sm">Enter your details to access your account.</p>
      </div>

      {successMessage && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {verificationEmailSent && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Mail className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Verification email sent! Please check your inbox.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50" role="alert" aria-live="assertive">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800" id="login-error">
            {error}
            {error.includes('verify your email') && (
              <button
                onClick={handleResendVerification}
                className="ml-2 underline hover:no-underline"
              >
                Resend verification email
              </button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
        aria-describedby={error ? 'login-error' : undefined}
      >
        <div>
          <Label htmlFor="email">
            Email Address <span className="text-purple-600">*</span>
          </Label>
          <div className="mt-1.5">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">
              Password <span className="text-purple-600">*</span>
            </Label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-purple-700 hover:text-purple-800"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              placeholder="••••••••"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              disabled={isSubmitting}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-400"
                >
                  <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                  <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                  <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                  <path d="m2 2 20 20" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-400"
                >
                  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="remember-me"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
          />
          <Label htmlFor="remember-me" className="text-sm text-gray-600 font-normal cursor-pointer">
            Keep me signed in
          </Label>
        </div>

        <Button
          type="submit"
          className="w-full bg-purple-700 hover:bg-purple-800"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                aria-hidden="true"
              ></span>
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Log In
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      {/* New account link */}
      {!isStandalone && (
        <p className="mt-6 text-center text-sm text-gray-500">
          New to Navigate Wealth?{' '}
          <Link to="/signup" className="font-medium text-purple-700 hover:text-purple-800">
            Get started
          </Link>
        </p>
      )}

      {/* Mobile trust bar — in the browser layout the brand panel covers this
          from md up; in the installed PWA there's no brand panel, so keep it. */}
      <AuthTrustBar hideWhenBrandPanelVisible={!isStandalone} />
    </>
  );

  const twoFactorModal = twoFactor ? <TwoFactorModal {...twoFactor} /> : null;

  // Installed PWA: branded, app-like shell around the same form.
  if (isStandalone) {
    return (
      <>
        {twoFactorModal}
        <MobileAuthLayout maxWidthClass="max-w-md">{formContent}</MobileAuthLayout>
      </>
    );
  }

  return (
    <div className="relative overflow-hidden bg-[#f8f9fb] py-8 md:py-12">
      {/* Ask Vasco-style chart-paper backdrop behind the card */}
      <AuthPaperBackground />
      {twoFactorModal}

      {/* Match the navigation bar's content width (logo → Get Started button) */}
      <div className="relative z-10 mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-gray-200/70 md:min-h-[640px] md:grid-cols-2">
          {/* Left Column - Brand panel (tablet and up) */}
          <AuthBrandPanel
            headline="Welcome back to your wealth journey."
            subheadline="Sign in to manage your financial plan, documents and adviser communication."
            features={LOGIN_BRAND_FEATURES}
          />

          {/* Right Column - Form */}
          <div className="flex flex-col justify-center bg-white px-6 py-10 sm:px-10 lg:px-14">
            <div className="mx-auto w-full max-w-md">{formContent}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
