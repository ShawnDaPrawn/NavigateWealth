import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { 
  signIn, 
  resendVerificationEmail 
} from '../../utils/auth/authService';
import { signOut } from '../../utils/auth/authService';
import { AuthError } from '../../utils/auth/errorHandler';
import { useAuth } from '../auth/AuthContext';
import { getAuthenticatedRedirectPath } from '../auth/RouteGuards';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import { Mail, CheckCircle2, XCircle, Lock, HelpCircle } from 'lucide-react';
import { TwoFactorModal } from '../auth/TwoFactorModal';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { LOGIN_FEATURES } from './auth/authConstants';
import { AuthShowcasePanel } from './auth/AuthShowcasePanel';
import { AuthTrustBar } from './auth/AuthTrustBar';
import { PageLoader } from '../ui/page-loader';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [tempUserId, setTempUserId] = useState<string | null>(null);
  const [tempUserEmail, setTempUserEmail] = useState<string>('');
  /** Temporarily held password for re-authentication after 2FA verification */
  const [tempPassword, setTempPassword] = useState<string>('');

  // Get success message from location state (e.g., from email verification)
  const successMessage = location.state?.message;

  // Read returnUrl from query parameters (set by session-expiry redirect)
  const returnUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('returnUrl');
    // Validate: only allow relative paths to prevent open redirect attacks
    if (url && url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    return null;
  }, []);

  // Handle redirect when user becomes authenticated
  useEffect(() => {
    // Only automatically redirect if we are NOT in the middle of a login flow
    // (isLoading) and NOT showing the 2FA modal.
    if (isAuthenticated && user && !isLoading && !show2FAModal) {
      // If a returnUrl was provided (e.g. from session-expiry redirect), use it.
      // Otherwise, use the RouteGuards helper to determine the correct redirect path.
      const redirectPath = returnUrl || getAuthenticatedRedirectPath(user);
      navigate(redirectPath);
    }
  }, [isAuthenticated, user, navigate, isLoading, show2FAModal, returnUrl]);

  const isRedirectingToAuthenticatedArea = isAuthenticated && user && !show2FAModal;

  // Once auth is confirmed, replace the login form with a transition loader
  // so the dashboard layout doesn't appear above the login screen while the
  // destination route finishes loading.
  if (isRedirectingToAuthenticatedArea) {
    return <PageLoader />;
  }

  const handleResendVerification = async () => {
    try {
      setVerificationEmailSent(false);
      await resendVerificationEmail(email);
      setVerificationEmailSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend verification email.';
      setError(msg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerificationEmailSent(false);

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    
    try {
      // Proceed with normal sign in
      const result = await signIn(email, password);
      
      // Check if 2FA is enabled for this user
      if (result.user?.id) {
        
        try {
          const securityResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${result.user.id}/status`,
            {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            }
          );

          if (securityResponse.ok) {
            const securityData = await securityResponse.json();
            
            // -- Account lifecycle gate --
            // If the account is closed (soft-deleted), sign out immediately
            // and inform the user. All data remains visible to admin.
            if (securityData.success && securityData.status?.deleted) {
              await signOut();
              setIsLoading(false);
              setError(
                'Your account has been closed. If you believe this is an error, please contact Navigate Wealth support.'
              );
              return;
            }

            // If the account is suspended, sign out and inform
            if (securityData.success && securityData.status?.suspended) {
              await signOut();
              setIsLoading(false);
              setError(
                'Your account has been suspended. Please contact Navigate Wealth support for assistance.'
              );
              return;
            }

            if (securityData.success && securityData.status?.twoFactorEnabled) {
              
              // ── 3-hour grace period ────────────────────────────────
              // If the user verified 2FA within the last 3 hours, skip
              // the challenge to avoid friction on short-lived sessions.
              const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
              const last2fa = securityData.status?.last2faVerifiedAt;
              if (last2fa) {
                const elapsed = Date.now() - new Date(last2fa).getTime();
                if (elapsed < THREE_HOURS_MS) {
                  // Grace period active — allow login without 2FA
                  setIsLoading(false);
                  return; // useEffect handles redirect
                }
              }

              // ── Sign out immediately ───────────────────────────────
              // The signIn() call above created a session. We must kill
              // it BEFORE showing the 2FA modal so the user cannot
              // access any authenticated routes until the code is
              // verified. Credentials are held in local state so we
              // can re-authenticate after successful verification.
              await signOut();

              // Send 2FA code
              const sendCodeResponse = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${result.user.id}/2fa/send-code`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${publicAnonKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ email: email })
                }
              );

              if (!sendCodeResponse.ok) {
                throw new Error('Failed to send 2FA code');
              }

              // Show 2FA modal — user is signed out at this point
              setTempUserId(result.user.id);
              setTempUserEmail(email);
              setTempPassword(password);
              setShow2FAModal(true);
              setIsLoading(false);
              return; // Don't proceed with login until 2FA is verified
            }

            // 2FA is not enabled — flag this so the dashboard can prompt the user
            if (securityData.success && !securityData.status?.twoFactorEnabled) {
              sessionStorage.setItem('nw_show_2fa_prompt', 'true');
            }
          }
        } catch (twoFAError: unknown) {
          // Continue with login if 2FA check fails (fail open)
          // This is intentional - 2FA check failing should not block login
        }
      }
      
      // Don't redirect here - let the useEffect handle all redirects after user is loaded
      
    } catch (error: unknown) {
      // AuthError carries a `code` property for reliable classification
      if (error instanceof AuthError) {
        switch (error.code) {
          case 'rate_limited':
            setError(
              'Too many login attempts. Navigate Wealth has temporarily blocked further attempts for security reasons. Please wait 5-10 minutes before trying again.'
            );
            break;
          case 'email_not_verified':
            setError(
              'Please verify your email address before signing in. Check your inbox for the verification link.'
            );
            break;
          case 'invalid_credentials':
            setError('You entered the incorrect username or password.');
            break;
          case 'network_error':
            setError(
              'Unable to connect to the authentication server. This may be a temporary issue — please wait a moment and try again. If the problem persists, contact support.'
            );
            break;
          default:
            setError(error.message || 'An error occurred. Please try again.');
        }
      } else if (error instanceof Error) {
        // Fallback for non-AuthError exceptions
        console.error('Login error:', error.message);
        setError('An unexpected error occurred. Please try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerified = async () => {
    setShow2FAModal(false);
    setError('');

    // ── Re-authenticate ──────────────────────────────────────────
    // The user was signed out before the 2FA modal was shown.
    // Now that the code has been verified, re-create the session
    // using the stored credentials.
    if (tempUserEmail && tempPassword) {
      try {
        setIsLoading(true);
        await signIn(tempUserEmail, tempPassword);
        // Session is now active — the useEffect will detect
        // isAuthenticated and redirect to the dashboard.
      } catch (reAuthError: unknown) {
        console.error('Re-authentication after 2FA failed:', reAuthError);
        setError(
          'Your identity was verified, but we could not complete sign-in. Please try logging in again.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    // Clear temporary credentials
    setTempUserId(null);
    setTempUserEmail('');
    setTempPassword('');
  };

  const handle2FACancel = async () => {
    setShow2FAModal(false);
    setTempUserId(null);
    setTempUserEmail('');
    setTempPassword('');
    
    // User was already signed out before the modal was shown,
    // so no need to sign out again — just inform them.
    setError('Login cancelled. Two-factor authentication is required.');
  };

  return (
    <div className="flex flex-col lg:flex-row lg:min-h-screen">
      {/* 2FA Modal */}
      {show2FAModal && tempUserId && (
        <TwoFactorModal
          email={tempUserEmail}
          onVerified={handle2FAVerified}
          onCancel={handle2FACancel}
          verifyCode={async (code: string) => {
            const response = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${tempUserId}/2fa/verify-code`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${publicAnonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
              }
            );
            const data = await response.json();
            if (!response.ok || !data.success) {
              // If the account was suspended due to too many failures,
              // close the modal and show the suspension error on the login page.
              if (data.suspended) {
                setShow2FAModal(false);
                setTempUserId(null);
                setTempUserEmail('');
                setTempPassword('');
                setError(data.error || 'Your account has been suspended. Please contact Navigate Wealth support.');
                return { success: false, error: '' }; // Error shown on login page, not in modal
              }
              return { success: false, error: data.error || 'Verification failed' };
            }
            return { success: true };
          }}
          resendCode={async () => {
            const response = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/security/${tempUserId}/2fa/send-code`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${publicAnonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: tempUserEmail }),
              }
            );
            const data = await response.json();
            if (!response.ok || !data.success) {
              return { success: false, error: data.error || 'Failed to resend code' };
            }
            return { success: true };
          }}
        />
      )}

      {/* Left Column - Form */}
      <div className="flex-1 flex flex-col justify-start lg:justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-white py-8">
        <div className="mx-auto w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-gray-900 text-2xl font-bold">Welcome back</h2>
            <p className="mt-2 text-gray-600 text-sm">
              Don't have an account?{' '}
              <Link to="/signup" className="text-purple-700 hover:text-purple-800 font-medium">
                Sign up
              </Link>
            </p>
          </div>

          {successMessage && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {successMessage}
              </AlertDescription>
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

          <form onSubmit={handleSubmit} className="space-y-5" aria-describedby={error ? 'login-error' : undefined}>
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

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-purple-700 hover:text-purple-800"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
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
                Remember me
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-purple-700 hover:bg-purple-800"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" aria-hidden="true"></span>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </Button>

            {/* Inline trust signal */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <Lock className="h-3 w-3" />
              <span>FSP 54606 | FSCA Regulated | 256-bit encryption</span>
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
        headline="Your wealth journey continues"
        subheadline="Access your personalised financial dashboard and continue building your future."
        features={LOGIN_FEATURES}
      />
    </div>
  );
}

export default LoginPage;
