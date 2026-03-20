import React from 'react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
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
  HelpCircle,
} from 'lucide-react';
import { validatePassword, getPasswordStrengthColor, getPasswordStrengthLabel } from '../../utils/auth/passwordValidation';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getUserErrorMessage, isError } from '../../utils/errorUtils';
import { toast } from 'sonner@2.0.3';
import { useLegalDocumentViewer, LegalDocumentDialog } from '../shared/LegalDocumentViewer';
import { SIGNUP_FEATURES } from './auth/authConstants';
import { AuthShowcasePanel } from './auth/AuthShowcasePanel';
import { AuthTrustBar } from './auth/AuthTrustBar';
import { CountryCodeCombobox } from './auth/CountryCodeCombobox';

export function SignupPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+27');
  const [cellphone, setCellphone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLocalhostWarning, setShowLocalhostWarning] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Legal document viewer
  const legalViewer = useLegalDocumentViewer();

  useEffect(() => {
    // Check if we're on localhost and show warning
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      setShowLocalhostWarning(true);
    }
  }, []);

  const passwordStrength = validatePassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate first name
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }

    // Validate surname
    if (!surname.trim()) {
      setError('Please enter your surname');
      return;
    }

    // Validate cellphone
    if (!cellphone.trim()) {
      setError('Please enter your cellphone number');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!passwordStrength.isValid) {
      setError('Password does not meet security requirements. Please check the requirements below.');
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const fullPhoneNumber = `${countryCode}${cellphone}`;
      
      // Call our backend signup endpoint that creates user + application
      
      const endpointUrl = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/auth-signup/signup`;

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          email,
          password,
          firstName: firstName.trim(),
          surname: surname.trim(),
          countryCode,
          phoneNumber: cellphone.trim()
        })
      });

      let result;
      const responseText = await response.text();
      
      try {
        result = JSON.parse(responseText);
      } catch (parseError: unknown) {
        throw new Error(`Server returned non-JSON response: ${responseText.substring(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(result.error || `Server error: ${response.status} ${response.statusText}`);
      }

      if (!result.success || !result.user) {
        throw new Error('Account creation failed. Please try again.');
      }

      // Show success message with application number
      setSuccess(`Account created successfully! Your application number is ${result.application.application_number}. Redirecting to verification...`);
      
      // Redirect to verify email page
      setTimeout(() => {
        navigate('/verify-email', { 
          state: { 
            email,
            message: 'Please verify your email address to continue.' 
          } 
        });
      }, 1500);
      
    } catch (error: unknown) {
      if (isError(error)) {
        // Handle specific errors
        if (error.message.includes('already registered') || 
            error.message.includes('already exists') ||
            error.message.includes('User already registered')) {
          const msg = 'This email is already registered. Please sign in instead or use a different email address.';
          setError(msg);
          toast.error(msg);
        } else if (error.message.includes('password')) {
          const msg = 'Password does not meet requirements. Please try a different password.';
          setError(msg);
          toast.error(msg);
        } else {
          const msg = getUserErrorMessage(error.message);
          setError(msg);
          toast.error(msg);
        }
      } else {
        // Fallback for unknown errors - show the actual message for debugging
        const msg = (error instanceof Error ? error.message : null) || 'Failed to create account. Please try again.';
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const showPasswordHints = passwordFocused || password.length > 0;

  return (
    <div className="flex flex-col lg:flex-row lg:min-h-screen">
      {/* Left Column - Form */}
      <div className="flex-1 flex flex-col justify-start lg:justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-white py-8">
        <div className="mx-auto w-full max-w-xl">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-gray-900 text-2xl font-bold">Create your account</h2>
            <p className="mt-2 text-gray-600 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-purple-700 hover:text-purple-800 font-medium">
                Sign in
              </Link>
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
                <strong>For production:</strong> Ensure Supabase Site URL is set to your production domain.
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50 relative" role="alert" aria-live="assertive">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 pr-8" id="signup-error">{error}</AlertDescription>
              <button
                onClick={() => setError('')}
                className="absolute top-3 right-3 text-red-600 hover:text-red-800 transition-colors"
                aria-label="Close error message"
              >
                <X className="h-4 w-4" />
              </button>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" aria-describedby={error ? 'signup-error' : undefined}>
            {/* ── Section: Personal Details ── */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Personal Details</legend>

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
              <legend className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Create Password</legend>

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
                      <span className={`text-xs font-medium ${getPasswordStrengthColor(passwordStrength.score)}`}>
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
                      <div className={`flex items-center gap-2 ${passwordStrength.requirements.minLength ? 'text-green-700' : 'text-gray-500'}`}>
                        {passwordStrength.requirements.minLength ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                        )}
                        <span>At least 12 characters</span>
                      </div>
                      <div className={`flex items-center gap-2 ${passwordStrength.requirements.characterTypes >= 3 ? 'text-green-700' : 'text-gray-500'}`}>
                        {passwordStrength.requirements.characterTypes >= 3 ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                        )}
                        <span>Mix of uppercase, lowercase, numbers & symbols</span>
                      </div>
                      <div className={`flex items-center gap-2 ${passwordStrength.requirements.notCommon ? 'text-green-700' : 'text-gray-500'}`}>
                        {passwordStrength.requirements.notCommon ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                        )}
                        <span>Not a common password</span>
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
                    aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
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
              disabled={isLoading || !passwordStrength.isValid || !passwordsMatch || !email || !firstName.trim() || !surname.trim() || !cellphone.trim()}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" aria-hidden="true"></span>
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </Button>

            {/* Inline trust signal */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <Lock className="h-3 w-3" />
              <span>FSP 54606 | FSCA Regulated | POPIA Compliant</span>
            </div>
          </form>

          {/* Help Link */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <Link to="/contact" className="text-sm text-purple-700 hover:text-purple-800">
              Need help? Contact our support team
            </Link>
          </div>

          {/* Mobile trust bar */}
          <AuthTrustBar />
        </div>
      </div>

      {/* Right Column - Feature Showcase */}
      <AuthShowcasePanel
        headline="Start your wealth journey today"
        subheadline="Join thousands who trust Navigate Wealth to help them achieve their financial goals."
        features={SIGNUP_FEATURES}
      />

      {/* Legal Document Viewer Modal */}
      <LegalDocumentDialog
        open={legalViewer.viewerOpen}
        onOpenChange={legalViewer.setViewerOpen}
        document={legalViewer.viewerDocument}
        onPrint={legalViewer.handlePrint}
      />
    </div>
  );
}

export default SignupPage;