import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Mail, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';
import { getCurrentUser, getSupabaseClient, resendVerificationEmail } from '../../utils/auth';
import { Logo } from '../layout/Logo';
import { logger } from '../../utils/logger';

export function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [success, setSuccess] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resendError, setResendError] = useState('');

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

  /**
   * Resend the confirmation link.
   *
   * This page is the ONLY reliable place to offer it. Signup now creates an
   * unconfirmed account (auth-signup.ts), so the confirmation mail is what
   * unlocks sign-in — and if that first send fails, the person lands here
   * looking at "check your email" for a mail that never left.
   *
   * LoginPage.tsx also has a resend button, but it is rendered only when the
   * sign-in error text contains "verify your email", which requires Supabase to
   * answer `Email not confirmed`. For an account created through
   * `admin.createUser` it can instead answer `Invalid login credentials` —
   * errorHandler.ts maps that to invalid_credentials, and the button never
   * appears. Recovery cannot depend on that classification, so it lives here,
   * where the email address is already known and no error parsing is involved.
   */
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

  const handleBackToSignIn = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <Link to="/" className="flex justify-center mb-8">
          <Logo />
        </Link>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-12">
          {isVerified || success ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <AlertDescription className="text-green-800">
                {success || 'Email verified successfully! Redirecting to dashboard...'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="contents">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="flex items-center justify-center h-20 w-20 rounded-full bg-purple-100">
                  <Mail className="h-10 w-10 text-purple-700" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-center text-gray-900 mb-3">Check Your Email</h2>

              {/* Description */}
              <p className="text-center text-gray-600 mb-2">We've sent a verification link to</p>
              <p className="text-center text-purple-700 mb-8 break-all px-4">
                {email || 'your email address'}
              </p>

              {/* Instructions */}
              <div className="bg-gray-50 rounded-xl p-6 mb-8">
                <p className="text-sm text-gray-700 text-center">
                  Click the verification link in your email to complete your registration.
                  <br />
                  <span className="text-gray-500 mt-2 block">
                    Don't forget to check your spam folder if you don't see it.
                  </span>
                </p>
              </div>

              {/* Resend — the recovery path when the first send failed */}
              {resendState === 'sent' ? (
                <Alert className="mb-4 border-green-200 bg-green-50">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Verification email sent. Check your inbox, and your spam folder.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  onClick={handleResend}
                  disabled={resendState === 'sending'}
                  className="w-full mb-3"
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${resendState === 'sending' ? 'animate-spin' : ''}`}
                  />
                  {resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
                </Button>
              )}

              {resendError && (
                <Alert className="mb-4 border-red-200 bg-red-50" role="alert">
                  <AlertDescription className="text-red-800">{resendError}</AlertDescription>
                </Alert>
              )}

              {/* Back to Sign In Button */}
              <Button
                onClick={handleBackToSignIn}
                variant="outline"
                className="w-full group hover:bg-purple-50 border-purple-200"
              >
                <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Back to Sign In
              </Button>

              {/* Help Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600 text-center">
                  Need help?{' '}
                  <a
                    href="mailto:info@navigatewealth.co"
                    className="text-purple-700 hover:text-purple-800 underline"
                  >
                    Contact support
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        {!isVerified && !success && (
          <p className="text-center text-sm text-gray-500 mt-6">
            The verification link will expire in 24 hours
          </p>
        )}
      </div>
    </div>
  );
}

export default VerifyEmailPage;
