import { Link } from 'react-router';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Mail, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Logo } from '../layout/Logo';
import { useVerifyEmailFlow } from './auth/useVerifyEmailFlow';

export function VerifyEmailPage() {
  // The address lookup, verified redirect and resend live in
  // useVerifyEmailFlow, shared with the Navigator redesign of this page.
  const { email, isVerified, success, resendState, resendError, handleResend, handleBackToSignIn } =
    useVerifyEmailFlow();

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
