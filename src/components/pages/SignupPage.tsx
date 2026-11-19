import React, { Suspense } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import {
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  User,
  Phone,
  Lock,
  ArrowRight,
} from 'lucide-react';
import {
  getPasswordStrengthColor,
  getPasswordStrengthLabel,
} from '../../utils/auth/passwordValidation';
import { useLegalDocumentViewer, LegalDocumentDialog } from '../shared/LegalDocumentViewer';
import { SIGNUP_BRAND_FEATURES } from './auth/authConstants';
import { AuthBrandPanel } from './auth/AuthBrandPanel';
import { AuthPaperBackground } from './auth/AuthPaperBackground';
import { AuthTrustBar } from './auth/AuthTrustBar';
import { MobileAuthLayout } from './auth/MobileAuthLayout';
import { AuthModeToggle } from './auth/AuthModeToggle';
import { useIsStandalone } from '../../hooks/useIsStandalone';
import { CountryCodeCombobox } from './auth/CountryCodeCombobox';
import { useSignupForm } from './auth/useSignupForm';
import { SITE_DESIGN } from '../../site/design';

const NavigatorSignupPage = React.lazy(() =>
  import('../../site/pages/NavigatorSignupPage').then((m) => ({
    default: m.NavigatorSignupPage,
  })),
);

/**
 * The sign-up page. The build's design switch picks the layout; both create
 * the account through useSignupForm, so they validate, send and hand off to
 * /verify-email exactly alike. The installed PWA keeps its app shell
 * (MobileAuthLayout) whichever design is live: there is no Navigator board
 * for it.
 */
export function SignupPage() {
  const isStandalone = useIsStandalone();
  if (SITE_DESIGN === 'navigator' && !isStandalone) {
    return (
      <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
        <NavigatorSignupPage />
      </Suspense>
    );
  }
  return <LegacySignupPage />;
}

function LegacySignupPage() {
  const isStandalone = useIsStandalone();
  const {
    firstName,
    setFirstName,
    surname,
    setSurname,
    email,
    setEmail,
    countryCode,
    setCountryCode,
    cellphone,
    setCellphone,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isLoading,
    error,
    setError,
    success,
    showLocalhostWarning,
    setPasswordFocused,
    passwordStrength,
    passwordsMatch,
    handleSubmit,
    showPasswordHints,
    submitDisabled,
  } = useSignupForm();

  // Legal document viewer
  const legalViewer = useLegalDocumentViewer();

  const formContent = (
    <>
      {/* Installed PWA: segmented Sign In / Sign Up switch */}
      {isStandalone && <AuthModeToggle active="signup" />}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-gray-900 text-2xl font-bold">Create your account</h2>
        <p className="mt-1.5 text-gray-500 text-sm">
          Enter your details to start your wealth journey.
        </p>
      </div>

      {showLocalhostWarning && (
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Development Mode Detected</strong>
            <br />
            You're testing on localhost. Verification emails may redirect to localhost.
            <br />
            <strong>For production:</strong> Ensure Supabase Site URL is set to your production
            domain.
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert
          className="mb-6 border-red-200 bg-red-50 relative"
          role="alert"
          aria-live="assertive"
        >
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 pr-8" id="signup-error">
            {error}
          </AlertDescription>
          <button
            onClick={() => setError('')}
            className="absolute top-3 right-3 text-red-600 hover:text-red-800 transition-colors"
            aria-label="Close error message"
          >
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
        aria-describedby={error ? 'signup-error' : undefined}
      >
        {/* ── Section: Personal Details ── */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Personal Details
          </legend>

          {/* Name Fields - Side by Side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="pl-10"
                  placeholder="John"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="surname">Surname</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="surname"
                  name="surname"
                  type="text"
                  required
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="pl-10"
                  placeholder="Doe"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Email Field */}
          <div>
            <Label htmlFor="email">Email Address</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Cellphone Field */}
          <div>
            <Label htmlFor="cellphone">Cellphone Number</Label>
            <div className="flex gap-2 mt-1">
              <CountryCodeCombobox
                value={countryCode}
                onValueChange={setCountryCode}
                disabled={isLoading}
              />
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="cellphone"
                  name="cellphone"
                  type="tel"
                  required
                  value={cellphone}
                  onChange={(e) => setCellphone(e.target.value)}
                  className="pl-10"
                  placeholder="82 123 4567"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </fieldset>

        {/* ── Section: Security ── */}
        <fieldset className="space-y-4 pt-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Create Password
          </legend>

          {/* Password Field */}
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                className="pl-10 pr-10"
                placeholder="Create a strong password"
                disabled={isLoading}
                aria-describedby="password-requirements"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {showPasswordHints && (
              <div className="mt-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Password Strength</span>
                  <span
                    className={`text-xs font-medium ${getPasswordStrengthColor(passwordStrength.score)}`}
                  >
                    {getPasswordStrengthLabel(passwordStrength.score)}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      passwordStrength.score === 0 || passwordStrength.score === 1
                        ? 'bg-red-500'
                        : passwordStrength.score === 2
                          ? 'bg-orange-500'
                          : passwordStrength.score === 3
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                    }`}
                    style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                  />
                </div>

                {/* Password Requirements */}
                <div className="text-xs space-y-1" id="password-requirements">
                  <div
                    className={`flex items-center gap-2 ${passwordStrength.requirements.minLength ? 'text-green-700' : 'text-gray-500'}`}
                  >
                    {passwordStrength.requirements.minLength ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                    )}
                    <span>At least 12 characters</span>
                  </div>
                  <div
                    className={`flex items-center gap-2 ${passwordStrength.requirements.characterTypes >= 3 ? 'text-green-700' : 'text-gray-500'}`}
                  >
                    {passwordStrength.requirements.characterTypes >= 3 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                    )}
                    <span>Mix of uppercase, lowercase, numbers & symbols</span>
                  </div>
                  <div
                    className={`flex items-center gap-2 ${passwordStrength.requirements.notCommon && passwordStrength.requirements.notPredictable ? 'text-green-700' : 'text-gray-500'}`}
                  >
                    {passwordStrength.requirements.notCommon &&
                    passwordStrength.requirements.notPredictable ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                    )}
                    <span>Not a common or predictable password</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10"
                placeholder="Re-enter your password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                disabled={isLoading}
                aria-label={
                  showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <div className="mt-1.5 flex items-center gap-2">
                {passwordsMatch ? (
                  <div className="contents">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-xs text-green-600">Passwords match</span>
                  </div>
                ) : (
                  <div className="contents">
                    <XCircle className="h-3.5 w-3.5 text-red-600" />
                    <span className="text-xs text-red-600">Passwords do not match</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </fieldset>

        {/* Terms Notice */}
        <div className="text-xs text-gray-500 leading-relaxed">
          By creating an account, you agree to Navigate Wealth's{' '}
          <button
            type="button"
            onClick={() => legalViewer.openDocument('terms-of-use')}
            className="text-purple-600 hover:text-purple-700 hover:underline underline-offset-2 cursor-pointer font-medium transition-colors duration-150"
            disabled={legalViewer.loadingSlug === 'terms-of-use'}
          >
            {legalViewer.loadingSlug === 'terms-of-use' ? 'Loading...' : 'Terms of Service'}
          </button>{' '}
          and{' '}
          <button
            type="button"
            onClick={() => legalViewer.openDocument('privacy-notice')}
            className="text-purple-600 hover:text-purple-700 hover:underline underline-offset-2 cursor-pointer font-medium transition-colors duration-150"
            disabled={legalViewer.loadingSlug === 'privacy-notice'}
          >
            {legalViewer.loadingSlug === 'privacy-notice' ? 'Loading...' : 'Privacy Policy'}
          </button>
          . Your data is protected under POPIA.
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full bg-purple-700 hover:bg-purple-800"
          disabled={submitDisabled}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                aria-hidden="true"
              ></span>
              Creating account...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Create account
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      {/* Existing account link */}
      {!isStandalone && (
        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-purple-700 hover:text-purple-800">
            Sign in
          </Link>
        </p>
      )}

      {/* Mobile trust bar — in the browser layout the brand panel covers this
          from md up; in the installed PWA there's no brand panel, so keep it. */}
      <AuthTrustBar hideWhenBrandPanelVisible={!isStandalone} />
    </>
  );

  // Legal document viewer modal (rendered alongside both layouts)
  const legalDialog = (
    <LegalDocumentDialog
      open={legalViewer.viewerOpen}
      onOpenChange={legalViewer.setViewerOpen}
      document={legalViewer.viewerDocument}
    />
  );

  // Installed PWA: branded, app-like shell around the same form.
  if (isStandalone) {
    return (
      <>
        <MobileAuthLayout maxWidthClass="max-w-md">{formContent}</MobileAuthLayout>
        {legalDialog}
      </>
    );
  }

  return (
    <div className="relative overflow-hidden bg-[#f8f9fb] py-8 md:py-12">
      {/* Ask Vasco-style chart-paper backdrop behind the card */}
      <AuthPaperBackground />
      {/* Match the navigation bar's content width (logo → Get Started button) */}
      <div className="relative z-10 mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-gray-200/70 md:min-h-[640px] md:grid-cols-2">
          {/* Left Column - Brand panel (tablet and up) */}
          <AuthBrandPanel
            headline="Start your wealth journey today."
            subheadline="Create your account to begin your personalised financial plan with Navigate Wealth."
            features={SIGNUP_BRAND_FEATURES}
          />

          {/* Right Column - Form */}
          <div className="flex flex-col justify-center bg-white px-6 py-10 sm:px-10 lg:px-14">
            <div className="mx-auto w-full max-w-md">{formContent}</div>
          </div>
        </div>
      </div>

      {legalDialog}
    </div>
  );
}

export default SignupPage;
